import { useMemo, useState, type ChangeEvent } from "react";
import { Link } from "react-router";
import { Upload } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { parseCsv } from "../lib/csv";
import { readXlsx, type Sheet } from "../lib/xlsx";
import { LEAD_FIELDS, findHeaderRow, guessMapping, rowsToLeads, type ImportRow, type LeadField, type Mapping } from "../lib/leadImport";
import { SEGMENTS, SEGMENT_LABEL, errMsg, fmtNum } from "../lib/format";
import { Notice, PageHeader, TableWrap } from "../components/ui";
import { confirmDialog } from "../components/dialog";
import { getBatchSize, useSettings } from "../lib/settings";
import { PipelineRunner } from "../components/PipelineRunner";
import { getPlaybook, mergeObjections, parseObjectionFile } from "../lib/pipeline";

type Stats = Record<string, number>;

const STAT_LABEL: Record<string, string> = {
  companies_created: "Công ty mới",
  companies_matched: "Công ty đã có (gộp)",
  deals_created: "Deal mới",
  deals_updated: "Deal cập nhật",
  contacts_added: "Người liên hệ mới",
  activities_added: "Điểm chạm lịch sử",
  skipped_dnc: "Bỏ qua (danh sách loại trừ)",
  skipped_invalid: "Bỏ qua (thiếu tên)",
};

/** Danh sách tên dán vào (mỗi dòng một công ty; dán từ Excel thì lấy ô đầu tiên không phải ID / link kênh). */
export function parseNameList(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const cell = line
      .split("\t")
      .map((c) => c.trim())
      .find((c) => c && !/^UC[\w-]{20,}$/.test(c) && !/^https?:\/\//i.test(c));
    const name = (cell ?? "")
      .replace(/^(\d{1,3}[.)]|[-•*])\s+/, "")
      .replace(/\s+-\s+YouTube$/i, "")
      .trim()
      .slice(0, 300);
    const key = name.toLowerCase();
    if (name && !seen.has(key)) {
      seen.add(key);
      out.push(name);
    }
  }
  return out;
}

function isPlaybookFile(j: unknown): boolean {
  if (!j || typeof j !== "object") return false;
  const o = j as { kind?: unknown; items?: unknown };
  if (o.kind === "bigfish-objections") return true;
  return Array.isArray(o.items) && o.items.some((x) => x && typeof x === "object" && "title" in x && ("short" in x || "text" in x));
}

