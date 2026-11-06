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
export type LostReason = "price" | "competitor" | "no_need" | "no_contact" | "timing" | "other" | "unqualified";

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
  /** Ngày hết hạn / gia hạn hợp đồng của khách đã ký (database tự điền mốc tròn năm kế tiếp). */
  renewal_at: string | null;
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
  new: "Chưa liên hệ. Việc đầu tiên: gửi email mở lời.",
  research: "Chưa liên hệ. Gửi email mở lời; đánh giá 8 tiêu chí khi đã trao đổi (không bắt buộc).",
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
  unqualified: "Không phù hợp",
};
export const LOST_REASON_RULE: Record<LostReason, string> = {
  price: "Liên hệ lại đầu tháng lên ngân sách (Cài đặt → sales_calendar.budget_month).",
  competitor: "Liên hệ lại 75 ngày trước khi hợp đồng của họ hết hạn (chưa biết ngày: sau 4 tháng).",
  no_need: "Liên hệ lại sau 6 tháng.",
  timing: "Liên hệ lại sau 2 tháng.",
  no_contact: "Thử lại sau 3 tháng, đổi kênh / đổi người.",
  other: "Liên hệ lại sau 3 tháng.",
  unqualified: "Không liên hệ lại; lần tìm sau tự bỏ qua công ty này.",
};

export type ObjectionTopic = "price" | "plan" | "usage" | "competitor" | "product" | "trust" | "legal" | "contract";
export const OBJECTION_TOPICS: ObjectionTopic[] = ["price", "plan", "usage", "competitor", "product", "trust", "legal", "contract"];
export const OBJECTION_TOPIC_LABEL: Record<ObjectionTopic, string> = {
  price: "Giá & ngân sách",
  plan: "Gói & cách mua",
  usage: "Ít dự án / cam kết 1 năm",
  competitor: "Đang dùng nguồn nhạc khác",
  product: "Kho nhạc & định dạng",
  trust: "Uy tín & rủi ro",
  legal: "Bản quyền & pháp lý",
  contract: "Hợp đồng & thanh toán",
};
/** Chủ đề nên mở khi khách từ chối vì lý do này. */
export const REASON_TOPICS: Record<LostReason, ObjectionTopic[]> = {
  price: ["price", "plan"],
  competitor: ["competitor"],
  no_need: ["usage", "product", "legal"],
  timing: ["usage"],
  no_contact: [],
  other: [],
  unqualified: [],
};
const TOPIC_REASON: Record<ObjectionTopic, LostReason> = {
  price: "price",
  plan: "price",
  usage: "timing",
  competitor: "competitor",
  product: "no_need",
  trust: "other",
  legal: "no_need",
  contract: "other",
};

export interface Objection {
  reason: LostReason;
  title: string;
  /** Câu trả lời đầy đủ (email / văn bản). */
  text: string;
  topic?: ObjectionTopic;
  /** Câu nói ngắn 1–3 câu khi gọi điện / nhắn Zalo. */
  short?: string;
  source?: string;
  /** Bản nháp chưa duyệt. */
  draft?: boolean;
  /** Việc cần kiểm tra trước khi dùng. */
  check?: string;
}

export function objectionTopic(o: Objection): ObjectionTopic {
  if (o.topic && o.topic in OBJECTION_TOPIC_LABEL) return o.topic;
  return o.reason === "price" ? "price" : o.reason === "competitor" ? "competitor" : o.reason === "no_contact" || o.reason === "other" ? "trust" : "usage";
}

function normObjection(x: Partial<Objection>): Objection | null {
  if (!x || typeof x.title !== "string" || !x.title.trim()) return null;
  const text = typeof x.text === "string" && x.text.trim() ? x.text : typeof x.short === "string" ? x.short : "";
  if (!text.trim()) return null;
  const topic = x.topic && x.topic in OBJECTION_TOPIC_LABEL ? x.topic : undefined;
  const reason = (x.reason && x.reason in LOST_REASON_LABEL ? x.reason : topic ? TOPIC_REASON[topic] : "other") as LostReason;
  return {
    reason,
    title: x.title.trim(),
    text,
    ...(topic ? { topic } : {}),
    ...(typeof x.short === "string" && x.short.trim() ? { short: x.short.trim() } : {}),
    ...(typeof x.source === "string" && x.source ? { source: x.source } : {}),
    ...(x.draft ? { draft: true } : {}),
    ...(typeof x.check === "string" && x.check.trim() ? { check: x.check.trim() } : {}),
  };
}

