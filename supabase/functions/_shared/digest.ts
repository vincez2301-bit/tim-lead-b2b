// Email nhắc việc mỗi sáng: chọn việc trong ngày và dựng nội dung email (hàm thuần, có test).

export interface DigestConfig {
  enabled: boolean;
  /** Giờ gửi theo giờ Việt Nam (0–23). */
  hour: number;
  recipients: string[];
  newPerDay: number;
  appUrl: string;
  senderName: string;
}

export interface DigestDeal {
  id: string;
  company_name: string;
  segment: string | null;
  city: string | null;
  stage: string;
  tier: string | null;
  score: number | null;
  next_action: string | null;
  next_action_at: string | null;
  renewal_at: string | null;
  est_arr_usd: number | null;
  cadence_started_at: string | null;
}

export interface DigestItem {
  id: string;
  company: string;
  what: string;
  /** Nhãn hạn: “Quá hạn 2 ngày”, “Hôm nay”, “15/12”. */
  when: string;
  overdue: boolean;
  meta: string;
}

export interface Digest {
  day: string;
  due: DigestItem[];
  newLeads: DigestItem[];
  renewals: DigestItem[];
  soon: number;
  waitingNew: number;
}

const SEGMENT_LABEL: Record<string, string> = {
  broadcaster: "Đài truyền hình",
  mcn: "MCN / mạng creator",
  agency: "Production house / agency",
  film: "Hãng phim / hậu kỳ",
  brand: "Nhãn hàng",
};
// Giống web/src/lib/pipeline.ts (SEGMENT_PRIORITY, leadRank).
const SEGMENT_PRIORITY: Record<string, number> = { broadcaster: 40, mcn: 35, agency: 30, film: 25, brand: 20 };
const TIER_RANK: Record<string, number> = { A: 0, B: 1, C: 2 };
const leadRank = (d: DigestDeal) =>
  (TIER_RANK[d.tier ?? ""] ?? 3) * 100 - (SEGMENT_PRIORITY[d.segment ?? ""] ?? 0) - (d.score ?? 0) / 10;

export const RENEWAL_WINDOW_DAYS = 90;

/** Ngày và giờ hiện tại theo giờ Việt Nam (UTC+7, không có giờ mùa hè). */
export function vnNow(now: Date): { day: string; hour: number } {
  const t = new Date(now.getTime() + 7 * 3_600_000);
  return { day: t.toISOString().slice(0, 10), hour: t.getUTCHours() };
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export function dayLabel(day: string, today: string): string {
  const diff = daysBetween(today, day);
  if (diff === 0) return "Hôm nay";
  if (diff === 1) return "Ngày mai";
  if (diff < 0) return `Quá hạn ${-diff} ngày`;
  const [y, m, d] = day.split("-");
  return `${d}/${m}${y === today.slice(0, 4) ? "" : `/${y}`}`;
}

const meta = (d: DigestDeal) => [d.tier ? `Hạng ${d.tier}` : "", SEGMENT_LABEL[d.segment ?? ""] ?? "", d.city ?? ""].filter(Boolean).join(" · ");

/** Chọn việc trong ngày, cùng quy tắc với trang Hôm nay. */
export function buildDigest(deals: DigestDeal[], today: string, newPerDay: number): Digest {
  const isNew = (d: DigestDeal) => d.stage === "new" || d.stage === "research";
  const due = deals
    .filter((d) => !isNew(d) && !["won", "lost"].includes(d.stage) && d.next_action_at && d.next_action_at <= today)
    .sort((a, b) => a.next_action_at!.localeCompare(b.next_action_at!) || leadRank(a) - leadRank(b))
    .map((d) => ({
      id: d.id,
      company: d.company_name,
      what: d.next_action ?? "Điểm chạm tiếp theo",
      when: dayLabel(d.next_action_at!, today),
      overdue: d.next_action_at! < today,
      meta: meta(d),
    }));
  const startedToday = deals.filter((d) => d.stage === "outreach" && d.cadence_started_at === today).length;
  const allNew = deals.filter(isNew).sort((a, b) => leadRank(a) - leadRank(b));
  const quota = Math.max(0, newPerDay - startedToday);
  const newLeads = allNew.slice(0, quota).map((d) => ({
    id: d.id,
    company: d.company_name,
    what: "Gửi email mở lời",
    when: "Hôm nay",
    overdue: false,
    meta: meta(d),
  }));
  const renewals = deals
    .filter((d) => d.stage === "won" && d.renewal_at && d.renewal_at <= addDays(today, RENEWAL_WINDOW_DAYS))
    .sort((a, b) => a.renewal_at!.localeCompare(b.renewal_at!))
    .map((d) => ({
      id: d.id,
      company: d.company_name,
      what: `Chốt gia hạn${d.est_arr_usd ? ` · ARR $${Math.round(d.est_arr_usd).toLocaleString("en-US")}` : ""}`,
      when: `hết hạn ${dayLabel(d.renewal_at!, today)}`,
      overdue: d.renewal_at! < today,
      meta: meta(d),
    }));
  const soon = deals.filter((d) => !isNew(d) && d.next_action_at && d.next_action_at > today && d.next_action_at <= addDays(today, 3)).length;
  return { day: today, due, newLeads, renewals, soon, waitingNew: Math.max(0, allNew.length - newLeads.length) };
}

export function digestSubject(g: Digest): string {
  const [, m, d] = g.day.split("-");
  const parts = [];
  if (g.due.length) parts.push(`${g.due.length} việc đến hạn`);
  if (g.newLeads.length) parts.push(`${g.newLeads.length} lead mới cần gửi email`);
  if (g.renewals.length) parts.push(`${g.renewals.length} khách sắp gia hạn`);
  return `Bigfish ${d}/${m}: ${parts.length ? parts.join(", ") : "không có việc đến hạn"}`;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function safeAppUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.hostname === "localhost" ? u.origin : "";
  } catch {
    return "";
  }
}

