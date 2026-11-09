// Tìm người phụ trách ngoài website (spec 003). Hàm thuần:
// - đọc kết quả Google (Serper) cho hồ sơ LinkedIn công khai: tên, chức danh, chỉ nhận khi có đúng tên công ty;
// - đọc email của công ty xuất hiện trên Internet (thông cáo báo chí, sự kiện, PDF…);
// - ghép người–email, đoán email theo mẫu khi đã có email thật của công ty làm bằng chứng (không đoán mò).
import type { EmailLabel } from "./types.ts";
import { isPlausibleEmail } from "./extract.ts";
import {
  applyPattern,
  findName,
  isRoleEmail,
  matchPattern,
  NAME_STOPWORDS,
  TITLE_RE,
  titleCase,
  VN_SURNAMES,
} from "./people.ts";

type Mx = "ok" | "a_only" | "none" | "unknown";

/** Bỏ dấu, chữ thường, chỉ giữ a-z 0-9, các từ cách nhau một dấu cách. */
export function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[đĐ]/g, "d").toLowerCase()
    .replace(/[^a-z0-9]+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Tên công ty → cụm để tìm và để so khớp
// ---------------------------------------------------------------------------
/** Hình thức pháp lý (bỏ khi tìm). */
const LEGAL = [
  "cong ty co phan", "cong ty tnhh", "cong ty", "cty", "tnhh", "co phan", "cp", "mtv", "mot thanh vien", "jsc",
  "joint stock company", "joint stock", "company limited", "co ltd", "ltd", "llc", "inc", "corp", "corporation",
  "company", "limited", "tap doan", "chi nhanh", "tm", "dv", "tmdv", "sx", "xnk",
];
/** Từ mô tả ngành (bỏ thêm để ra tên thương hiệu ngắn). */
const DESCRIPTORS = [
  "thuong mai dich vu", "truyen thong", "san xuat", "quang cao", "giai tri", "dich vu", "thuong mai", "dau tu",
  "phat trien", "cong nghe", "su kien", "giai phap", "media", "studio", "studios", "production", "productions", "film",
  "films", "phim", "agency", "group", "entertainment", "communication", "communications", "marketing", "digital",
  "creative", "event", "events", "va", "and", "viet nam", "vietnam", "vn",
];
const TLDS = new Set(["com", "vn", "net", "org", "edu", "gov", "co", "io", "tv", "asia", "biz", "info", "me"]);

function strip(tokens: string[], phrases: string[]): string[] {
  const words = phrases.map((p) => p.split(" ")).sort((a, b) => b.length - a.length);
  const folded = tokens.map(fold);
  const out: string[] = [];
  for (let i = 0; i < tokens.length;) {
    const hit = words.find((w) => w.every((x, j) => folded[i + j] === x));
    if (hit) {
      i += hit.length;
      continue;
    }
    if (folded[i]) out.push(tokens[i]);
    i++;
  }
  return out;
}

export interface CompanyKeys {
  /** Tên dùng trong câu tìm (tối đa 2: tên bỏ hình thức pháp lý, tên thương hiệu ngắn). */
  names: string[];
  /** Cụm đã bỏ dấu, so khớp nguyên từ. */
  match: string[];
  /** Cụm viết liền (≥ 6 ký tự, kể cả tên miền) để bắt “ABCMedia” lẫn “ABC Media”. */
  compact: string[];
}

export function domainLabel(domain: string | null): string | null {
  if (!domain) return null;
  const parts = domain.toLowerCase().replace(/^www\./, "").split(".");
  while (parts.length > 1 && TLDS.has(parts[parts.length - 1])) parts.pop();
  return parts[parts.length - 1]?.replace(/[^a-z0-9]/g, "") || null;
}

export function companyKeys(name: string, domain: string | null): CompanyKeys {
  const tokens = name.normalize("NFC").split(/[\s,.;:()[\]"'“”‘’\-–—&/|+]+/).filter(Boolean);
  const core = strip(tokens, LEGAL);
  const brand = strip(core, DESCRIPTORS);
  const names: string[] = [];
  const match: string[] = [];
  const compact = new Set<string>();
  const add = (t: string[], strictMatch: boolean) => {
    const s = t.join(" ");
    const f = fold(s);
    const c = f.replace(/ /g, "");
    if (c.length < 3 || match.includes(f)) return;
    names.push(s);
    // Tên thương hiệu ngắn một từ (vd. “Sao”) dễ trùng: chỉ so khớp khi đủ dài.
    if (!strictMatch || c.length >= 4 || t.length >= 2) match.push(f);
    if (c.length >= 6) compact.add(c);
  };
  add(core, false);
  add(brand, true);
  const label = domainLabel(domain);
  if (label && label.length >= 5) compact.add(label);
  return { names: names.slice(0, 2), match, compact: [...compact] };
}

/** Đoạn văn có nhắc đúng công ty không. */
export function mentionsCompany(text: string, keys: CompanyKeys): boolean {
  const f = ` ${fold(text)} `;
  if (keys.match.some((m) => f.includes(` ${m} `))) return true;
  const c = f.replace(/ /g, "");
  return keys.compact.some((k) => c.includes(k));
}

// ---------------------------------------------------------------------------
// Vai trò, câu tìm
// ---------------------------------------------------------------------------
const DEFAULT_ROLES = ["Giám đốc", "Director", "Producer", "Marketing Manager", "CEO", "Founder"];

/** Chức danh người quyết định chung (đã bỏ dấu, so khớp nguyên từ). */
const DECISION = [
  "tong giam doc", "pho tong giam doc", "giam doc", "pho giam doc", "nha sang lap", "dong sang lap", "founder",
  "co founder", "cofounder", "ceo", "cmo", "cco", "coo", "managing director", "director", "head of", "truong phong",
  "truong ban", "truong bo phan", "producer", "nha san xuat", "executive producer", "marketing manager",
  "brand manager", "content manager", "production manager", "creative lead", "content lead",
];
const JUNIOR = /\b(intern|internship|thuc tap|thuc tap sinh|student|sinh vien|fresher|cong tac vien|freelancer)\b/;

export function rolesFor(roles: Record<string, string[]>, segment: string | null): string[] {
  const list = segment ? roles[segment] : undefined;
  return list?.length ? list : DEFAULT_ROLES;
}

const q = (s: string) => `"${s.replace(/"/g, "").trim()}"`;

/** Hồ sơ LinkedIn công khai có tên công ty + vai trò cần tìm. */
export function peopleQuery(keys: CompanyKeys, roles: string[]): string {
  const r = roles.slice(0, 6).map(q).join(" OR ");
  return `site:linkedin.com/in (${keys.names.map(q).join(" OR ")})${r ? ` (${r})` : ""}`;
}

/** Trang trên Internet có nhắc email của công ty. */
export function emailQuery(domain: string): string {
  return q(`@${domain.toLowerCase()}`);
}

// ---------------------------------------------------------------------------
// Đọc kết quả Google
// ---------------------------------------------------------------------------
export interface FoundPerson {
  full_name: string;
  job_title: string;
  confidence: number;
  evidence_url: string;
}

interface Organic {
  title: string;
  link: string;
  snippet: string;
}

function organic(json: Record<string, unknown>): Organic[] {
  const list = Array.isArray(json.organic) ? json.organic as Record<string, unknown>[] : [];
  return list.map((r) => ({ title: String(r.title ?? ""), link: String(r.link ?? ""), snippet: String(r.snippet ?? "") }));
}

/** Tên người (2–5 từ). Họ Việt đứng đầu hoặc cuối (“Lan Nguyễn”), hoặc tên phương Tây ngắn. */
export function personName(raw: string): { name: string; conf: number } | null {
  const s = raw.normalize("NFC").replace(/\(.*?\)/g, " ").replace(/,.*$/, "").replace(/\s+/g, " ").trim();
  const tokens = s.split(" ");
  if (tokens.length < 2 || tokens.length > 5) return null;
  if (!tokens.every((t) => /^\p{L}[\p{L}\p{M}'’]*\.?$/u.test(t))) return null;
  const name = titleCase(s);
  const low = name.toLowerCase().split(" ");
  if (low.some((t) => NAME_STOPWORDS.has(t))) return null;
  if (VN_SURNAMES.has(low[0])) return { name, conf: 0.7 };
  if (VN_SURNAMES.has(low[low.length - 1])) return { name, conf: 0.6 };
  if (tokens.length <= 3 && low.every((t) => /^[a-z]+$/.test(t))) return { name, conf: 0.5 };
  return null;
}

const LINKEDIN_PROFILE = /^https:\/\/([a-z]{2,3}\.)?(www\.)?linkedin\.com\/in\/[^/?#]+/i;

/** Người đúng vai trò làm ở đúng công ty, từ kết quả “site:linkedin.com/in …”. */
export function parseLinkedInResults(json: Record<string, unknown>, keys: CompanyKeys, roles: string[]): FoundPerson[] {
  const roleKeys = roles.map(fold).filter(Boolean);
  const out = new Map<string, FoundPerson>();
  const isRole = (s: string) => {
    const f = ` ${fold(s)} `;
    return roleKeys.some((k) => f.includes(` ${k} `)) || DECISION.some((k) => f.includes(` ${k} `));
  };
  for (const r of organic(json)) {
    if (!LINKEDIN_PROFILE.test(r.link)) continue;
    const parts = r.title.replace(/\s*[|–—-]\s*LinkedIn\s*$/i, "").split(/\s+[|–—-]\s+/).map((s) => s.trim())
      .filter(Boolean);
    const name = parts.length ? personName(parts[0]) : null;
    if (!name || mentionsCompany(parts[0], keys)) continue;
    const rest = parts.slice(1);
    const inTitle = rest.some((p) => mentionsCompany(p, keys));
    if (!inTitle && !mentionsCompany(r.snippet, keys)) continue;
    const text = `${rest.join(" ")} ${r.snippet}`;
    if (JUNIOR.test(fold(text))) continue;
    if (!isRole(text)) continue;
    // Chức danh: phần trên tiêu đề (không phải tên công ty) có vai trò; không có thì vai trò khớp trong đoạn trích.
    const fromTitle = rest.find((p) => !mentionsCompany(p, keys) && isRole(p));
    const f = ` ${fold(text)} `;
    const generic = text.match(TITLE_RE)?.[0];
    const role = roles[roleKeys.findIndex((k) => f.includes(` ${k} `))] ?? (generic ? titleCase(generic) : null);
    const job = (fromTitle ?? role ?? "").slice(0, 120);
    if (!job) continue;
    const conf = Math.round(name.conf * (inTitle ? 1 : 0.85) * 100) / 100;
    const key = fold(name.name);
    const prev = out.get(key);
    if (!prev || prev.confidence < conf) {
      out.set(key, { full_name: name.name, job_title: job, confidence: conf, evidence_url: r.link.split(/[?#]/)[0] });
    }
  }
  return [...out.values()].sort((a, b) => b.confidence - a.confidence).slice(0, 8);
}

export interface WebEmail {
  value: string;
  evidence_url: string;
  /** Tên đứng ngay trước email, chỉ khi email đúng là tạo từ tên đó. */
  name: string | null;
}

const EMAIL_IN_TEXT = /[a-z0-9][a-z0-9._%+-]{0,63}@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}/gi;

/** Email thuộc tên miền công ty (kể cả tên miền con) trong tiêu đề / đoạn trích kết quả Google. */
export function parseWebEmails(json: Record<string, unknown>, domain: string): WebEmail[] {
  const d = domain.toLowerCase();
  const out = new Map<string, WebEmail>();
  for (const r of organic(json)) {
    if (!/^https?:\/\//i.test(r.link)) continue;
    const text = `${r.title} — ${r.snippet}`.normalize("NFC");
    for (const m of text.matchAll(EMAIL_IN_TEXT)) {
      const e = m[0].toLowerCase().replace(/[.,;:]+$/, "");
      const host = e.split("@")[1];
      if ((host !== d && !host.endsWith(`.${d}`)) || !isPlausibleEmail(e) || out.has(e)) continue;
      const before = text.slice(Math.max(0, m.index! - 80), m.index!).split(/[|•·;:]/).pop() ?? "";
      const nm = findName(before);
      out.set(e, { value: e, evidence_url: r.link, name: nm && matchPattern(nm.name, e) ? nm.name : null });
    }
  }
  return [...out.values()].slice(0, 12);
}

// ---------------------------------------------------------------------------
// Ghép người–email
// ---------------------------------------------------------------------------
/** Email tuyển dụng / CSKH / kế toán / hệ thống: không lưu từ Google, không bao giờ chọn để gửi. */
const HIDDEN_LOCALS = new Set([
  "hr", "hrm", "tuyendung", "tuyen", "recruit", "recruitment", "recruiting", "job", "jobs", "career", "careers",
  "nhansu", "ungtuyen", "cskh", "support", "hotro", "customerservice", "customercare", "customersupport", "care",
  "ketoan", "accounting", "billing", "invoice", "finance", "noreply", "donotreply", "webmaster", "postmaster",
  "abuse", "privacy", "legal",
]);

export function isHiddenEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const local = email.split("@")[0].toLowerCase().replace(/\d+$/, "");
  const first = local.split(/[._-]/)[0];
  return HIDDEN_LOCALS.has(local.replace(/[._-]/g, "")) || HIDDEN_LOCALS.has(first);
}

export interface KnownContact {
  full_name: string | null;
  email: string | null;
  email_label: EmailLabel | null;
}

export interface SearchDraft {
  full_name: string | null;
  job_title: string | null;
  email: string | null;
  email_label: EmailLabel | null;
  confidence: number;
  source: "linkedin" | "web";
  evidence_url: string;
  note: string | null;
}

function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 60);
  }
}

/**
 * Ghép người (LinkedIn) với email (Google + liên hệ đã có), suy ra mẫu email của công ty từ các cặp khớp nhau và
 * chỉ đoán email khi có mẫu đó. Bỏ người / email đã có sẵn trong danh sách liên hệ.
 */
export function mergeFound(
  domain: string | null,
  people: FoundPerson[],
  emails: WebEmail[],
  known: KnownContact[],
  mx: (domain: string) => Mx,
): { drafts: SearchDraft[]; pattern: string | null } {
  const label = (email: string, base: EmailLabel): EmailLabel => {
    const st = mx(email.split("@")[1]);
    if (st === "none") return "invalid";
    if (st === "a_only" && base === "published") return "risky";
    return base;
  };
  const knownEmails = new Set(known.map((k) => k.email?.toLowerCase()).filter(Boolean));
  const knownNamesWithEmail = new Set(known.filter((k) => k.full_name && k.email).map((k) => fold(k.full_name!)));
  const visible = emails.filter((e) => !isHiddenEmail(e.value));
  const personal = visible.filter((e) => !isRoleEmail(e.value));

  // Mẫu email của công ty: phiếu từ các cặp (tên, email) khớp nhau.
  const votes = new Map<string, { n: number; evidence: string }>();
  const vote = (name: string, email: string, weight: number) => {
    if (!domain || email.split("@")[1] !== domain) return;
    const pat = matchPattern(name, email);
    if (!pat) return;
    const v = votes.get(pat) ?? { n: 0, evidence: email };
    v.n += weight;
    votes.set(pat, v);
  };
  for (const e of personal) if (e.name) vote(e.name, e.value, 2);
  for (const p of people) for (const e of personal) vote(p.full_name, e.value, 1);
  for (const k of known) {
    if (k.full_name && k.email && k.email_label !== "guess" && k.email_label !== "invalid") vote(k.full_name, k.email.toLowerCase(), 1);
  }
  const top = [...votes.entries()].sort((a, b) => b[1].n - a[1].n)[0];
  const pattern = top?.[0] ?? null;

  const drafts: SearchDraft[] = [];
  const used = new Set<string>();
  const named = new Set<string>();
  for (const p of people) {
    const key = fold(p.full_name);
    if (knownNamesWithEmail.has(key) || named.has(key)) continue;
    named.add(key);
    const own = personal.find((e) => !used.has(e.value) && !knownEmails.has(e.value) && matchPattern(p.full_name, e.value));
    if (own) {
      used.add(own.value);
      drafts.push({
        full_name: p.full_name,
        job_title: p.job_title,
        email: own.value,
        email_label: label(own.value, "published"),
        confidence: Math.min(p.confidence, 0.8),
        source: "linkedin",
        evidence_url: p.evidence_url,
        note: `Email thấy trên ${host(own.evidence_url)}`,
      });
      continue;
    }
    const guess = pattern && domain ? applyPattern(pattern, p.full_name, domain) : null;
    const usable = guess && !knownEmails.has(guess) ? guess : null;
    drafts.push({
      full_name: p.full_name,
      job_title: p.job_title,
      email: usable,
      email_label: usable ? label(usable, "guess") : null,
      confidence: Math.round(p.confidence * (usable ? 0.6 : 1) * 100) / 100,
      source: "linkedin",
      evidence_url: p.evidence_url,
      note: usable
        ? `Email dự đoán theo mẫu của công ty (từ ${top![1].evidence})`.slice(0, 300)
        : "Chưa thấy email cá nhân — xem hồ sơ LinkedIn",
    });
  }
  for (const e of visible) {
    if (used.has(e.value) || knownEmails.has(e.value)) continue;
    used.add(e.value);
    const name = e.name && !named.has(fold(e.name)) && !knownNamesWithEmail.has(fold(e.name)) ? e.name : null;
    if (name) named.add(fold(name));
    const role = isRoleEmail(e.value);
    drafts.push({
      full_name: name,
      job_title: null,
      email: e.value,
      email_label: label(e.value, role ? "risky" : "published"),
      confidence: role ? 0.6 : 0.7,
      source: "web",
      evidence_url: e.evidence_url,
      note: `Email thấy trên ${host(e.evidence_url)}`,
    });
  }
  return { drafts, pattern };
}

/** Có ít nhất một người có tên kèm email dùng được (không phải email bị ẩn hay không tồn tại). */
export function hasPersonEmail(list: KnownContact[]): boolean {
  return list.some((x) => x.full_name && x.email && x.email_label !== "invalid" && !isHiddenEmail(x.email));
}