/** Đọc file kịch bản (JSON: mảng hoặc {items: [...]}) → danh sách đã kiểm tra. */
export function parseObjectionFile(raw: string): Objection[] {
  const data = JSON.parse(raw) as unknown;
  const list = Array.isArray(data) ? data : (data as { items?: unknown })?.items;
  if (!Array.isArray(list)) throw new Error("File không đúng định dạng: cần một mảng câu trả lời hoặc { items: [...] }.");
  return list.map((x) => normObjection(x as Partial<Objection>)).filter((x): x is Objection => !!x);
}

/** Gộp: câu cùng tiêu đề (không phân biệt dấu) thì thay, câu mới thì thêm. */
export function mergeObjections(current: Objection[], incoming: Objection[]): { list: Objection[]; added: number; updated: number } {
  const key = (o: Objection) => foldVi(o.title).replace(/[^a-z0-9]+/g, " ").trim();
  const list = [...current];
  let added = 0;
  let updated = 0;
  for (const o of incoming) {
    const i = list.findIndex((x) => key(x) === key(o));
    if (i >= 0) {
      list[i] = o;
      updated++;
    } else {
      list.push(o);
      added++;
    }
  }
  return { list, added, updated };
}
export interface Playlist {
  title: string;
  url: string;
  segments?: Segment[];
  note?: string;
}

export function getPlaybook(s: SettingsMap): Objection[] {
  const v = s["objection_playbook"];
  return Array.isArray(v) ? (v as Partial<Objection>[]).map(normObjection).filter((x): x is Objection => !!x) : [];
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
  email: string;
}

export function getTemplates(s: SettingsMap): MessageTemplate[] {
  const v = s["message_templates"];
  return Array.isArray(v) ? (v as MessageTemplate[]).filter((x) => x && typeof x.step === "number" && x.body) : [];
}
export function getSender(s: SettingsMap): Sender {
  const v = (s["sender"] ?? {}) as Partial<Sender>;
  return { name: v.name ?? "", title: v.title ?? "", company: v.company ?? "Epidemic Sound tại Việt Nam", phone: v.phone ?? "", email: v.email ?? "" };
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
  return [
    sd.name || "[Tên bạn]",
    [sd.title, sd.company].filter(Boolean).join(" – "),
    sd.phone ? `Điện thoại / Zalo / WhatsApp: ${sd.phone}` : "",
    sd.email ? `Email: ${sd.email}` : "",
    "www.epidemicsound.com",
  ]
    .filter(Boolean)
    .join("\n");
}

const VN_SURNAMES = new Set(
  "nguyen tran le pham hoang huynh phan vu vo dang bui do ho ngo duong ly dinh dao mai truong lam to ha ta cao luong luu chau thai quach kieu tang than chu diep phung tu trieu la doan vuong giang khong ton hua".split(" "),
);

/**
 * Cách xưng hô với người nhận: tên gọi (“Nguyễn Thị Lan” → “Lan”), anh/chị (đoán từ tên đệm Thị/Văn),
 * và lời chào đầy đủ (“chị Lan”; không có tên thì “Quý Công ty …”).
 */
