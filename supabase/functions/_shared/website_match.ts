// Tìm website chính thức của một công ty từ kết quả Google (Serper): so tên công ty với domain và tiêu đề.
import { hostInList, normalizeDomain } from "./domain.ts";

/** Từ chỉ loại hình doanh nghiệp: bỏ khi so tên ("Công ty TNHH Sóng Việt" ~ "Sóng Việt"). */
const LEGAL_PHRASES =
  /\b(trach nhiem huu han|mot thanh vien|co phan|cong ty|tap doan|chi nhanh|thuong mai|dich vu|co ltd)\b/g;
const LEGAL_WORDS = new Set([
  "cty", "tnhh", "cp", "mtv", "jsc", "ltd", "llc", "inc", "corp", "corporation", "company", "limited", "group",
  "co", "tm", "dv", "the", "and", "va",
]);
/** Từ chung của ngành / địa danh: vẫn so, nhưng không đủ để nhận một website là của công ty. */
const WEAK_WORDS = new Set([
  "viet", "nam", "vietnam", "vn", "truyen", "thong", "media", "phim", "film", "films", "studio", "studios",
  "production", "productions", "san", "xuat", "quang", "cao", "agency", "creative", "entertainment", "giai", "tri",
  "digital", "communication", "communications", "hinh", "anh", "video", "tv", "ha", "noi", "sai", "gon", "ho",
  "minh", "tp", "hcm", "da", "nang", "dai", "kenh", "network", "bao", "news", "official", "pictures", "tri",
]);

export function fold(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "d").toLowerCase();
}

const words = (s: string) => fold(s).replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);

/** Từ của tên công ty: all = bỏ từ loại hình; core = bỏ thêm từ chung của ngành / địa danh. */
export function nameTokens(name: string): { all: string[]; core: string[] } {
  const w = words(words(name).join(" ").replace(LEGAL_PHRASES, " "));
  const all = w.filter((x) => !LEGAL_WORDS.has(x));
  const base = all.length ? all : w;
  const core = base.filter((x) => !WEAK_WORDS.has(x));
  return { all: base, core: core.length ? core : base };
}

/** "songvietmedia.com.vn" → "songvietmedia"; "studio.abc.vn" → "studioabc". */
export function domainLabel(domain: string): string {
  const parts = domain.toLowerCase().replace(/^www\./, "").split(".");
  const tlds = new Set(["com", "vn", "net", "org", "edu", "gov", "info", "biz", "co", "io", "asia", "tv"]);
  while (parts.length > 1 && tlds.has(parts[parts.length - 1])) parts.pop();
  return parts.join("").replace(/[^a-z0-9]/g, "");
}

/**
 * Mức khớp 0–1 giữa tên công ty và một kết quả (domain + tiêu đề).
 * Chỉ khớp tiêu đề mà domain không liên quan thì tối đa 0,45 (dưới ngưỡng nhận): tránh nhận nhầm bài báo, danh bạ.
 */
export function matchScore(name: string, domain: string, title = ""): number {
  const { all, core } = nameTokens(name);
  if (!all.length) return 0;
  const label = domainLabel(domain);
  const coreJoined = core.join("");
  let byDomain = 0;
  if (label === all.join("") || label === coreJoined) byDomain = 1;
  else if (label.length >= 4 && coreJoined.length >= 3 && label.includes(coreJoined)) byDomain = coreJoined.length >= 4 ? 0.9 : 0.5;
  else {
    const long = core.filter((t) => t.length >= 3);
    const hit = long.filter((t) => label.includes(t)).length;
    byDomain = long.length ? 0.8 * hit / long.length : 0;
    const initials = all.map((t) => t[0]).join("");
    if (initials.length >= 3 && label === initials) byDomain = Math.max(byDomain, 0.6);
  }
  const titleWords = new Set(words(title));
  const inTitle = core.filter((t) => titleWords.has(t)).length / core.length;
  if (byDomain === 0) return 0.45 * inTitle;
  return Math.min(1, Math.max(byDomain, 0.5 * byDomain + 0.5 * inTitle));
}

export interface WebsitePick {
  domain: string;
  website_url: string;
  score: number;
  via: "knowledge_graph" | "search" | "maps";
}

const ACCEPT = 0.55;
const SOCIAL = /(^|\.)(facebook|fb|youtube|youtu|tiktok|instagram|linkedin|twitter|x|zalo|google|wikipedia)\.[a-z.]+$/;

