// Tiện ích HTTP chung cho Edge Functions: CORS, JSON, lỗi có mã.

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "content-disposition, x-row-count",
};

export class HttpError extends Error {
  constructor(public status: number, message: string, public code = "error") {
    super(message);
  }
}

export const badRequest = (msg: string) => new HttpError(400, msg, "bad_request");

export function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8", ...extra },
  });
}

/** Bọc handler: xử lý preflight CORS, chỉ nhận POST JSON, chuyển lỗi thành JSON. */
export function serve(handler: (req: Request, body: Record<string, unknown>) => Promise<Response>) {
  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json({ error: "Chỉ hỗ trợ POST", code: "method_not_allowed" }, 405);
    try {
      let body: Record<string, unknown> = {};
      const raw = await req.text();
      if (raw.trim()) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) body = parsed;
          else throw new Error();
        } catch {
          throw badRequest("Body phải là JSON object");
        }
      }
      return await handler(req, body);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message, code: e.code }, e.status);
      // Không lộ chi tiết nội bộ ra client; ghi log phía server (không chứa khoá bí mật).
      console.error("Unhandled error:", e instanceof Error ? e.stack ?? e.message : e);
      return json({ error: "Lỗi máy chủ", code: "internal" }, 500);
    }
  });
}

// ---- kiểm tra input ----------------------------------------------------------
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

export function uuidList(v: unknown, max: number, field = "company_ids"): string[] {
  if (!Array.isArray(v) || v.length === 0) throw badRequest(`${field} phải là mảng id không rỗng`);
  if (v.length > max) throw badRequest(`${field} tối đa ${max} phần tử mỗi lần gọi`);
  if (!v.every(isUuid)) throw badRequest(`${field} chứa id không hợp lệ`);
  return [...new Set(v as string[])];
}

export function intIn(v: unknown, min: number, max: number, def: number, field: string): number {
  if (v === undefined || v === null) return def;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw badRequest(`${field} phải là số nguyên từ ${min} đến ${max}`);
  return n;
}

export function oneOf<T extends string>(v: unknown, allowed: readonly T[], def: T | undefined, field: string): T {
  if ((v === undefined || v === null) && def !== undefined) return def;
  if (typeof v !== "string" || !(allowed as readonly string[]).includes(v)) {
    throw badRequest(`${field} phải là một trong: ${allowed.join(", ")}`);
  }
  return v as T;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Chạy tác vụ với số luồng giới hạn. */
export async function pool<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}
