import { useState, type ChangeEvent } from "react";
import { Link } from "react-router";
import { Upload } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { parseCsv } from "../lib/csv";
import { SEGMENTS, SEGMENT_LABEL, errMsg, fmtNum } from "../lib/format";
import { Notice, PageHeader } from "../components/ui";
import { confirmDialog } from "../components/dialog";
import { useSettings } from "../lib/settings";
import { getPlaybook, mergeObjections, parseObjectionFile } from "../lib/pipeline";

interface ImportRow {
  name: string;
  domain?: string;
  segment?: string;
  city?: string;
  source?: string;
  stage?: string;
  contacts?: { full_name?: string; job_title?: string; email?: string; phone?: string }[];
  activities?: unknown[];
  [k: string]: unknown;
}

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

const CSV_COLS = "company, domain, segment, city, source, contact_name, contact_title, contact_email, contact_phone, note";

function segmentCode(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const s = v.trim().toLowerCase();
  const hit = SEGMENTS.find((k) => k === s || SEGMENT_LABEL[k].toLowerCase() === s);
  if (hit) return hit;
  if (/đài|broadcast|television|\btv\b/.test(s)) return "broadcaster";
  if (/mcn|network|creator/.test(s)) return "mcn";
  if (/production|agency|studio/.test(s)) return "agency";
  if (/film|phim|post/.test(s)) return "film";
  if (/brand|nhãn/.test(s)) return "brand";
  return undefined;
}

/** CSV phẳng: mỗi dòng một người liên hệ; gộp theo tên công ty. */
function fromCsv(text: string): ImportRow[] {
  const [head, ...lines] = parseCsv(text);
  const idx = (k: string) => head.findIndex((h) => h.trim().toLowerCase() === k);
  const col = (r: string[], k: string) => {
    const i = idx(k);
    return i >= 0 ? (r[i] ?? "").trim() : "";
  };
  if (idx("company") < 0) throw new Error(`CSV cần cột "company". Các cột nhận: ${CSV_COLS}.`);
  const map = new Map<string, ImportRow>();
  for (const r of lines) {
    const name = col(r, "company");
    if (!name) continue;
    const key = name.toLowerCase();
    const row = map.get(key) ?? {
      name,
      domain: col(r, "domain") || undefined,
      segment: segmentCode(col(r, "segment")),
      city: col(r, "city") || undefined,
      source: col(r, "source") || "CSV",
      notes: col(r, "note") || undefined,
      contacts: [],
    };
    if (col(r, "contact_name") || col(r, "contact_email")) {
      row.contacts!.push({
        full_name: col(r, "contact_name"),
        job_title: col(r, "contact_title"),
        email: col(r, "contact_email"),
        phone: col(r, "contact_phone"),
      });
    }
    map.set(key, row);
  }
  return [...map.values()];
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
  const { settings, save } = useSettings();

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

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setError(null);
    setResult(null);
    setRows(null);
    setPlaybookMsg(null);
    e.target.value = "";
    if (!f) return;
    setFileName(f.name);
    try {
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
        data = fromCsv(text);
      }
      setRows(data.filter((r) => r && typeof r.name === "string" && r.name.trim()));
    } catch (err) {
      setError(errMsg(err));
    }
  }

  async function run() {
    if (!rows) return;
    setBusy(true);
    setError(null);
    const total: Stats = {};
    try {
      for (let i = 0; i < rows.length; i += 100) {
        const { data, error } = await supabase.rpc("import_leads", { p_rows: rows.slice(i, i + 100) });
        if (error) throw error;
        for (const [k, v] of Object.entries((data ?? {}) as Stats)) total[k] = (total[k] ?? 0) + Number(v);
        setProgress(Math.min(rows.length, i + 100));
      }
      setResult(total);
    } catch (err) {
      setError(`${errMsg(err)} (đã nhập ${progress} dòng; chạy lại cùng file sẽ không nhân đôi dữ liệu)`);
      if (Object.keys(total).length) setResult(total);
    } finally {
      setBusy(false);
    }
  }

  const count = (f: (r: ImportRow) => number) => (rows ?? []).reduce((s, r) => s + f(r), 0);
  const bySeg = new Map<string, number>();
  const bySource = new Map<string, number>();
  for (const r of rows ?? []) {
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
        <h2>1. Chọn file</h2>
        <p className="muted small">
          Nhận file <strong>.json</strong> (định dạng đầy đủ: lead, người liên hệ, lịch sử điểm chạm) hoặc <strong>.csv</strong> mỗi dòng một
          người liên hệ với các cột: <code>{CSV_COLS}</code>. File kịch bản xử lý từ chối (<code>kich-ban-tu-choi.json</code>) cũng nhập
          ở đây được — app tự nhận ra và đưa vào kho Xử lý từ chối.
        </p>
        <label className="file-drop">
          <Upload aria-hidden="true" />
          <span>{fileName || "Bấm để chọn file .json hoặc .csv"}</span>
          <input type="file" accept=".json,.csv,application/json,text/csv" disabled={!isAdmin || busy} onChange={(e) => void onFile(e)} />
        </label>
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      {playbookMsg && (
        <Notice kind="ok">
          {playbookMsg} <Link to="/library/objections">Mở Xử lý từ chối →</Link>
        </Notice>
      )}
      {rows && (
        <div className="card">
          <h2>2. Kiểm tra trước khi nhập</h2>
          <div className="grid kpis">
            <div className="stat">
              <span className="stat-label">Công ty</span>
              <span className="stat-value">{fmtNum(rows.length)}</span>
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
            <button type="button" className="btn-primary" disabled={!isAdmin || busy} onClick={() => void run()}>
              {busy ? `Đang nhập… ${progress}/${rows.length}` : `Nhập ${rows.length} công ty`}
            </button>
          </div>
        </div>
      )}
      {result && (
        <div className="card">
          <h2>3. Kết quả</h2>
          <ul className="plain">
            {Object.entries(STAT_LABEL).map(([k, l]) => (
              <li key={k}>
                {l}: <strong>{fmtNum(result[k] ?? 0)}</strong>
              </li>
            ))}
          </ul>
          <div className="row">
            <Link className="btn btn-primary" to="/">
              Mở Việc hôm nay
            </Link>
            <Link className="btn" to="/pipeline">
              Mở bảng pipeline
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
