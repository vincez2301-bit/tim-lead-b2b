// Hạn mức lượt API mỗi ngày (mục 10.4): giữ chỗ nguyên tử trong Postgres trước khi gọi,
// hoàn trả nếu lời gọi thất bại.
import { HttpError } from "./http.ts";
import type { Db } from "./db.ts";
import { envCap } from "./settings.ts";
import type { QuotaInfo } from "./types.ts";

export type Provider = "serper" | "youtube";

export async function usageToday(db: Db, provider: Provider, userId: string): Promise<QuotaInfo> {
  const { data, error } = await db.rpc("api_usage_today", {
    p_provider: provider,
    p_user: userId,
    p_global_cap: envCap(provider),
  });
  if (error) throw new Error(`api_usage_today: ${error.message}`);
  return data as QuotaInfo;
}

/** Trả về true nếu giữ chỗ thành công, false nếu đã hết hạn mức. */
export async function reserve(db: Db, runId: string, userId: string, provider: Provider, units: number): Promise<boolean> {
  const { data, error } = await db.rpc("reserve_units", {
    p_run_id: runId,
    p_user: userId,
    p_provider: provider,
    p_units: units,
    p_global_cap: envCap(provider),
  });
  if (error) throw new Error(`reserve_units: ${error.message}`);
  return (data as { ok: boolean }).ok === true;
}

export async function refund(db: Db, runId: string, userId: string, provider: Provider, units: number): Promise<void> {
  const { error } = await db.rpc("refund_units", { p_run_id: runId, p_user: userId, p_provider: provider, p_units: units });
  if (error) console.error("refund_units:", error.message);
}

export function quotaExceeded(provider: Provider): HttpError {
  return new HttpError(
    429,
    provider === "serper"
      ? "Đã hết hạn mức lượt Serper hôm nay (theo cấu hình). Thử lại ngày mai hoặc nhờ admin nâng hạn mức."
      : "Đã hết hạn mức quota YouTube hôm nay. Run được lưu tiến độ để chạy tiếp sau khi quota đặt lại.",
    "quota_exceeded",
  );
}
