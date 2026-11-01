import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from "./supabase";
import type {
  EnrichYoutubeResponse,
  ExportRequest,
  RunStatus,
} from "./api-types";

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

function friendly(status: number, code: string | undefined, serverMsg: string): string {
  const detail = serverMsg ? ` (${serverMsg})` : "";
  switch (code) {
    case "quota_exceeded":
      return `Đã hết hạn mức API hôm nay — thử lại sau khi quota được đặt lại hoặc nhờ admin tăng hạn mức${detail}.`;
    case "too_many_runs":
      return `Bạn đang có quá nhiều lượt chạy đồng thời. Đợi lượt trước xong rồi thử lại${detail}.`;
    case "not_configured":
      return `Server chưa được cấu hình đầy đủ (thiếu khoá API)${detail}.`;
    case "upstream_error":
      return `Dịch vụ bên ngoài trả lỗi${detail}.`;
    case "unauthorized":
      return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
    case "forbidden":
      return `Bạn không có quyền thực hiện thao tác này${detail}.`;
    case "bad_request":
      return `Dữ liệu gửi lên không hợp lệ${detail}.`;
  }
  if (status === 429) return `Vượt giới hạn (429)${detail}.`;
  if (status === 401) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  if (status === 403) return `Bạn không có quyền thực hiện thao tác này${detail}.`;
  if (status >= 500) return `Lỗi server (${status})${detail}.`;
  return serverMsg || `Lỗi ${status}`;
}

async function errorFromResponse(res: Response): Promise<ApiError> {
  let msg = "";
  let code: string | undefined;
  try {
    const j = (await res.clone().json()) as { error?: string; code?: string };
    msg = j.error ?? "";
    code = j.code;
  } catch {
    try {
      msg = (await res.text()).slice(0, 300);
    } catch {
      /* bỏ qua */
    }
  }
  return new ApiError(friendly(res.status, code, msg), res.status, code);
}

/** Gọi một Edge Function, trả về dữ liệu JSON hoặc ném ApiError có thông báo tiếng Việt. */
export async function callFn<TRes, TReq = unknown>(name: string, body: TReq): Promise<TRes> {
  const { data, error } = await supabase.functions.invoke(name, { body: body as Record<string, unknown> });
  if (error) {
    if (error instanceof FunctionsHttpError && error.context instanceof Response) {
      throw await errorFromResponse(error.context);
    }
    if (error instanceof FunctionsRelayError) {
      throw new ApiError(`Không gọi được function "${name}" (relay): ${error.message}`, 502);
    }
    if (error instanceof FunctionsFetchError) {
      throw new ApiError(`Không kết nối được tới function "${name}". Kiểm tra mạng hoặc function đã được deploy chưa.`, 0);
    }
    throw new ApiError(error.message ?? String(error), 0);
  }
  return data as TRes;
}

function parseFilename(cd: string | null): string | null {
  if (!cd) return null;
  const star = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(cd);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim());
    } catch {
      /* bỏ qua */
    }
  }
  const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(cd);
  return plain ? plain[1].trim() : null;
}

/** Export qua fetch trực tiếp (không dùng invoke) để giữ nguyên byte, BOM và tên file. */
export async function downloadExport(req: ExportRequest): Promise<{ filename: string; rows: number | null }> {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) throw new ApiError("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", 401, "unauthorized");
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/export`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(req),
    });
  } catch {
    throw new ApiError("Không kết nối được tới function export.", 0);
  }
  if (!res.ok) throw await errorFromResponse(res);
  const blob = await res.blob();
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const filename =
    parseFilename(res.headers.get("Content-Disposition"))?.replace(/[\\/:*?"<>|]/g, "_") ??
    `sync-leads-${today}.${req.format}`;
  const rowsHeader = res.headers.get("X-Row-Count");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return { filename, rows: rowsHeader !== null && rowsHeader !== "" ? Number(rowsHeader) : null };
}

// ---------------------------------------------------------------------------
// Chạy function theo lô (profile, enrich_youtube, enrich_contact).
// ---------------------------------------------------------------------------
export type BatchFn = "profile" | "enrich_youtube" | "enrich_contact";

export interface BatchProgress {
  done: number;
  total: number;
  calls: number;
}

export interface BatchResult<R> {
  responses: R[];
  done: number;
  total: number;
  stoppedReason: "quota" | "cancelled" | "stalled" | null;
  error: string | null;
  runIds: string[];
}

interface BatchLike {
  run_id?: string;
  remaining_ids?: string[];
  status?: RunStatus;
  stopped_reason?: EnrichYoutubeResponse["stopped_reason"];
}

/**
 * Gửi company_ids theo lô (kích thước batchSize), gửi lại remaining_ids cho tới khi hết.
 * Dừng khi có lỗi, khi hết quota YouTube, khi bị huỷ, hoặc khi 3 lần liên tiếp không tiến triển.
 */
export async function runBatched<R extends BatchLike>(
  fn: BatchFn,
  ids: string[],
  batchSize: number,
  onProgress?: (p: BatchProgress) => void,
  isCancelled?: () => boolean,
): Promise<BatchResult<R>> {
  const size = Math.max(1, Math.floor(batchSize) || 5);
  let queue = [...new Set(ids)];
  const total = queue.length;
  const responses: R[] = [];
  const runIds: string[] = [];
  let done = 0;
  let calls = 0;
  let stalls = 0;
  onProgress?.({ done, total, calls });

  while (queue.length > 0) {
    if (isCancelled?.()) return { responses, done, total, stoppedReason: "cancelled", error: null, runIds };
    const chunk = queue.slice(0, size);
    let res: R;
    try {
      res = await callFn<R>(fn, { company_ids: chunk });
    } catch (e) {
      return {
        responses,
        done,
        total,
        stoppedReason: null,
        error: e instanceof Error ? e.message : String(e),
        runIds,
      };
    }
    calls++;
    responses.push(res);
    if (res.run_id) runIds.push(res.run_id);
    const chunkSet = new Set(chunk);
    const remaining = (res.remaining_ids ?? []).filter((id) => chunkSet.has(id));
    const progressed = chunk.length - remaining.length;
    done += progressed;
    queue = [...remaining, ...queue.slice(chunk.length)];
    onProgress?.({ done, total, calls });

    if (res.stopped_reason === "quota") {
      return { responses, done, total, stoppedReason: "quota", error: null, runIds };
    }
    if (progressed === 0) {
      stalls++;
      if (stalls >= 3) return { responses, done, total, stoppedReason: "stalled", error: null, runIds };
    } else stalls = 0;
  }
  return { responses, done, total, stoppedReason: null, error: null, runIds };
}

/** Cộng dồn một trường số qua nhiều phản hồi. */
export function sumField<R>(responses: R[], key: keyof R): number {
  return responses.reduce((acc, r) => {
    const v = r[key];
    return acc + (typeof v === "number" ? v : 0);
  }, 0);
}
