// Pipeline bán hàng: kiểu dữ liệu, nhãn, lịch 19 điểm chạm, gợi ý hạng (tier) và dự báo.
import { useEffect, useState } from "react";
import type { Segment } from "./api-types";
import type { SettingsMap } from "./settings";
import { supabase } from "./supabase";

export type Stage =
  | "new"
  | "research"
  | "outreach"
  | "connected"
  | "meeting"
  | "proposal"
  | "commit"
  | "won"
  | "lost"
  | "nurture";
export type Tier = "A" | "B" | "C";
export type Channel = "email" | "call" | "zalo" | "linkedin" | "meeting" | "event" | "other";
export type Outcome = "done" | "no_answer" | "replied" | "positive" | "negative";
export type Billing = "annual" | "monthly" | "one_off";
export type Answer = "yes" | "no" | "unknown";
export type LostReason = "price" | "competitor" | "no_need" | "no_contact" | "timing" | "other";

export interface Deal {
  id: string;
  company_id: string;
  stage: Stage;
  owner_id: string | null;
  tier: Tier | null;
  qualification: Record<string, Answer>;
  next_action: string | null;
  next_action_at: string | null;
  cadence_started_at: string | null;
  est_arr_usd: number | null;
  probability: number | null;
  expected_close: string | null;
  billing: Billing | null;
  lost_reason: string | null;
  lost_reason_code: LostReason | null;
  competitor: string | null;
  contract_end: string | null;
  signed_at: string | null;
  effective_at: string | null;
  source: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  stage_changed_at: string;
}

/** Một dòng của view deal_board. */
export interface DealRow extends Deal {
  company_name: string;
  domain: string | null;
  website_url: string | null;
  segment: Segment | null;
  city: string | null;
  score: number | null;
  is_dnc: boolean;
  touches: number;
  last_touch_at: string | null;
}

export interface Activity {
  id: string;
  deal_id: string;
  contact_id: string | null;
  user_id: string | null;
  channel: Channel;
  outcome: Outcome;
  step: number | null;
  note: string | null;
  happened_at: string;
}

export interface CadenceStep {
  step: number;
  day: number;
  channel: Channel;
  title: string;
  hint?: string;
}

export interface Criterion {
  key: string;
  label: string;
}

export interface Member {
  user_id: string;
  email: string | null;
  role: string;
}

export const TOUCH_GOAL = 19;

/** Giai đoạn đang mở, theo thứ tự trên bảng. */
export const OPEN_STAGES: Stage[] = ["new", "research", "outreach", "connected", "meeting", "proposal", "commit"];
export const CLOSED_STAGES: Stage[] = ["won", "lost", "nurture"];
export const STAGES: Stage[] = [...OPEN_STAGES, ...CLOSED_STAGES];

export const STAGE_LABEL: Record<Stage, string> = {
  new: "Lead mới",
  research: "Đánh giá",
  outreach: "Đang tiếp cận",
  connected: "Đã phản hồi",
  meeting: "Gặp / demo",
  proposal: "Đề xuất",
  commit: "Chờ ký",
  won: "Thắng",
  lost: "Thua",
  nurture: "Nuôi dưỡng",
};
export const STAGE_HINT: Record<Stage, string> = {
  new: "Chưa đánh giá. Đừng liên hệ trước khi đánh giá.",
  research: "Kiểm tra 8 tiêu chí, tìm người quyết định, chọn hạng A/B/C.",
  outreach: "Đang chạy lịch điểm chạm 1–12.",
  connected: "Khách đã trả lời — hẹn buổi tìm hiểu nhu cầu.",
  meeting: "Tìm hiểu nhu cầu, demo.",
  proposal: "Đã gửi đề xuất / báo giá.",
  commit: "Khách đã đồng ý, chờ ký.",
  won: "Đã ký.",
  lost: "Không mua (ghi lý do).",
  nurture: "Chưa phải lúc — hẹn quay lại sau.",
};
/** Xác suất mặc định theo giai đoạn (dùng cho dự báo khi deal chưa đặt riêng). */
export const STAGE_PROBABILITY: Record<Stage, number> = {
  new: 0,
  research: 0,
  outreach: 5,
  connected: 10,
  meeting: 25,
  proposal: 50,
  commit: 90,
  won: 100,
  lost: 0,
  nurture: 0,
};
export const STAGE_TONE: Record<Stage, string> = {
  new: "gray",
  research: "blue",
  outreach: "blue",
  connected: "blue",
  meeting: "orange",
  proposal: "orange",
  commit: "green",
  won: "green",
  lost: "red",
  nurture: "gray",
};

