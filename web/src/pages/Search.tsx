import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { ArrowRight, Kanban, Play } from "lucide-react";
import { supabase } from "../lib/supabase";
import { callFn } from "../lib/api";
import type { CompanyStatus, DiscoverMode, DiscoverRequest, DiscoverResponse, EstimateResponse, Segment } from "../lib/api-types";
import type { Run } from "../lib/db-types";
import { SEGMENTS, SEGMENT_LABEL, STATUS_LABEL, errMsg, fmtDate, fmtNum } from "../lib/format";
import { getBatchSize, getKeywordSet, getLimits, getRegions, locationNames, useSettings } from "../lib/settings";
import { STAGE_LABEL, addToSalesPipeline, type Stage } from "../lib/pipeline";
import { Badge, EmptyState, Notice, PageHeader, RunStatusBadge, ScorePill, Spinner, TableWrap } from "../components/ui";
import { SafeLink, shortUrl } from "../components/SafeLink";
import { PipelineRunner } from "../components/PipelineRunner";
import { confirmDialog } from "../components/dialog";

const MAX_KEYWORDS = 20;
const MAX_KEYWORD_LEN = 120;

const MODE_LABEL: Record<DiscoverMode, string> = {
  search: "Google Search",
  maps: "Google Maps",
  both: "Cả hai",
};

function parseKeywords(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const k = line.trim().replace(/\s+/g, " ");
    if (k && !seen.has(k.toLowerCase())) {
      seen.add(k.toLowerCase());
      out.push(k);
    }
  }
  return out;
}

interface RunInput {
  segment?: Segment;
  keywords?: string[];
  location?: string | null;
  region?: string;
  mode?: DiscoverMode;
  pages?: number;
}
interface ResultRow {
  is_new: boolean;
  id: string;
  name: string;
  domain: string | null;
  website_url: string | null;
  city: string | null;
  segment: Segment | null;
  status: CompanyStatus;
  score: number | null;
  deal: { id: string; stage: Stage } | null;
}