/** Chọn website từ kết quả Google Search: Knowledge Graph trước, rồi 5 kết quả đầu (bỏ trang tổng hợp). */
export function pickFromSearch(name: string, body: Record<string, unknown>, blocklist: string[]): WebsitePick | null {
  const kg = body.knowledgeGraph as Record<string, unknown> | undefined;
  const kgSite = typeof kg?.website === "string" ? kg.website : null;
  const kgDomain = normalizeDomain(kgSite);
  if (kgSite && kgDomain && !hostInList(kgDomain, blocklist)) {
    const s = Math.max(matchScore(name, kgDomain, String(kg?.title ?? "")), 0);
    // Knowledge Graph nói về đúng thực thể được tìm: chấp nhận ngưỡng thấp hơn.
    if (s >= 0.35) return { domain: kgDomain, website_url: kgSite, score: s, via: "knowledge_graph" };
  }
  let best: WebsitePick | null = null;
  const organic = (body.organic as Record<string, unknown>[] | undefined) ?? [];
  for (const [i, r] of organic.slice(0, 5).entries()) {
    const link = typeof r.link === "string" ? r.link : null;
    const domain = normalizeDomain(link);
    if (!link || !domain) continue;
    const raw = matchScore(name, domain, String(r.title ?? ""));
    // Trang tổng hợp / báo / mạng xã hội bị bỏ, trừ khi domain chính là tên công ty (vd. “Dân Trí” → dantri.com.vn).
    if (hostInList(domain, blocklist) && (raw < 0.95 || SOCIAL.test(domain))) continue;
    // Kết quả càng thấp càng trừ nhẹ, để kết quả đầu thắng khi điểm ngang nhau.
    const s = raw - i * 0.02;
    if (s >= ACCEPT && (!best || s > best.score)) best = { domain, website_url: homeOf(link), score: s, via: "search" };
  }
  return best;
}

export interface MapsPick {
  domain: string | null;
  website_url: string | null;
  phone: string | null;
  address: string | null;
  maps_url: string | null;
}

/** Chọn địa điểm Google Maps khớp tên: lấy website (nếu không phải mạng xã hội) và số điện thoại. */
export function pickFromMaps(name: string, body: Record<string, unknown>, blocklist: string[]): MapsPick | null {
  const tokens = nameTokens(name).core;
  for (const p of ((body.places as Record<string, unknown>[] | undefined) ?? []).slice(0, 3)) {
    const title = typeof p.title === "string" ? p.title : "";
    const placeWords = new Set(words(title));
    const hit = tokens.length ? tokens.filter((t) => placeWords.has(t)).length / tokens.length : 0;
    if (hit < 0.6) continue;
    const site = typeof p.website === "string" ? p.website : null;
    const domain = normalizeDomain(site);
    const ok = !!(site && domain && !hostInList(domain, blocklist));
    const cid = p.cid ? `https://www.google.com/maps?cid=${encodeURIComponent(String(p.cid))}` : null;
    return {
      domain: ok ? domain : null,
      website_url: ok ? homeOf(site!) : null,
      phone: typeof p.phoneNumber === "string" ? p.phoneNumber.slice(0, 40) : null,
      address: typeof p.address === "string" ? p.address.slice(0, 300) : null,
      maps_url: cid,
    };
  }
  return null;
}

/** Địa chỉ trong Knowledge Graph (thuộc tính “Địa chỉ” / “Address” / “Trụ sở”). */
export function kgAddress(body: Record<string, unknown>): string | null {
  const attrs = (body.knowledgeGraph as Record<string, unknown> | undefined)?.attributes as Record<string, unknown> | undefined;
  if (!attrs) return null;
  for (const [k, v] of Object.entries(attrs)) {
    if (/^(địa chỉ|dia chi|address|headquarters|trụ sở( chính)?)$/i.test(k.trim()) && typeof v === "string") return v.slice(0, 300);
  }
  return null;
}

/** Số điện thoại trong Knowledge Graph (thuộc tính “Điện thoại” / “Phone”). */
export function kgPhone(body: Record<string, unknown>): string | null {
  const attrs = (body.knowledgeGraph as Record<string, unknown> | undefined)?.attributes as Record<string, unknown> | undefined;
  if (!attrs) return null;
  for (const [k, v] of Object.entries(attrs)) {
    if (/^(điện thoại|dien thoai|phone|số điện thoại)$/i.test(k.trim()) && typeof v === "string") return v.slice(0, 40);
  }
  return null;
}

/** Trang chủ của một link kết quả (bỏ đường dẫn bài viết / trang con). */
export function homeOf(link: string): string {
  try {
    const u = new URL(link);
    return `${u.protocol}//${u.host}/`;
  } catch {
    return link;
  }
}
