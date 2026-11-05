import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { ExternalLink, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useSettings } from "../lib/settings";
import type { Segment } from "../lib/api-types";
import { SEGMENTS, SEGMENT_LABEL, errMsg, fmtDate } from "../lib/format";
import {
  BILLING_LABEL,
  CHANNELS,
  CHANNEL_LABEL,
  OUTCOMES,
  OUTCOME_LABEL,
  OUTCOME_TONE,
  STAGES,
  STAGE_HINT,
  STAGE_LABEL,
  STAGE_PROBABILITY,
  TIER_HINT,
  TIER_SHORT,
  TOUCH_GOAL,
  addDays,
  dueDateFor,
  dueState,
  fmtDay,
  getCadence,
  getCriteria,
  memberName,
  nextStep,
  suggestTier,
  todayIso,
  useMembers,
  type Activity,
  type Answer,
  type Billing,
  type Channel,
  type Deal,
  type DealRow,
  type Outcome,
  type Stage,
  type Tier,
} from "../lib/pipeline";
import { Badge, Notice, ScorePill, Spinner } from "./ui";
import { SafeLink, shortUrl } from "./SafeLink";

interface ContactRow {
  id: string;
  full_name: string | null;
  job_title: string | null;
  email: string | null;
  phone: string | null;
}

type Tab = "qualify" | "touches" | "info";

