import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { supabase } from "../lib/supabase";
import { callFn } from "../lib/api";
import type { EstimateResponse, Segment } from "../lib/api-types";
import type { CompanyStat, Run } from "../lib/db-types";
import { SEGMENT_LABEL, STATUSES, STATUS_LABEL, STEP_LABEL, errMsg, fmtDate, fmtNum } from "../lib/format";
import { Notice, RunStatusBadge, Spinner, TableWrap } from "../components/ui";
import { QuotaCard } from "../components/QuotaCard";

export function OverviewPage() {
  const [stats, setStats] = useState<CompanyStat[] | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [confirmed, setConfirmed] = useState<number | null>(null);
  const [quota, setQuota] = useState<EstimateResponse | null>(null);
  const [quotaErr, setQuotaErr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [s, r, c] = await Promise.all([
        supabase.from("company_stats").select("*"),
        supabase.from("runs").select("*").order("started_at", { ascending: false }).limit(5),
        supabase.from("signal_codes").select("code", { count: "exact", head: true }).eq("status", "confirmed"),
      ]);
      if (!alive) return;
      if (s.error || r.error || c.error) setError((s.error ?? r.error ?? c.error)!.message);
      setStats((s.data ?? []) as CompanyStat[]);
      setRuns((r.data ?? []) as Run[]);
      setConfirmed(c.count ?? 0);
    })();
    callFn<EstimateResponse>("estimate", {})
      .then((q) => alive && setQuota(q))
      .catch((e) => alive && setQuotaErr(errMsg(e)));
    return () => {
      alive = false;
    };
  }, []);

  const agg = useMemo(() => {
    const bySegment = new Map<string, number>();
    const byStatus = new Map<string, number>();
    let total = 0;
    let scoreSum = 0;
    let scored = 0;
    for (const r of stats ?? []) {
      total += r.companies;
      bySegment.set(r.segment ?? "none", (bySegment.get(r.segment ?? "none") ?? 0) + r.companies);
      byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + r.companies);
      if (r.avg_score !== null) {
        scoreSum += Number(r.avg_score) * r.companies;
        scored += r.companies;
      }
    }
    return { bySegment, byStatus, total, avg: scored ? scoreSum / scored : null };
  }, [stats]);

  if (!stats) return <Spinner />;

  return (
    <section>
      <h1>Tổng quan</h1>
      {error && <Notice kind="error">{error}</Notice>}
      {confirmed === 0 && (
        <Notice kind="warn">
          Chưa có tín hiệu nào được xác nhận — pipeline sẽ không ghi nhận observation nào. Vào{" "}
          <Link to="/signals">Tín hiệu</Link> để admin duyệt.
        </Notice>
      )}

      <div className="grid">
        <div className="card stat">
          <div className="muted small">Tổng số công ty</div>
          <div className="stat-value">{fmtNum(agg.total)}</div>
        </div>
        <div className="card stat">
          <div className="muted small">Điểm trung bình</div>
          <div className="stat-value">{fmtNum(agg.avg, 1)}</div>
        </div>
        <QuotaCard title="Serper hôm nay" q={quota?.serper} unit="lượt" />
        <QuotaCard title="YouTube hôm nay" q={quota?.youtube} unit="đơn vị" />
      </div>
      {quotaErr && <Notice kind="warn">Không lấy được hạn mức API: {quotaErr}</Notice>}
      {quota?.warnings?.map((w) => (
        <Notice key={w} kind="warn">
          {w}
        </Notice>
      ))}

      <div className="grid two">
        <div className="card">
          <h2>Theo nhóm</h2>
          <TableWrap>
            <table>
              <tbody>
                {(["agency", "brand", "film", "mcn"] as Segment[]).map((s) => (
                  <tr key={s}>
                    <td>{SEGMENT_LABEL[s]}</td>
                    <td className="num">{fmtNum(agg.bySegment.get(s) ?? 0)}</td>
                  </tr>
                ))}
                {(agg.bySegment.get("none") ?? 0) > 0 && (
                  <tr>
                    <td>Chưa phân nhóm</td>
                    <td className="num">{fmtNum(agg.bySegment.get("none"))}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </TableWrap>
        </div>
        <div className="card">
          <h2>Theo trạng thái</h2>
          <TableWrap>
            <table>
              <tbody>
                {STATUSES.map((s) => (
                  <tr key={s}>
                    <td>{STATUS_LABEL[s]}</td>
                    <td className="num">{fmtNum(agg.byStatus.get(s) ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </div>
      </div>

      <div className="card">
        <div className="row space-between">
          <h2>Lượt chạy gần đây</h2>
          <Link to="/logs">Xem tất cả</Link>
        </div>
        {runs.length === 0 ? (
          <p className="muted">Chưa có lượt chạy nào.</p>
        ) : (
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th>Bắt đầu</th>
                  <th>Bước</th>
                  <th>Trạng thái</th>
                  <th className="num">Đơn vị API</th>
                  <th>Lỗi</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td>{fmtDate(r.started_at)}</td>
                    <td>{STEP_LABEL[r.step] ?? r.step}</td>
                    <td>
                      <RunStatusBadge status={r.status} />
                    </td>
                    <td className="num">{fmtNum(r.api_units_used)}</td>
                    <td className="small">{r.error ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </div>
    </section>
  );
}
