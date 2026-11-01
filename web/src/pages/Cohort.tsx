import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { callFn, downloadExport } from "../lib/api";
import type { CohortFilter, CohortQueryResponse, CohortRange, Segment } from "../lib/api-types";
import type { CohortSaved, SignalCode } from "../lib/db-types";
import { SEGMENTS, SEGMENT_LABEL, errMsg, fmtDate, fmtNum } from "../lib/format";
import { useDebounced } from "../lib/hooks";
import { Badge, Notice, ScorePill, StatusBadge, TableWrap } from "../components/ui";
import { SafeLink, shortUrl } from "../components/SafeLink";

interface RangeRow {
  code: string;
  min: string;
  max: string;
}

function toNum(s: string): number | null {
  if (s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function asArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

export function CohortPage() {
  const { session } = useAuth();
  const [signals, setSignals] = useState<SignalCode[]>([]);
  const [must, setMust] = useState<string[]>([]);
  const [exclude, setExclude] = useState<string[]>([]);
  const [ranges, setRanges] = useState<RangeRow[]>([]);
  const [minScore, setMinScore] = useState("");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [q, setQ] = useState("");
  const [includeDnc, setIncludeDnc] = useState(false);

  const [result, setResult] = useState<CohortQueryResponse | null>(null);
  const [querying, setQuerying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [saved, setSaved] = useState<CohortSaved[]>([]);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    supabase
      .from("signal_codes")
      .select("*")
      .eq("status", "confirmed")
      .order("sort_order")
      .then(({ data }) => setSignals((data ?? []) as SignalCode[]));
  }, []);

  const loadSaved = useCallback(async () => {
    const { data } = await supabase.from("cohorts").select("*").order("created_at", { ascending: false });
    setSaved((data ?? []) as CohortSaved[]);
  }, []);
  useEffect(() => {
    void loadSaved();
  }, [loadSaved]);

  const filter: CohortFilter = useMemo(() => {
    const rs: CohortRange[] = ranges
      .filter((r) => r.code && (toNum(r.min) !== null || toNum(r.max) !== null))
      .map((r) => ({ code: r.code, min: toNum(r.min), max: toNum(r.max) }));
    return {
      must,
      exclude,
      ranges: rs,
      min_score: toNum(minScore),
      segments,
      q: q.trim() || undefined,
      include_dnc: includeDnc,
    };
  }, [must, exclude, ranges, minScore, segments, q, includeDnc]);

  // Đếm kết quả "theo thời gian thực" (debounce) — mục 9.
  const dFilter = useDebounced(filter, 500);
  useEffect(() => {
    let alive = true;
    setQuerying(true);
    callFn<CohortQueryResponse>("cohort_query", { ...dFilter, limit: 50, offset: 0 })
      .then((r) => {
        if (!alive) return;
        setResult(r);
        setError(null);
      })
      .catch((e) => alive && setError(errMsg(e)))
      .finally(() => alive && setQuerying(false));
    return () => {
      alive = false;
    };
  }, [dFilter]);

  function toggleIn(list: string[], set: (v: string[]) => void, code: string) {
    set(list.includes(code) ? list.filter((c) => c !== code) : [...list, code]);
  }

  async function save() {
    const name = window.prompt("Tên cohort:");
    if (!name?.trim() || !session) return;
    const { error } = await supabase
      .from("cohorts")
      .insert({ owner_id: session.user.id, name: name.trim().slice(0, 120), filter });
    if (error) setError(error.message);
    else {
      setInfo(`Đã lưu cohort "${name.trim()}".`);
      await loadSaved();
    }
  }

  function load(c: CohortSaved) {
    const f = (c.filter ?? {}) as Record<string, unknown>;
    setMust(asArray(f.must));
    setExclude(asArray(f.exclude));
    setRanges(
      (Array.isArray(f.ranges) ? (f.ranges as CohortRange[]) : []).map((r) => ({
        code: r.code,
        min: r.min === null || r.min === undefined ? "" : String(r.min),
        max: r.max === null || r.max === undefined ? "" : String(r.max),
      })),
    );
    setMinScore(f.min_score === null || f.min_score === undefined ? "" : String(f.min_score));
    setSegments(asArray(f.segments) as Segment[]);
    setQ(typeof f.q === "string" ? f.q : "");
    setIncludeDnc(f.include_dnc === true);
    setInfo(`Đã tải cohort "${c.name}".`);
  }

  async function remove(c: CohortSaved) {
    if (!window.confirm(`Xoá cohort "${c.name}"?`)) return;
    const { error } = await supabase.from("cohorts").delete().eq("id", c.id);
    if (error) setError(error.message);
    await loadSaved();
  }

  async function doExport(format: "csv" | "xlsx") {
    setExporting(true);
    setError(null);
    setInfo(null);
    try {
      const { include_dnc: _ignored, ...rest } = filter;
      void _ignored;
      const r = await downloadExport({ filter: rest, format });
      setInfo(`Đã tải ${r.filename}${r.rows !== null ? ` (${fmtNum(r.rows)} dòng)` : ""}.`);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setExporting(false);
    }
  }

  return (
    <section>
      <h1>Cohort builder</h1>
      <div className="card">
        <div className="grid two">
          <fieldset>
            <legend>Phải có</legend>
            <div className="chips">
              {signals.map((s) => (
                <label key={s.code} className={must.includes(s.code) ? "chip on" : "chip"} title={s.description}>
                  <input
                    type="checkbox"
                    checked={must.includes(s.code)}
                    onChange={() => toggleIn(must, setMust, s.code)}
                  />
                  {s.code}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Loại trừ</legend>
            <div className="chips">
              {signals.map((s) => (
                <label key={s.code} className={exclude.includes(s.code) ? "chip off" : "chip"} title={s.description}>
                  <input
                    type="checkbox"
                    checked={exclude.includes(s.code)}
                    onChange={() => toggleIn(exclude, setExclude, s.code)}
                  />
                  {s.code}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        {signals.length === 0 && <Notice kind="warn">Chưa có tín hiệu nào được xác nhận.</Notice>}

        <fieldset>
          <legend>Khoảng giá trị (value_num của observation mới nhất)</legend>
          {ranges.map((r, i) => (
            <div className="row wrap" key={i}>
              <select
                value={r.code}
                onChange={(e) => setRanges((rs) => rs.map((x, j) => (j === i ? { ...x, code: e.target.value } : x)))}
                aria-label="Tín hiệu"
              >
                <option value="">— Chọn tín hiệu —</option>
                {signals.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code}
                  </option>
                ))}
              </select>
              <input
                className="input-sm"
                type="number"
                placeholder="từ"
                value={r.min}
                onChange={(e) => setRanges((rs) => rs.map((x, j) => (j === i ? { ...x, min: e.target.value } : x)))}
              />
              <input
                className="input-sm"
                type="number"
                placeholder="đến"
                value={r.max}
                onChange={(e) => setRanges((rs) => rs.map((x, j) => (j === i ? { ...x, max: e.target.value } : x)))}
              />
              <button type="button" className="btn-link" onClick={() => setRanges((rs) => rs.filter((_, j) => j !== i))}>
                Xoá
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setRanges((rs) => [...rs, { code: "", min: "", max: "" }])}>
            + Thêm điều kiện
          </button>
        </fieldset>

        <div className="form-grid">
          <label>
            Điểm tối thiểu
            <input type="number" min={0} max={100} value={minScore} onChange={(e) => setMinScore(e.target.value)} />
          </label>
          <label>
            Tìm theo tên / domain
            <input value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
        </div>
        <fieldset>
          <legend>Nhóm khách</legend>
          <div className="chips">
            {SEGMENTS.map((s) => (
              <label key={s} className={segments.includes(s) ? "chip on" : "chip"}>
                <input
                  type="checkbox"
                  checked={segments.includes(s)}
                  onChange={() =>
                    setSegments((v) => (v.includes(s) ? v.filter((x) => x !== s) : [...v, s]))
                  }
                />
                {SEGMENT_LABEL[s]}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="checkbox">
          <input type="checkbox" checked={includeDnc} onChange={(e) => setIncludeDnc(e.target.checked)} />
          Xem cả công ty thuộc DNC (export luôn loại DNC)
        </label>

        <div className="row wrap">
          <strong>{querying ? "Đang đếm…" : `${fmtNum(result?.total ?? 0)} công ty phù hợp`}</strong>
          <button type="button" onClick={() => void save()}>
            Lưu cohort
          </button>
          <button type="button" disabled={exporting || !result?.total} onClick={() => void doExport("csv")}>
            Export CSV
          </button>
          <button type="button" disabled={exporting || !result?.total} onClick={() => void doExport("xlsx")}>
            Export Excel
          </button>
        </div>
        <p className="small muted">Export luôn lọc lại danh sách loại trừ ở server và được ghi vào nhật ký audit.</p>
        {error && <Notice kind="error">{error}</Notice>}
        {info && <Notice kind="ok">{info}</Notice>}
      </div>

      {saved.length > 0 && (
        <div className="card">
          <h2>Cohort đã lưu</h2>
          <TableWrap>
            <table>
              <tbody>
                {saved.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td className="small">{fmtDate(c.created_at)}</td>
                    <td>
                      <div className="row nowrap">
                        <button type="button" onClick={() => load(c)}>
                          Tải
                        </button>
                        {c.owner_id === session?.user.id && (
                          <button type="button" className="btn-link" onClick={() => void remove(c)}>
                            Xoá
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </div>
      )}

      {result && result.rows.length > 0 && (
        <div className="card">
          <h2>50 kết quả đầu</h2>
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th>Tên</th>
                  <th>Website</th>
                  <th>Nhóm</th>
                  <th>Thành phố</th>
                  <th>Trạng thái</th>
                  <th className="num">Điểm</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link to={`/companies/${r.id}`}>{r.name}</Link> {r.is_dnc && <Badge tone="red">DNC</Badge>}
                    </td>
                    <td>
                      {r.domain ? <SafeLink href={r.website_url ?? `https://${r.domain}/`}>{shortUrl(r.domain)}</SafeLink> : "—"}
                    </td>
                    <td>{r.segment ? SEGMENT_LABEL[r.segment] : "—"}</td>
                    <td>{r.city ?? "—"}</td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="num">
                      <ScorePill score={r.score} />
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
