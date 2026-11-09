// Khung “Tiến độ chốt” cho khách đã trả lời: bước 13–19, báo giá nhanh, khách đồng ý, đã ký.
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Copy, FileText, Plus, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useSettings } from "../lib/settings";
import { errMsg } from "../lib/format";
import { canEmail } from "../lib/contacts";
import {
  QUOTE_STEP,
  SIGN_STEP,
  STAGE_LABEL,
  addDays,
  addressFor,
  closeStep,
  fmtDay,
  fmtUsd,
  parseAmount,
  signature,
  todayIso,
  type Activity,
  type CadenceStep,
  type Channel,
  type Deal,
  type DealRow,
  type Outcome,
  type Sender,
} from "../lib/pipeline";
import {
  QUOTE_STATUS_LABEL,
  expiryText,
  fmtMoney,
  getPriceBook,
  loadQuotes,
  quoteEmail,
  quoteTotals,
  toAnnualUsd,
  type Currency,
  type PriceBook,
  type Quote,
  type QuoteLine,
} from "../lib/quotes";
import { Badge, Notice } from "./ui";

interface ContactLite {
  id: string;
  full_name: string | null;
  job_title?: string | null;
  email: string | null;
  email_label?: string | null;
}

export type LogFn = (a: {
  channel: Channel;
  outcome: Outcome;
  note: string;
  contactId: string | null;
  step?: number | null;
  patch?: Partial<Deal>;
  msg?: string;
}) => Promise<void>;

type Mode = "" | "quote" | "send" | "agree" | "won";

