// cohort_query — lọc cohort (mục 6.2) qua hàm SQL tham số hoá cohort_search.
import { intIn, json, serve } from "../_shared/http.ts";
import { requireUser } from "../_shared/auth.ts";
import { confirmedSignals } from "../_shared/signals.ts";
import { parseCohortFilter } from "../_shared/cohort.ts";
import type { CohortQueryResponse, CohortRow } from "../_shared/types.ts";

serve(async (req, body) => {
  const ctx = await requireUser(req);
  const filter = parseCohortFilter(body, await confirmedSignals(ctx.db));
  const limit = intIn(body.limit, 0, 500, 50, "limit");
  const offset = intIn(body.offset, 0, 1_000_000, 0, "offset");

  const { data, error } = await ctx.db.rpc("cohort_search", { p_filter: { ...filter, limit, offset } });
  if (error) throw new Error(`cohort_search: ${error.message}`);
  const rows = (data ?? []) as (CohortRow & { total_count: number })[];
  let total = rows[0]?.total_count ?? 0;
  if (!rows.length && offset > 0) {
    // Trang rỗng do offset vượt quá → lấy tổng riêng.
    const r = await ctx.db.rpc("cohort_search", { p_filter: { ...filter, limit: 1, offset: 0 } });
    total = (r.data as { total_count: number }[] | null)?.[0]?.total_count ?? 0;
  }
  const res: CohortQueryResponse = {
    total: Number(total),
    rows: rows.map(({ total_count: _t, ...r }) => r),
  };
  return json(res);
});
