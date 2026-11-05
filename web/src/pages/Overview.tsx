import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { supabase } from "../lib/supabase";
import { callFn } from "../lib/api";
import type { EstimateResponse } from "../lib/api-types";
import type { CompanyStat, Run } from "../lib/db-types";
import { SEGMENTS, SEGMENT_LABEL, STATUSES, STATUS_LABEL, STEP_LABEL, errMsg, fmtDate, fmtNum } from "../lib/format";
import { Check, Search } from "lucide-react";
import { EmptyState, Notice, PageHeader, RunStatusBadge, Spinner, TableWrap } from "../components/ui";
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

  const processed = (agg.byStatus.get("profiled") ?? 0) + (agg.byStatus.get("enriched") ?? 0);
  const steps = [
    {
      done: (confirmed ?? 0) > 0,
      title: "Duyệt tín hiệu cần thu thập",
      hint: "Pipeline chỉ ghi nhận tín hiệu đã xác nhận (admin làm một lần).",
      to: "/signals",
      cta: "Mở Tín hiệu",
    },
    {
      done: agg.total > 0,
      title: "Tìm công ty mới",
      hint: "Chọn nhóm khách, địa danh và bộ từ khoá rồi chạy tìm kiếm.",
      to: "/search",
      cta: "Tìm kiếm",
    },
    {
      done: processed > 0,
      title: "Chạy pipeline",
      hint: "Đọc website, kênh YouTube và người liên hệ để chấm điểm.",
      to: "/companies",
      cta: "Mở Công ty",
    },
    {
      done: false,
      title: "Lọc và xuất danh sách để liên hệ",
      hint: "Lọc theo điểm, tín hiệu, thành phố rồi xuất CSV / Excel.",
      to: "/cohort",
      cta: "Mở Cohort",
    },
  ];
  const next = steps.findIndex((x) => !x.done);

  return (
    <section>
      <PageHeader
        title="Tổng quan"
        description="Tình hình dữ liệu, hạn mức API hôm nay và việc nên làm tiếp."
        actions={
          <Link className="btn btn-primary" to="/search">
            <Search aria-hidden="true" /> Tìm kiếm mới
          </Link>
        }
      />
      {error && <Notice kind="error">{error}</Notice>}

      <div className="card">
        <h2>Bắt đầu nhanh</h2>
        <ol className="checklist">
          {steps.map((st, i) => (
            <li key={st.title} className={st.done ? "done" : i === next ? "next" : ""}>
              <span className="dot">{st.done ? <Check size={14} aria-label="Xong" /> : i + 1}</span>
              <div className="text">
                <strong>{st.title}</strong>
                <span>{st.hint}</span>
              </div>
              <Link className={i === next ? "btn btn-primary" : "btn"} to={st.to}>
                {st.cta}
              </Link>
            </li>
          ))}
        </ol>
      </div>

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
                {SEGMENTS.map((s) => (
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
          <EmptyState title="Chưa có lượt chạy nào">Chạy tìm kiếm hoặc pipeline để thấy lịch sử ở đây.</EmptyState>
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
