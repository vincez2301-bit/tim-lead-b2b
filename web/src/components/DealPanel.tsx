import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { Copy, ExternalLink, Reply, UserSearch, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useSettings } from "../lib/settings";
import type { FindPeopleResponse, Segment } from "../lib/api-types";
import { callFn } from "../lib/api";
import { SOURCE_LABEL, canEmail, getContactRoles, rankContacts } from "../lib/contacts";
import type { ContactSource } from "../lib/db-types";
import { SEGMENTS, SEGMENT_LABEL, errMsg, fmtDate } from "../lib/format";
import {
  BILLING_LABEL,
  addressFor,
  REASON_TOPICS,
  foldVi,
  objectionTopic,
  fmtUsd,
  parseAmount,
  LOST_REASONS,
  LOST_REASON_LABEL,
  LOST_REASON_RULE,
  getBudgetMonth,
  getPlaybook,
  getPlaylists,
  getSender,
  getTemplates,
  pickTemplate,
  renderTemplate,
  signature,
  type MessageTemplate,
  type Sender,
  reengageDate,
  type LostReason,
  type Objection,
  type Playlist,
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
  closeStep,
  closeDue,
  isTalking,
  stageAfterStep,
  QUOTE_STEP,
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
import { Badge, CopyButton, Notice, ScorePill, Spinner } from "./ui";
import { SafeLink, shortUrl } from "./SafeLink";
import { DisqualifyDialog } from "./Disqualify";
import { ClosePlan, type LogFn } from "./ClosePlan";

interface ContactRow {
  id: string;
  full_name: string | null;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  email_label: string | null;
  source: ContactSource;
  evidence_url: string | null;
  note: string | null;
}

type Tab = "qualify" | "touches" | "info";

export interface DealQueue {
  pos: number;
  total: number;
  next: () => void;
  prev: () => void;
  autoNext: boolean;
}

export function DealPanel({
  dealId,
  initialTab,
  onClose,
  onChanged,
  queue,
}: {
  dealId: string;
  initialTab?: Tab;
  onClose: () => void;
  onChanged: () => void;
  queue?: DealQueue;
}) {
  const { session } = useAuth();
  const { settings } = useSettings();
  const members = useMembers();
  const cadence = useMemo(() => getCadence(settings), [settings]);
  const criteria = useMemo(() => getCriteria(settings), [settings]);
  const playbook = useMemo(() => getPlaybook(settings), [settings]);
  const playlists = useMemo(() => getPlaylists(settings), [settings]);
  const budgetMonth = getBudgetMonth(settings);
  const templates = useMemo(() => getTemplates(settings), [settings]);
  const sender = useMemo(() => getSender(settings), [settings]);
  const [rejecting, setRejecting] = useState(false);
  const [disqualifying, setDisqualifying] = useState(false);

  const [deal, setDeal] = useState<DealRow | null>(null);
  const [acts, setActs] = useState<Activity[]>([]);
  const [allContacts, setContacts] = useState<ContactRow[]>([]);
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
      supabase
        .from("contacts")
        .select("id,full_name,job_title,email,phone,email_label,source,evidence_url,note")
        .eq("company_id", row.company_id)
        .order("created_at"),
    ]);
    setActs((a.data ?? []) as Activity[]);
    setContacts((c.data ?? []) as ContactRow[]);
  }, [dealId]);

  // Người đúng vai trò có email lên đầu; email tuyển dụng / CSKH bị ẩn (không bao giờ là người nhận).
  const roles = useMemo(() => getContactRoles(settings), [settings]);
  const ranked = useMemo(() => rankContacts(allContacts, deal?.segment ?? null, roles), [allContacts, deal?.segment, roles]);
  const contacts = ranked.shown;

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
              {queue && (
                <div className="queue-bar">
                  <strong>
                    Việc {queue.pos}/{queue.total}
                  </strong>
                  <span className="small">Gửi xong bấm “Đã gửi” — app tự chuyển sang việc tiếp theo.</span>
                  <span className="row">
                    <button type="button" className="btn-link small" disabled={queue.pos <= 1} onClick={queue.prev}>
                      ← Trước
                    </button>
                    <button type="button" className="btn-link small" disabled={queue.pos >= queue.total} onClick={queue.next}>
                      Bỏ qua →
                    </button>
                  </span>
                </div>
              )}
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
              <div className="row space-between stage-hint">
                <span className="small muted">
                  {STAGE_HINT[deal.stage]}
                  {deal.lost_reason_code && ` · Lý do: ${LOST_REASON_LABEL[deal.lost_reason_code]}`}
                  {deal.contract_end && ` · Hết HĐ với ${deal.competitor ?? "NCC hiện tại"}: ${fmtDay(deal.contract_end)}`}
                </span>
                {!["won", "lost"].includes(deal.stage) && (
                  <span className="row nowrap">
                    {["new", "research", "outreach"].includes(deal.stage) && (
                      <button type="button" className="btn-link small danger" onClick={() => setDisqualifying(true)}>
                        Không phù hợp…
                      </button>
                    )}
                    <button type="button" className="btn-link small" onClick={() => setRejecting((v) => !v)}>
                      Khách từ chối…
                    </button>
                  </span>
                )}
              </div>
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
              {rejecting && (
                <RejectForm
                  deal={deal}
                  budgetMonth={budgetMonth}
                  userId={session?.user.id ?? null}
                  onDone={async (msg) => {
                    setRejecting(false);
                    setInfo(msg);
                    await load();
                    onChanged();
                  }}
                  onCancel={() => setRejecting(false)}
                  setError={setError}
                />
              )}
              {disqualifying && (
                <DisqualifyDialog
                  companies={[{ id: deal.company_id, name: deal.company_name }]}
                  onClose={() => setDisqualifying(false)}
                  onDone={() => {
                    // Deal chưa liên hệ đã bị gỡ khỏi pipeline → đóng khung (hoặc sang khách kế tiếp khi làm lần lượt).
                    setDisqualifying(false);
                    onChanged();
                    if (queue?.autoNext) queue.next();
                    else onClose();
                  }}
                />
              )}
              {tab === "qualify" && ["new", "research"].includes(deal.stage) && (
                <div className="reply-bar">
                  <span className="small">Đánh giá xong thấy không đạt? Loại ngay để không mất thời gian tiếp cận.</span>
                  <button type="button" className="btn-sm btn-danger" onClick={() => setDisqualifying(true)}>
                    Không phù hợp…
                  </button>
                </div>
              )}
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
                  playbook={playbook}
                  playlists={playlists}
                  budgetMonth={budgetMonth}
                  templates={templates}
                  sender={sender}
                  onLogged={queue?.autoNext ? queue.next : undefined}
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
                <InfoTab
                  deal={deal}
                  contacts={contacts}
                  hiddenCount={ranked.hidden.length}
                  busy={busy}
                  patch={patch}
                  reload={load}
                  setError={setError}
                  membersName={memberName(members, deal.created_by)}
                />
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
  playbook,
  playlists,
  budgetMonth,
  templates,
  sender,
  userId,
  reload,
  setError,
  setInfo,
  onLogged,
}: {
  deal: DealRow;
  acts: Activity[];
  contacts: ContactRow[];
  cadence: ReturnType<typeof getCadence>;
  members: ReturnType<typeof useMembers>;
  playbook: Objection[];
  playlists: Playlist[];
  budgetMonth: number;
  templates: MessageTemplate[];
  sender: Sender;
  userId: string | null;
  reload: () => Promise<void>;
  setError: (s: string | null) => void;
  setInfo: (s: string | null) => void;
  onLogged?: () => void;
}) {
  const talking = isTalking(deal.stage);
  const doneSteps = useMemo(() => new Set(acts.map((a) => a.step).filter((n): n is number => n !== null)), [acts]);
  // Khách đã trả lời: bước kế tiếp theo giai đoạn (13–19), không theo số điểm chạm.
  const step = talking ? (closeStep(cadence, deal.stage, doneSteps) ?? nextStep(cadence, acts.length)) : nextStep(cadence, acts.length);
  const [channel, setChannel] = useState<Channel>(step?.channel ?? "email");
  const [outcome, setOutcome] = useState<Outcome>("done");
  const [contactId, setContactId] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayIso());
  const [busy, setBusy] = useState(false);
  useEffect(() => setChannel(step?.channel ?? "email"), [step?.channel]);

  const preQualified = deal.stage === "new" || deal.stage === "research";
  // Khách đang nuôi dưỡng dùng mẫu “điểm chạm nuôi dưỡng” (bước 90) thay cho lịch tiếp cận.
  const composeStep =
    deal.stage === "nurture"
      ? { step: 90, channel: "email" as Channel, title: "Điểm chạm nuôi dưỡng" }
      : step;

  async function submit(e: FormEvent) {
    e.preventDefault();
    await log({ channel, outcome, note: note.trim() || null, contactId: contactId || null, date });
  }

  async function log(a: {
    channel: Channel;
    outcome: Outcome;
    note: string | null;
    contactId: string | null;
    date: string;
    /** Bước ghi vào điểm chạm (mặc định: bước đang hiện). */
    step?: number | null;
    /** Ghi đè việc tiếp theo / giai đoạn app tự tính. */
    patch?: Partial<Deal>;
    msg?: string;
  }) {
    if (!userId) return;
    setBusy(true);
    setError(null);
    const outcome = a.outcome;
    const logStep = a.step !== undefined ? a.step : (deal.stage === "outreach" || preQualified || talking) && step ? step.step : null;
    try {
      const ins = await supabase.from("activities").insert({
        deal_id: deal.id,
        user_id: userId,
        channel: a.channel,
        outcome,
        note: a.note,
        contact_id: a.contactId,
        step: logStep,
        happened_at: a.date === todayIso() ? new Date().toISOString() : `${a.date}T09:00:00+07:00`,
      });
      if (ins.error) throw ins.error;
      // Lên lịch việc tiếp theo.
      const touches = acts.length + 1;
      let p: Partial<Deal>;
      let msg: string;
      if ((outcome === "replied" || outcome === "positive") && ["new", "research", "outreach", "nurture"].includes(deal.stage)) {
        // Trả lời trong ngày: khách vừa trả lời là lúc dễ hẹn lịch nhất.
        p = { stage: "connected", next_action: "Hẹn buổi tìm hiểu nhu cầu", next_action_at: todayIso() };
        msg = "Khách đã phản hồi → Đã phản hồi. Việc ngay hôm nay: hẹn buổi tìm hiểu nhu cầu (mẫu email ở bước 13).";
      } else if (deal.stage === "nurture") {
        const re = deal.lost_reason_code ? reengageDate(deal.lost_reason_code, deal.contract_end, budgetMonth) : addDays(todayIso(), 90);
        const monthly = addDays(todayIso(), 30);
        p = re < monthly
          ? { next_action: `Liên hệ lại: ${deal.lost_reason_code ? LOST_REASON_LABEL[deal.lost_reason_code] : "nuôi dưỡng"}`, next_action_at: re }
          : { next_action: "Điểm chạm nuôi dưỡng hằng tháng (playlist / tin bản quyền)", next_action_at: monthly };
        msg = `Đã ghi điểm chạm nuôi dưỡng. Lần tới: ${fmtDay(p.next_action_at ?? null)}.`;
      } else if (talking) {
        // Chặng chốt: tiến giai đoạn theo bước vừa làm, hẹn bước kế tiếp tối đa 3 ngày.
        const newStage = stageAfterStep(deal.stage, logStep, outcome);
        const done = new Set(doneSteps);
        if (logStep) done.add(logStep);
        const cur = logStep ? (cadence.find((c) => c.step === logStep) ?? null) : null;
        const nxt = closeStep(cadence, newStage, done);
        p = nxt
          ? { next_action: nxt.title, next_action_at: closeDue(cur, nxt) }
          : { next_action: deal.next_action ?? "Chọn việc tiếp theo", next_action_at: addDays(todayIso(), 2) };
        if (newStage !== deal.stage) p = { ...p, stage: newStage };
        msg = `Đã ghi.${newStage !== deal.stage ? ` Chuyển sang ${STAGE_LABEL[newStage]}.` : ""} Việc tiếp theo: ${p.next_action} (${fmtDay(p.next_action_at ?? null)}).`;
      } else {
        const nxt = nextStep(cadence, touches);
        p = nxt
          ? { next_action: nxt.title, next_action_at: dueDateFor(nxt, preQualified ? todayIso() : deal.cadence_started_at) }
          : { next_action: "Đã đủ 19 điểm chạm — chốt hoặc chuyển Nuôi dưỡng", next_action_at: addDays(todayIso(), 2) };
        // Lead mới: điểm chạm đầu tiên (thường là email mở lời) bắt đầu lịch tiếp cận.
        if (preQualified) p = { ...p, stage: "outreach", cadence_started_at: todayIso() };
        msg = preQualified
          ? `Đã bắt đầu tiếp cận ${deal.company_name}. Việc tiếp theo: ${p.next_action} (${fmtDay(p.next_action_at ?? null)}).`
          : `Đã ghi điểm chạm ${touches}/${TOUCH_GOAL}. Việc tiếp theo: ${p.next_action} (${fmtDay(p.next_action_at ?? null)}).`;
      }
      if (a.patch) p = { ...p, ...a.patch };
      if (a.msg) msg = a.msg;
      const up = await supabase.from("deals").update(p).eq("id", deal.id);
      if (up.error) throw up.error;
      setNote("");
      setOutcome("done");
      setInfo(msg);
      await reload();
      onLogged?.();
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
      {preQualified && (
        <Notice kind="info">
          Lead mới — việc đầu tiên là gửi email mở lời bên dưới. Gửi xong bấm “✓ Đã gửi”, app chuyển khách sang Đang tiếp cận và hẹn
          bước kế tiếp. Đánh giá 8 tiêu chí (tab Đánh giá) không bắt buộc, làm khi đã trao đổi với khách.
        </Notice>
      )}
      {acts.length > 0 && ["outreach", "nurture"].includes(deal.stage) && (
        <div className="reply-bar">
          <span className="small">Khách vừa trả lời email / Zalo / điện thoại?</span>
          <button
            type="button"
            className="btn-sm btn-primary"
            disabled={busy}
            onClick={() =>
              void log({ channel: acts[0]?.channel ?? "email", outcome: "replied", note: "Khách trả lời", contactId: null, date: todayIso() })
            }
          >
            <Reply aria-hidden="true" /> Khách đã trả lời
          </button>
          <span className="small muted">Trả lời để từ chối thì bấm “Khách từ chối…” ở trên.</span>
        </div>
      )}
      {talking && (
        <ClosePlan
          deal={deal}
          acts={acts}
          cadence={cadence}
          contacts={contacts}
          sender={sender}
          busy={busy}
          setError={setError}
          log={((x) => log({ ...x, date: todayIso() })) as LogFn}
        />
      )}
      {step && (
        <div className="next-step">
          <span className="badge badge-blue">Bước {step.step}</span>
          <div>
            <strong>{step.title}</strong> <span className="badge">{CHANNEL_LABEL[step.channel]}</span>
            {step.hint && <div className="small muted">{step.hint}</div>}
          </div>
        </div>
      )}
      {composeStep && !(talking && composeStep.step === QUOTE_STEP) && (
        <Compose
          key={`${deal.id}-${composeStep.step}`}
          deal={deal}
          step={composeStep}
          template={pickTemplate(templates, composeStep.step, deal.segment)}
          sender={sender}
          contacts={contacts}
          playlists={playlists}
          busy={busy}
          onSent={(ch, oc, n, cid) => void log({ channel: ch, outcome: oc, note: n, contactId: cid, date: todayIso() })}
        />
      )}
      <Helpers
        segment={deal.segment}
        playbook={playbook}
        playlists={playlists}
        openPlaylists={!!step && /playlist|nhạc mẫu/i.test(step.title)}
        focusReason={deal.lost_reason_code}
      />
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
  hiddenCount,
  busy,
  patch,
  reload,
  setError,
  membersName,
}: {
  deal: DealRow;
  contacts: ContactRow[];
  hiddenCount: number;
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
    competitor: deal.competitor ?? "",
    contract_end: deal.contract_end ?? "",
    signed_at: deal.signed_at ?? "",
    effective_at: deal.effective_at ?? "",
    renewal_at: deal.renewal_at ?? "",
    notes: deal.notes ?? "",
  });
  const [c, setC] = useState({ name: "", title: "", email: "", phone: "" });
  const [finding, setFinding] = useState(false);
  const [findMsg, setFindMsg] = useState<{ kind: "ok" | "warn" | "error"; text: string } | null>(null);

  async function findPeople() {
    setFinding(true);
    setFindMsg(null);
    try {
      const r = await callFn<FindPeopleResponse>("find_people", { company_ids: [deal.company_id], force: true });
      if (r.stopped_reason === "quota") {
        setFindMsg({ kind: "warn", text: "Đã hết lượt Google hôm nay — thử lại ngày mai." });
      } else if (r.skipped_not_in_pipeline) {
        setFindMsg({ kind: "warn", text: "Chỉ tìm cho công ty đang trong pipeline." });
      } else if (r.errors.length) {
        setFindMsg({ kind: "error", text: r.errors[0] });
      } else {
        setFindMsg({
          kind: r.people || r.emails ? "ok" : "warn",
          text:
            r.people || r.emails
              ? `Tìm thấy ${r.people} người qua LinkedIn, ${r.emails} email thật${r.guessed ? `, ${r.guessed} email đoán theo mẫu của công ty` : ""} (dùng ${r.units_used} lượt Google).`
              : `Chưa thấy người phụ trách hay email nào trên Google (dùng ${r.units_used} lượt). Có thể nhập tay bên dưới.`,
        });
      }
      await reload();
    } catch (e) {
      setFindMsg({ kind: "error", text: errMsg(e) });
    } finally {
      setFinding(false);
    }
  }
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
          const arr = parseAmount(f.est_arr_usd);
          if (f.est_arr_usd.trim() && arr === null) return setError(`Không đọc được số tiền “${f.est_arr_usd}”. Gõ ví dụ 10206 hoặc 10.206.`);
          void patch(
            {
              est_arr_usd: arr,
              probability: num(f.probability),
              expected_close: f.expected_close || null,
              billing: (f.billing || null) as Billing | null,
              next_action: f.next_action.trim() || null,
              next_action_at: f.next_action_at || null,
              lost_reason: f.lost_reason.trim() || null,
              competitor: f.competitor.trim() || null,
              contract_end: f.contract_end || null,
              signed_at: f.signed_at || null,
              effective_at: f.effective_at || null,
              ...(deal.stage === "won" ? { renewal_at: f.renewal_at || null } : {}),
              notes: f.notes.trim() || null,
            },
            "Đã lưu.",
          );
        }}
      >
        <div className="form-grid">
          <label>
            ARR dự kiến (USD)
            <input
              inputMode="decimal"
              value={f.est_arr_usd}
              onChange={set("est_arr_usd")}
              placeholder="VD: 10.206"
              aria-describedby="arr-hint"
            />
            {f.est_arr_usd.trim() && (
              <span id="arr-hint" className={parseAmount(f.est_arr_usd) === null ? "small text-danger" : "small muted"}>
                {parseAmount(f.est_arr_usd) === null ? "Chưa đọc được số này" : `= ${fmtUsd(parseAmount(f.est_arr_usd))}`}
              </span>
            )}
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
          {deal.stage === "won" && (
            <>
              <label>
                Ngày ký
                <input type="date" value={f.signed_at} onChange={set("signed_at")} />
              </label>
              <label>
                Ngày hiệu lực
                <input type="date" value={f.effective_at} onChange={set("effective_at")} />
              </label>
              <label>
                Ngày gia hạn
                <input type="date" value={f.renewal_at} onChange={set("renewal_at")} />
                <span className="small muted">Để trống: tự tính mốc tròn năm kế tiếp từ ngày hiệu lực.</span>
              </label>
            </>
          )}
          <label>
            Nhà cung cấp nhạc hiện tại
            <input value={f.competitor} onChange={set("competitor")} placeholder="nếu có" />
          </label>
          <label>
            Hợp đồng của họ hết hạn
            <input type="date" value={f.contract_end} onChange={set("contract_end")} />
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
      <div className="row space-between">
        <h3>Người liên hệ ({contacts.length})</h3>
        <button type="button" className="btn-sm" disabled={finding} onClick={() => void findPeople()}>
          <UserSearch aria-hidden="true" /> {finding ? "Đang tìm…" : "Tìm người phụ trách"}
        </button>
      </div>
      <p className="small muted">
        Tìm trên LinkedIn công khai và email của công ty trên Google (tối đa 2 lượt Google). Người đúng vai trò có email được xếp đầu và
        là người nhận mặc định.
      </p>
      {findMsg && <Notice kind={findMsg.kind}>{findMsg.text}</Notice>}
      {contacts.length > 0 && (
        <ul className="contacts">
          {contacts.map((x) => (
            <li key={x.id}>
              <div className="row space-between nowrap">
                <span>
                  <strong>{x.full_name ?? (x.email ? "Email chung" : "—")}</strong>
                  {x.job_title && <span className="muted"> · {x.job_title}</span>}
                </span>
                <Badge tone={x.source === "linkedin" ? "blue" : "gray"} title={x.evidence_url ?? undefined}>
                  {SOURCE_LABEL[x.source] ?? x.source}
                </Badge>
              </div>
              <div className="small">
                {x.email && (canEmail(x) ? <a href={`mailto:${x.email}`}>{x.email}</a> : <s className="muted">{x.email}</s>)}
                {x.email_label === "guess" && <Badge tone="orange">dự đoán</Badge>}
                {x.email_label === "invalid" && <span className="muted"> (tên miền không nhận email)</span>}
                {x.phone && <span className="muted"> · {x.phone}</span>}
                {x.evidence_url && (
                  <>
                    {" · "}
                    <SafeLink href={x.evidence_url}>nguồn</SafeLink>
                  </>
                )}
              </div>
              {x.note && <div className="small muted">{x.note}</div>}
            </li>
          ))}
        </ul>
      )}
      {hiddenCount > 0 && (
        <p className="small muted">Đã ẩn {hiddenCount} email tuyển dụng / CSKH / kế toán (không dùng để gửi). Xem đủ ở trang công ty.</p>
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

// ------------------------------------------------------------------ Khách từ chối
function RejectForm({
  deal,
  budgetMonth,
  userId,
  onDone,
  onCancel,
  setError,
}: {
  deal: DealRow;
  budgetMonth: number;
  userId: string | null;
  onDone: (msg: string) => Promise<void>;
  onCancel: () => void;
  setError: (s: string | null) => void;
}) {
  const [reason, setReason] = useState<LostReason>(deal.lost_reason_code ?? "price");
  const [competitor, setCompetitor] = useState(deal.competitor ?? "");
  const [contractEnd, setContractEnd] = useState(deal.contract_end ?? "");
  const [note, setNote] = useState("");
  const [permanent, setPermanent] = useState(false);
  const [busy, setBusy] = useState(false);
  const suggested = reengageDate(reason, contractEnd || null, budgetMonth);
  const [date, setDate] = useState(suggested);
  useEffect(() => setDate(suggested), [suggested]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setBusy(true);
    setError(null);
    try {
      const a = await supabase.from("activities").insert({
        deal_id: deal.id,
        user_id: userId,
        channel: "other",
        outcome: "negative",
        note: `Từ chối: ${LOST_REASON_LABEL[reason]}${competitor ? ` (${competitor})` : ""}${note.trim() ? ` — ${note.trim()}` : ""}`,
      });
      if (a.error) throw a.error;
      const u = await supabase
        .from("deals")
        .update({
          stage: permanent ? "lost" : "nurture",
          lost_reason_code: reason,
          lost_reason: note.trim() || LOST_REASON_LABEL[reason],
          competitor: competitor.trim() || null,
          contract_end: contractEnd || null,
          next_action: permanent ? null : `Liên hệ lại: ${LOST_REASON_LABEL[reason]}`,
          next_action_at: permanent ? null : date,
        })
        .eq("id", deal.id);
      if (u.error) throw u.error;
      await onDone(permanent ? "Đã chuyển sang Thua." : `Đã chuyển sang Nuôi dưỡng, hẹn liên hệ lại ${fmtDay(date)}.`);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card reject" onSubmit={(e) => void submit(e)}>
      <h3>Khách từ chối — lên lịch quay lại</h3>
      <div className="form-grid">
        <label>
          Lý do
          <select value={reason} onChange={(e) => setReason(e.target.value as LostReason)}>
            {LOST_REASONS.map((r) => (
              <option key={r} value={r}>
                {LOST_REASON_LABEL[r]}
              </option>
            ))}
          </select>
        </label>
        {reason === "competitor" && (
          <>
            <label>
              Nhà cung cấp hiện tại
              <input value={competitor} onChange={(e) => setCompetitor(e.target.value)} placeholder="vd. EMVN, nhạc qua MCN…" />
            </label>
            <label>
              Hợp đồng của họ hết hạn
              <input type="date" value={contractEnd} onChange={(e) => setContractEnd(e.target.value)} />
            </label>
          </>
        )}
        <label>
          Liên hệ lại ngày
          <input type="date" value={date} disabled={permanent} onChange={(e) => setDate(e.target.value || suggested)} />
        </label>
      </div>
      <p className="small muted">{LOST_REASON_RULE[reason]}</p>
      <label>
        Ghi chú (khách nói gì)
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <label className="checkbox">
        <input type="checkbox" checked={permanent} onChange={(e) => setPermanent(e.target.checked)} />
        Không bao giờ phù hợp — chuyển sang Thua, không hẹn lại
      </label>
      <div className="row">
        <button type="submit" className="btn-primary" disabled={busy}>
          {permanent ? "Chuyển sang Thua" : "Lưu & hẹn liên hệ lại"}
        </button>
        <button type="button" onClick={onCancel}>
          Huỷ
        </button>
      </div>
    </form>
  );
}

// ------------------------------------------------------------------ Câu xử lý từ chối + playlist gợi ý
function Helpers({
  segment,
  playbook,
  playlists,
  openPlaylists,
  focusReason,
}: {
  segment: Segment | null;
  playbook: Objection[];
  playlists: Playlist[];
  openPlaylists: boolean;
  focusReason: LostReason | null;
}) {
  const lists = playlists.filter((p) => !p.segments?.length || (segment && p.segments.includes(segment)));
  const [q, setQ] = useState("");
  const focusTopics = focusReason ? REASON_TOPICS[focusReason] : [];
  const f = foldVi(q.trim());
  const matched = playbook
    .filter((o) => (f ? foldVi(`${o.title} ${o.short ?? ""} ${o.text}`).includes(f) : !focusTopics.length || focusTopics.includes(objectionTopic(o))))
    .slice(0, 12);
  return (
    <div className="helpers">
      <details open={openPlaylists}>
        <summary>Playlist gợi ý ({lists.length})</summary>
        {lists.length === 0 ? (
          <p className="small muted">Chưa có playlist cho nhóm này. Thêm link playlist ở trang Nhạc mẫu.</p>
        ) : (
          <ul className="snippets">
            {lists.map((p) => (
              <li key={p.url}>
                <div className="row space-between nowrap">
                  <SafeLink href={p.url}>{p.title}</SafeLink>
                  <CopyButton text={`${p.title}: ${p.url}`} />
                </div>
                {p.note && <div className="small muted">{p.note}</div>}
              </li>
            ))}
          </ul>
        )}
      </details>
      {playbook.length > 0 && (
        <details open={!!focusReason}>
          <summary>Khách từ chối — trả lời thế nào ({playbook.length})</summary>
          <input
            className="input-sm search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Khách nói gì? VD: đắt, hợp đồng, độc quyền"
            aria-label="Tìm câu trả lời"
          />
          {!f && focusTopics.length > 0 && (
            <p className="small muted">Đang hiện chủ đề hợp với lý do “{LOST_REASON_LABEL[focusReason!]}”. Gõ để tìm câu khác.</p>
          )}
          <ul className="snippets">
            {matched.map((o) => (
              <li key={o.title}>
                <div className="row space-between nowrap">
                  <span className="small">
                    <strong>{o.title}</strong>
                  </span>
                  <CopyButton text={o.short ?? o.text} />
                </div>
                <div className="small">{o.short ?? o.text}</div>
                {o.check && <div className="small check">Cần kiểm tra: {o.check}</div>}
              </li>
            ))}
            {matched.length === 0 && <li className="small muted">Không có câu khớp.</li>}
          </ul>
          <Link className="small" to="/library/objections">
            Mở kho Xử lý từ chối (bản đầy đủ để gửi email) →
          </Link>
        </details>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Nội dung soạn sẵn cho bước hiện tại
function Compose({
  deal,
  step,
  template,
  sender,
  contacts,
  playlists,
  busy,
  onSent,
}: {
  deal: DealRow;
  step: { step: number; channel: Channel; title: string };
  template: MessageTemplate | null;
  sender: Sender;
  contacts: ContactRow[];
  playlists: Playlist[];
  busy: boolean;
  onSent: (channel: Channel, outcome: Outcome, note: string, contactId: string | null) => void;
}) {
  const withEmail = contacts.filter(canEmail);
  const [contactId, setContactId] = useState((withEmail[0] ?? contacts[0])?.id ?? "");
  // Danh bạ tải sau khung soạn: chọn người nhận mặc định khi có dữ liệu.
  useEffect(() => {
    if (!contacts.some((c) => c.id === contactId)) setContactId((withEmail[0] ?? contacts[0])?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contacts]);
  const contact = contacts.find((c) => c.id === contactId) ?? null;
  const pl = playlists.find((p) => !p.segments?.length || (deal.segment && p.segments.includes(deal.segment)));
  const addr = addressFor(contact?.full_name ?? null, deal.company_name);
  const vars: Record<string, string> = {
    ...addr,
    cong_ty: deal.company_name,
    playlist: pl ? pl.url : "[link playlist — thêm ở trang Nhạc mẫu]",
    nguoi_gui: sender.name || "[Tên bạn]",
    chuc_danh: sender.title,
    cong_ty_ban: sender.company || "Epidemic Sound tại Việt Nam",
    sdt: sender.phone,
    chu_ky: signature(sender),
  };
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    setSubject(template?.subject ? renderTemplate(template.subject, vars) : "");
    setBody(template ? renderTemplate(template.body, vars) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template, contactId, pl?.url, sender.name]);

  if (!template) {
    return (
      <p className="small muted">
        Chưa có nội dung soạn sẵn cho bước {step.step}. Thêm ở Kho nội dung → Email &amp; tin nhắn mẫu.
      </p>
    );
  }
  const ch = template.channel;
  const mailto =
    ch === "email" && contact?.email
      ? `mailto:${encodeURIComponent(contact.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
      : null;
  const tel = contact?.phone ? `tel:${contact.phone.replace(/[^0-9+]/g, "")}` : null;
  const note = `${CHANNEL_LABEL[ch]} — ${template.title}${contact ? ` (gửi ${contact.full_name ?? contact.email})` : ""}`;

  return (
    <div className="compose">
      <div className="row space-between">
        <strong>Nội dung soạn sẵn · {template.title}</strong>
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
      {contacts.length === 0 && (
        <Notice kind="warn">Chưa có người liên hệ — thêm ở tab “Thông tin & liên hệ” hoặc bấm “Phân tích website” ở trang công ty để app tự tìm.</Notice>
      )}
      {ch === "email" && (
        <label>
          Tiêu đề
          <input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </label>
      )}
      <label>
        {ch === "call" ? "Kịch bản" : "Nội dung"}
        <textarea rows={ch === "email" ? 18 : 6} value={body} onChange={(e) => setBody(e.target.value)} />
      </label>
      {body.includes("[") && <p className="small muted">Điền các chỗ trong ngoặc vuông [ … ] trước khi gửi.</p>}
      <div className="row">
        {mailto && (
          <a className="btn btn-primary" href={mailto}>
            Mở email
          </a>
        )}
        {ch === "call" && tel && (
          <a className="btn btn-primary" href={tel}>
            Gọi {contact?.phone}
          </a>
        )}
        <button
          type="button"
          onClick={() =>
            void navigator.clipboard?.writeText(ch === "email" ? `${subject}\n\n${body}` : body).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            })
          }
        >
          <Copy aria-hidden="true" /> {copied ? "Đã chép" : ch === "zalo" ? "Chép tin Zalo" : "Chép nội dung"}
        </button>
        {ch === "call" ? (
          <>
            <button type="button" className="btn-primary" disabled={busy} onClick={() => onSent(ch, "no_answer", `${note}: không nghe máy`, contactId || null)}>
              Đã gọi — không nghe
            </button>
            <button type="button" disabled={busy} onClick={() => onSent(ch, "replied", `${note}: đã nói chuyện`, contactId || null)}>
              Đã nói chuyện
            </button>
          </>
        ) : (
          <button type="button" className="btn-primary" disabled={busy} onClick={() => onSent(ch, "done", note, contactId || null)}>
            {ch === "meeting" ? "✓ Đã làm xong" : "✓ Đã gửi"}
          </button>
        )}
      </div>
    </div>
  );
}
