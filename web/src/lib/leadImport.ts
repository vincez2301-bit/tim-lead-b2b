// Ghép cột của file Excel / CSV bất kỳ vào trường lead, rồi gộp thành danh sách công ty cho import_leads.
import { SEGMENTS, SEGMENT_LABEL } from "./format";
import { foldVi } from "./pipeline";

export interface ImportRow {
  name: string;
  domain?: string;
  website_url?: string;
  segment?: string;
  city?: string;
  source?: string;
  tier?: string;
  stage?: string;
  notes?: string;
  contacts?: { full_name?: string; job_title?: string; email?: string; phone?: string }[];
  activities?: unknown[];
  [k: string]: unknown;
}

export type LeadField =
  | "company"
  | "website"
  | "segment"
  | "city"
  | "tier"
  | "source"
  | "contact_name"
  | "contact_title"
  | "contact_email"
  | "contact_phone"
  | "note";

export const LEAD_FIELDS: { key: LeadField; label: string; hint?: string }[] = [
  { key: "company", label: "Tên công ty", hint: "bắt buộc" },
  { key: "website", label: "Website" },
  { key: "segment", label: "Nhóm khách", hint: "đài / MCN / production / phim / nhãn hàng" },
  { key: "city", label: "Thành phố" },
  { key: "tier", label: "Hạng A/B/C" },
  { key: "source", label: "Nguồn" },
  { key: "contact_name", label: "Người liên hệ" },
  { key: "contact_title", label: "Chức vụ" },
  { key: "contact_email", label: "Email" },
  { key: "contact_phone", label: "Điện thoại" },
  { key: "note", label: "Ghi chú" },
];

export type Mapping = Record<LeadField, number>;

// Tên cột hay gặp (đã bỏ dấu, viết thường). Thứ tự = ưu tiên khi một cột khớp nhiều trường.
const SYNONYMS: [LeadField, string[]][] = [
  ["contact_email", ["email", "e-mail", "mail", "thu dien tu"]],
  ["contact_phone", ["so dien thoai", "dien thoai", "sdt", "phone", "mobile", "di dong", "hotline", "zalo", "tel"]],
  ["contact_title", ["chuc vu", "chuc danh", "vi tri", "title", "position", "job title", "role"]],
  ["contact_name", ["nguoi lien he", "ten nguoi lien he", "lien he", "ho ten", "ho va ten", "contact name", "contact", "full name", "pic", "dau moi"]],
  ["website", ["website", "web", "url", "trang web", "site", "domain", "ten mien"]],
  ["segment", ["nhom khach", "nhom", "phan khuc", "phan loai", "segment", "loai hinh", "linh vuc", "nganh", "category", "type", "loai"]],
  ["city", ["thanh pho", "tinh thanh", "tinh", "khu vuc", "dia ban", "city", "location", "dia chi", "address"]],
  ["tier", ["hang", "tier", "uu tien", "priority", "rank"]],
  ["source", ["nguon", "source", "kenh", "lead source"]],
  ["note", ["ghi chu", "note", "notes", "mo ta", "description", "nhan xet", "comment"]],
  ["company", ["ten cong ty", "cong ty", "company", "doanh nghiep", "khach hang", "to chuc", "don vi", "account", "brand", "thuong hieu", "ten", "name"]],
];

const norm = (s: string) => foldVi(s).replace(/[^a-z0-9@]+/g, " ").trim();

export function emptyMapping(): Mapping {
  return Object.fromEntries(LEAD_FIELDS.map((f) => [f.key, -1])) as Mapping;
}

/** Đoán cột cho từng trường: khớp nguyên tên trước, rồi khớp một phần. */
export function guessMapping(header: string[]): Mapping {
  const m = emptyMapping();
  const used = new Set<number>();
  const cols = header.map(norm);
  for (const exact of [true, false]) {
    for (const [field, words] of SYNONYMS) {
      if (m[field] >= 0) continue;
      const i = cols.findIndex(
        (c, idx) => !used.has(idx) && c && words.some((w) => (exact ? c === w : c.includes(w) && !(w.length <= 3 && c.length > w.length + 6))),
      );
      if (i >= 0) {
        m[field] = i;
        used.add(i);
      }
    }
  }
  return m;
}

