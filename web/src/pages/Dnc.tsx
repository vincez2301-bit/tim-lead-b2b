import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { parseCsv } from "../lib/csv";
import type { DncReason, DncRow } from "../lib/db-types";
import { DNC_REASONS, DNC_REASON_LABEL, errMsg, fmtDate, fmtNum } from "../lib/format";
import { useDebounced } from "../lib/hooks";
import { Notice, PageHeader, Spinner, TableWrap } from "../components/ui";
import { confirmDialog } from "../components/dialog";

type Kind = "domain" | "email";
interface NewRow {
  kind: Kind;
  value: string;
  reason: DncReason;
  note: string | null;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const DOMAIN_RE = /^(https?:\/\/)?(www\.)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(\/.*)?$/i;

function detectKind(v: string): Kind | null {
  if (EMAIL_RE.test(v)) return "email";
  if (DOMAIN_RE.test(v)) return "domain";
  return null;
}

/** CSV có header kind,value,reason,note — hoặc mỗi dòng một domain/email (tự nhận dạng). */
function rowsFromCsv(text: string, defaultReason: DncReason): { rows: NewRow[]; invalid: string[] } {
  const table = parseCsv(text);
  const rows: NewRow[] = [];
  const invalid: string[] = [];
  if (table.length === 0) return { rows, invalid };
  const header = table[0].map((h) => h.toLowerCase());
  const hasHeader = header.includes("value");
  const idx = (n: string) => header.indexOf(n);
  for (const r of hasHeader ? table.slice(1) : table) {
    const value = (hasHeader ? r[idx("value")] : r[0])?.trim() ?? "";
    if (!value) continue;
    let kind = (hasHeader && idx("kind") >= 0 ? r[idx("kind")]?.toLowerCase() : "") as Kind | "";
    if (kind !== "domain" && kind !== "email") kind = detectKind(value) ?? "";
    const reasonRaw = hasHeader && idx("reason") >= 0 ? r[idx("reason")]?.toLowerCase() : "";
    const reason = (DNC_REASONS as string[]).includes(reasonRaw ?? "") ? (reasonRaw as DncReason) : defaultReason;
    const note = hasHeader && idx("note") >= 0 ? r[idx("note")] || null : null;
    if (!kind || (kind === "email" && !EMAIL_RE.test(value)) || (kind === "domain" && !DOMAIN_RE.test(value))) {
      invalid.push(value);
      continue;
    }
    rows.push({ kind, value, reason, note });
  }
  return { rows, invalid };
}

export function DncPage() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<DncRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [kind, setKind] = useState<Kind>("domain");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState<DncReason>("existing_customer");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const [importReason, setImportReason] = useState<DncReason>("other");
  const [importPreview, setImportPreview] = useState<{ rows: NewRow[]; invalid: string[] } | null>(null);

  const [fKind, setFKind] = useState<Kind>("email");
  const [fValue, setFValue] = useState("");
  const [fNote, setFNote] = useState("");

  const dSearch = useDebounced(search, 300);

  const load = useCallback(async () => {
    let qb = supabase.from("do_not_contact").select("*", { count: "exact" });
    const s = dSearch.trim().replace(/[%_\\]/g, "");
    if (s) qb = qb.ilike("value", `%${s}%`);
    const { data, count, error } = await qb.order("created_at", { ascending: false }).limit(500);
    if (error) setError(error.message);
    setRows((data ?? []) as DncRow[]);
    setTotal(count ?? 0);
  }, [dSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    const { error } = await supabase
      .from("do_not_contact")
      .insert({ kind, value: value.trim(), reason, note: note.trim() || null });
    if (error) setError(error.code === "23505" ? "Giá trị này đã có trong danh sách." : error.message);
    else {
      setInfo(`Đã thêm ${value.trim()}.`);
      setValue("");
      setNote("");
      await load();
    }
    setBusy(false);
  }

  async function remove(r: DncRow) {
    if (!(await confirmDialog({ title: `Xoá ${r.value} khỏi danh sách loại trừ?`, message: "Công ty/email này có thể được thu thập lại.", confirmLabel: "Xoá", danger: true }))) return;
    const { error } = await supabase.from("do_not_contact").delete().eq("id", r.id);
    if (error) setError(error.message);
    await load();
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    setError(null);
    setInfo(null);
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError("File quá lớn (tối đa 2MB).");
      return;
    }
    const text = await file.text();
    setImportPreview(rowsFromCsv(text, importReason));
  }