export const CHANNELS: Channel[] = ["email", "call", "zalo", "linkedin", "meeting", "event", "other"];
export const CHANNEL_LABEL: Record<Channel, string> = {
  email: "Email",
  call: "Gọi điện",
  zalo: "Zalo",
  linkedin: "LinkedIn",
  meeting: "Gặp / họp",
  event: "Sự kiện",
  other: "Khác",
};
export const OUTCOMES: Outcome[] = ["done", "no_answer", "replied", "positive", "negative"];
export const OUTCOME_LABEL: Record<Outcome, string> = {
  done: "Đã gửi / đã làm",
  no_answer: "Không phản hồi",
  replied: "Khách trả lời",
  positive: "Tích cực",
  negative: "Từ chối",
};
export const OUTCOME_TONE: Record<Outcome, string> = {
  done: "gray",
  no_answer: "orange",
  replied: "blue",
  positive: "green",
  negative: "red",
};
export const BILLING_LABEL: Record<Billing, string> = { annual: "Hằng năm", monthly: "Hằng tháng", one_off: "Một lần" };
export const LOST_REASONS: LostReason[] = ["price", "competitor", "no_need", "timing", "no_contact", "other"];
export const LOST_REASON_LABEL: Record<LostReason, string> = {
  price: "Chê giá cao",
  competitor: "Đang dùng nhà cung cấp khác",
  no_need: "Chưa có nhu cầu",
  timing: "Chưa đúng thời điểm",
  no_contact: "Không liên lạc được",
  other: "Lý do khác",
};
export const LOST_REASON_RULE: Record<LostReason, string> = {
  price: "Liên hệ lại đầu tháng lên ngân sách (Cài đặt → sales_calendar.budget_month).",
  competitor: "Liên hệ lại 75 ngày trước khi hợp đồng của họ hết hạn (chưa biết ngày: sau 4 tháng).",
  no_need: "Liên hệ lại sau 6 tháng.",
  timing: "Liên hệ lại sau 2 tháng.",
  no_contact: "Thử lại sau 3 tháng, đổi kênh / đổi người.",
  other: "Liên hệ lại sau 3 tháng.",
};

export interface Objection {
  reason: LostReason;
  title: string;
  text: string;
}
export interface Playlist {
  title: string;
  url: string;
  segments?: Segment[];
  note?: string;
}

