import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { supabase } from "../lib/supabase";
import { callFn } from "../lib/api";
import type { CohortQueryRequest, CohortQueryResponse, CompanyStatus, Segment } from "../lib/api-types";
import type { SignalCode } from "../lib/db-types";
import { SEGMENTS, SEGMENT_LABEL, STATUSES, STATUS_LABEL, errMsg, fmtDate, fmtNum } from "../lib/format";
import { useDebounced } from "../lib/hooks";
import { allCityNames, getBatchSize, rememberFilter, rememberedFilter, useSettings } from "../lib/settings";
import { Play, X } from "lucide-react";
import { Badge, EmptyState, Notice, PageHeader, ScorePill, Spinner, StatusBadge, TableWrap } from "../components/ui";
import { SafeLink, shortUrl } from "../components/SafeLink";
import { PipelineRunner } from "../components/PipelineRunner";

const PAGE_SIZE = 50;

interface Row {
  id: string;
  name: string;
  domain: string | null;
  website_url: string | null;
  segment: Segment | null;
  city: string | null;
  status: CompanyStatus;
  score: number | null;
  is_dnc: boolean;
  last_seen_at?: string;
}

type Sort = "score" | "name" | "last_seen_at";

/** Loại ký tự đặc biệt của bộ lọc PostgREST khỏi chuỗi tìm kiếm. */
function cleanQuery(q: string): string {
  return q.replace(/[,()"'\\*%:]/g, " ").trim().slice(0, 100);
}

export function CompaniesPage() {
  const { settings } = useSettings();
  const [segment, setSegment] = useState<Segment | "">("");
  const [status, setStatus] = useState<CompanyStatus | "">("");
  const [minScore, setMinScore] = useState("");
  const [q, setQ] = useState("");
  const [signal, setSignal] = useState("");
  const [city, setCity] = useState(() => rememberedFilter("companies.city"));
  const [showDnc, setShowDnc] = useState(false);
  const [sort, setSort] = useState<Sort>("score");
  const [page, setPage] = useState(0);

  const [rows, setRows] = useState<Row[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [signals, setSignals] = useState<SignalCode[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showRunner, setShowRunner] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    supabase
      .from("signal_codes")
      .select("*")
      .eq("status", "confirmed")
      .order("sort_order")
      .then(({ data }) => setSignals((data ?? []) as SignalCode[]));
  }, []);

  const dq = useDebounced(q, 400);
  const dMin = useDebounced(minScore, 400);
  useEffect(() => rememberFilter("companies.city", city), [city]);
  const cities = useMemo(() => allCityNames(settings), [settings]);
  const filterKey = JSON.stringify([segment, status, dMin, dq, signal, city, showDnc, sort]);
  useEffect(() => setPage(0), [filterKey]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setError(null);
      const min = dMin.trim() === "" ? null : Number(dMin);
      const query = cleanQuery(dq);
      try {
        if (signal) {
          // Lọc theo tín hiệu → dùng cohort_query (truy vấn tham số hoá ở server).
          const body: CohortQueryRequest = {
            must: [signal],
            segments: segment ? [segment] : [],
            statuses: status ? [status] : [],
            cities: city ? [city] : [],
            min_score: min !== null && Number.isFinite(min) ? min : null,
            q: query || undefined,
            include_dnc: showDnc,
            limit: PAGE_SIZE,
            offset: page * PAGE_SIZE,
          };
          const res = await callFn<CohortQueryResponse>("cohort_query", body);
          if (!alive) return;
          setRows(res.rows);
          setTotal(res.total);
          return;
        }
        let qb = supabase
          .from("company_list")
          .select("id,name,domain,website_url,segment,city,status,score,is_dnc,last_seen_at", { count: "exact" });
        if (segment) qb = qb.eq("segment", segment);
        if (status) qb = qb.eq("status", status);
        if (city) qb = qb.ilike("city", city.replace(/[%_\\]/g, (c) => `\\${c}`));
        if (min !== null && Number.isFinite(min)) qb = qb.gte("score", min);
        if (!showDnc) qb = qb.eq("is_dnc", false);
        if (query) qb = qb.or(`name.ilike.*${query}*,domain.ilike.*${query}*`);
        if (sort === "score") qb = qb.order("score", { ascending: false, nullsFirst: false });
        else if (sort === "name") qb = qb.order("name");
        else qb = qb.order("last_seen_at", { ascending: false });
        const { data, count, error } = await qb.order("id").range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
        if (!alive) return;
        if (error) throw error;
        setRows((data ?? []) as Row[]);
        setTotal(count ?? 0);
      } catch (e) {
        if (alive) {
          setError(errMsg(e));
          setRows([]);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [filterKey, page, reloadKey, dMin, dq, segment, status, signal, city, showDnc, sort]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const allOnPage = useMemo(() => (rows ?? []).map((r) => r.id), [rows]);
  const allSelected = allOnPage.length > 0 && allOnPage.every((id) => selected.has(id));

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function toggleAll() {
    setSelected((s) => {
      const n = new Set(s);
      if (allSelected) allOnPage.forEach((id) => n.delete(id));
      else allOnPage.forEach((id) => n.add(id));
      return n;
    });
  }

  return (
    <section>
      <PageHeader
        title="Công ty"
        description="Lead đã thu thập, xếp theo điểm. Tích chọn để chạy pipeline, bấm tên để xem vì sao công ty có điểm đó."
      />
      <div className="card">
        <div className="form-grid">
          <label>
            Tìm theo tên / domain
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="vd. production" />
          </label>
          <label>
            Nhóm
            <select value={segment} onChange={(e) => setSegment(e.target.value as Segment | "")}>
              <option value="">Tất cả</option>
              {SEGMENTS.map((s) => (
                <option key={s} value={s}>
                  {SEGMENT_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Thành phố
            <select value={city} onChange={(e) => setCity(e.target.value)}>
              <option value="">Tất cả</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label>
            Trạng thái
            <select value={status} onChange={(e) => setStatus(e.target.value as CompanyStatus | "")}>
              <option value="">Tất cả</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Điểm tối thiểu
            <input type="number" min={0} max={100} value={minScore} onChange={(e) => setMinScore(e.target.value)} />
          </label>
          <label>
            Có tín hiệu
            <select value={signal} onChange={(e) => setSignal(e.target.value)}>
              <option value="">— Bất kỳ —</option>
              {signals.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.code}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sắp xếp
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} disabled={!!signal}>
              <option value="score">Điểm cao trước</option>
              <option value="name">Tên A→Z</option>
              <option value="last_seen_at">Mới thấy gần đây</option>
            </select>
          </label>
        </div>
        <label className="checkbox">
          <input type="checkbox" checked={showDnc} onChange={(e) => setShowDnc(e.target.checked)} />
          Hiện cả công ty trong danh sách loại trừ (DNC)
        </label>
      </div>

      {error && <Notice kind="error">{error}</Notice>}

      <div className="toolbar">
        <span className="muted">
          <strong className="stat-inline">{fmtNum(total)}</strong> công ty{city ? ` · ${city}` : ""}
        </span>
        {selected.size === 0 && <span className="muted small">Tích chọn công ty để chạy pipeline.</span>}
      </div>

      {showRunner && selected.size > 0 && (
        <div id="runner">
        <PipelineRunner
          key={[...selected].join(",")}
          companyIds={[...selected]}
          batchSize={getBatchSize(settings)}
          onFinished={() => setReloadKey((k) => k + 1)}
        />
        </div>
      )}

      {!rows ? (
        <Spinner />
      ) : (
        <TableWrap>
          <table>
            <thead>
              <tr>
                <th>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Chọn tất cả trên trang" />
                </th>
                <th>Tên</th>
                <th>Website</th>
                <th>Nhóm</th>
                <th>Thành phố</th>
                <th>Trạng thái</th>
                <th className="num">Điểm</th>
                {!signal && <th>Thấy lần cuối</th>}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <EmptyState title="Không có công ty phù hợp">
                      Thử bỏ bớt bộ lọc, hoặc <Link to="/search">tìm thêm công ty</Link>.
                    </EmptyState>
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Chọn ${r.name}`} />
                  </td>
                  <td>
                    <Link to={`/companies/${r.id}`}>{r.name}</Link> {r.is_dnc && <Badge tone="red">DNC</Badge>}
                  </td>
                  <td>
                    {r.domain ? (
                      <SafeLink href={r.website_url ?? `https://${r.domain}/`}>{shortUrl(r.domain)}</SafeLink>
                    ) : (
                      <span className="muted">không có</span>
                    )}
                  </td>
                  <td>{r.segment ? SEGMENT_LABEL[r.segment] : "—"}</td>
                  <td>{r.city ?? "—"}</td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="num">
                    <ScorePill score={r.score} />
                  </td>
                  {!signal && <td className="small">{fmtDate(r.last_seen_at)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}

      {selected.size > 0 && (
        <div className="bulkbar" role="region" aria-label="Thao tác với mục đã chọn">
          <span>
            Đã chọn <strong>{selected.size}</strong> công ty
          </span>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setShowRunner(true);
              requestAnimationFrame(() => document.getElementById("runner")?.scrollIntoView({ behavior: "smooth" }));
            }}
          >
            <Play aria-hidden="true" /> Chạy pipeline
          </button>
          <button type="button" className="btn-link" onClick={() => setSelected(new Set())}>
            <X aria-hidden="true" /> Bỏ chọn
          </button>
        </div>
      )}
      <div className="row pager">
        <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
          ← Trước
        </button>
        <span>
          Trang {page + 1}/{pages}
        </span>
        <button type="button" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>
          Sau →
        </button>
      </div>
    </section>
  );
}
