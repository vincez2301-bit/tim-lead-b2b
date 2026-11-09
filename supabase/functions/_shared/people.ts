// Tìm người quyết định trên trang About/Team và suy luận email (mục 4.4). Hàm thuần.
import type { EmailLabel } from "./types.ts";
import type { FoundValue, PageData } from "./extract.ts";

export interface Person {
  full_name: string;
  job_title: string;
  confidence: number;
  evidence_url: string;
}

// Chức danh người quyết định (khớp không phân biệt hoa thường). Thứ tự = độ ưu tiên.
export const TITLE_RE = new RegExp(
  [
    "tổng giám đốc", "phó tổng giám đốc", "giám đốc điều hành", "giám đốc sáng tạo", "giám đốc sản xuất",
    "giám đốc marketing", "giám đốc nội dung", "giám đốc", "nhà sáng lập", "đồng sáng lập", "người sáng lập",
    "trưởng phòng marketing", "trưởng phòng truyền thông", "trưởng phòng sản xuất", "trưởng bộ phận nội dung",
    "nhà sản xuất", "chủ tịch",
    "chief executive officer", "chief marketing officer", "chief creative officer", "managing director",
    "executive producer", "creative director", "content director", "marketing director", "head of content",
    "head of marketing", "head of production", "marketing manager", "brand manager", "co-founder", "cofounder",
    "founder", "producer", "ceo", "cmo", "cco", "coo", "director",
  ].map((t) => t.replace(/[-]/g, "\\-")).join("|"),
  "i",
);

export const VN_SURNAMES = new Set([
  "nguyễn", "trần", "lê", "phạm", "hoàng", "huỳnh", "phan", "vũ", "võ", "đặng", "bùi", "đỗ", "hồ", "ngô",
  "dương", "lý", "đinh", "đoàn", "trương", "lâm", "mai", "trịnh", "đào", "cao", "lưu", "tạ", "tô", "hà",
  "châu", "quách", "thái", "lương", "vương", "từ", "kiều", "la", "triệu", "chu", "văn", "tăng", "khúc",
]);
export const NAME_STOPWORDS = new Set([
  "công", "ty", "tnhh", "cổ", "phần", "giám", "đốc", "tổng", "marketing", "content", "head", "our", "team",
  "về", "chúng", "tôi", "liên", "hệ", "đội", "ngũ", "ban", "lãnh", "đạo", "founder", "ceo", "director",
  "creative", "producer", "studio", "production", "media", "group", "việt", "nam", "vietnam", "the", "and",
  "of", "manager", "chief", "officer", "executive", "nhà", "sáng", "lập", "sản", "xuất", "phòng", "trưởng",
  "about", "us", "contact", "home", "agency", "film", "films", "company", "co", "ltd", "jsc",
]);

// 2–5 từ bắt đầu bằng chữ hoa (có dấu tiếng Việt), kể cả tên VIẾT HOA TOÀN BỘ.
const NAME_RE = /\p{Lu}[\p{L}\p{M}]*(?:\s+\p{Lu}[\p{L}\p{M}]*){1,4}/gu;

export function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|\s)(\p{L})/gu, (_m, sp: string, c: string) => sp + c.toUpperCase());
}

function nameConfidence(name: string): number {
  const tokens = name.toLowerCase().split(/\s+/);
  if (tokens.length < 2 || tokens.length > 5) return 0;
  if (tokens.some((t) => NAME_STOPWORDS.has(t))) return 0;
  if (VN_SURNAMES.has(tokens[0])) return 0.75;
  if (tokens.length <= 3 && tokens.every((t) => /^[a-z]+$/.test(t))) return 0.5; // tên phương Tây
  return 0;
}

export function findName(s: string): { name: string; conf: number } | null {
  let best: { name: string; conf: number } | null = null;
  for (const m of s.matchAll(NAME_RE)) {
    const name = titleCase(m[0].trim());
    const conf = nameConfidence(name);
    if (conf > 0 && (!best || conf > best.conf)) best = { name, conf };
  }
  return best;
}

/** Tìm (tên, chức danh) bằng so khớp chức danh gần tên: cùng dòng hoặc dòng liền kề. */
export function findDecisionMakers(pages: Pick<PageData, "url" | "text">[]): Person[] {
  const people = new Map<string, Person>();
  for (const page of pages) {
    const lines = page.text.normalize("NFC").split("\n").map((l) => l.trim()).filter((l) => l.length > 0 && l.length < 300);
    lines.forEach((line, i) => {
      const t = line.match(TITLE_RE);
      if (!t) return;
      const title = titleCase(t[0]).replace(/\b(Ceo|Cmo|Cco|Coo)\b/g, (x) => x.toUpperCase());
      const sameLine = findName(line.replace(t[0], " "));
      const pick = sameLine ??
        (i > 0 ? findName(lines[i - 1]) : null) ??
        (i + 1 < lines.length ? findName(lines[i + 1]) : null);
      if (!pick) return;
      // Tên nằm ở dòng liền kề kém chắc chắn hơn tên cùng dòng với chức danh.
      const conf = Math.round((sameLine ? pick.conf : pick.conf - 0.1) * 100) / 100;
      const key = pick.name.toLowerCase();
      const prev = people.get(key);
      if (!prev || prev.confidence < conf) {
        people.set(key, { full_name: pick.name, job_title: title, confidence: conf, evidence_url: page.url });
      }
    });
  }
  return [...people.values()].sort((a, b) => b.confidence - a.confidence).slice(0, 10);
}

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------
const ROLE_LOCALS = /^(info|contact|lienhe|lien\.he|hello|hi|sales|admin|support|marketing|hr|tuyendung|tuyen\.dung|jobs?|careers?|recruit(ment)?|cskh|booking|office|mail|email|kinhdoanh|hotro|press|media|partner(ship)?s?|business|inquir(y|ies)|enquir(y|ies)|team|studio|production|webmaster|noreply|no-reply|billing|accounting|ketoan)$/;