export function DealPanel({
  dealId,
  initialTab,
  onClose,
  onChanged,
}: {
  dealId: string;
  initialTab?: Tab;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { session } = useAuth();
  const { settings } = useSettings();
  const members = useMembers();
  const cadence = useMemo(() => getCadence(settings), [settings]);
  const criteria = useMemo(() => getCriteria(settings), [settings]);

  const [deal, setDeal] = useState<DealRow | null>(null);
  const [acts, setActs] = useState<Activity[]>([]);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [tab, setTab] = useState<Tab>(initialTab ?? "touches");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const d = await supabase.from("deal_board").select("*").eq("id", dealId).maybeSingle();
    if (d.error) return setError(d.error.message);
    const row = d.data as DealRow | null;
    setDeal(row);
    if (!row) return;
    const [a, c] = await Promise.all([
      supabase.from("activities").select("*").eq("deal_id", dealId).order("happened_at", { ascending: false }),
      supabase.from("contacts").select("id,full_name,job_title,email,phone").eq("company_id", row.company_id).order("created_at"),
    ]);
    setActs((a.data ?? []) as Activity[]);
    setContacts((c.data ?? []) as ContactRow[]);
  }, [dealId]);

  useEffect(() => {
    setDeal(null);
    setTab(initialTab ?? "touches");
    void load();
  }, [load, initialTab]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function patch(p: Partial<Deal>, msg?: string) {
    if (!deal) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.from("deals").update(p).eq("id", deal.id);
    setBusy(false);
    if (error) return setError(error.message);
    if (msg) setInfo(msg);
    await load();
    onChanged();
  }

  return (
    <>
      <div className="scrim drawer-scrim" onClick={onClose} aria-hidden="true" />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Chi tiết deal">
        {!deal ? (
          <div className="drawer-body">{error ? <Notice kind="error">{error}</Notice> : <Spinner />}</div>
        ) : (
          <>
            <header className="drawer-head">
              <div className="row space-between nowrap">
                <div className="drawer-title">
                  <h2>{deal.company_name}</h2>
                  <div className="row small muted">
                    {deal.segment ? <Badge tone="blue">{SEGMENT_LABEL[deal.segment]}</Badge> : <Badge>Chưa phân nhóm</Badge>}
                    {deal.city && <span>{deal.city}</span>}
                    {deal.domain && (
                      <SafeLink href={deal.website_url ?? `https://${deal.domain}/`}>{shortUrl(deal.domain)}</SafeLink>
                    )}
                    <Link to={`/companies/${deal.company_id}`} className="row">
                      Tín hiệu <ExternalLink size={13} aria-hidden="true" />
                    </Link>
                    <ScorePill score={deal.score} />
                  </div>
                </div>
                <button type="button" className="btn-icon" aria-label="Đóng" onClick={onClose}>
                  <X />
                </button>
              </div>
              <div className="form-grid compact">
                <label>
                  Giai đoạn
                  <select value={deal.stage} disabled={busy} onChange={(e) => void patch({ stage: e.target.value as Stage })}>
                    {STAGES.map((s) => (
                      <option key={s} value={s}>
                        {STAGE_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Người phụ trách
                  <select
                    value={deal.owner_id ?? ""}
                    disabled={busy}
                    onChange={(e) => void patch({ owner_id: e.target.value || null })}
                  >
                    <option value="">Chưa giao</option>
                    {members.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.email}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Hạng
                  <select
                    value={deal.tier ?? ""}
                    disabled={busy}
                    onChange={(e) => void patch({ tier: (e.target.value || null) as Tier | null })}
                  >
                    <option value="">Chưa xếp</option>
                    {(["A", "B", "C"] as Tier[]).map((t) => (
                      <option key={t} value={t}>
                        {t} — {TIER_SHORT[t]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="small muted stage-hint">{STAGE_HINT[deal.stage]}</p>
              <div className="tabs" role="tablist">
                {(
                  [
                    ["qualify", "Đánh giá"],
                    ["touches", `Điểm chạm (${deal.touches}/${TOUCH_GOAL})`],
                    ["info", "Thông tin & liên hệ"],
                  ] as [Tab, string][]
                ).map(([k, l]) => (
                  <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "tab active" : "tab"} onClick={() => setTab(k)}>
                    {l}
                  </button>
                ))}
              </div>
            </header>
            <div className="drawer-body">
              {error && <Notice kind="error">{error}</Notice>}
              {info && <Notice kind="ok">{info}</Notice>}
              {tab === "qualify" && (
                <QualifyTab deal={deal} criteria={criteria} busy={busy} patch={patch} reload={load} onChanged={onChanged} setError={setError} cadenceFirst={cadence[0]?.title} />
              )}
              {tab === "touches" && (
                <TouchesTab
                  deal={deal}
                  acts={acts}
                  contacts={contacts}
                  cadence={cadence}
                  members={members}
                  userId={session?.user.id ?? null}
                  reload={async () => {
                    await load();
                    onChanged();
                  }}
                  setError={setError}
                  setInfo={setInfo}
                />
              )}
              {tab === "info" && (
                <InfoTab deal={deal} contacts={contacts} busy={busy} patch={patch} reload={load} setError={setError} membersName={memberName(members, deal.created_by)} />
              )}
            </div>
          </>
        )}
      </aside>
    </>
  );
}

// ------------------------------------------------------------------ Đánh giá trước khi tiếp cận
function QualifyTab({
  deal,
  criteria,
  busy,
  patch,
  reload,
  onChanged,
  setError,
  cadenceFirst,
}: {
  deal: DealRow;
  criteria: { key: string; label: string }[];
  busy: boolean;
  patch: (p: Partial<Deal>, msg?: string) => Promise<void>;
  reload: () => Promise<void>;
  onChanged: () => void;
  setError: (s: string | null) => void;
  cadenceFirst?: string;
}) {
  const [q, setQ] = useState<Record<string, Answer>>(deal.qualification ?? {});
  const [segment, setSegment] = useState<Segment | "">(deal.segment ?? "");
  const [city, setCity] = useState(deal.city ?? "");
  const sug = suggestTier(segment || null, q, deal.score, criteria);
  const dirtyCompany = (segment || null) !== deal.segment || (city.trim() || null) !== deal.city;

  async function saveCompany() {
    const { error } = await supabase.rpc("update_company_profile", {
      p_company_id: deal.company_id,
      p_segment: segment || null,
      p_city: city,
    });
    if (error) throw error;
  }

  async function save(extra: Partial<Deal> = {}, msg = "Đã lưu đánh giá.") {
    try {
      if (dirtyCompany) await saveCompany();
      await patch({ qualification: q, ...extra }, msg);
    } catch (e) {
      setError(errMsg(e));
      await reload();
      onChanged();
    }
  }

  return (
    <div className="stack">
      <p className="muted small">
        Đánh giá trước khi liên hệ để không mất thời gian của cả hai bên. Ưu tiên: đài truyền hình → MCN → production house → nhãn hàng.
      </p>
      <div className="form-grid">
        <label>
          Nhóm khách
          <select value={segment} onChange={(e) => setSegment(e.target.value as Segment | "")}>
            <option value="">Chưa rõ</option>
            {SEGMENTS.map((s) => (
              <option key={s} value={s}>
                {SEGMENT_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Thành phố
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="vd. TP.HCM" />
        </label>
      </div>
      <ul className="criteria">
        {criteria.map((c) => (
          <li key={c.key}>
            <span>{c.label}</span>
            <div className="seg" role="group" aria-label={c.label}>
              {(
                [
                  ["yes", "Có"],
                  ["no", "Không"],
                  ["unknown", "Chưa rõ"],
                ] as [Answer, string][]
              ).map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  className={(q[c.key] ?? "unknown") === v ? `on ans-${v}` : ""}
                  aria-pressed={(q[c.key] ?? "unknown") === v}
                  onClick={() => setQ((o) => ({ ...o, [c.key]: v }))}
                >
                  {l}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <div className={`suggest tier-${sug.tier}`}>
        <div>
          <strong>
            Gợi ý: hạng {sug.tier} <span className="muted small">({sug.points} điểm)</span>
          </strong>
          <div className="small muted">{TIER_HINT[sug.tier]}</div>
          <div className="small muted">{sug.reasons.join(" · ")}</div>
        </div>
      </div>
      <div className="row">
        <button type="button" disabled={busy} onClick={() => void save()}>
          Lưu đánh giá
        </button>
        {["new", "research"].includes(deal.stage) && (
          <>
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={() =>
                void save(
                  {
                    tier: sug.tier === "C" ? "B" : sug.tier,
                    stage: "outreach",
                    next_action: cadenceFirst ?? "Bắt đầu tiếp cận",
                    next_action_at: todayIso(),
                  },
                  "Đã chuyển sang Đang tiếp cận — điểm chạm 1 là việc hôm nay.",
                )
              }
            >
              Đạt — bắt đầu tiếp cận
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void save(
                  { tier: "C", stage: "nurture", next_action: "Đánh giá lại", next_action_at: addDays(todayIso(), 90) },
                  "Đã chuyển sang Nuôi dưỡng, nhắc lại sau 90 ngày.",
                )
              }
            >
              Chưa phù hợp — nuôi dưỡng
            </button>
          </>
        )}
        {deal.stage === "new" && (
          <button type="button" className="btn-link" disabled={busy} onClick={() => void save({ stage: "research" }, "Đã chuyển sang Đánh giá.")}>
            Đánh dấu đang đánh giá
          </button>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Điểm chạm
function TouchesTab({
  deal,
  acts,
  contacts,
  cadence,
  members,
  userId,
  reload,
  setError,
  setInfo,
}: {
  deal: DealRow;
  acts: Activity[];
  contacts: ContactRow[];
  cadence: ReturnType<typeof getCadence>;
  members: ReturnType<typeof useMembers>;
  userId: string | null;
  reload: () => Promise<void>;
  setError: (s: string | null) => void;
  setInfo: (s: string | null) => void;
}) {
  const step = nextStep(cadence, acts.length);
  const [channel, setChannel] = useState<Channel>(step?.channel ?? "email");
  const [outcome, setOutcome] = useState<Outcome>("done");
  const [contactId, setContactId] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayIso());
  const [busy, setBusy] = useState(false);
  useEffect(() => setChannel(step?.channel ?? "email"), [step?.channel]);

  const preQualified = deal.stage === "new" || deal.stage === "research";

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setBusy(true);
    setError(null);
    try {
      const ins = await supabase.from("activities").insert({
        deal_id: deal.id,
        user_id: userId,
        channel,
        outcome,
        note: note.trim() || null,
        contact_id: contactId || null,
        step: deal.stage === "outreach" && step ? step.step : null,
        happened_at: date === todayIso() ? new Date().toISOString() : `${date}T09:00:00+07:00`,
      });
      if (ins.error) throw ins.error;
      // Lên lịch việc tiếp theo.
      const touches = acts.length + 1;
      let p: Partial<Deal>;
      let msg: string;
      if ((outcome === "replied" || outcome === "positive") && ["new", "research", "outreach"].includes(deal.stage)) {
        p = { stage: "connected", next_action: "Hẹn buổi tìm hiểu nhu cầu", next_action_at: addDays(todayIso(), 1) };
        msg = "Khách đã phản hồi → chuyển sang Đã phản hồi. Việc tiếp theo: hẹn buổi tìm hiểu nhu cầu.";
      } else {
        const nxt = nextStep(cadence, touches);
        p = nxt
          ? { next_action: nxt.title, next_action_at: dueDateFor(nxt, deal.cadence_started_at) }
          : { next_action: "Đã đủ 19 điểm chạm — chốt hoặc chuyển Nuôi dưỡng", next_action_at: addDays(todayIso(), 2) };
        msg = `Đã ghi điểm chạm ${touches}/${TOUCH_GOAL}.`;
      }
      const up = await supabase.from("deals").update(p).eq("id", deal.id);
      if (up.error) throw up.error;
      setNote("");
      setOutcome("done");
      setInfo(msg);
      await reload();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(a: Activity) {
    const { error } = await supabase.from("activities").delete().eq("id", a.id);
    if (error) setError(error.message);
    else await reload();
  }

  const pct = Math.min(100, Math.round((100 * acts.length) / TOUCH_GOAL));
  const due = dueState(deal.next_action_at);
  return (
    <div className="stack">
      <div className="touch-progress">
        <div className="row space-between">
          <strong>
            {acts.length}/{TOUCH_GOAL} điểm chạm
          </strong>
          <span className={`due due-${due}`}>
            {deal.next_action ? `${deal.next_action} · ${fmtDay(deal.next_action_at)}` : "Chưa có việc tiếp theo"}
          </span>
        </div>
        <div className="bar" aria-hidden="true">
          <span style={{ width: `${pct}%` }} />
        </div>
      </div>
      {preQualified && <Notice kind="warn">Lead chưa được đánh giá. Nên đánh giá ở tab Đánh giá trước khi liên hệ.</Notice>}
      {step && (
        <div className="next-step">
          <span className="badge badge-blue">Bước {step.step}</span>
          <div>
            <strong>{step.title}</strong> <span className="badge">{CHANNEL_LABEL[step.channel]}</span>
            {step.hint && <div className="small muted">{step.hint}</div>}
          </div>
        </div>
      )}
      <form className="log-form" onSubmit={(e) => void submit(e)}>
        <div className="chips" role="group" aria-label="Kênh">
          {CHANNELS.map((c) => (
            <button key={c} type="button" className={channel === c ? "chip on" : "chip"} aria-pressed={channel === c} onClick={() => setChannel(c)}>
              {CHANNEL_LABEL[c]}
            </button>
          ))}
        </div>
        <div className="form-grid">
          <label>
            Kết quả
            <select value={outcome} onChange={(e) => setOutcome(e.target.value as Outcome)}>
              {OUTCOMES.map((o) => (
                <option key={o} value={o}>
                  {OUTCOME_LABEL[o]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Người liên hệ
            <select value={contactId} onChange={(e) => setContactId(e.target.value)}>
              <option value="">—</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name ?? c.email}
                  {c.job_title ? ` · ${c.job_title}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Ngày
            <input type="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value || todayIso())} />
          </label>
        </div>
        <label>
          Ghi chú
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nội dung trao đổi, khách nói gì…" />
        </label>
        <div className="row">
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? "Đang lưu…" : "Lưu điểm chạm"}
          </button>
        </div>
      </form>
      <h3>Lịch sử</h3>
      {acts.length === 0 ? (
        <p className="muted small">Chưa có điểm chạm nào.</p>
      ) : (
        <ol className="timeline">
          {acts.map((a) => (
            <li key={a.id}>
              <div className="row space-between">
                <span className="row">
                  <strong>{CHANNEL_LABEL[a.channel]}</strong>
                  <Badge tone={OUTCOME_TONE[a.outcome]}>{OUTCOME_LABEL[a.outcome]}</Badge>
                </span>
                <span className="small muted">
                  {fmtDate(a.happened_at)} · {memberName(members, a.user_id)}
                  {a.user_id === userId && (
                    <button type="button" className="btn-link small" onClick={() => void remove(a)}>
                      Xoá
                    </button>
                  )}
                </span>
              </div>
              {a.note && <p className="pre-wrap small">{a.note}</p>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Thông tin & liên hệ
function InfoTab({
  deal,
  contacts,
  busy,
  patch,
  reload,
  setError,
  membersName,
}: {
  deal: DealRow;
  contacts: ContactRow[];
  busy: boolean;
  patch: (p: Partial<Deal>, msg?: string) => Promise<void>;
  reload: () => Promise<void>;
  setError: (s: string | null) => void;
  membersName: string;
}) {
  const [f, setF] = useState({
    est_arr_usd: deal.est_arr_usd?.toString() ?? "",
    probability: deal.probability?.toString() ?? "",
    expected_close: deal.expected_close ?? "",
    billing: deal.billing ?? "",
    next_action: deal.next_action ?? "",
    next_action_at: deal.next_action_at ?? "",
    lost_reason: deal.lost_reason ?? "",
    notes: deal.notes ?? "",
  });
  const [c, setC] = useState({ name: "", title: "", email: "", phone: "" });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((o) => ({ ...o, [k]: e.target.value }));
  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  async function addContact(e: FormEvent) {
    e.preventDefault();
    const { error } = await supabase.rpc("add_contact", {
      p_company_id: deal.company_id,
      p_full_name: c.name,
      p_job_title: c.title || null,
      p_email: c.email || null,
      p_phone: c.phone || null,
    });
    if (error) return setError(error.message);
    setC({ name: "", title: "", email: "", phone: "" });
    await reload();
  }

  return (
    <div className="stack">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void patch(
            {
              est_arr_usd: num(f.est_arr_usd),
              probability: num(f.probability),
              expected_close: f.expected_close || null,
              billing: (f.billing || null) as Billing | null,
              next_action: f.next_action.trim() || null,
              next_action_at: f.next_action_at || null,
              lost_reason: f.lost_reason.trim() || null,
              notes: f.notes.trim() || null,
            },
            "Đã lưu.",
          );
        }}
      >
        <div className="form-grid">
          <label>
            ARR dự kiến (USD)
            <input type="number" min={0} step={1} value={f.est_arr_usd} onChange={set("est_arr_usd")} />
          </label>
          <label>
            Xác suất (%)
            <input type="number" min={0} max={100} value={f.probability} onChange={set("probability")} placeholder={`${STAGE_PROBABILITY[deal.stage]} (theo giai đoạn)`} />
          </label>
          <label>
            Ngày chốt dự kiến
            <input type="date" value={f.expected_close} onChange={set("expected_close")} />
          </label>
          <label>
            Thanh toán
            <select value={f.billing} onChange={set("billing")}>
              <option value="">—</option>
              {(Object.keys(BILLING_LABEL) as Billing[]).map((b) => (
                <option key={b} value={b}>
                  {BILLING_LABEL[b]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Việc tiếp theo
            <input value={f.next_action} onChange={set("next_action")} />
          </label>
          <label>
            Hạn
            <input type="date" value={f.next_action_at} onChange={set("next_action_at")} />
          </label>
        </div>
        {deal.stage === "lost" && (
          <label>
            Lý do thua
            <input value={f.lost_reason} onChange={set("lost_reason")} />
          </label>
        )}
        <label>
          Ghi chú
          <textarea rows={5} value={f.notes} onChange={set("notes")} />
        </label>
        <div className="row">
          <button type="submit" className="btn-primary" disabled={busy}>
            Lưu thông tin
          </button>
          <span className="small muted">
            Nguồn: {deal.source ?? "—"} · Tạo bởi {membersName} · {fmtDate(deal.created_at)}
          </span>
        </div>
      </form>
      <h3>Người liên hệ ({contacts.length})</h3>
      {contacts.length > 0 && (
        <ul className="contacts">
          {contacts.map((x) => (
            <li key={x.id}>
              <strong>{x.full_name ?? "—"}</strong>
              {x.job_title && <span className="muted"> · {x.job_title}</span>}
              <div className="small">
                {x.email && <a href={`mailto:${x.email}`}>{x.email}</a>}
                {x.phone && <span className="muted"> · {x.phone}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
      <form className="form-grid" onSubmit={(e) => void addContact(e)}>
        <label>
          Họ tên
          <input value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} />
        </label>
        <label>
          Chức danh
          <input value={c.title} onChange={(e) => setC({ ...c, title: e.target.value })} />
        </label>
        <label>
          Email
          <input type="email" value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} />
        </label>
        <label>
          Điện thoại / Zalo
          <input value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} />
        </label>
        <div className="row">
          <button type="submit" disabled={!c.name.trim() && !c.email.trim()}>
            Thêm người liên hệ
          </button>
        </div>
      </form>
    </div>
  );
}