export function addressFor(fullName: string | null, company: string): { ten: string; anh_chi: string; xung_ho: string } {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { ten: "[tên]", anh_chi: "anh/chị", xung_ho: `Quý Công ty ${company}` };
  const folded = parts.map(foldVi);
  const vn = folded.length > 1 && VN_SURNAMES.has(folded[0]);
  const ten = vn ? parts[parts.length - 1] : parts[0];
  const anh_chi = folded.slice(1, -1).includes("thi") ? "chị" : folded.slice(1, -1).includes("van") ? "anh" : "anh/chị";
  return { ten, anh_chi, xung_ho: `${anh_chi} ${ten}` };
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

// ------------------------------------------------------------------ Gia hạn, đứng yên, nhập tiền, tìm không dấu
/** Nhắc gia hạn trước bao nhiêu ngày. */
export const RENEWAL_WINDOW_DAYS = 90;
/** Deal đang mở không có điểm chạm / đổi giai đoạn quá số ngày này thì coi là đứng yên. */
export const STALE_DAYS = 21;

/** Số ngày deal đứng yên (kể từ lần điểm chạm hoặc đổi giai đoạn gần nhất); null nếu chưa tới ngưỡng. */
export function staleDays(r: Pick<DealRow, "stage" | "stage_changed_at" | "last_touch_at">): number | null {
  if (!OPEN_STAGES.includes(r.stage) || r.stage === "new") return null;
  const last = [r.stage_changed_at, r.last_touch_at].filter(Boolean).sort().pop();
  if (!last) return null;
  const days = Math.floor((Date.now() - new Date(last).getTime()) / 86_400_000);
  return days >= STALE_DAYS ? days : null;
}

/**
 * Đọc số tiền theo cách người Việt gõ: "10.206", "10,206", "10 206", "$10,206" đều là 10206;
 * "1.234.567" là 1234567; "12,5" hoặc "12.5" là 12.5. Trả về null nếu không đọc được.
 */
export function parseAmount(input: string): number | null {
  const s = input.replace(/[\s$₫đUSDVNDusdvnd]/g, "");
  if (!s) return null;
  if (!/^[0-9.,]+$/.test(s)) return null;
  // Dấu chấm/phẩy theo sau đúng 3 chữ số (và lặp lại) là phân nhóm hàng nghìn.
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) return Number(s.replace(/[.,]/g, ""));
  const parts = s.split(/[.,]/);
  if (parts.length > 2) return null;
  const n = Number(parts.join("."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Bỏ dấu tiếng Việt và viết thường để tìm kiếm: "Sóng Việt" → "song viet". */
export function foldVi(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "d").toLowerCase();
}

// ------------------------------------------------------------------ Giai đoạn đơn giản + việc tiếp theo
/** 5 nhóm dễ hiểu thay cho 10 giai đoạn chi tiết. */
export type Phase = "start" | "outreach" | "talking" | "won" | "paused";
export const PHASES: Phase[] = ["start", "outreach", "talking", "won", "paused"];
export const PHASE_LABEL: Record<Phase, string> = {
  start: "Chưa liên hệ",
  outreach: "Đang tiếp cận",
  talking: "Đang trao đổi",
  won: "Đã ký",
  paused: "Tạm dừng",
};
export const PHASE_HINT: Record<Phase, string> = {
  start: "Lead mới. Việc đầu tiên: gửi email mở lời.",
  outreach: "Đã gửi email, đang theo lịch 19 điểm chạm cho tới khi khách trả lời.",
  talking: "Khách đã trả lời: hẹn gặp, demo, gửi đề xuất, chốt.",
  won: "Khách đã ký: chăm sóc và chốt gia hạn.",
  paused: "Khách từ chối hoặc chưa đúng lúc: liên hệ lại đúng hẹn.",
};
export function phaseOf(stage: Stage): Phase {
  if (stage === "new" || stage === "research") return "start";
  if (stage === "outreach") return "outreach";
  if (stage === "won") return "won";
  if (stage === "lost" || stage === "nurture") return "paused";
  return "talking";
}

const STAGE_DEFAULT_ACTION: Partial<Record<Stage, string>> = {
  connected: "Hẹn buổi tìm hiểu nhu cầu",
  meeting: "Gặp / demo cho khách",
  proposal: "Theo dõi đề xuất",
  commit: "Ký hợp đồng",
  nurture: "Liên hệ lại",
};

export interface NextMove {
  title: string;
  channel: Channel | null;
  /** Ngày nên làm; null = chưa lên lịch (lead mới chờ tới lượt, hoặc chưa đặt hạn). */
  due: string | null;
  /** Bước trong lịch 19 điểm chạm (nếu có). */
  step: number | null;
}

/** Việc tiếp theo của một khách, gộp từ giai đoạn, lịch 19 bước và việc đã đặt. */
export function nextMove(r: DealRow, cadence: CadenceStep[]): NextMove {
  if (r.stage === "lost") return { title: "Đã đóng", channel: null, due: null, step: null };
  if (r.stage === "won") {
    return r.renewal_at
      ? { title: `Chốt gia hạn (hết hạn ${fmtDay(r.renewal_at)})`, channel: "call", due: addDays(r.renewal_at, -RENEWAL_WINDOW_DAYS), step: null }
      : { title: "Chăm sóc khách đã ký", channel: null, due: null, step: null };
  }
  const s = nextStep(cadence, r.touches);
  if (r.stage === "new" || r.stage === "research") {
    return { title: s?.title ?? "Email mở lời", channel: s?.channel ?? "email", due: r.next_action_at, step: s?.step ?? 1 };
  }
  if (r.stage === "outreach") {
    // Việc đã đặt khác bước trong lịch (đặt tay, hoặc lịch đã đổi) thì không đoán kênh.
    const matches = !r.next_action || r.next_action === s?.title;
    return {
      title: r.next_action ?? s?.title ?? "Chọn việc tiếp theo",
      channel: matches ? (s?.channel ?? null) : null,
      due: r.next_action_at,
      step: matches ? (s?.step ?? null) : null,
    };
  }
  return { title: r.next_action ?? STAGE_DEFAULT_ACTION[r.stage] ?? "Chọn việc tiếp theo", channel: null, due: r.next_action_at, step: null };
}

/** Thứ tự ưu tiên lead mới: hạng A/B/C → nhóm khách (đài → MCN → …) → điểm. */
export function leadRank(r: Pick<DealRow, "tier" | "segment" | "score">): number {
  const tierRank: Record<string, number> = { A: 0, B: 1, C: 2 };
  return (tierRank[r.tier ?? ""] ?? 3) * 100 - (r.segment ? SEGMENT_PRIORITY[r.segment] : 0) - (r.score ?? 0) / 10;
}

/** Số lead mới gửi email mở lời mỗi ngày (lưu trên trình duyệt). */
export const DEFAULT_NEW_PER_DAY = 2;

// ------------------------------------------------------------------ Lead không phù hợp
export type DisqualifyReason = "no_video" | "event" | "too_small" | "out_of_area" | "existing" | "duplicate" | "other";
export const DISQUALIFY_REASONS: DisqualifyReason[] = ["no_video", "event", "too_small", "out_of_area", "existing", "duplicate", "other"];
export const DISQUALIFY_LABEL: Record<DisqualifyReason, string> = {
  no_video: "Không làm video / không dùng nhạc",
  event: "Công ty sự kiện, in ấn, biển bảng",
  too_small: "Quá nhỏ, không đủ ngân sách",
  out_of_area: "Ngoài khu vực phụ trách",
  existing: "Đã là khách hàng / đối tác",
  duplicate: "Trùng hoặc sai thông tin",
  other: "Lý do khác",
};
/** Từ khoá gợi ý thêm vào danh sách tự loại khi tìm công ty, theo lý do. */
export const DISQUALIFY_SUGGEST_WORDS: Partial<Record<DisqualifyReason, string[]>> = {
  event: ["event", "sự kiện", "wedding", "tiệc cưới", "in ấn", "bảng hiệu"],
};

export async function disqualifyCompanies(ids: string[], reason: DisqualifyReason, note: string) {
  const { data, error } = await supabase.rpc("disqualify_companies", { p_ids: ids, p_reason: reason, p_note: note || null });
  if (error) throw new Error(error.message);
  return data as { companies: number; deals_removed: number; deals_closed: number };
}
export async function requalifyCompanies(ids: string[]): Promise<number> {
  const { data, error } = await supabase.rpc("requalify_companies", { p_ids: ids });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

// ------------------------------------------------------------------ Chặng chốt (bước 13–19)
/** Khách đã trả lời, đang đi tới ký. */
export const TALKING_STAGES: Stage[] = ["connected", "meeting", "proposal", "commit"];
export const isTalking = (s: Stage) => TALKING_STAGES.includes(s);
/** Bước chặng chốt ứng với từng giai đoạn (lịch mặc định: 13 tìm hiểu nhu cầu … 19 ký). */
const CLOSE_STEPS: Partial<Record<Stage, number[]>> = { connected: [13], meeting: [14, 15], proposal: [16, 17, 18], commit: [19] };
/** Ghi xong bước này thì deal tiến tới giai đoạn này (chỉ tiến, không lùi). */
const STEP_ADVANCE: Record<number, Stage> = { 13: "meeting", 15: "proposal" };
/** Khoảng cách tối đa giữa hai bước chốt: khách đã trả lời thì không để nguội quá 3 ngày. */
export const CLOSE_MAX_GAP = 3;
export const QUOTE_STEP = 15;
export const SIGN_STEP = 19;

/** Bước chốt kế tiếp theo giai đoạn (không theo số điểm chạm): bước đầu tiên của giai đoạn chưa làm. */
export function closeStep(cadence: CadenceStep[], stage: Stage, done: Set<number>): CadenceStep | null {
  const steps = (CLOSE_STEPS[stage] ?? []).map((n) => cadence.find((c) => c.step === n)).filter((c): c is CadenceStep => !!c);
  if (!steps.length) return null;
  return steps.find((s) => !done.has(s.step)) ?? steps[steps.length - 1];
}

/** Giai đoạn sau khi ghi một bước chốt. Khách “Tích cực” khi đã có đề xuất = đồng ý, chờ ký. */
export function stageAfterStep(stage: Stage, step: number | null, outcome: Outcome): Stage {
  let next = (step && STEP_ADVANCE[step]) || stage;
  if (outcome === "positive" && stage === "proposal") next = "commit";
  return OPEN_STAGES.indexOf(next) > OPEN_STAGES.indexOf(stage) ? next : stage;
}

/** Hạn của bước chốt kế tiếp: theo khoảng cách trong lịch, tối thiểu 1, tối đa CLOSE_MAX_GAP ngày. */
export function closeDue(prev: CadenceStep | null, next: CadenceStep): string {
  const gap = prev ? next.day - prev.day : 1;
  return addDays(todayIso(), Math.min(CLOSE_MAX_GAP, Math.max(1, gap)));
}
