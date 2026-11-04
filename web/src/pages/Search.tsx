import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { callFn } from "../lib/api";
import type {
  DiscoverMode,
  DiscoverRequest,
  DiscoverResponse,
  EstimateRequest,
  EstimateResponse,
  Segment,
} from "../lib/api-types";
import type { SearchRow } from "../lib/db-types";
import { SEGMENTS, SEGMENT_LABEL, errMsg, fmtDate, fmtNum } from "../lib/format";
import { useDebounced } from "../lib/hooks";
import { getBatchSize, getKeywordSet, getLimits, getRegions, locationNames, useSettings } from "../lib/settings";
import { Notice, PageHeader, Spinner, TableWrap } from "../components/ui";
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

export function SearchPage() {
  const { settings, loading, error: settingsError } = useSettings();
  const regions = getRegions(settings);
  const limits = getLimits(settings);
  const maxResultsCap = limits.max_results_per_discover ?? 100;

  const [segment, setSegment] = useState<Segment>("agency");
  const [keywordsText, setKeywordsText] = useState("");
  const [region, setRegion] = useState("");
  const [location, setLocation] = useState("");
  const [mode, setMode] = useState<DiscoverMode>("search");
  const [pages, setPages] = useState(1);
  const [maxResults, setMaxResults] = useState<number>(50);

  const [estimate, setEstimate] = useState<EstimateResponse | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [estimateErr, setEstimateErr] = useState<string | null>(null);

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<DiscoverResponse | null>(null);
  const [runErr, setRunErr] = useState<string | null>(null);
  const [includeExisting, setIncludeExisting] = useState(false);

  const [recent, setRecent] = useState<SearchRow[]>([]);

  // Điền giá trị mặc định khi settings tải xong.
  useEffect(() => {
    if (loading) return;
    if (!region && regions[0]) setRegion(regions[0].code);
    setKeywordsText((t) => t || getKeywordSet(settings, segment).join("\n"));
    setMaxResults((m) => Math.min(m, maxResultsCap));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  useEffect(() => {
    supabase
      .from("searches")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => setRecent((data ?? []) as SearchRow[]));
  }, [result]);

  const keywords = useMemo(() => parseKeywords(keywordsText), [keywordsText]);
  const tooLong = keywords.filter((k) => k.length > MAX_KEYWORD_LEN);
  const regionObj = regions.find((r) => r.code === region);
  const locations = locationNames(regionObj);

  // Ước tính số lượt API TRƯỚC khi chạy (mục 4.1 bước 1, mục 10.4).
  const estReq: EstimateRequest = useMemo(
    () => ({ keywords: keywords.slice(0, MAX_KEYWORDS), pages, mode, region }),
    [keywords, pages, mode, region],
  );
  const debouncedReq = useDebounced(estReq, 500);
  useEffect(() => {
    if (!debouncedReq.region) return;
    let alive = true;
    setEstimating(true);
    callFn<EstimateResponse>("estimate", debouncedReq)
      .then((e) => {
        if (!alive) return;
        setEstimate(e);
        setEstimateErr(null);
      })
      .catch((e) => alive && setEstimateErr(errMsg(e)))
      .finally(() => alive && setEstimating(false));
    return () => {
      alive = false;
    };
  }, [debouncedReq]);

  function changeSegment(s: Segment) {
    setSegment(s);
    setKeywordsText(getKeywordSet(settings, s).join("\n"));
  }

  function loadSearch(s: SearchRow) {
    if (s.segment) setSegment(s.segment);
    setKeywordsText(s.keywords.join("\n"));
    setRegion(s.region);
    setLocation(s.location ?? "");
    setMode(s.mode);
    setPages(Math.min(3, Math.max(1, s.pages)));
  }

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

  const units = estimate?.serper_units ?? keywords.length * pages * (mode === "both" ? 2 : 1);
  const overQuota = estimate ? units > estimate.remaining_today : false;

  async function run() {
    if (invalid) return;
    let confirm = false;
    const needs = estimate ? estimate.needs_confirmation : true;
    if (needs) {
      const ok = await confirmDialog({
        title: `Dùng khoảng ${units} lượt Serper?`,
        message:
          (estimate ? `Hôm nay còn ${estimate.remaining_today} lượt. ` : "Chưa ước tính xong hạn mức còn lại. ") +
          "Mỗi từ khoá × mỗi trang kết quả tốn 1 lượt.",
        confirmLabel: "Chạy tìm kiếm",
      });
      if (!ok) return;
      confirm = true;
    }
    setRunning(true);
    setRunErr(null);
    setResult(null);
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
      setResult(res);
      // cập nhật lại ước tính / quota còn lại
      callFn<EstimateResponse>("estimate", estReq).then(setEstimate).catch(() => undefined);
    } catch (e) {
      setRunErr(errMsg(e));
    } finally {
      setRunning(false);
    }
  }

  if (loading) return <Spinner />;

  const pipelineIds = result ? (includeExisting ? result.company_ids : result.new_company_ids) : [];

  return (
    <section>
      <PageHeader
        title="Tìm kiếm công ty"
        description="Tìm công ty mới qua Google Search / Maps, rồi chạy pipeline để đọc website, YouTube và người liên hệ."
      />
      {settingsError && <Notice kind="error">{settingsError}</Notice>}
      <div className="card">
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
            <select value={region} onChange={(e) => { setRegion(e.target.value); setLocation(""); }}>
              {regions.length === 0 && <option value="">(chưa cấu hình khu vực)</option>}
              {regions.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.name} ({r.code})
                </option>
              ))}
            </select>
          </label>
          <label>
            Địa danh (tuỳ chọn)
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
            Tối đa số công ty ghi nhận
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
          Bộ từ khoá (mỗi dòng một từ khoá — {keywords.length}/{MAX_KEYWORDS})
          <textarea rows={8} value={keywordsText} onChange={(e) => setKeywordsText(e.target.value)} />
        </label>
        <div className="row">
          <button type="button" onClick={() => setKeywordsText(getKeywordSet(settings, segment).join("\n"))}>
            Khôi phục bộ từ khoá mặc định
          </button>
        </div>

        <div className="estimate">
          <strong>Ước tính:</strong> {fmtNum(units)} lượt Serper
          {estimate && (
            <>
              {" "}
              · còn lại hôm nay: {fmtNum(estimate.remaining_today)} lượt
              {estimate.needs_confirmation && " · cần xác nhận trước khi chạy"}
            </>
          )}
          {estimating && <span className="muted"> (đang tính…)</span>}
        </div>
        {estimateErr && <Notice kind="warn">Không ước tính được: {estimateErr}</Notice>}
        {estimate?.warnings?.map((w) => (
          <Notice key={w} kind="warn">
            {w}
          </Notice>
        ))}
        {invalid && <Notice kind="warn">{invalid}</Notice>}
        {overQuota && <Notice kind="error">Số lượt dự kiến vượt hạn mức còn lại hôm nay.</Notice>}

        <button type="button" className="btn-primary" disabled={!!invalid || running || overQuota} onClick={() => void run()}>
          {running ? "Đang tìm…" : "Chạy tìm kiếm"}
        </button>
        {runErr && <Notice kind="error">{runErr}</Notice>}
      </div>

      {result && (
        <div className="card">
          <h2>Kết quả</h2>
          {result.message && <Notice kind={result.status === "done" ? "ok" : "warn"}>{result.message}</Notice>}
          <div className="grid">
            <div className="stat">
              <div className="muted small">Công ty mới</div>
              <div className="stat-value">{fmtNum(result.new)}</div>
            </div>
            <div className="stat">
              <div className="muted small">Đã có</div>
              <div className="stat-value">{fmtNum(result.existing)}</div>
            </div>
            <div className="stat">
              <div className="muted small">Bỏ qua (DNC)</div>
              <div className="stat-value">{fmtNum(result.skipped_dnc)}</div>
            </div>
            <div className="stat">
              <div className="muted small">Bỏ qua (aggregator)</div>
              <div className="stat-value">{fmtNum(result.skipped_blocked)}</div>
            </div>
            <div className="stat">
              <div className="muted small">Lượt Serper đã dùng</div>
              <div className="stat-value">{fmtNum(result.units_used)}</div>
            </div>
          </div>
          <label className="checkbox">
            <input type="checkbox" checked={includeExisting} onChange={(e) => setIncludeExisting(e.target.checked)} />
            Chạy pipeline cho cả công ty đã có ({result.company_ids.length} công ty)
          </label>
          <PipelineRunner key={`${result.run_id}-${includeExisting}`} companyIds={pipelineIds} batchSize={getBatchSize(settings)} />
        </div>
      )}

      {recent.length > 0 && (
        <div className="card">
          <h2>Tìm kiếm gần đây</h2>
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th>Thời điểm</th>
                  <th>Nhóm</th>
                  <th>Từ khoá</th>
                  <th>Khu vực</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {recent.map((s) => (
                  <tr key={s.id}>
                    <td>{fmtDate(s.created_at)}</td>
                    <td>{s.segment ? SEGMENT_LABEL[s.segment] : "—"}</td>
                    <td className="small">{s.keywords.slice(0, 3).join("; ")}{s.keywords.length > 3 ? ` (+${s.keywords.length - 3})` : ""}</td>
                    <td>{s.region}{s.location ? ` · ${s.location}` : ""}</td>
                    <td>
                      <button type="button" onClick={() => loadSearch(s)}>
                        Dùng lại
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </div>
      )}
    </section>
  );
}
