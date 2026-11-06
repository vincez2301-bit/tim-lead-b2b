// Ghi nhận lượt chạy pipeline (bảng runs) và audit_log.
import { HttpError } from "./http.ts";
import { type Db, must } from "./db.ts";
import type { AuthContext } from "./auth.ts";

export type Step = "discover" | "find_website" | "profile" | "enrich_youtube" | "enrich_contact" | "score" | "export";

// run "running" lâu hơn thế coi như đã chết (function bị timeout hoặc vượt CPU/bộ nhớ, mã 546).
// Mỗi lượt tự dừng sau ~110s (crawl.time_budget_ms), nên 3 phút là đủ an toàn.
const STALE_MINUTES = 3;

/** Giới hạn số run đồng thời mỗi người dùng (mục 10.4). */
export async function assertConcurrency(ctx: AuthContext, max: number): Promise<void> {
  const since = new Date(Date.now() - STALE_MINUTES * 60_000).toISOString();
  const { count, error } = await ctx.db.from("runs").select("id", { count: "exact", head: true })
    .eq("owner_id", ctx.userId).eq("status", "running").gte("started_at", since);
  if (error) throw new Error(`Đếm run: ${error.message}`);
  if ((count ?? 0) >= max) {
    throw new HttpError(429, `Bạn đang có ${count} lượt chạy chưa xong (tối đa ${max}). Vui lòng đợi.`, "too_many_runs");
  }
}

export async function startRun(
  ctx: AuthContext,
  step: Step,
  input: unknown,
  extra: { provider?: "serper" | "youtube"; api_units_estimated?: number; search_id?: string } = {},
): Promise<string> {
  const row = must(
    await ctx.db.from("runs").insert({ owner_id: ctx.userId, step, input, ...extra }).select("id").single(),
    "Tạo run",
  ) as { id: string };
  return row.id;
}

export async function finishRun(
  db: Db,
  runId: string,
  status: "done" | "failed" | "partial",
  stats: Record<string, unknown>,
  opts: { error?: string | null; progress?: unknown } = {},
): Promise<void> {
  const { error } = await db.from("runs").update({
    status,
    stats,
    error: opts.error ? opts.error.slice(0, 2000) : null,
    progress: opts.progress ?? null,
    finished_at: new Date().toISOString(),
  }).eq("id", runId);
  if (error) console.error("finishRun:", error.message);
}

export async function audit(db: Db, userId: string | null, action: string, detail: unknown): Promise<void> {
  const { error } = await db.from("audit_log").insert({ user_id: userId, action, detail });
  if (error) console.error("audit:", error.message);
}
