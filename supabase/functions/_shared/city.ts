// Đoán thành phố của công ty từ địa chỉ trên website / Google Maps.
// Ưu tiên tên trong settings.regions (TP.HCM, Hà Nội…), rồi tên quận đặc trưng, rồi mọi tỉnh/thành khác.
import type { PageData } from "./extract.ts";
import type { Region } from "./settings.ts";

const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "d").toLowerCase();

/** Quận / khu vực chỉ có ở một thành phố → đủ để nhận ra thành phố khi địa chỉ không ghi tên thành phố. */
const DISTRICTS: [string, string[]][] = [
  ["TP.HCM", [
    "quan 1", "quan 3", "quan 4", "quan 5", "quan 6", "quan 7", "quan 8", "quan 10", "quan 11", "quan 12",
    "binh thanh", "phu nhuan", "tan binh", "go vap", "tan phu", "binh tan", "thu duc", "thao dien", "nha be", "cu chi",
  ]],
  ["Hà Nội", [
    "cau giay", "dong da", "ba dinh", "hoan kiem", "hai ba trung", "thanh xuan", "nam tu liem", "bac tu liem",
    "tay ho", "long bien", "hoang mai", "ha dong",
  ]],
];

/** Các tỉnh/thành (tên cũ và mới sau sáp nhập 2025) — dùng khi settings.regions không có. */
const PROVINCES = [
  "An Giang", "Bà Rịa - Vũng Tàu", "Vũng Tàu", "Bắc Giang", "Bắc Kạn", "Bạc Liêu", "Bắc Ninh", "Bến Tre", "Bình Định",
  "Bình Phước", "Bình Thuận", "Cà Mau", "Cao Bằng", "Đắk Lắk", "Đắk Nông", "Điện Biên", "Đồng Nai", "Đồng Tháp",
  "Gia Lai", "Hà Giang", "Hà Nam", "Hà Tĩnh", "Hải Dương", "Hậu Giang", "Tỉnh Hòa Bình", "Hưng Yên", "Kiên Giang",
  "Kon Tum", "Lai Châu", "Lâm Đồng", "Đà Lạt", "Lạng Sơn", "Lào Cai", "Long An", "Nam Định", "Nghệ An",
  "Ninh Bình", "Ninh Thuận", "Phú Thọ", "Phú Yên", "Quảng Bình", "Quảng Nam", "Quảng Ngãi", "Quảng Ninh", "Hạ Long",
  "Quảng Trị", "Sóc Trăng", "Sơn La", "Tây Ninh", "Tỉnh Thái Bình", "Thái Nguyên", "Thanh Hóa", "Thừa Thiên Huế", "Thành phố Huế", "TP Huế",
  "Tiền Giang", "Trà Vinh", "Tuyên Quang", "Vĩnh Long", "Vĩnh Phúc", "Yên Bái", "Biên Hòa", "Quy Nhơn", "Buôn Ma Thuột",
];

interface Pattern {
  city: string;
  re: RegExp;
  weight: number;
}

function patterns(region: Region | undefined): Pattern[] {
  const out: Pattern[] = [];
  const word = (s: string) => new RegExp(`(^|[^a-z0-9])${fold(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "[\\s.-]*")}($|[^a-z0-9])`);
  for (const loc of region?.locations ?? []) {
    for (const a of [loc.name, ...(loc.aliases ?? [])]) if (a) out.push({ city: loc.name, re: word(a), weight: 1 });
  }
  const known = new Set(out.map((p) => p.city));
  for (const [city, list] of DISTRICTS) {
    // Tên trong settings có thể khác ("TP. Hồ Chí Minh"): dùng tên của settings nếu khớp.
    const name = [...known].find((k) => fold(k).replace(/[^a-z]/g, "").includes(fold(city).replace(/[^a-z]/g, ""))) ?? city;
    for (const d of list) out.push({ city: name, re: word(d), weight: 0.8 });
    if (!known.has(name)) out.push({ city: name, re: word(city), weight: 1 });
  }
  for (const p of PROVINCES) if (!known.has(p)) out.push({ city: p, re: word(p), weight: 0.9 });
  return out;
}

const ADDRESS_LINE = /(dia chi|address|tru so|van phong|office|head ?quarter|\bhq\b|chi nhanh|phuong|quan |duong |street|district|ward|tang \d|lau \d)/;

/**
 * Thành phố trong một đoạn địa chỉ (vd. từ Google Maps). Địa chỉ đi từ nhỏ đến lớn
 * ("… Đường Thái Bình, Đồng Nai") nên lấy tên tỉnh/thành xuất hiện sau cùng; tên quận chỉ dùng khi không có tên thành phố.
 */
export function cityFromText(text: string | null | undefined, region: Region | undefined): string | null {
  if (!text) return null;
  const t = fold(text);
  let best: { city: string; at: number; w: number } | null = null;
  for (const p of patterns(region)) {
    const g = new RegExp(p.re.source, "g");
    let at = -1;
    for (const m of t.matchAll(g)) at = m.index ?? at;
    if (at < 0) continue;
    const rank = p.weight >= 0.9 ? at : -1;
    if (!best || rank > best.at || (rank === best.at && p.weight > best.w)) best = { city: p.city, at: rank, w: p.weight };
  }
  return best?.city ?? null;
}

/**
 * Thành phố từ các trang đã đọc: dòng có vẻ là địa chỉ được tính nặng nhất, trang Liên hệ hơn trang khác.
 * Không đủ chắc (chỉ nhắc tên thành phố lướt qua) thì trả null.
 */
export function cityFromPages(pages: Pick<PageData, "kind" | "text">[], region: Region | undefined): string | null {
  const pats = patterns(region);
  const score = new Map<string, number>();
  for (const page of pages) {
    const pageW = page.kind === "contact" ? 1.5 : page.kind === "home" || page.kind === "about" ? 1 : 0.5;
    for (const line of page.text.split("\n")) {
      if (line.length > 400) continue;
      const l = fold(line);
      const addr = ADDRESS_LINE.test(l);
      const hits = new Map<string, number>();
      for (const p of pats) if (p.re.test(l)) hits.set(p.city, Math.max(hits.get(p.city) ?? 0, p.weight));
      for (const [city, w] of hits) score.set(city, (score.get(city) ?? 0) + w * pageW * (addr ? 3 : 0.5));
    }
  }
  const ranked = [...score.entries()].sort((a, b) => b[1] - a[1]);
  return ranked.length && ranked[0][1] >= 2 ? ranked[0][0] : null;
}