  async function doImport() {
    if (!importPreview) return;
    setBusy(true);
    setError(null);
    let ok = 0;
    const failed: string[] = [];
    const list = importPreview.rows;
    for (let i = 0; i < list.length; i += 200) {
      const chunk = list.slice(i, i + 200);
      const { error } = await supabase
        .from("do_not_contact")
        .upsert(chunk, { onConflict: "kind,value", ignoreDuplicates: true });
      if (!error) {
        ok += chunk.length;
        continue;
      }
      // Một dòng lỗi làm hỏng cả lô → thử từng dòng để biết dòng nào sai.
      for (const r of chunk) {
        const { error: e1 } = await supabase
          .from("do_not_contact")
          .upsert([r], { onConflict: "kind,value", ignoreDuplicates: true });
        if (e1) failed.push(r.value);
        else ok++;
      }
    }
    setInfo(`Đã import ${ok} dòng (bỏ qua trùng lặp).`);
    if (failed.length) setError(`${failed.length} dòng bị từ chối: ${failed.slice(0, 10).join(", ")}${failed.length > 10 ? "…" : ""}`);
    setImportPreview(null);
    setBusy(false);
    await load();
  }

  async function forget(e: FormEvent) {
    e.preventDefault();
    const v = fValue.trim();
    if (!v) return;
    if (
      !(await confirmDialog({
        title: `Xoá toàn bộ dữ liệu của ${v}?`,
        message: `Xoá ${fKind === "domain" ? "công ty, observation, liên hệ" : "liên hệ và email"} liên quan rồi thêm vào danh sách loại trừ. Không thể hoàn tác.`,
        confirmLabel: "Xoá vĩnh viễn",
        danger: true,
      }))
    )
      return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const { data, error } = await supabase.rpc("forget_subject", {
      p_kind: fKind,
      p_value: v,
      p_reason: "opted_out",
      p_note: fNote.trim() || null,
    });
    if (error) setError(errMsg(error));
    else {
      const d = (data ?? {}) as Record<string, number>;
      setInfo(
        `Đã xử lý yêu cầu xoá cho ${v}: ${d.companies_deleted ?? 0} công ty, ${d.contacts_deleted ?? 0} liên hệ, ${d.observations_deleted ?? 0} observation đã xoá; đã thêm vào DNC.`,
      );
      setFValue("");
      setFNote("");
      await load();
    }
    setBusy(false);
  }

