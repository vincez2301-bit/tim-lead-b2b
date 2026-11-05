import { useEffect, useRef, useState } from "react";
import { useAuth } from "../lib/auth";
import { useSettings } from "../lib/settings";
import {
  DISQUALIFY_LABEL,
  DISQUALIFY_REASONS,
  DISQUALIFY_SUGGEST_WORDS,
  disqualifyCompanies,
  foldVi,
  type DisqualifyReason,
} from "../lib/pipeline";
import { Notice } from "./ui";

/**
 * Hộp thoại “Không phù hợp”: chọn lý do, ghi chú, và (tuỳ chọn) thêm từ khoá để lần tìm sau tự bỏ qua
 * công ty tương tự. Gọi onDone với câu thông báo khi xong.
 */
export function DisqualifyDialog({
  companies,
  onDone,
  onClose,
}: {
  companies: { id: string; name: string }[];
  onDone: (msg: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const { isAdmin } = useAuth();
  const { settings, save } = useSettings();
  const [reason, setReason] = useState<DisqualifyReason>("no_video");
  const [note, setNote] = useState("");
  const [addWords, setAddWords] = useState(false);
  const [words, setWords] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = (Array.isArray(settings["discover_exclude_words"]) ? settings["discover_exclude_words"] : []) as string[];

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => d?.close();
  }, []);
  useEffect(() => {
    const suggest = (DISQUALIFY_SUGGEST_WORDS[reason] ?? []).filter((w) => !current.some((c) => foldVi(c) === foldVi(w)));
    setWords(suggest.join(", "));
    setAddWords(suggest.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reason]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const r = await disqualifyCompanies(
        companies.map((c) => c.id),
        reason,
        note.trim(),
      );
      let extra = "";
      const list = words.split(/[,;\n]+/).map((w) => w.trim()).filter((w) => w.length >= 2);
      if (addWords && list.length && isAdmin) {
        const merged = [...current];
        for (const w of list) if (!merged.some((c) => foldVi(c) === foldVi(w))) merged.push(w);
        const err = await save("discover_exclude_words", merged);
        extra = err ? ` (chưa lưu được từ khoá tự loại: ${err})` : ` Lần tìm sau tự bỏ qua công ty có tên chứa: ${list.join(", ")}.`;
      }
      onDone(
        `Đã loại ${r.companies} công ty${r.deals_removed ? `, gỡ ${r.deals_removed} khỏi pipeline` : ""}${r.deals_closed ? `, đóng ${r.deals_closed} deal đã liên hệ` : ""}.${extra}`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const title = companies.length === 1 ? `“${companies[0].name}” không phù hợp?` : `Loại ${companies.length} công ty không phù hợp?`;
  return (
    <dialog ref={ref} className="dialog disqualify" onClose={onClose} aria-labelledby="dq-title">
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <h2 id="dq-title">{title}</h2>
        <p className="small muted">
          Lead chưa liên hệ được gỡ khỏi pipeline; khách đã liên hệ được đóng với lý do “Không phù hợp”. Xem lại hoặc khôi phục ở mục Công ty.
        </p>
        <div className="chips" role="radiogroup" aria-label="Lý do">
          {DISQUALIFY_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={reason === r}
              className={reason === r ? "chip on" : "chip"}
              onClick={() => setReason(r)}
            >
              {DISQUALIFY_LABEL[r]}
            </button>
          ))}
        </div>
        <label>
          Ghi chú (tuỳ chọn)
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="VD: chỉ tổ chức tiệc cưới, không làm video" />
        </label>
        {isAdmin && (
          <div className="exclude-box">
            <label className="checkbox inline">
              <input type="checkbox" checked={addWords} onChange={(e) => setAddWords(e.target.checked)} />
              Lần tìm sau tự bỏ qua công ty có tên chứa:
            </label>
            <input value={words} disabled={!addWords} onChange={(e) => setWords(e.target.value)} placeholder="event, sự kiện" />
          </div>
        )}
        {error && <Notice kind="error">{error}</Notice>}
        <div className="actions">
          <button type="button" onClick={() => ref.current?.close()} disabled={busy}>
            Huỷ
          </button>
          <button type="submit" className="btn-danger" disabled={busy}>
            {busy ? "Đang loại…" : companies.length === 1 ? "Loại lead này" : `Loại ${companies.length} công ty`}
          </button>
        </div>
      </form>
    </dialog>
  );
}