export function isRoleEmail(email: string): boolean {
  return ROLE_LOCALS.test(email.split("@")[0].toLowerCase());
}

/** Bỏ dấu tiếng Việt, chữ thường, chỉ giữ a-z. */
export function asciiFold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D")
    .toLowerCase().replace(/[^a-z\s]/g, "").trim();
}

type Pattern = (given: string, surname: string, middles: string[]) => string;

/** Các mẫu email phổ biến; tên Việt: họ đứng đầu, tên đứng cuối. */
export const PATTERNS: Record<string, Pattern> = {
  "given": (g) => g,
  "given.surname": (g, s) => `${g}.${s}`,
  "surname.given": (g, s) => `${s}.${g}`,
  "givensurname": (g, s) => `${g}${s}`,
  "surnamegiven": (g, s) => `${s}${g}`,
  "given+initials": (g, s, m) => `${g}${s[0]}${m.map((x) => x[0]).join("")}`, // annv
  "initials+given": (g, s, m) => `${s[0]}${m.map((x) => x[0]).join("")}${g}`, // nvan
  "fullname": (g, s, m) => `${s}${m.join("")}${g}`, // nguyenvanan
  "g.surname": (g, s) => `${g[0]}.${s}`,
  "gsurname": (g, s) => `${g[0]}${s}`,
  "given_surname": (g, s) => `${g}_${s}`,
};

export function nameParts(fullName: string): { given: string; surname: string; middles: string[] } | null {
  const t = asciiFold(fullName).split(/\s+/).filter(Boolean);
  if (t.length < 2) return null;
  const first = fullName.trim().split(/\s+/)[0].toLowerCase();
  const vnOrder = VN_SURNAMES.has(first);
  return vnOrder
    ? { surname: t[0], middles: t.slice(1, -1), given: t[t.length - 1] }
    : { given: t[0], middles: t.slice(1, -1), surname: t[t.length - 1] };
}

/** Tìm mẫu tạo ra local part của email cho người này. */
export function matchPattern(fullName: string, email: string): string | null {
  const p = nameParts(fullName);
  if (!p) return null;
  const local = email.split("@")[0].toLowerCase();
  for (const [key, fn] of Object.entries(PATTERNS)) {
    if (fn(p.given, p.surname, p.middles) === local) return key;
  }
  return null;
}

export function applyPattern(pattern: string, fullName: string, domain: string): string | null {
  const p = nameParts(fullName);
  const fn = PATTERNS[pattern];
  if (!p || !fn) return null;
  const local = fn(p.given, p.surname, p.middles);
  return /^[a-z][a-z0-9._]{0,63}$/.test(local) ? `${local}@${domain}` : null;
}

export interface ContactDraft {
  full_name: string | null;
  job_title: string | null;
  email: string | null;
  email_label: EmailLabel | null;
  phone: string | null;
  confidence: number;
  evidence_url: string;
}

/**
 * Ghép người quyết định với email:
 * - email công khai khớp tên → 'published'; email chung (info@...) → 'risky';
 * - suy luận mẫu từ email công khai đã khớp → email dự đoán 'guess' cho người còn lại.
 * mxStatus(domain): 'ok' | 'a_only' | 'none' | 'unknown' → 'invalid' khi 'none'.
 */
export function buildContacts(
  domain: string,
  people: Person[],
  emails: FoundValue[],
  phones: string[],
  mxStatus: (domain: string) => "ok" | "a_only" | "none" | "unknown",
): ContactDraft[] {
  const out: ContactDraft[] = [];
  const used = new Set<string>();
  const labelFor = (email: string, base: EmailLabel): EmailLabel => {
    const st = mxStatus(email.split("@")[1]);
    if (st === "none") return "invalid";
    if (st === "a_only" && base === "published") return "risky";
    return base;
  };

  // Mẫu email của công ty từ các cặp (người, email công khai) khớp nhau.
  const votes = new Map<string, number>();
  const personal = emails.filter((e) => !isRoleEmail(e.value));
  for (const person of people) {
    for (const e of personal) {
      const pat = matchPattern(person.full_name, e.value);
      if (pat) votes.set(pat, (votes.get(pat) ?? 0) + 1);
    }
  }
  const pattern = [...votes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  for (const person of people) {
    const own = personal.find((e) => !used.has(e.value) && matchPattern(person.full_name, e.value));
    if (own) {
      used.add(own.value);
      out.push({
        ...person,
        email: own.value,
        email_label: labelFor(own.value, "published"),
        phone: null,
        confidence: Math.min(person.confidence, own.confidence),
      });
      continue;
    }
    const guess = pattern ? applyPattern(pattern, person.full_name, domain) : null;
    out.push({
      ...person,
      email: guess,
      email_label: guess ? labelFor(guess, "guess") : null,
      phone: null,
      confidence: Math.round(person.confidence * (guess ? 0.6 : 1) * 100) / 100,
    });
  }

  // Email công khai còn lại (không gắn được với người cụ thể).
  phones = [...phones];
  for (const e of emails) {
    if (used.has(e.value)) continue;
    used.add(e.value);
    out.push({
      full_name: null,
      job_title: null,
      email: e.value,
      email_label: labelFor(e.value, isRoleEmail(e.value) ? "risky" : "published"),
      phone: phones.shift() ?? null,
      confidence: e.confidence,
      evidence_url: e.evidence_url,
    });
  }
  return out;
}