  return (
    <section>
      <PageHeader
        title="Danh sách loại trừ"
        description="Khách hàng hiện tại, đối thủ hoặc người yêu cầu không liên hệ. Domain/email ở đây bị bỏ qua ở mọi nơi: tìm kiếm, đọc website, cohort và xuất file."
      />
      {error && <Notice kind="error">{error}</Notice>}
      {info && <Notice kind="ok">{info}</Notice>}

      {isAdmin ? (
        <div className="grid two">
          <form className="card" onSubmit={(e) => void add(e)}>
            <h2>Thêm</h2>
            <div className="form-grid">
              <label>
                Loại
                <select value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
                  <option value="domain">Domain</option>
                  <option value="email">Email</option>
                </select>
              </label>
              <label>
                Lý do
                <select value={reason} onChange={(e) => setReason(e.target.value as DncReason)}>
                  {DNC_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {DNC_REASON_LABEL[r]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              {kind === "domain" ? "Domain (vd. congty.vn)" : "Email"}
              <input required value={value} onChange={(e) => setValue(e.target.value)} />
            </label>
            <label>
              Ghi chú
              <input value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            <button type="submit" className="btn-primary" disabled={busy}>
              Thêm vào DNC
            </button>
          </form>

          <div className="card">
            <h2>Import CSV</h2>
            <p className="small muted">
              Header <code>kind,value,reason,note</code>, hoặc mỗi dòng một domain/email (tự nhận dạng). Lý do mặc định:
            </p>
            <select value={importReason} onChange={(e) => setImportReason(e.target.value as DncReason)}>
              {DNC_REASONS.map((r) => (
                <option key={r} value={r}>
                  {DNC_REASON_LABEL[r]}
                </option>
              ))}
            </select>
            <input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={(e) => void onFile(e)} />
            {importPreview && (
              <div>
                <p>
                  Hợp lệ: <strong>{importPreview.rows.length}</strong> dòng
                  {importPreview.invalid.length > 0 && (
                    <>
                      {" "}
                      · không hợp lệ: {importPreview.invalid.length} (
                      {importPreview.invalid.slice(0, 5).join(", ")}
                      {importPreview.invalid.length > 5 ? "…" : ""})
                    </>
                  )}
                </p>
                <div className="row">
                  <button type="button" className="btn-primary" disabled={busy || importPreview.rows.length === 0} onClick={() => void doImport()}>
                    Import {importPreview.rows.length} dòng
                  </button>
                  <button type="button" className="btn-link" onClick={() => setImportPreview(null)}>
                    Huỷ
                  </button>
                </div>
              </div>
            )}
          </div>

          <form className="card danger" onSubmit={(e) => void forget(e)}>
            <h2>Xoá dữ liệu theo yêu cầu</h2>
            <p className="small muted">
              Dùng khi cá nhân/công ty yêu cầu xoá dữ liệu (quyền yêu cầu xoá). Dữ liệu liên quan bị xoá, giá trị được thêm
              vào DNC để không thu thập lại, và thao tác được ghi audit.
            </p>
            <div className="form-grid">
              <label>
                Loại
                <select value={fKind} onChange={(e) => setFKind(e.target.value as Kind)}>
                  <option value="email">Email</option>
                  <option value="domain">Domain</option>
                </select>
              </label>
              <label>
                Giá trị
                <input required value={fValue} onChange={(e) => setFValue(e.target.value)} />
              </label>
            </div>
            <label>
              Ghi chú (vd. mã yêu cầu)
              <input value={fNote} onChange={(e) => setFNote(e.target.value)} />
            </label>
            <button type="submit" className="btn-danger" disabled={busy}>
              Xoá dữ liệu và thêm DNC
            </button>
          </form>
        </div>
      ) : (
        <Notice kind="info">Chỉ admin được thêm/xoá. Bạn đang xem ở chế độ chỉ đọc.</Notice>
      )}

      <div className="card">
        <div className="row space-between">
          <h2>Danh sách ({fmtNum(total)})</h2>
          <input placeholder="Tìm…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Tìm trong DNC" />
        </div>
        {!rows ? (
          <Spinner />
        ) : (
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th>Loại</th>
                  <th>Giá trị</th>
                  <th>Lý do</th>
                  <th>Ghi chú</th>
                  <th>Ngày thêm</th>
                  {isAdmin && <th></th>}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="muted">
                      Trống.
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.kind === "domain" ? "Domain" : "Email"}</td>
                    <td>{r.value}</td>
                    <td>{DNC_REASON_LABEL[r.reason] ?? r.reason}</td>
                    <td className="small">{r.note ?? ""}</td>
                    <td className="small">{fmtDate(r.created_at)}</td>
                    {isAdmin && (
                      <td>
                        <button type="button" className="btn-link" onClick={() => void remove(r)}>
                          Xoá
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
        {total > 500 && <p className="small muted">Hiển thị 500 mục mới nhất — dùng ô tìm kiếm để lọc.</p>}
      </div>
    </section>
  );
}