/** Dòng tiêu đề: dòng đầu (trong 10 dòng) khớp nhiều tên cột nhất; mặc định dòng đầu có dữ liệu. */
export function findHeaderRow(rows: string[][]): number {
  let best = -1;
  let bestScore = 0;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const m = guessMapping(rows[i] ?? []);
    const score = Object.values(m).filter((x) => x >= 0).length + (m.company >= 0 ? 2 : 0);
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  }
  if (best >= 0) return best;
  return Math.max(0, rows.findIndex((r) => r.some((c) => c.trim())));
}

export function segmentCode(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const s = foldVi(v.trim());
  const hit = SEGMENTS.find((k) => k === s || foldVi(SEGMENT_LABEL[k]) === s);
  if (hit) return hit;
  if (/dai|broadcast|television|truyen hinh|\btv\b|phat thanh/.test(s)) return "broadcaster";
  if (/mcn|network|creator|kol|influencer/.test(s)) return "mcn";
  if (/production|agency|studio|san xuat|quang cao|tvc|event|su kien/.test(s)) return "agency";
  if (/film|phim|post|hau ky|dien anh/.test(s)) return "film";
  if (/brand|nhan hang|thuong hieu|fmcg|ban le|retail/.test(s)) return "brand";
  return undefined;
}

export function websiteToDomain(v: string): { website?: string; domain?: string } {
  const s = v.trim();
  if (!s) return {};
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    if (!u.hostname.includes(".")) return {};
    const domain = u.hostname.toLowerCase().replace(/^www\./, "");
    return { website: `${u.protocol}//${u.hostname}${u.pathname === "/" ? "" : u.pathname}`, domain };
  } catch {
    return {};
  }
}

function tierCode(v: string): string | undefined {
  const m = foldVi(v).match(/\b([abc])\b/);
  return m ? m[1].toUpperCase() : undefined;
}

/** Mỗi dòng là một công ty hoặc một người liên hệ; dòng cùng tên công ty được gộp. */
export function rowsToLeads(rows: string[][], headerRow: number, m: Mapping, defaults: { segment?: string; source: string }): ImportRow[] {
  const cell = (r: string[], f: LeadField) => (m[f] >= 0 ? (r[m[f]] ?? "").trim() : "");
  const out = new Map<string, ImportRow>();
  for (const r of rows.slice(headerRow + 1)) {
    const name = cell(r, "company").replace(/\s+/g, " ");
    if (!name || name.length > 300) continue;
    const key = norm(name);
    const web = websiteToDomain(cell(r, "website"));
    let row = out.get(key);
    if (!row) {
      row = {
        name,
        ...(web.domain ? { domain: web.domain, website_url: web.website } : {}),
        segment: segmentCode(cell(r, "segment")) ?? defaults.segment,
        city: cell(r, "city") || undefined,
        tier: tierCode(cell(r, "tier")),
        source: cell(r, "source") || defaults.source,
        notes: cell(r, "note") || undefined,
        contacts: [],
      };
      out.set(key, row);
    } else if (!row.domain && web.domain) {
      row.domain = web.domain;
      row.website_url = web.website;
    }
    const contact = {
      full_name: cell(r, "contact_name") || undefined,
      job_title: cell(r, "contact_title") || undefined,
      email: cell(r, "contact_email").toLowerCase() || undefined,
      phone: cell(r, "contact_phone") || undefined,
    };
    // Chỉ có số điện thoại (thường là số tổng đài): vẫn giữ, đặt tên chung để không bị bỏ qua khi nhập.
    if (!contact.full_name && !contact.email && contact.phone) contact.full_name = "Liên hệ chung";
    if (contact.full_name || contact.email) row.contacts!.push(contact);
  }
  return [...out.values()];
}