export function ImportPage() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<Stats | null>(null);
  const [playbookMsg, setPlaybookMsg] = useState<string | null>(null);
  // File bảng (Excel / CSV): chọn trang tính, dòng tiêu đề, ghép cột.
  const [sheets, setSheets] = useState<Sheet[] | null>(null);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [headerRow, setHeaderRow] = useState(0);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [defSegment, setDefSegment] = useState("");
  const [defSource, setDefSource] = useState("");
  const { settings, save } = useSettings();
  // Dán danh sách tên công ty.
  const [pasteText, setPasteText] = useState("");
  const [pasteSegment, setPasteSegment] = useState("");
  const [pasteSource, setPasteSource] = useState("");
  const [pasteAuto, setPasteAuto] = useState(true);
  // Công ty vừa nhập → Tìm website + Đọc website (liên hệ) + YouTube.
  const [importedIds, setImportedIds] = useState<string[]>([]);
  const [analyze, setAnalyze] = useState<{ ids: string[]; auto: boolean } | null>(null);
  const pasteNames = useMemo(() => parseNameList(pasteText), [pasteText]);

  /** File kịch bản xử lý từ chối ({kind:"bigfish-objections", items:[…]}) → gộp vào kho Xử lý từ chối. */
  async function importPlaybook(text: string) {
    const incoming = parseObjectionFile(text);
    if (!incoming.length) throw new Error("File kịch bản không có câu trả lời nào đọc được.");
    const { list, added, updated } = mergeObjections(getPlaybook(settings), incoming);
    const ok = await confirmDialog({
      title: `Nhập ${incoming.length} câu trả lời vào kho Xử lý từ chối?`,
      message: `Thêm mới ${added} câu, thay ${updated} câu trùng tiêu đề. Các câu khác giữ nguyên.`,
      confirmLabel: "Nhập",
    });
    if (!ok) return;
    const err = await save("objection_playbook", list);
    if (err) throw new Error(err);
    setPlaybookMsg(`Đã nhập kịch bản: thêm ${added}, cập nhật ${updated} câu trả lời.`);
  }

  function openSheet(list: Sheet[], i: number) {
    const h = findHeaderRow(list[i]?.rows ?? []);
    setSheets(list);
    setSheetIdx(i);
    setHeaderRow(h);
    setMapping(guessMapping(list[i]?.rows[h] ?? []));
  }

  const tableRows = sheets?.[sheetIdx]?.rows ?? null;
  const header = tableRows?.[headerRow] ?? [];
  const mapped = useMemo(
    () =>
      tableRows && mapping && mapping.company >= 0
        ? rowsToLeads(tableRows, headerRow, mapping, { segment: defSegment || undefined, source: defSource.trim() || "Excel" })
        : null,
    [tableRows, headerRow, mapping, defSegment, defSource],
  );
  const effectiveRows = sheets ? mapped : rows;

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setError(null);
    setResult(null);
    setRows(null);
    setPlaybookMsg(null);
    setSheets(null);
    setMapping(null);
    e.target.value = "";
    if (!f) return;
    setFileName(f.name);
    try {
      if (/\.xlsx$/i.test(f.name) || /\.csv$/i.test(f.name)) {
        const list = /\.xlsx$/i.test(f.name)
          ? await readXlsx(await f.arrayBuffer())
          : [{ name: f.name, rows: parseCsv(await f.text()) }];
        const first = Math.max(0, list.findIndex((x) => x.rows.length > 1));
        openSheet(list, first);
        setDefSource(f.name.replace(/\.(xlsx|csv)$/i, ""));
        return;
      }
      if (/\.xls$/i.test(f.name)) throw new Error("File .xls (Excel đời cũ) chưa đọc được. Mở file bằng Excel → Lưu thành → .xlsx rồi chọn lại.");
      const text = await f.text();
      let data: ImportRow[];
      if (/\.json$/i.test(f.name)) {
        const j = JSON.parse(text) as unknown;
        if (isPlaybookFile(j)) {
          await importPlaybook(text);
          return;
        }
        data = (Array.isArray(j) ? j : (j as { rows?: unknown }).rows) as ImportRow[];
        if (!Array.isArray(data)) throw new Error("File JSON phải là mảng lead (hoặc { rows: [...] }).");
      } else {
        throw new Error("Chỉ nhận file .xlsx, .csv hoặc .json.");
      }
      setRows(data.filter((r) => r && typeof r.name === "string" && r.name.trim()));
    } catch (err) {
      setError(errMsg(err));
    }
  }

  async function run(rows = effectiveRows, autoAnalyze = false) {
    if (!rows) return;
    setBusy(true);
    setError(null);
    setAnalyze(null);
    setImportedIds([]);
    const total: Stats = {};
    const ids = new Set<string>();
    try {
      for (let i = 0; i < rows.length; i += 100) {
        const { data, error } = await supabase.rpc("import_leads", { p_rows: rows.slice(i, i + 100) });
        if (error) throw error;
        for (const [k, v] of Object.entries((data ?? {}) as Record<string, unknown>)) {
          if (k === "company_ids") (v as string[]).forEach((x) => ids.add(x));
          else total[k] = (total[k] ?? 0) + Number(v);
        }
        setProgress(Math.min(rows.length, i + 100));
      }
      setResult(total);
      setImportedIds([...ids]);
      if (autoAnalyze && ids.size) setAnalyze({ ids: [...ids], auto: true });
    } catch (err) {
      setError(`${errMsg(err)} (đã nhập ${progress} dòng; chạy lại cùng file sẽ không nhân đôi dữ liệu)`);
      if (Object.keys(total).length) setResult(total);
    } finally {
      setBusy(false);
    }
  }

  const count = (f: (r: ImportRow) => number) => (effectiveRows ?? []).reduce((s, r) => s + f(r), 0);
  const bySeg = new Map<string, number>();
  const bySource = new Map<string, number>();
  for (const r of effectiveRows ?? []) {
    bySeg.set(r.segment ?? "", (bySeg.get(r.segment ?? "") ?? 0) + 1);
    bySource.set(r.source ?? "—", (bySource.get(r.source ?? "—") ?? 0) + 1);
  }

  return (
    <section>
      <PageHeader
        title="Nhập dữ liệu"
        description="Nhập danh sách lead / deal vào pipeline, hoặc file kịch bản xử lý từ chối. Công ty trùng tên hoặc domain được gộp; chạy lại cùng file không nhân đôi dữ liệu."
      />
      {!isAdmin && <Notice kind="info">Chỉ admin được nhập dữ liệu.</Notice>}
      <div className="card">
        <h2>Dán danh sách tên công ty</h2>
        <p className="muted small">
          Mỗi dòng một công ty (dán thẳng từ Excel cũng được). App đưa các công ty vào Pipeline, rồi tự tìm website trên Google, đọc
          website lấy email, số điện thoại, người phụ trách và tìm kênh YouTube.
        </p>
        <textarea
          rows={6}
          value={pasteText}
          disabled={!isAdmin || busy}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder={"Yeah1\nCông ty TNHH Truyền thông Sóng Việt\nFapTV"}
          aria-label="Danh sách tên công ty"
        />
        <div className="form-grid">
          <label>
            Nhóm khách
            <select value={pasteSegment} onChange={(e) => setPasteSegment(e.target.value)}>
              <option value="">— Chưa phân nhóm —</option>
              {SEGMENTS.map((sg) => (
                <option key={sg} value={sg}>
                  {SEGMENT_LABEL[sg]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Nguồn
            <input value={pasteSource} onChange={(e) => setPasteSource(e.target.value)} placeholder="VD: Danh sách MCN 11/2026" />
          </label>
        </div>
        <label className="checkbox">
          <input type="checkbox" checked={pasteAuto} onChange={(e) => setPasteAuto(e.target.checked)} />
          Nhập xong tự tìm website và thông tin liên hệ (mỗi công ty chưa có website tốn 1–2 lượt Google)
        </label>
        <div className="row">
          <button
            type="button"
            className="btn-primary"
            disabled={!isAdmin || busy || !pasteNames.length}
            onClick={() =>
              void run(
                pasteNames.map((name) => ({
                  name,
                  ...(pasteSegment ? { segment: pasteSegment } : {}),
                  source: pasteSource.trim() || "Danh sách dán tay",
                })) as ImportRow[],
                pasteAuto,
              )
            }
          >
            {busy ? `Đang nhập… ${progress}/${pasteNames.length}` : `Nhập ${pasteNames.length} công ty`}
          </button>
          {pasteNames.length > 0 && (
            <span className="small muted">
              {pasteNames.slice(0, 4).join(" · ")}
              {pasteNames.length > 4 ? ` · … (+${pasteNames.length - 4})` : ""}
            </span>
          )}
        </div>
      </div>
      <div className="card">
        <h2>1. Chọn file</h2>
        <p className="muted small">
          Nhận file <strong>Excel (.xlsx)</strong> hoặc <strong>.csv</strong> bất kỳ: mỗi dòng là một công ty hoặc một người liên hệ, app tự nhận
          ra các cột (tên công ty, website, người liên hệ, chức vụ, email, điện thoại…) và cho bạn chỉnh lại trước khi nhập. Cũng nhận file{" "}
          <strong>.json</strong> đầy đủ (kèm lịch sử điểm chạm) và file kịch bản xử lý từ chối.
        </p>
        <label className="file-drop">
          <Upload aria-hidden="true" />
          <span>{fileName || "Bấm để chọn file Excel, CSV hoặc JSON"}</span>
          <input
            type="file"
            accept=".xlsx,.xls,.csv,.json,application/json,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            disabled={!isAdmin || busy}
            onChange={(e) => void onFile(e)}
          />
        </label>
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      {playbookMsg && (
        <Notice kind="ok">
          {playbookMsg} <Link to="/library/objections">Mở Xử lý từ chối →</Link>
        </Notice>
      )}
      {sheets && mapping && tableRows && (
        <div className="card">
          <h2>2. Ghép cột</h2>
          <p className="small muted">App đã đoán sẵn — chỉ cần kiểm tra. Cột nào không dùng thì để “—”.</p>
          <div className="form-grid">
            {sheets.length > 1 && (
              <label>
                Trang tính
                <select value={sheetIdx} onChange={(e) => openSheet(sheets, Number(e.target.value))}>
                  {sheets.map((sh, i) => (
                    <option key={sh.name + i} value={i}>
                      {sh.name} ({Math.max(0, sh.rows.length - 1)} dòng)
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Dòng tiêu đề
              <select
                value={headerRow}
                onChange={(e) => {
                  const h = Number(e.target.value);
                  setHeaderRow(h);
                  setMapping(guessMapping(tableRows[h] ?? []));
                }}
              >
                {tableRows.slice(0, 10).map((r, i) => (
                  <option key={i} value={i}>
                    Dòng {i + 1}: {r.filter(Boolean).slice(0, 3).join(" | ").slice(0, 60) || "(trống)"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Nhóm khách khi file không ghi
              <select value={defSegment} onChange={(e) => setDefSegment(e.target.value)}>
                <option value="">— Chưa phân nhóm —</option>
                {SEGMENTS.map((sg) => (
                  <option key={sg} value={sg}>
                    {SEGMENT_LABEL[sg]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Nguồn (khi file không ghi)
              <input value={defSource} onChange={(e) => setDefSource(e.target.value)} placeholder="VD: Hội chợ ATF 2026" />
            </label>
          </div>
          <div className="map-grid">
            {LEAD_FIELDS.map((f) => (
              <label key={f.key} className={f.key === "company" && mapping.company < 0 ? "missing" : ""} title={f.hint}>
                {f.key === "company" ? `${f.label} *` : f.label}
                <select
                  value={mapping[f.key]}
                  onChange={(e) => setMapping({ ...mapping, [f.key]: Number(e.target.value) } as Record<LeadField, number>)}
                >
                  <option value={-1}>—</option>
                  {header.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `Cột ${i + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {mapping.company < 0 && <Notice kind="warn">Chọn cột chứa tên công ty để tiếp tục.</Notice>}
          {mapped && mapped.length > 0 && (
            <>
              <h3 className="sub">Xem trước 5 công ty đầu</h3>
              <TableWrap>
                <table>
                  <thead>
                    <tr>
                      <th>Công ty</th>
                      <th>Website</th>
                      <th>Nhóm</th>
                      <th>Thành phố</th>
                      <th>Người liên hệ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mapped.slice(0, 5).map((r) => (
                      <tr key={r.name}>
                        <td>
                          <strong>{r.name}</strong>
                          {r.tier && <span className="small muted"> · hạng {r.tier}</span>}
                        </td>
                        <td className="small">{r.domain ?? "—"}</td>
                        <td className="small">{r.segment ? SEGMENT_LABEL[r.segment as keyof typeof SEGMENT_LABEL] : "—"}</td>
                        <td className="small">{r.city ?? "—"}</td>
                        <td className="small">
                          {(r.contacts ?? []).map((c) => [c.full_name, c.job_title, c.email, c.phone].filter(Boolean).join(" · ")).join("; ") || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </>
          )}
        </div>
      )}
      {effectiveRows && (
        <div className="card">
          <h2>{sheets ? "3" : "2"}. Kiểm tra trước khi nhập</h2>
          <div className="grid kpis">
            <div className="stat">
              <span className="stat-label">Công ty</span>
              <span className="stat-value">{fmtNum(effectiveRows.length)}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Người liên hệ</span>
              <span className="stat-value">{fmtNum(count((r) => r.contacts?.length ?? 0))}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Điểm chạm lịch sử</span>
              <span className="stat-value">{fmtNum(count((r) => r.activities?.length ?? 0))}</span>
            </div>
          </div>
          <div className="grid two">
            <div>
              <h3>Theo nhóm khách</h3>
              <ul className="plain">
                {[...bySeg.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                  <li key={k}>
                    {k ? SEGMENT_LABEL[k as keyof typeof SEGMENT_LABEL] ?? k : "Chưa phân nhóm"}: <strong>{v}</strong>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Theo nguồn</h3>
              <ul className="plain">
                {[...bySource.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                  <li key={k}>
                    {k}: <strong>{v}</strong>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="row">
            <button type="button" className="btn-primary" disabled={!isAdmin || busy} onClick={() => void run(effectiveRows)}>
              {busy ? `Đang nhập… ${progress}/${effectiveRows.length}` : `Nhập ${effectiveRows.length} công ty`}
            </button>
          </div>
        </div>
      )}
      {result && (
        <div className="card">
          <h2>Kết quả</h2>
          <ul className="plain">
            {Object.entries(STAT_LABEL).map(([k, l]) => (
              <li key={k}>
                {l}: <strong>{fmtNum(result[k] ?? 0)}</strong>
              </li>
            ))}
          </ul>
          <div className="row">
            {importedIds.length > 0 && !analyze && (
              <button type="button" className="btn-primary" onClick={() => setAnalyze({ ids: importedIds, auto: true })}>
                Tìm website &amp; liên hệ cho {importedIds.length} công ty
              </button>
            )}
            <Link className="btn btn-primary" to="/">
              Mở Hôm nay
            </Link>
            <Link className="btn" to="/pipeline">
              Mở bảng pipeline
            </Link>
          </div>
        </div>
      )}
      {analyze && (
        <PipelineRunner
          key={analyze.ids.join(",")}
          companyIds={analyze.ids}
          batchSize={getBatchSize(settings)}
          findWebsite
          autoStart={analyze.auto}
        />
      )}
    </section>
  );
}