export function renderDigest(g: Digest, cfg: Pick<DigestConfig, "appUrl" | "senderName">): { html: string; text: string } {
  const app = safeAppUrl(cfg.appUrl);
  const link = (id: string) => (app ? `${app}/?deal=${encodeURIComponent(id)}&tab=touches` : "");
  const total = g.due.length + g.newLeads.length;
  const hello = cfg.senderName ? `Chào buổi sáng ${escapeHtml(cfg.senderName)},` : "Chào buổi sáng,";
  const section = (title: string, items: DigestItem[]) =>
    items.length
      ? `<h2 style="font-size:15px;margin:24px 0 8px;color:#0f1115">${escapeHtml(title)} (${items.length})</h2>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse">${items
          .map(
            (i) => `<tr><td style="padding:10px 0;border-top:1px solid #e2e4e9">
<div style="font-weight:600;color:#0f1115">${link(i.id) ? `<a href="${link(i.id)}" style="color:#0f1115;text-decoration:none">${escapeHtml(i.company)}</a>` : escapeHtml(i.company)}</div>
<div style="color:#4423d6">${escapeHtml(i.what)}</div>
<div style="color:#5a606e;font-size:12px">${escapeHtml(i.meta)}</div></td>
<td style="padding:10px 0;border-top:1px solid #e2e4e9;text-align:right;white-space:nowrap;font-size:13px;color:${i.overdue ? "#c8261b" : "#5a606e"}">${escapeHtml(i.when)}</td></tr>`,
          )
          .join("")}</table>`
      : "";
  const html = `<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#2c3039">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
<div style="background:#ffffff;border:1px solid #e2e4e9;border-radius:12px;padding:24px">
<p style="margin:0 0 4px">${hello}</p>
<p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#0f1115">${total ? `Hôm nay có ${total} việc` : "Hôm nay không có việc đến hạn"}</p>
${app ? `<a href="${app}/" style="display:inline-block;background:#5534eb;color:#ffffff;text-decoration:none;font-weight:600;padding:10px 18px;border-radius:8px">Mở Bigfish và bắt đầu</a>` : ""}
${section("Việc đến hạn", g.due)}
${section("Lead mới — gửi email mở lời", g.newLeads)}
${section("Sắp gia hạn hợp đồng", g.renewals)}
<p style="margin:20px 0 0;color:#5a606e;font-size:13px">${g.soon} việc trong 3 ngày tới · ${g.waitingNew} lead mới đang chờ tới lượt.</p>
</div>
<p style="color:#5a606e;font-size:12px;text-align:center;margin:12px 0 0">Email tự động từ Bigfish Lead Finder. Đổi giờ gửi hoặc tắt ở Cài đặt → Email nhắc việc mỗi sáng.</p>
</div></body></html>`;
  const lines = (title: string, items: DigestItem[]) =>
    items.length ? [`\n${title} (${items.length})`, ...items.map((i) => `- ${i.company}: ${i.what} (${i.when})${link(i.id) ? ` ${link(i.id)}` : ""}`)] : [];
  const text = [
    cfg.senderName ? `Chào buổi sáng ${cfg.senderName},` : "Chào buổi sáng,",
    total ? `Hôm nay có ${total} việc.` : "Hôm nay không có việc đến hạn.",
    app ? `Mở Bigfish: ${app}/` : "",
    ...lines("Việc đến hạn", g.due),
    ...lines("Lead mới — gửi email mở lời", g.newLeads),
    ...lines("Sắp gia hạn hợp đồng", g.renewals),
    `\n${g.soon} việc trong 3 ngày tới · ${g.waitingNew} lead mới đang chờ tới lượt.`,
  ]
    .filter((x) => x !== "")
    .join("\n");
  return { html, text };
}

export function parseDigestConfig(v: unknown, senderName: string): DigestConfig {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const hour = Number(o.hour);
  const n = Number(o.new_per_day);
  const recipients = Array.isArray(o.recipients)
    ? o.recipients.filter((x): x is string => typeof x === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x.trim())).map((x) => x.trim())
    : [];
  return {
    enabled: o.enabled === true,
    hour: Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : 7,
    recipients: recipients.slice(0, 5),
    newPerDay: Number.isInteger(n) && n >= 0 && n <= 20 ? n : 2,
    appUrl: typeof o.app_url === "string" ? o.app_url : "",
    senderName,
  };
}
