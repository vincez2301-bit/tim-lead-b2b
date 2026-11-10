// Email gợi ý ngay dưới một lead ở trang Hôm nay: người nhận tốt nhất, tiêu đề + nội dung đã điền, Mở email / Chép / Đã gửi.
// Chỉ cho chặng tiếp cận (lead mới hoặc đang tiếp cận); việc khác vẫn mở khung khách đầy đủ.
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useSettings } from "../lib/settings";
import { canEmail, getContactRoles, rankContacts, type RankableContact } from "../lib/contacts";
import {
  getCadence,
  getPlaylists,
  getSender,
  getTemplates,
  loadPersonalFacts,
  logOutreachEmail,
  nextOutreachStep,
  personalLine,
  pickTemplate,
  renderTemplate,
  templateVars,
  type DealRow,
} from "../lib/pipeline";
import { errMsg } from "../lib/format";
import { CopyButton, Notice, Spinner } from "./ui";

interface Contact extends RankableContact {
  id: string;
}

/** Lead có email chặng tiếp cận để gợi ý ngay trên danh sách. */
export function hasQuickEmail(r: Pick<DealRow, "stage" | "outreach_emails">, cadence: ReturnType<typeof getCadence>): boolean {
  return ["new", "research", "outreach"].includes(r.stage) && !!nextOutreachStep(cadence, r.outreach_emails ?? 0);
}

export function QuickEmail({ row, onSent, onOpen }: { row: DealRow; onSent: (msg: string) => void; onOpen: () => void }) {
  const { session } = useAuth();
  const { settings } = useSettings();
  const cadence = getCadence(settings);
  const templates = getTemplates(settings);
  const step = nextOutreachStep(cadence, row.outreach_emails ?? 0);
  const template = step ? pickTemplate(templates, step.step, row.segment) : null;

  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [personal, setPersonal] = useState<string | null>(null);
  const [contactId, setContactId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      const [c, facts] = await Promise.all([
        supabase.from("contacts").select("id,full_name,job_title,email,email_label,source").eq("company_id", row.company_id),
        loadPersonalFacts(row.company_id),
      ]);
      if (!live) return;
      const { shown } = rankContacts((c.data ?? []) as Contact[], row.segment, getContactRoles(settings));
      const list = shown.filter(canEmail);
      setContacts(list);
      setContactId(list[0]?.id ?? "");
      setPersonal(personalLine(row.company_name, facts));
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.id]);

  const contact = contacts?.find((c) => c.id === contactId) ?? null;
  // Điền lại khi đổi người nhận (câu chào theo tên người nhận).
  useEffect(() => {
    if (!template || personal === null) return;
    const vars = templateVars({
      company: row.company_name,
      segment: row.segment,
      contactName: contact?.full_name ?? null,
      sender: getSender(settings),
      playlists: getPlaylists(settings),
      personal,
      firstSubject: pickTemplate(templates, 1, row.segment)?.subject,
    });
    setSubject(template.subject ? renderTemplate(template.subject, vars) : "");
    setBody(renderTemplate(template.body, vars));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template, contactId, personal]);

  if (!step || !template) {
    return <p className="small muted quick-email">Chưa có email mẫu cho bước này — mở khách để soạn.</p>;
  }
  if (contacts === null || personal === null) return <div className="quick-email"><Spinner /></div>;

  const mailto = contact?.email
    ? `mailto:${encodeURIComponent(contact.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    : null;

  async function sent() {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const note = `Email — ${template!.title}${contact ? ` (gửi ${contact.full_name ?? contact.email})` : ""}`;
      onSent(await logOutreachEmail({ row, cadence, userId: session.user.id, contactId: contact?.id ?? null, note }));
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="quick-email">
      {error && <Notice kind="error">{error}</Notice>}
      <div className="row space-between">
        <strong className="small">
          Email {step.step}/{cadence.filter((c) => c.step < 13).length} · {step.title}
        </strong>
        {contacts.length > 0 ? (
          <select className="input-sm" value={contactId} onChange={(e) => setContactId(e.target.value)} aria-label="Người nhận">
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name ? `${c.full_name} · ${c.email}` : c.email}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      {contacts.length === 0 && (
        <Notice kind="warn">
          Chưa có email người nhận.{" "}
          <button type="button" className="btn-link" onClick={onOpen}>
            Mở khách
          </button>{" "}
          để bấm “Tìm người phụ trách” hoặc thêm tay.
        </Notice>
      )}
      <label>
        Tiêu đề
        <input value={subject} onChange={(e) => setSubject(e.target.value)} />
      </label>
      <label>
        Nội dung
        <textarea rows={14} value={body} onChange={(e) => setBody(e.target.value)} />
      </label>
      {subject.startsWith("Re:") && (
        <p className="small muted">Nên trả lời trong luồng email mở lời đã gửi (hộp thư → Trả lời → dán nội dung bằng nút Chép).</p>
      )}
      {body.includes("[") && <Notice kind="warn">Còn chỗ trong ngoặc vuông [ … ] cần tự điền trước khi gửi.</Notice>}
      <div className="row">
        {mailto && (
          <a className="btn btn-primary" href={mailto}>
            Mở email
          </a>
        )}
        <CopyButton text={subject ? `${subject}\n\n${body}` : body} />
        <button type="button" disabled={busy} onClick={() => void sent()}>
          {busy ? "Đang ghi…" : "Đã gửi"}
        </button>
        <button type="button" className="btn-link small" onClick={onOpen}>
          Mở khách
        </button>
      </div>
    </div>
  );
}
