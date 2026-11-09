// Xếp hạng người liên hệ để gửi email (spec 003): người đúng vai trò có email → email phòng ban liên quan → email chung.
// Email tuyển dụng / CSKH / kế toán bị ẩn, không bao giờ được chọn để gửi. Danh sách từ khoá khớp _shared/people_search.ts.
import type { Segment } from "./api-types";
import type { ContactSource } from "./db-types";
import type { SettingsMap } from "./settings";
import { foldVi } from "./pipeline";

export const SOURCE_LABEL: Record<ContactSource, string> = {
  auto: "Website",
  manual: "Nhập tay",
  google: "Google Maps",
  linkedin: "LinkedIn",
  web: "Google",
  youtube: "YouTube",
};

export interface RankableContact {
  full_name: string | null;
  job_title?: string | null;
  email: string | null;
  email_label?: string | null;
  source?: string | null;
}

const HIDDEN_LOCALS = new Set([
  "hr", "hrm", "tuyendung", "tuyen", "recruit", "recruitment", "recruiting", "job", "jobs", "career", "careers",
  "nhansu", "ungtuyen", "cskh", "support", "hotro", "customerservice", "customercare", "customersupport", "care",
  "ketoan", "accounting", "billing", "invoice", "finance", "noreply", "donotreply", "webmaster", "postmaster",
  "abuse", "privacy", "legal",
]);
/** Phòng ban có thể liên quan tới nhạc / nội dung. */
const DEPT_LOCALS = new Set([
  "marketing", "mkt", "production", "sanxuat", "content", "noidung", "media", "creative", "brand", "partnership",
  "partnerships", "partner", "partners", "business", "press", "pr", "studio", "booking", "hoptac", "collab", "ads",
  "quangcao", "sales", "kinhdoanh",
]);
const GENERIC_LOCALS = new Set([
  "info", "contact", "contacts", "lienhe", "hello", "hi", "admin", "office", "mail", "email", "team", "enquiry",
  "enquiries", "inquiry", "inquiries", "general", "vanphong",
]);

function localParts(email: string): { whole: string; first: string } {
  const local = email.split("@")[0].toLowerCase().replace(/\d+$/, "");
  return { whole: local.replace(/[._-]/g, ""), first: local.split(/[._-]/)[0] };
}
const inSet = (set: Set<string>, email: string) => {
  const p = localParts(email);
  return set.has(p.whole) || set.has(p.first);
};

export function isHiddenEmail(email: string | null | undefined): boolean {
  return !!email && inSet(HIDDEN_LOCALS, email);
}

const DEFAULT_ROLES = ["Giám đốc", "Director", "Producer", "Marketing Manager", "CEO", "Founder"];
const DECISION = [
  "tong giam doc", "giam doc", "nha sang lap", "dong sang lap", "founder", "co founder", "ceo", "cmo", "cco", "coo",
  "managing director", "director", "head of", "truong phong", "truong ban", "truong bo phan", "producer",
  "nha san xuat", "marketing manager", "brand manager", "content manager", "production manager",
];
const fold = (s: string) => ` ${foldVi(s).replace(/[^a-z0-9]+/g, " ").trim()} `;

export function getContactRoles(s: SettingsMap): Record<string, string[]> {
  const v = s["contact_roles"];
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  return Object.fromEntries(
    Object.entries(v as Record<string, unknown>).map(([k, l]) => [k, Array.isArray(l) ? l.filter((x): x is string => typeof x === "string") : []]),
  );
}

/** Chức danh có đúng vai trò cần tìm của nhóm khách (hoặc là người quyết định chung) không. */
export function roleFit(jobTitle: string | null | undefined, segment: Segment | null, roles: Record<string, string[]>): boolean {
  if (!jobTitle) return false;
  const t = fold(jobTitle);
  const list = (segment && roles[segment]?.length ? roles[segment] : DEFAULT_ROLES).map((r) => fold(r).trim());
  return list.some((r) => r && t.includes(` ${r} `)) || DECISION.some((k) => t.includes(` ${k} `));
}

/** Điểm xếp hạng; −1 = ẩn (email tuyển dụng / CSKH). */
export function contactRank(c: RankableContact, segment: Segment | null, roles: Record<string, string[]>): number {
  if (isHiddenEmail(c.email)) return -1;
  const hasEmail = !!c.email && c.email_label !== "invalid";
  const named = !!c.full_name;
  const fit = roleFit(c.job_title, segment, roles);
  let r: number;
  if (hasEmail && named) r = fit ? 100 : 80;
  else if (hasEmail && inSet(DEPT_LOCALS, c.email!)) r = 60;
  else if (hasEmail && !inSet(GENERIC_LOCALS, c.email!)) r = 55; // email cá nhân chưa rõ tên
  else if (hasEmail) r = 40;
  else if (named) r = fit ? 30 : 20;
  else r = 10;
  if (hasEmail && c.email_label === "guess") r -= 8;
  if (hasEmail && c.email_label === "risky") r -= 3;
  return r;
}

/** Sắp xếp giảm dần theo điểm (giữ thứ tự cũ khi bằng điểm); tách riêng liên hệ bị ẩn. */
export function rankContacts<T extends RankableContact>(
  list: T[],
  segment: Segment | null,
  roles: Record<string, string[]>,
): { shown: T[]; hidden: T[] } {
  const scored = list.map((c, i) => ({ c, i, r: contactRank(c, segment, roles) }));
  const shown = scored.filter((x) => x.r >= 0).sort((a, b) => b.r - a.r || a.i - b.i).map((x) => x.c);
  return { shown, hidden: scored.filter((x) => x.r < 0).map((x) => x.c) };
}

/** Liên hệ gửi email được (có email, không bị ẩn, không phải email không tồn tại). */
export function canEmail(c: RankableContact): boolean {
  return !!c.email && c.email_label !== "invalid" && !isHiddenEmail(c.email);
}