export function SearchPage() {
  const { settings, loading, error: settingsError } = useSettings();
  const regions = getRegions(settings);
  const limits = getLimits(settings);
  const maxResultsCap = limits.max_results_per_discover ?? 100;
  const [params, setParams] = useSearchParams();
  const runId = params.get("run");

  const [segment, setSegment] = useState<Segment>("broadcaster");
  const [keywordsText, setKeywordsText] = useState("");
  const [region, setRegion] = useState("");
  const [location, setLocation] = useState("");
  const [mode, setMode] = useState<DiscoverMode>("search");
  const [pages, setPages] = useState(1);
  const [maxResults, setMaxResults] = useState<number>(50);

  const [quota, setQuota] = useState<EstimateResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [runMsg, setRunMsg] = useState<{ kind: "ok" | "warn" | "error"; text: string } | null>(null);
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [formOpen, setFormOpen] = useState(!runId);

  // Điền giá trị mặc định khi settings tải xong.
  useEffect(() => {
    if (loading) return;
    if (!region && regions[0]) setRegion(regions[0].code);
    setKeywordsText((t) => t || getKeywordSet(settings, segment).join("\n"));
    setMaxResults((m) => Math.min(m, maxResultsCap));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const loadRuns = useCallback(async () => {
    const { data } = await supabase
      .from("runs")
      .select("*")
      .eq("step", "discover")
      .order("started_at", { ascending: false })
      .limit(15);
    setRuns((data ?? []) as Run[]);
  }, []);
  // Hạn mức chỉ hỏi server khi mở trang và sau mỗi lần tìm (không gọi lại mỗi lần gõ từ khoá).
  const loadQuota = useCallback(() => {
    callFn<EstimateResponse>("estimate", { keywords: [], pages: 1, mode: "search" })
      .then(setQuota)
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    void loadRuns();
    loadQuota();
  }, [loadRuns, loadQuota]);

  const keywords = useMemo(() => parseKeywords(keywordsText), [keywordsText]);
  const tooLong = keywords.filter((k) => k.length > MAX_KEYWORD_LEN);
  const regionObj = regions.find((r) => r.code === region);
  const locations = locationNames(regionObj);
  const units = Math.min(keywords.length, MAX_KEYWORDS) * pages * (mode === "both" ? 2 : 1);
  const remaining = quota?.remaining_today ?? null;
  const overQuota = remaining !== null && units > remaining;

  const invalid =
    keywords.length === 0
      ? "Nhập ít nhất một từ khoá."
      : keywords.length > MAX_KEYWORDS
        ? `Tối đa ${MAX_KEYWORDS} từ khoá mỗi lần chạy.`
        : tooLong.length > 0
          ? `Từ khoá dài quá ${MAX_KEYWORD_LEN} ký tự: ${tooLong[0].slice(0, 40)}…`
          : !region
            ? "Chọn khu vực."
            : null;

  function changeSegment(s: Segment) {
    setSegment(s);
    setKeywordsText(getKeywordSet(settings, s).join("\n"));
  }

  function reuse(r: Run) {
    const i = (r.input ?? {}) as RunInput;
    if (i.segment) setSegment(i.segment);
    if (i.keywords) setKeywordsText(i.keywords.join("\n"));
    if (i.region) setRegion(i.region);
    setLocation(i.location ?? "");
    if (i.mode) setMode(i.mode);
    if (i.pages) setPages(Math.min(3, Math.max(1, i.pages)));
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function run() {
    if (invalid) return;
    let confirm = false;
    const threshold = quota?.confirm_above_units ?? 0;
    if (units > threshold) {
      const ok = await confirmDialog({
        title: `Dùng khoảng ${units} lượt tìm Google?`,
        message: (remaining !== null ? `Hôm nay còn ${remaining} lượt. ` : "") + "Mỗi từ khoá × mỗi trang kết quả tốn 1 lượt.",
        confirmLabel: "Tìm",
      });
      if (!ok) return;
      confirm = true;
    }
    setRunning(true);
    setRunMsg(null);
    try {
      const body: DiscoverRequest = {
        segment,
        keywords,
        region,
        location: location || null,
        pages,
        mode,
        max_results: maxResults,
        confirm,
      };
      const res = await callFn<DiscoverResponse>("discover", body);
      setRunMsg({
        kind: res.status === "done" ? "ok" : "warn",
        text:
          `Tìm được ${res.new} công ty mới, ${res.existing} công ty đã có. Danh sách ở ngay bên dưới — bước tiếp theo: phân tích website rồi đưa công ty phù hợp vào Pipeline.` +
          (res.message ? ` ${res.message}` : ""),
      });
      setFormOpen(false);
      setParams({ run: res.run_id });
      await loadRuns();
      loadQuota();
    } catch (e) {
      setRunMsg({ kind: "error", text: errMsg(e) });
    } finally {
      setRunning(false);
    }
  }

  if (loading) return <Spinner />;
  const selectedRun = runs?.find((r) => r.id === runId) ?? null;

  return (
    <section>
      <PageHeader
        title="Tìm khách mới"
        description="Tìm công ty trên Google → phân tích website để lấy email, người phụ trách và điểm phù hợp → đưa công ty tốt vào Pipeline bán hàng."
      />
      <ol className="flow">
        <li className={formOpen ? "on" : "done"}>
          <span>1</span> Tìm trên Google
        </li>
        <li className={selectedRun ? "on" : ""}>
          <span>2</span> Phân tích website
        </li>
        <li className={selectedRun ? "on" : ""}>
          <span>3</span> Đưa vào Pipeline
        </li>
      </ol>
      {settingsError && <Notice kind="error">{settingsError}</Notice>}
      {runMsg && <Notice kind={runMsg.kind}>{runMsg.text}</Notice>}

      <details className="card search-form" open={formOpen} onToggle={(e) => setFormOpen((e.target as HTMLDetailsElement).open)}>
        <summary>
          <strong>Tìm công ty mới</strong>
          <span className="small muted">
            {remaining !== null ? `Hôm nay còn ${fmtNum(remaining)} lượt tìm Google` : ""}
          </span>
        </summary>
        <div className="form-grid">
          <label>
            Nhóm khách
            <select value={segment} onChange={(e) => changeSegment(e.target.value as Segment)}>
              {SEGMENTS.map((s) => (
                <option key={s} value={s}>
                  {SEGMENT_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Khu vực
            <select
              value={region}
              onChange={(e) => {
                setRegion(e.target.value);
                setLocation("");
              }}
            >
              {regions.length === 0 && <option value="">(chưa cấu hình khu vực)</option>}
              {regions.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.name} ({r.code})
                </option>
              ))}
            </select>
          </label>
          <label>
            Thành phố (tuỳ chọn)
            <select value={location} onChange={(e) => setLocation(e.target.value)}>
              <option value="">— Không thêm —</option>
              {locations.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label>
            Nguồn
            <select value={mode} onChange={(e) => setMode(e.target.value as DiscoverMode)}>
              {(Object.keys(MODE_LABEL) as DiscoverMode[]).map((m) => (
                <option key={m} value={m}>
                  {MODE_LABEL[m]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Số trang kết quả / từ khoá
            <select value={pages} onChange={(e) => setPages(Number(e.target.value))}>
              {[1, 2, 3].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tối đa số công ty
            <input
              type="number"
              min={1}
              max={maxResultsCap}
              value={maxResults}
              onChange={(e) => setMaxResults(Math.max(1, Math.min(maxResultsCap, Number(e.target.value) || 1)))}
            />
          </label>
        </div>
        <label>
          Từ khoá — mỗi dòng một từ ({keywords.length}/{MAX_KEYWORDS})
          <textarea rows={6} value={keywordsText} onChange={(e) => setKeywordsText(e.target.value)} />
        </label>
        {quota?.warnings
          ?.filter((w) => !w.startsWith("Yêu cầu cần"))
          .map((w) => (
            <Notice key={w} kind="warn">
              {w}
            </Notice>
          ))}
        {invalid && <Notice kind="warn">{invalid}</Notice>}
        {overQuota && <Notice kind="error">Cần {units} lượt nhưng hôm nay chỉ còn {remaining} lượt.</Notice>}
        <div className="row">
          <button type="button" className="btn-primary" disabled={!!invalid || running || overQuota} onClick={() => void run()}>
            {running ? "Đang tìm…" : `Tìm (${units} lượt)`}
          </button>
          <button type="button" onClick={() => setKeywordsText(getKeywordSet(settings, segment).join("\n"))}>
            Khôi phục từ khoá mặc định
          </button>
        </div>
      </details>

      {selectedRun && <RunResults key={selectedRun.id} run={selectedRun} batchSize={getBatchSize(settings)} />}

      <div className="card">
        <h2>Các lượt tìm</h2>
        {!runs ? (
          <Spinner />
        ) : runs.length === 0 ? (
          <EmptyState title="Chưa có lượt tìm nào." />
        ) : (
          <ul className="runs">
            {runs.map((r) => {
              const i = (r.input ?? {}) as RunInput;
              const st = (r.stats ?? {}) as { new?: number; existing?: number };
              return (
                <li key={r.id} className={r.id === runId ? "active" : ""}>
                  <button type="button" className="run-main" onClick={() => setParams({ run: r.id })}>
                    <span className="run-when small muted">{fmtDate(r.started_at)}</span>
                    <span className="run-what">
                      <strong>{i.segment ? SEGMENT_LABEL[i.segment] : "—"}</strong>
                      {i.location ? ` · ${i.location}` : ""}
                      <span className="small muted">
                        {" "}
                        · {(i.keywords ?? []).slice(0, 2).join("; ")}
                        {(i.keywords?.length ?? 0) > 2 ? ` +${(i.keywords?.length ?? 0) - 2}` : ""}
                      </span>
                    </span>
                    <span className="run-count">
                      <strong>{fmtNum(st.new ?? 0)}</strong> mới · {fmtNum(st.existing ?? 0)} đã có
                    </span>
                    <RunStatusBadge status={r.status} />
                    <ArrowRight aria-hidden="true" className="run-go" />
                  </button>
                  <button type="button" className="btn-link small" onClick={() => reuse(r)}>
                    Tìm lại
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function RunResults({ run, batchSize }: { run: Run; batchSize: number }) {
  const [rows, setRows] = useState<ResultRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [analyze, setAnalyze] = useState<string[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const input = (run.input ?? {}) as RunInput;

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("run_companies")
      .select("is_new, company:companies(id,name,domain,website_url,city,segment,status,score,deals(id,stage))")
      .eq("run_id", run.id)
      .limit(500);
    if (error) setError(error.message);
    type Raw = { is_new: boolean; company: (Omit<ResultRow, "is_new" | "deal"> & { deals: unknown }) | null };
    const list = ((data ?? []) as unknown as Raw[])
      .filter((x) => x.company)
      .map((x) => {
        const d = x.company!.deals;
        const deal = (Array.isArray(d) ? d[0] : d) as ResultRow["deal"] | undefined;
        const { deals: _drop, ...c } = x.company!;
        void _drop;
        return { ...c, is_new: x.is_new, deal: deal ?? null };
      })
      .sort((a, b) => Number(!!a.deal) - Number(!!b.deal) || (b.score ?? -1) - (a.score ?? -1) || a.name.localeCompare(b.name, "vi"));
    setRows(list);
  }, [run.id]);
  useEffect(() => {
    void load();
  }, [load]);

  if (!rows) return <div className="card"><Spinner /></div>;

  const notAnalyzed = rows.filter((r) => r.status === "new");
  const notInPipeline = rows.filter((r) => !r.deal);
  const inPipeline = rows.length - notInPipeline.length;
  const ids = [...selected];
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="card run-results">
      <div className="row space-between">
        <div>
          <h2>
            Kết quả: {input.segment ? SEGMENT_LABEL[input.segment] : "lượt tìm"}
            {input.location ? ` · ${input.location}` : ""} <span className="count">{rows.length}</span>
          </h2>
          <p className="small muted">
            {fmtDate(run.started_at)} · {notAnalyzed.length} chưa phân tích · {inPipeline} đã ở Pipeline. Mọi công ty ở đây cũng đã được lưu vào mục{" "}
            <Link to="/companies">Công ty</Link>.
          </p>
        </div>
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      {notice && (
        <Notice kind="ok">
          {notice} <Link to="/">Mở Hôm nay →</Link>
        </Notice>
      )}
      {rows.length === 0 ? (
        <EmptyState title="Lượt tìm này không ra công ty nào.">Thử từ khoá khác hoặc thêm trang kết quả.</EmptyState>
      ) : (
        <>
          <div className="toolbar">
            <button type="button" className="btn-sm" onClick={() => setSelected(new Set(notInPipeline.map((r) => r.id)))}>
              Chọn tất cả chưa vào Pipeline ({notInPipeline.length})
            </button>
            {selected.size > 0 && (
              <button type="button" className="btn-link small" onClick={() => setSelected(new Set())}>
                Bỏ chọn
              </button>
            )}
            <span className="grow" />
            <button
              type="button"
              disabled={!(selected.size || notAnalyzed.length)}
              onClick={() => setAnalyze(selected.size ? ids : notAnalyzed.map((r) => r.id))}
            >
              <Play aria-hidden="true" /> Phân tích website ({selected.size || notAnalyzed.length})
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={selected.size === 0}
              onClick={async () => {
                const r = await addToSalesPipeline(ids);
                if (r.error) setError(r.error);
                else {
                  setNotice(`Đã đưa ${r.added} công ty vào Pipeline (Lead mới). Đánh giá chúng ở Hôm nay → “Cần đánh giá”.`);
                  setSelected(new Set());
                  void load();
                }
              }}
            >
              <Kanban aria-hidden="true" /> Đưa vào Pipeline ({selected.size})
            </button>
          </div>
          {analyze && (
            <PipelineRunner
              key={analyze.join(",")}
              companyIds={analyze}
              batchSize={batchSize}
              onFinished={() => void load()}
            />
          )}
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th className="check" aria-label="Chọn"></th>
                  <th>Công ty</th>
                  <th className="col-web">Website</th>
                  <th>Phân tích</th>
                  <th className="num">Điểm</th>
                  <th>Pipeline</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={selected.has(r.id) ? "selected" : ""}>
                    <td className="check">
                      <input type="checkbox" aria-label={`Chọn ${r.name}`} checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                    </td>
                    <td>
                      <Link to={`/companies/${r.id}`}>
                        <strong>{r.name}</strong>
                      </Link>
                      <div className="small muted">
                        {r.is_new ? <Badge tone="green">Mới</Badge> : <Badge>Đã có</Badge>} {r.city ?? ""}
                      </div>
                    </td>
                    <td className="small col-web">{r.website_url ? <SafeLink href={r.website_url}>{shortUrl(r.website_url)}</SafeLink> : "—"}</td>
                    <td className="small">{STATUS_LABEL[r.status]}</td>
                    <td className="num">
                      <ScorePill score={r.score} />
                    </td>
                    <td>
                      {r.deal ? (
                        <Link to={`/pipeline?deal=${r.deal.id}`} className="small">
                          {STAGE_LABEL[r.deal.stage]}
                        </Link>
                      ) : (
                        <span className="small muted">Chưa</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </>
      )}
    </div>
  );
}
