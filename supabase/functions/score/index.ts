// score — tính lại điểm (mục 6.1). Công thức nằm trong hàm SQL recompute_scores để
// chấm điểm, cohort và giao diện dùng chung một nguồn sự thật.
import { badRequest, HttpError, json, serve, uuidList } from "../_shared/http.ts";
import { requireUser } from "../_shared/auth.ts";
import { audit, finishRun, startRun } from "../_shared/runs.ts";
import { recomputeScores } from "../_shared/signals.ts";
import type { ScoreResponse } from "../_shared/types.ts";

serve(async (req, body) => {
  const ctx = await requireUser(req);
  let ids: string[] | null;
  if (body.company_ids === "all") {
    if (!ctx.isAdmin) throw new HttpError(403, "Chỉ admin được tính lại điểm toàn bộ", "forbidden");
    ids = null;
  } else if (Array.isArray(body.company_ids)) {
    ids = uuidList(body.company_ids, 500);
  } else {
    throw badRequest('company_ids phải là mảng id hoặc "all"');
  }
  const runId = await startRun(ctx, "score", { company_ids: ids ?? "all" });
  try {
    const updated = await recomputeScores(ctx.db, ids);
    await finishRun(ctx.db, runId, "done", { updated });
    await audit(ctx.db, ctx.userId, "run.score", { run_id: runId, scope: ids ? ids.length : "all", updated });
    const res: ScoreResponse = { updated };
    return json(res);
  } catch (e) {
    await finishRun(ctx.db, runId, "failed", {}, { error: (e as Error).message });
    throw e;
  }
});