export function getPlaybook(s: SettingsMap): Objection[] {
  const v = s["objection_playbook"];
  return Array.isArray(v) ? (v as Objection[]).filter((x) => x && x.title && x.text) : [];
}
export function getPlaylists(s: SettingsMap): Playlist[] {
  const v = s["playlists"];
  return Array.isArray(v) ? (v as Playlist[]).filter((x) => x && x.title && /^https?:\/\//.test(x.url ?? "")) : [];
}
export function getBudgetMonth(s: SettingsMap): number {
  const m = Number((s["sales_calendar"] as { budget_month?: number } | undefined)?.budget_month);
  return Number.isInteger(m) && m >= 1 && m <= 12 ? m : 11;
}

/** Ngày nên liên hệ lại sau khi khách từ chối. */
export function reengageDate(reason: LostReason, contractEnd: string | null, budgetMonth: number): string {
  const t = todayIso();
  if (reason === "price") {
    const y = Number(t.slice(0, 4));
    let d = `${y}-${String(budgetMonth).padStart(2, "0")}-01`;
    if (d < addDays(t, 30)) d = `${y + 1}-${String(budgetMonth).padStart(2, "0")}-01`;
    return d;
  }
  if (reason === "competitor") {
    if (contractEnd) {
      const d = addDays(contractEnd, -75);
      return d > addDays(t, 7) ? d : addDays(t, 7);
    }
    return addDays(t, 120);
  }
  return addDays(t, reason === "no_need" ? 180 : reason === "timing" ? 60 : 90);
}

export const TIER_SHORT: Record<Tier, string> = { A: "ưu tiên cao", B: "phù hợp", C: "nuôi dưỡng" };
export const TIER_HINT: Record<Tier, string> = {
  A: "Ưu tiên cao — tiếp cận ngay",
  B: "Phù hợp — tiếp cận sau nhóm A",
  C: "Chưa phù hợp — nuôi dưỡng",
};

/** Điểm ưu tiên theo nhóm khách (broadcaster → MCN → production house → hãng phim → brand). */
export const SEGMENT_PRIORITY: Record<Segment, number> = { broadcaster: 40, mcn: 35, agency: 30, film: 25, brand: 20 };

const DEFAULT_CADENCE: CadenceStep[] = [
  { step: 1, day: 0, channel: "linkedin", title: "Gửi kết nối LinkedIn" },
  { step: 2, day: 0, channel: "email", title: "Email mở lời cá nhân hoá" },
  { step: 3, day: 1, channel: "call", title: "Gọi điện lần 1" },
];

export function getCadence(s: SettingsMap): CadenceStep[] {
  const v = s["cadence"];
  if (!Array.isArray(v)) return DEFAULT_CADENCE;
  return (v as CadenceStep[])
    .filter((x) => x && typeof x.step === "number" && typeof x.title === "string")
    .sort((a, b) => a.step - b.step);
}

export function getCriteria(s: SettingsMap): Criterion[] {
  const v = s["qualification_criteria"];
  return Array.isArray(v) ? (v as Criterion[]).filter((x) => x && x.key && x.label) : [];
}

/** Gợi ý hạng: nhóm khách + số tiêu chí "Có" − số "Không" + điểm tín hiệu của app. */
export function suggestTier(
  segment: Segment | null,
  q: Record<string, Answer>,
  score: number | null,
  criteria: Criterion[],
): { tier: Tier; points: number; reasons: string[] } {
  const reasons: string[] = [];
  let points = segment ? SEGMENT_PRIORITY[segment] : 15;
  reasons.push(segment ? `Nhóm khách: +${SEGMENT_PRIORITY[segment]}` : "Chưa rõ nhóm khách: +15");
  const yes = criteria.filter((c) => q[c.key] === "yes").length;
  const no = criteria.filter((c) => q[c.key] === "no").length;
  if (yes) reasons.push(`${yes} tiêu chí "Có": +${yes * 8}`);
  if (no) reasons.push(`${no} tiêu chí "Không": −${no * 6}`);
  points += yes * 8 - no * 6;
  if (q["uses_music"] === "no" && q["outsourcing"] !== "yes") {
    points -= 25;
    reasons.push("Không dùng nhạc: −25");
  }
  if (score !== null && score !== undefined) {
    const s = Math.round(score / 5);
    points += s;
    reasons.push(`Điểm tín hiệu ${score}: +${s}`);
  }
  const tier: Tier = points >= 65 ? "A" : points >= 45 ? "B" : "C";
  return { tier, points, reasons };
}

/** Bước kế tiếp trong lịch (dựa trên số điểm chạm đã ghi). */
export function nextStep(cadence: CadenceStep[], touches: number): CadenceStep | null {
  return cadence.find((c) => c.step > touches) ?? null;
}

export function isoDate(d: Date): string {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return z.toISOString().slice(0, 10);
}
export function todayIso(): string {
  return isoDate(new Date());
}
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

/** Ngày đến hạn của một bước: ngày bắt đầu lịch + day, nhưng không sớm hơn ngày mai. */
export function dueDateFor(step: CadenceStep, cadenceStart: string | null): string {
  const tomorrow = addDays(todayIso(), 1);
  if (!cadenceStart) return tomorrow;
  const due = addDays(cadenceStart, step.day);
  return due > tomorrow ? due : tomorrow;
}

export function dueState(d: string | null): "overdue" | "today" | "soon" | "later" | "none" {
  if (!d) return "none";
  const t = todayIso();
  if (d < t) return "overdue";
  if (d === t) return "today";
  return d <= addDays(t, 3) ? "soon" : "later";
}

export function fmtDay(d: string | null): string {
  if (!d) return "—";
  const [y, m, dd] = d.slice(0, 10).split("-");
  const t = todayIso();
  if (d === t) return "Hôm nay";
  if (d === addDays(t, 1)) return "Ngày mai";
  if (d === addDays(t, -1)) return "Hôm qua";
  return `${dd}/${m}${y === t.slice(0, 4) ? "" : `/${y}`}`;
}

export function fmtUsd(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}

export function probabilityOf(d: Pick<Deal, "probability" | "stage">): number {
  return d.probability ?? STAGE_PROBABILITY[d.stage];
}

/** Dự báo giống file Excel cũ: Commit (khách đã OK), Forecast (ARR × xác suất), Best case (từ demo trở đi). */
export function forecast(rows: DealRow[]) {
  let commit = 0;
  let weighted = 0;
  let best = 0;
  let won = 0;
  for (const r of rows) {
    const arr = r.est_arr_usd ?? 0;
    if (r.stage === "won") won += arr;
    if (r.stage === "commit") commit += arr;
    if (["meeting", "proposal", "commit"].includes(r.stage)) best += arr;
    if (OPEN_STAGES.includes(r.stage)) weighted += (arr * probabilityOf(r)) / 100;
  }
  return { commit, weighted: Math.round(weighted), best, won };
}

let membersCache: Member[] | null = null;
export function useMembers(): Member[] {
  const [m, setM] = useState<Member[]>(membersCache ?? []);
  useEffect(() => {
    if (membersCache) return;
    void supabase.rpc("team_members").then(({ data }) => {
      membersCache = (data ?? []) as Member[];
      setM(membersCache);
    });
  }, []);
  return m;
}

export function memberName(members: Member[], id: string | null): string {
  if (!id) return "Chưa giao";
  const e = members.find((x) => x.user_id === id)?.email;
  return e ? e.split("@")[0] : "—";
}

// ------------------------------------------------------------------ Nội dung soạn sẵn
export interface MessageTemplate {
  step: number;
  channel: Channel;
  segment: Segment | "all";
  title: string;
  subject?: string;
  body: string;
}
export interface Sender {
  name: string;
  title: string;
  company: string;
  phone: string;
}

export function getTemplates(s: SettingsMap): MessageTemplate[] {
  const v = s["message_templates"];
  return Array.isArray(v) ? (v as MessageTemplate[]).filter((x) => x && typeof x.step === "number" && x.body) : [];
}
export function getSender(s: SettingsMap): Sender {
  const v = (s["sender"] ?? {}) as Partial<Sender>;
  return { name: v.name ?? "", title: v.title ?? "", company: v.company ?? "Bigfish Agency", phone: v.phone ?? "" };
}

/** Mẫu cho một bước: ưu tiên đúng nhóm khách, hãng phim dùng mẫu production house, sau đó mẫu chung. */
export function pickTemplate(list: MessageTemplate[], step: number, segment: Segment | null): MessageTemplate | null {
  const forStep = list.filter((t) => t.step === step);
  return (
    forStep.find((t) => t.segment === segment) ??
    (segment === "film" ? forStep.find((t) => t.segment === "agency") : undefined) ??
    forStep.find((t) => t.segment === "all") ??
    forStep[0] ??
    null
  );
}

export function signature(sd: Sender): string {
  const phone = sd.phone ? `${sd.phone} (Zalo / WhatsApp)` : "";
  return [sd.name || "[Tên bạn]", [sd.title, sd.company].filter(Boolean).join(" – "), phone].filter(Boolean).join("\n");
}

export function renderTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{([a-z_]+)\}/g, (m, k: string) => (k in vars ? vars[k] : m));
}

/** Thêm công ty vào pipeline bán hàng (giai đoạn Lead mới); bỏ qua công ty đã có deal. */
export async function addToSalesPipeline(ids: string[]): Promise<{ added: number; error: string | null }> {
  const { data, error } = await supabase
    .from("deals")
    .upsert(
      ids.map((company_id) => ({ company_id, stage: "new" })),
      { onConflict: "company_id", ignoreDuplicates: true },
    )
    .select("id");
  return { added: data?.length ?? 0, error: error?.message ?? null };
}