export function ClosePlan({
  deal,
  acts,
  cadence,
  contacts,
  sender,
  busy,
  log,
  setError,
}: {
  deal: DealRow;
  acts: Activity[];
  cadence: CadenceStep[];
  contacts: ContactLite[];
  sender: Sender;
  busy: boolean;
  log: LogFn;
  setError: (s: string | null) => void;
}) {
  const { settings } = useSettings();
  const book = useMemo(() => getPriceBook(settings), [settings]);
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [mode, setMode] = useState<Mode>("");
  const [sending, setSending] = useState<Quote | null>(null);

  const done = useMemo(() => new Set(acts.map((a) => a.step).filter((n): n is number => n !== null)), [acts]);
  const steps = cadence.filter((c) => c.step >= 13 && c.step <= SIGN_STEP);
  const current = closeStep(cadence, deal.stage, done);

  const reloadQuotes = useCallback(async () => {
    try {
      const q = await loadQuotes(deal.id);
      setQuotes(q);
      return q;
    } catch (e) {
      setError(errMsg(e));
      return [];
    }
  }, [deal.id, setError]);
  useEffect(() => {
    void reloadQuotes().then((q) => {
      // Tới bước gửi báo giá mà chưa có báo giá: mở sẵn form.
      if (!q.length && current?.step === QUOTE_STEP) setMode("quote");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadQuotes]);

  const latest = quotes?.find((q) => q.status !== "declined") ?? null;
  const exp = latest?.status === "sent" ? expiryText(latest.valid_until) : null;
  const daysInStage = Math.max(0, Math.floor((Date.now() - new Date(deal.stage_changed_at).getTime()) / 86_400_000));

  async function acceptLatest() {
    if (latest?.status === "sent") await supabase.from("quotes").update({ status: "accepted" }).eq("id", latest.id);
  }
  const lastChannel = acts[0]?.channel ?? "email";

  return (
    <div className="close-plan">
      <div className="row space-between">
        <strong>Tiến độ chốt</strong>
        <span className="small muted">
          {STAGE_LABEL[deal.stage]} · {daysInStage === 0 ? "từ hôm nay" : `${daysInStage} ngày ở giai đoạn này`}
          {deal.expected_close ? ` · dự kiến ký ${fmtDay(deal.expected_close)}` : ""}
        </span>
      </div>
      {steps.length > 0 && (
        <ol className="close-steps">
          {steps.map((s) => {
            const st = done.has(s.step) ? "done" : current?.step === s.step ? "current" : "";
            return (
              <li key={s.step} className={st} aria-current={st === "current" ? "step" : undefined}>
                <span className="dot" aria-hidden="true">
                  {st === "done" ? "✓" : s.step}
                </span>
                {s.title}
              </li>
            );
          })}
        </ol>
      )}
      {latest && (
        <div className={exp?.urgent ? "quote-line urgent" : "quote-line"}>
          <span>
            <strong>{latest.number}</strong> · {fmtMoney(latest.total, latest.currency)} · {QUOTE_STATUS_LABEL[latest.status]}
            {exp && ` · ${exp.text}`}
          </span>
          <span className="row nowrap">
            <a className="btn-link small" href={`/quotes/${latest.id}`} target="_blank" rel="noopener">
              In / PDF
            </a>
            {latest.status === "sent" && (
              <button type="button" className="btn-link small" onClick={() => (setSending(latest), setMode("send"))}>
                Email gửi báo giá
              </button>
            )}
          </span>
        </div>
      )}
      <div className="row">
        <button
          type="button"
          className={["connected", "meeting"].includes(deal.stage) ? "btn-sm btn-primary" : "btn-sm"}
          onClick={() => setMode(mode === "quote" ? "" : "quote")}
        >
          <FileText aria-hidden="true" /> {latest ? "Tạo báo giá mới" : "Tạo báo giá"}
        </button>
        {deal.stage !== "commit" && (
          <button type="button" className={deal.stage === "proposal" ? "btn-sm btn-primary" : "btn-sm"} onClick={() => setMode(mode === "agree" ? "" : "agree")}>
            Khách đồng ý
          </button>
        )}
        <button type="button" className={deal.stage === "commit" ? "btn-sm btn-primary" : "btn-sm"} onClick={() => setMode(mode === "won" ? "" : "won")}>
          Đã ký hợp đồng
        </button>
      </div>

      {mode === "quote" && (
        <QuoteForm
          deal={deal}
          contacts={contacts}
          book={book}
          setError={setError}
          onCancel={() => setMode("")}
          onCreated={async (q) => {
            await reloadQuotes();
            setSending(q);
            setMode("send");
          }}
        />
      )}
      {mode === "send" && sending && (
        <SendQuote
          quote={sending}
          deal={deal}
          contacts={contacts}
          sender={sender}
          busy={busy}
          onSent={async (contactId) => {
            await log({
              channel: "email",
              outcome: "done",
              note: `Gửi báo giá ${sending.number}: ${fmtMoney(sending.total, sending.currency)}`,
              contactId,
              step: QUOTE_STEP,
              patch: {
                next_action: `Theo dõi báo giá ${sending.number}`,
                next_action_at: addDays(todayIso(), 2),
                ...(deal.expected_close ? {} : { expected_close: sending.valid_until }),
              },
              msg: `Đã gửi báo giá ${sending.number} → Đề xuất. Hai ngày nữa app nhắc gửi email theo dõi; báo giá hết hạn ${fmtDay(sending.valid_until)}.`,
            });
            setMode("");
          }}
          onClose={() => setMode("")}
        />
      )}
      {mode === "agree" && (
        <AgreeForm
          busy={busy}
          defaultDate={deal.expected_close && deal.expected_close >= todayIso() ? deal.expected_close : addDays(todayIso(), 7)}
          onCancel={() => setMode("")}
          onSubmit={async (date) => {
            await acceptLatest();
            await log({
              channel: lastChannel,
              outcome: "positive",
              note: "Khách đồng ý — chờ ký hợp đồng",
              contactId: null,
              step: null,
              patch: { stage: "commit", next_action: "Gửi hợp đồng để khách ký", next_action_at: todayIso(), expected_close: date },
              msg: "Khách đồng ý → Chờ ký. Việc hôm nay: gửi hợp đồng (mẫu email ở bước 19).",
            });
            setMode("");
          }}
        />
      )}
      {mode === "won" && (
        <WonForm
          busy={busy}
          defaultArr={latest?.annual_usd ?? deal.est_arr_usd}
          onCancel={() => setMode("")}
          onSubmit={async (f) => {
            await acceptLatest();
            await log({
              channel: "other",
              outcome: "positive",
              note: `Đã ký hợp đồng${f.arr ? ` · ARR ${fmtUsd(f.arr)}` : ""}`,
              contactId: null,
              step: SIGN_STEP,
              patch: {
                stage: "won",
                signed_at: f.signed,
                effective_at: f.effective,
                ...(f.arr !== null ? { est_arr_usd: f.arr } : {}),
                next_action: null,
                next_action_at: null,
              },
              msg: `Chúc mừng! ${deal.company_name} đã ký. App sẽ nhắc chốt gia hạn trước ngày hết hạn 90 ngày.`,
            });
          }}
        />
      )}

      {quotes && quotes.length > 1 && (
        <details className="small">
          <summary>Báo giá đã tạo ({quotes.length})</summary>
          <ul className="plain-list">
            {quotes.map((q) => (
              <li key={q.id} className="row space-between">
                <span>
                  {q.number} · {fmtMoney(q.total, q.currency)} · hạn {fmtDay(q.valid_until)}
                </span>
                <span className="row nowrap">
                  <Badge tone={q.status === "accepted" ? "green" : q.status === "declined" ? "gray" : "blue"}>{QUOTE_STATUS_LABEL[q.status]}</Badge>
                  <a className="btn-link small" href={`/quotes/${q.id}`} target="_blank" rel="noopener">
                    In
                  </a>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Form báo giá
interface LineDraft {
  name: string;
  detail: string;
  qty: string;
  price: string;
  unit: string;
}
const blankLine = (): LineDraft => ({ name: "", detail: "", qty: "1", price: "", unit: "năm" });
const fromBook = (it: PriceBook["items"][number]): LineDraft => ({
  name: it.name,
  detail: it.detail ?? "",
  qty: "1",
  price: String(it.unit_price),
  unit: it.unit ?? "năm",
});

function QuoteForm({
  deal,
  contacts,
  book,
  setError,
  onCancel,
  onCreated,
}: {
  deal: DealRow;
  contacts: ContactLite[];
  book: PriceBook;
  setError: (s: string | null) => void;
  onCancel: () => void;
  onCreated: (q: Quote) => Promise<void>;
}) {
  const [lines, setLines] = useState<LineDraft[]>(() => [book.items.length ? fromBook(book.items[0]) : blankLine()]);
  const [currency, setCurrency] = useState<Currency>(book.currency);
  const [discount, setDiscount] = useState("0");
  const [validUntil, setValidUntil] = useState(addDays(todayIso(), book.valid_days));
  const [terms, setTerms] = useState(book.terms);
  const [contactId, setContactId] = useState((contacts.find(canEmail) ?? contacts[0])?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const parsed: (QuoteLine | null)[] = lines.map((l) => {
    const qty = Number(l.qty.replace(",", "."));
    const price = parseAmount(l.price);
    return l.name.trim() && qty > 0 && price !== null ? { name: l.name.trim(), detail: l.detail.trim() || undefined, qty, unit_price: price, unit: l.unit.trim() || undefined } : null;
  });
  const disc = Math.min(100, Math.max(0, Number(discount.replace(",", ".")) || 0));
  const ok = parsed.filter((x): x is QuoteLine => !!x);
  const totals = quoteTotals(ok, disc, currency);
  const set = (i: number, k: keyof LineDraft) => (e: { target: { value: string } }) =>
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: e.target.value } : l)));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setProblem(null);
    const bad = parsed.findIndex((x) => !x);
    if (bad >= 0) return setProblem(`Dòng ${bad + 1}: cần tên gói, số lượng lớn hơn 0 và đơn giá (ví dụ 2400 hoặc 2.400).`);
    if (validUntil < todayIso()) return setProblem("Ngày hết hạn báo giá phải từ hôm nay trở đi.");
    setBusy(true);
    try {
      const contact = contacts.find((c) => c.id === contactId);
      const annual = toAnnualUsd(totals.total, currency, book.usd_vnd);
      const ins = await supabase
        .from("quotes")
        .insert({
          deal_id: deal.id,
          currency,
          items: ok,
          discount_pct: disc,
          annual_usd: annual,
          valid_until: validUntil,
          terms: terms.trim() || null,
          contact_name: contact?.full_name ?? null,
        })
        .select()
        .single();
      if (ins.error) throw ins.error;
      const q = ins.data as Quote;
      const up = await supabase
        .from("deals")
        .update({ est_arr_usd: annual, next_action: `Gửi báo giá ${q.number} cho khách`, next_action_at: todayIso() })
        .eq("id", deal.id);
      if (up.error) throw up.error;
      await onCreated(q);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="quote-form" onSubmit={(e) => void submit(e)}>
      <div className="row space-between">
        <strong>Báo giá cho {deal.company_name}</strong>
        {book.items.length === 0 && <span className="small muted">Bảng giá trống — điền giá ở Cài đặt → Bảng giá để chọn nhanh.</span>}
      </div>
      <div className="quote-lines">
        <div className="quote-line-head small muted" aria-hidden="true">
          <span>Gói / hạng mục</span>
          <span>SL</span>
          <span>Đơn giá ({currency})</span>
          <span>Đơn vị</span>
          <span />
        </div>
        {lines.map((l, i) => (
          <div key={i} className="quote-line-row">
            <div className="stack-tight">
              <input aria-label={`Tên dòng ${i + 1}`} value={l.name} onChange={set(i, "name")} placeholder="Tên gói" />
              <input aria-label={`Mô tả dòng ${i + 1}`} className="input-detail" value={l.detail} onChange={set(i, "detail")} placeholder="Mô tả: số người dùng, kênh, nền tảng…" />
            </div>
            <input aria-label={`Số lượng dòng ${i + 1}`} inputMode="decimal" value={l.qty} onChange={set(i, "qty")} />
            <input aria-label={`Đơn giá dòng ${i + 1}`} inputMode="decimal" value={l.price} onChange={set(i, "price")} placeholder="2.400" />
            <input aria-label={`Đơn vị dòng ${i + 1}`} value={l.unit} onChange={set(i, "unit")} />
            <button
              type="button"
              className="btn-icon"
              aria-label={`Xoá dòng ${i + 1}`}
              disabled={lines.length === 1}
              onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
            >
              <Trash2 />
            </button>
          </div>
        ))}
      </div>
      <div className="row">
        {book.items.length > 0 && (
          <select
            className="input-sm quote-add"
            value=""
            aria-label="Thêm gói từ bảng giá"
            onChange={(e) => {
              const it = book.items[Number(e.target.value)];
              if (it) setLines((ls) => [...ls, fromBook(it)]);
            }}
          >
            <option value="">+ Thêm gói từ bảng giá…</option>
            {book.items.map((it, i) => (
              <option key={i} value={i}>
                {it.name} — {fmtMoney(it.unit_price, book.currency)}
                {it.unit ? `/${it.unit}` : ""}
              </option>
            ))}
          </select>
        )}
        <button type="button" className="btn-sm" disabled={lines.length >= 20} onClick={() => setLines((ls) => [...ls, blankLine()])}>
          <Plus aria-hidden="true" /> Dòng trống
        </button>
      </div>
      <div className="form-grid">
        <label>
          Tiền tệ
          <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
            <option value="USD">USD</option>
            <option value="VND">VND</option>
          </select>
        </label>
        <label>
          Giảm giá (%)
          <input inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} />
        </label>
        <label>
          Hiệu lực đến
          <input type="date" value={validUntil} min={todayIso()} onChange={(e) => setValidUntil(e.target.value)} />
        </label>
        {contacts.length > 0 && (
          <label>
            Người nhận
            <select value={contactId} onChange={(e) => setContactId(e.target.value)}>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name ?? c.email}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <label>
        Điều khoản
        <textarea rows={4} value={terms} onChange={(e) => setTerms(e.target.value)} />
      </label>
      <div className="quote-total">
        <span>Tạm tính {fmtMoney(totals.subtotal, currency)}</span>
        {disc > 0 && <span>Giảm {disc}%: −{fmtMoney(totals.discount, currency)}</span>}
        <strong>Tổng {fmtMoney(totals.total, currency)}</strong>
        {currency === "VND" && <span className="small muted">≈ {fmtUsd(toAnnualUsd(totals.total, "VND", book.usd_vnd))} (tỷ giá {book.usd_vnd.toLocaleString("vi-VN")})</span>}
      </div>
      {problem && <Notice kind="error">{problem}</Notice>}
      <div className="row">
        <button type="submit" className="btn-primary" disabled={busy || !ok.length}>
          {busy ? "Đang tạo…" : "Tạo báo giá"}
        </button>
        <button type="button" onClick={onCancel}>
          Huỷ
        </button>
        <span className="small muted">Tạo xong: in / lưu PDF và soạn sẵn email có số tiền. ARR dự kiến của deal cập nhật theo tổng.</span>
      </div>
    </form>
  );
}

// ------------------------------------------------------------------ Gửi báo giá
function SendQuote({
  quote,
  deal,
  contacts,
  sender,
  busy,
  onSent,
  onClose,
}: {
  quote: Quote;
  deal: DealRow;
  contacts: ContactLite[];
  sender: Sender;
  busy: boolean;
  onSent: (contactId: string | null) => Promise<void>;
  onClose: () => void;
}) {
  const withEmail = contacts.filter(canEmail);
  const [contactId, setContactId] = useState((withEmail[0] ?? contacts[0])?.id ?? "");
  const contact = contacts.find((c) => c.id === contactId) ?? null;
  const draft = useMemo(
    () => quoteEmail(quote, { ...addressFor(contact?.full_name ?? null, deal.company_name), cong_ty: deal.company_name, chu_ky: signature(sender) }),
    [quote, contact?.full_name, deal.company_name, sender],
  );
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  useEffect(() => {
    setSubject(draft.subject);
    setBody(draft.body);
  }, [draft]);
  const [copied, setCopied] = useState(false);
  const mailto = contact?.email
    ? `mailto:${encodeURIComponent(contact.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    : null;

  return (
    <div className="compose">
      <div className="row space-between">
        <strong>Gửi báo giá {quote.number}</strong>
        {contacts.length > 0 && (
          <select className="input-sm" value={contactId} onChange={(e) => setContactId(e.target.value)} aria-label="Người nhận">
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name ?? c.email}
                {c.email ? "" : " (chưa có email)"}
              </option>
            ))}
          </select>
        )}
      </div>
      <ol className="small steps-inline">
        <li>
          Bấm{" "}
          <a href={`/quotes/${quote.id}`} target="_blank" rel="noopener">
            In / Lưu PDF
          </a>{" "}
          → chọn “Lưu dưới dạng PDF”.
        </li>
        <li>Mở email, đính kèm file PDF, gửi.</li>
        <li>Bấm “✓ Đã gửi báo giá”: app chuyển khách sang Đề xuất và hẹn ngày gửi email theo dõi.</li>
      </ol>
      <label>
        Tiêu đề
        <input value={subject} onChange={(e) => setSubject(e.target.value)} />
      </label>
      <label>
        Nội dung
        <textarea rows={14} value={body} onChange={(e) => setBody(e.target.value)} />
      </label>
      <div className="row">
        <a className="btn" href={`/quotes/${quote.id}`} target="_blank" rel="noopener">
          <FileText aria-hidden="true" /> In / Lưu PDF
        </a>
        {mailto && (
          <a className="btn" href={mailto}>
            Mở email
          </a>
        )}
        <button
          type="button"
          onClick={() =>
            void navigator.clipboard?.writeText(`${subject}\n\n${body}`).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            })
          }
        >
          <Copy aria-hidden="true" /> {copied ? "Đã chép" : "Chép nội dung"}
        </button>
        <button type="button" className="btn-primary" disabled={busy} onClick={() => void onSent(contactId || null)}>
          ✓ Đã gửi báo giá
        </button>
        <button type="button" className="btn-link small" onClick={onClose}>
          Để sau
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Khách đồng ý / Đã ký
function AgreeForm({
  busy,
  defaultDate,
  onCancel,
  onSubmit,
}: {
  busy: boolean;
  defaultDate: string;
  onCancel: () => void;
  onSubmit: (date: string) => Promise<void>;
}) {
  const [date, setDate] = useState(defaultDate);
  return (
    <form
      className="inline-form"
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit(date || defaultDate);
      }}
    >
      <label>
        Ngày dự kiến ký
        <input type="date" value={date} min={todayIso()} onChange={(e) => setDate(e.target.value)} />
      </label>
      <button type="submit" className="btn-primary" disabled={busy}>
        Chuyển sang Chờ ký
      </button>
      <button type="button" onClick={onCancel}>
        Huỷ
      </button>
      <span className="small muted">Gửi hợp đồng ngay hôm nay khi khách còn “nóng”.</span>
    </form>
  );
}

function WonForm({
  busy,
  defaultArr,
  onCancel,
  onSubmit,
}: {
  busy: boolean;
  defaultArr: number | null;
  onCancel: () => void;
  onSubmit: (f: { signed: string; effective: string; arr: number | null }) => Promise<void>;
}) {
  const [signed, setSigned] = useState(todayIso());
  const [effective, setEffective] = useState(todayIso());
  const [arr, setArr] = useState(defaultArr !== null ? String(defaultArr) : "");
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <form
      className="inline-form"
      onSubmit={(e) => {
        e.preventDefault();
        const v = arr.trim() ? parseAmount(arr) : null;
        if (arr.trim() && v === null) return setProblem(`Không đọc được số tiền “${arr}”.`);
        void onSubmit({ signed, effective: effective || signed, arr: v });
      }}
    >
      <label>
        Ngày ký
        <input type="date" value={signed} max={todayIso()} onChange={(e) => setSigned(e.target.value)} required />
      </label>
      <label>
        Ngày hiệu lực
        <input type="date" value={effective} onChange={(e) => setEffective(e.target.value)} />
      </label>
      <label>
        ARR (USD)
        <input inputMode="decimal" value={arr} onChange={(e) => setArr(e.target.value)} placeholder="2.400" />
      </label>
      <button type="submit" className="btn-primary" disabled={busy}>
        Đánh dấu Thắng
      </button>
      <button type="button" onClick={onCancel}>
        Huỷ
      </button>
      {problem && <Notice kind="error">{problem}</Notice>}
    </form>
  );
}
