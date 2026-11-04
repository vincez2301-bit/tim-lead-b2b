// Trích xuất dữ liệu từ HTML bằng regex — KHÔNG dùng AI (mục 4.2).
// Mọi hàm là hàm thuần (không I/O) để dễ unit test.

export type PageKind = "home" | "contact" | "about" | "team" | "careers" | "portfolio" | "other";

export interface Link {
  href: string; // URL tuyệt đối
  text: string;
}

export interface PageData {
  url: string;
  kind: PageKind;
  html: string;
  text: string;
  links: Link[];
}

/** Một phát hiện → sẽ thành một observation. */
export interface Finding {
  code: string;
  value_num: number | null;
  value_text?: string | null;
  confidence: number;
  evidence_url: string;
}

export interface FoundValue {
  value: string;
  confidence: number;
  evidence_url: string;
}

// ---------------------------------------------------------------------------
// HTML → text
// ---------------------------------------------------------------------------
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—",
  hellip: "…", copy: "©", reg: "®", trade: "™", laquo: "«", raquo: "»", bull: "•", middot: "·",
  rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", commat: "@", period: ".", lpar: "(", rpar: ")",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, ent: string) => {
    if (ent[0] === "#") {
      const code = ent[1].toLowerCase() === "x" ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return NAMED_ENTITIES[ent.toLowerCase()] ?? m;
  });
}

const BLOCK_TAGS =
  "address|article|aside|blockquote|br|dd|div|dl|dt|figcaption|figure|footer|form|h[1-6]|header|hr|li|main|nav|ol|p|pre|section|table|tbody|td|tfoot|th|thead|tr|ul";

/** Văn bản hiển thị, giữ ranh giới khối bằng xuống dòng. */
export function htmlToText(html: string): string {
  const stripped = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|iframe)\b[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(new RegExp(`<\\/?(?:${BLOCK_TAGS})\\b[^>]*>`, "gi"), "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(stripped)
    .split("\n")
    .map((l) => l.replace(/[ \t\r\f\v ]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return m ? decodeEntities(m[1] ?? m[2] ?? m[3] ?? "") : null;
}

/** Mọi thẻ <a href> → URL tuyệt đối (http/https/mailto/tel) + chữ hiển thị. */
export function extractLinks(html: string, baseUrl: string): Link[] {
  const out: Link[] = [];
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const href = attr(" " + m[1], "href");
    if (!href) continue;
    const trimmed = href.trim();
    if (/^(javascript|data|vbscript):/i.test(trimmed)) continue;
    let abs: string;
    try {
      abs = new URL(trimmed, baseUrl).toString();
    } catch {
      continue;
    }
    const text = htmlToText(m[2]).replace(/\s+/g, " ").trim().slice(0, 200);
    out.push({ href: abs, text });
  }
  return out;
}

export function extractIframeSrcs(html: string, baseUrl: string): string[] {
  const out: string[] = [];
  const re = /<iframe\b([^>]*)>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const src = attr(" " + m[1], "src") ?? attr(" " + m[1], "data-src");
    if (!src) continue;
    try {
      out.push(new URL(src, baseUrl).toString());
    } catch { /* bỏ qua */ }
  }
  return out;
}

/** Giới hạn HTML giữ lại cho mỗi trang sau khi bỏ script/style (giữ CPU/bộ nhớ trong hạn mức Edge Function). */
export const MAX_PAGE_HTML_CHARS = 200_000;

/**
 * Bỏ comment, script, style, svg, noscript, template (không chứa thông tin cần trích) rồi cắt độ dài.
 * Giữ iframe (nhúng YouTube) và thuộc tính thẻ (mailto, tel, data-cfemail).
 */
// Dấu hiệu pixel quảng cáo nằm trong <script>: giữ lại dưới dạng comment ngắn để detectPageSignals vẫn thấy.
const AD_HINTS = /fbq\(\s*['"]init|fbq\(|connect\.facebook\.net\/[^"']*fbevents\.js|['"\s=]AW-\d{6,}|googleadservices\.com\/pagead\/conversion|googletagmanager\.com\/gtag\/js/gi;

export function slimHtml(html: string): string {
  const s = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1\s*>/gi, (block, tag: string) => {
      if (tag.toLowerCase() !== "script") return " ";
      const hits = block.match(AD_HINTS);
      return hits ? ` <!--ads ${hits.slice(0, 5).join(" ")}--> ` : " ";
    });
  return s.length > MAX_PAGE_HTML_CHARS ? s.slice(0, MAX_PAGE_HTML_CHARS) : s;
}

export function makePage(url: string, kind: PageKind, rawHtml: string): PageData {
  const html = slimHtml(rawHtml);
  return { url, kind, html, text: htmlToText(html), links: extractLinks(html, url) };
}

// ---------------------------------------------------------------------------
// Phân loại trang
// ---------------------------------------------------------------------------
export const KIND_PATTERNS: Record<Exclude<PageKind, "home" | "other">, RegExp> = {
  contact: /(lien-?he|contact|lienhe)/i,
  careers: /(tuyen-?dung|careers?|jobs?|viec-?lam|recruit|co-hoi-nghe-nghiep|hiring)/i,
  team: /(doi-?ngu|our-?team|\/team|nhan-?su|ban-?lanh-?dao|leadership|founders?|our-?people)/i,
  about: /(gioi-?thieu|about|ve-?chung-?toi|who-?we-?are|cau-?chuyen|our-?story)/i,
  portfolio: /(du-?an|portfolio|projects?|showreel|our-?work|\/works?\b|tac-?pham|case-?stud)/i,
};
const KIND_TEXT: Record<Exclude<PageKind, "home" | "other">, RegExp> = {
  contact: /^(liên hệ|contact( us)?|lien he)$/i,
  careers: /^(tuyển dụng|careers?|jobs|việc làm|we'?re hiring|cơ hội nghề nghiệp)$/i,
  team: /^(đội ngũ|our team|team|ban lãnh đạo|leadership|nhân sự)$/i,
  about: /^(giới thiệu|about( us)?|về chúng tôi|who we are)$/i,
  portfolio: /^(dự án|portfolio|projects|showreel|our work|works|tác phẩm)$/i,
};

export function classifyUrl(url: string, linkText = ""): PageKind {
  let path = "";
  try {
    const u = new URL(url);
    path = (u.pathname + u.search).toLowerCase();
  } catch {
    return "other";
  }
  if (path === "/" || path === "") return "home";
  for (const kind of ["contact", "careers", "team", "about", "portfolio"] as const) {
    if (KIND_PATTERNS[kind].test(path) || KIND_TEXT[kind].test(linkText.trim())) return kind;
  }
  return "other";
}

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------
const ASSET_TLDS = new Set([
  "png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "bmp", "tif", "tiff", "avif", "heic",
  "css", "js", "mjs", "json", "map", "mp4", "webm", "mov", "mp3", "wav", "woff", "woff2", "ttf", "otf", "eot", "pdf",
]);
const PLACEHOLDER_DOMAINS = [
  "example.com", "example.org", "example.net", "domain.com", "email.com", "yourdomain.com", "yoursite.com",
  "company.com", "mysite.com", "test.com", "sentry.io", "wixpress.com", "sentry-next.wixpress.com", "localhost",
  "tenmien.com", "congty.com", "abc.com", "xyz.com",
];
const PLACEHOLDER_LOCALS = new Set(["your", "youremail", "your.email", "email", "name", "yourname", "user", "username", "abc", "xxx"]);
const EMAIL_RE = /[a-z0-9][a-z0-9._%+-]{0,63}@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}/gi;

export function isPlausibleEmail(email: string): boolean {
  const e = email.toLowerCase();
  const at = e.lastIndexOf("@");
  if (at <= 0) return false;
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  if (!/^[a-z0-9._%+-]+$/.test(local) || local.startsWith(".") || local.endsWith(".") || local.includes("..")) return false;
  const tld = domain.split(".").pop() ?? "";
  if (ASSET_TLDS.has(tld)) return false;
  if (/@\d+x\./.test(e)) return false; // logo@2x.png
  if (PLACEHOLDER_LOCALS.has(local)) return false;
  if (PLACEHOLDER_DOMAINS.some((d) => domain === d || domain.endsWith("." + d))) return false;
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(domain);
}

/** Giải mã email bị Cloudflare "Email Address Obfuscation" mã hoá. */
export function decodeCfEmail(hex: string): string | null {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length < 4 || hex.length % 2) return null;
  const key = parseInt(hex.slice(0, 2), 16);
  let out = "";
  for (let i = 2; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
  return out;
}

/** "ten [at] congty [dot] vn", "ten(at)congty.vn", "ten @ congty . vn" → dạng chuẩn. */
export function deobfuscateEmails(text: string): string {
  return text
    .replace(/\s*[\[\(\{<]\s*(?:at|@|a còng|acong)\s*[\]\)\}>]\s*/gi, "@")
    .replace(/\s*[\[\(\{<]\s*(?:dot|chấm|cham)\s*[\]\)\}>]\s*/gi, ".")
    .replace(/([a-z0-9._%+-]+)\s+(?:at|@)\s+([a-z0-9-]+)\s+(?:dot|\.)\s+([a-z]{2,24})\b/gi, "$1@$2.$3");
}

function addFound(map: Map<string, FoundValue>, value: string, confidence: number, url: string) {
  const prev = map.get(value);
  if (!prev || prev.confidence < confidence) map.set(value, { value, confidence, evidence_url: url });
}

export function extractEmails(page: Pick<PageData, "url" | "kind" | "html" | "text">): FoundValue[] {
  const found = new Map<string, FoundValue>();
  const onContact = page.kind === "contact";
  const clean = (e: string) => e.trim().toLowerCase().replace(/^mailto:/, "").replace(/[.,;:]+$/, "");

  // 1. mailto:
  for (const m of page.html.matchAll(/href\s*=\s*["']\s*mailto:([^"'?]+)/gi)) {
    let raw = m[1];
    try {
      raw = decodeURIComponent(raw);
    } catch { /* giữ nguyên */ }
    for (const part of decodeEntities(raw).split(/[,;]/)) {
      const e = clean(part);
      if (isPlausibleEmail(e)) addFound(found, e, onContact ? 0.95 : 0.85, page.url);
    }
  }
  // 2. Cloudflare email protection
  for (const m of page.html.matchAll(/(?:data-cfemail\s*=\s*["']|email-protection#)([0-9a-f]{6,})/gi)) {
    const e = decodeCfEmail(m[1]);
    if (e && isPlausibleEmail(clean(e))) addFound(found, clean(e), 0.85, page.url);
  }
  // 3. văn bản tự do
  for (const m of page.text.matchAll(EMAIL_RE)) {
    const e = clean(m[0]);
    if (isPlausibleEmail(e)) addFound(found, e, onContact ? 0.8 : 0.65, page.url);
  }
  // 4. dạng che giấu [at]/(dot)
  const deob = deobfuscateEmails(page.text);
  if (deob !== page.text) {
    for (const m of deob.matchAll(EMAIL_RE)) {
      const e = clean(m[0]);
      if (isPlausibleEmail(e)) addFound(found, e, 0.6, page.url);
    }
  }
  return [...found.values()];
}

// ---------------------------------------------------------------------------
// Số điện thoại Việt Nam
// Di động: 0[35789]x xxx xxxx (10 số). Cố định: 02xx xxxx xxxx (11 số, mã vùng từ 2017).
// Ghi chú: tài liệu nêu "tổng 10 số"; nếu áp dụng cứng sẽ loại toàn bộ số cố định
// (vd. 028 3822 1234) nên ở đây chấp nhận thêm số cố định 11 số bắt đầu bằng 02.
// ---------------------------------------------------------------------------
const PHONE_RE = /(?<![\w+])(?:\(\+?84\)|\+84|\(0|0)(?:[ .\-)]{0,2}\d){8,10}(?![\d])/g;
const NOT_PHONE_CONTEXT = /(mst|mã số thuế|ma so thue|tax|mã số doanh nghiệp|msdn|gpkd|giấy phép|stk|số tài khoản|tài khoản|account|fax|cmnd|cccd)\W{0,12}$/i;
const PHONE_CONTEXT = /(hotline|điện thoại|đt|sđt|sdt|tel|phone|mobile|di động|liên hệ|zalo|call|gọi)\W{0,25}$/i;

/** Chuẩn hoá về dạng quốc gia "0xxxxxxxxx"; null nếu không phải số VN hợp lệ. */
export function normalizeVnPhone(raw: string): string | null {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("84")) d = "0" + d.slice(2);
  if (/^0[35789]\d{8}$/.test(d)) return d;
  if (/^02\d{9}$/.test(d)) return d;
  return null;
}

/** Định dạng hiển thị: 0901 234 567 hoặc 028 3822 1234. */
export function formatVnPhone(p: string): string {
  if (p.length === 10) return `${p.slice(0, 4)} ${p.slice(4, 7)} ${p.slice(7)}`;
  if (p.length === 11) return `${p.slice(0, 3)} ${p.slice(3, 7)} ${p.slice(7)}`;
  return p;
}

export function extractPhones(page: Pick<PageData, "url" | "html" | "text">): FoundValue[] {
  const found = new Map<string, FoundValue>();
  for (const m of page.html.matchAll(/href\s*=\s*["']\s*tel:([^"']+)/gi)) {
    const p = normalizeVnPhone(decodeEntities(m[1]));
    if (p) addFound(found, p, 0.9, page.url);
  }
  for (const m of page.text.matchAll(PHONE_RE)) {
    const before = page.text.slice(Math.max(0, (m.index ?? 0) - 40), m.index ?? 0);
    if (NOT_PHONE_CONTEXT.test(before)) continue;
    const p = normalizeVnPhone(m[0]);
    if (!p) continue;
    addFound(found, p, PHONE_CONTEXT.test(before) ? 0.75 : 0.55, page.url);
  }
  return [...found.values()];
}

// ---------------------------------------------------------------------------
// Link mạng xã hội
// ---------------------------------------------------------------------------
/** Chuẩn hoá link kênh YouTube; null nếu là video/playlist hoặc không phải kênh. */
export function normalizeYoutubeChannelUrl(href: string): string | null {
  let u: URL;
  try {
    u = new URL(href);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase().replace(/^(www|m)\./, "");
  if (host !== "youtube.com") return null;
  const parts = u.pathname.split("/").filter(Boolean);
  if (parts.length === 0) return null;
  const first = parts[0];
  if (first.startsWith("@") && first.length > 1) {
    return `https://www.youtube.com/${decodeURIComponent(first).toLowerCase()}`;
  }
  if (first === "channel" && parts[1] && /^UC[\w-]{22}$/.test(parts[1])) {
    return `https://www.youtube.com/channel/${parts[1]}`;
  }
  if ((first === "c" || first === "user") && parts[1]) {
    return `https://www.youtube.com/${first}/${decodeURIComponent(parts[1])}`;
  }
  return null;
}

export function normalizeTiktokUrl(href: string): string | null {
  try {
    const u = new URL(href);
    if (!/(^|\.)tiktok\.com$/i.test(u.hostname)) return null;
    const m = u.pathname.match(/^\/(@[\w.-]+)/);
    return m ? `https://www.tiktok.com/${m[1].toLowerCase()}` : null;
  } catch {
    return null;
  }
}

export function normalizeZaloUrl(href: string): string | null {
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (host !== "zalo.me" && host !== "chat.zalo.me" && host !== "oa.zalo.me") return null;
    if (u.pathname === "/" && !u.search) return null;
    return `https://${host}${u.pathname}${u.search}`;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Tín hiệu theo trang
// ---------------------------------------------------------------------------
const HIRING_ROLE =
  /(video\s*editor|editor\s*video|biên tập (?:viên )?video|dựng phim|dựng video|editor dựng|motion\s*(?:graphics?\s*)?designer|motion graphics?|content\s*creator|sáng tạo nội dung|quay\s*(?:&|và)?\s*dựng|quay phim|videographer|cameraman|video\s*producer|nhà sản xuất video)/i;
const HIRING_CONTEXT =
  /(tuyển|tuyển dụng|hiring|we'?re hiring|join (?:our|us)|careers?|vị trí|ứng tuyển|apply|cơ hội việc làm|việc làm|job|mô tả công việc|jd\b|mức lương|salary)/i;

function near(text: string, index: number, re: RegExp, radius = 160): boolean {
  return re.test(text.slice(Math.max(0, index - radius), index + radius));
}

export function detectPageSignals(page: PageData): Finding[] {
  const out: Finding[] = [];
  const { html, text, url, kind } = page;
  const push = (code: string, confidence: number, value_text: string | null = null, value_num = 1) =>
    out.push({ code, value_num, value_text, confidence, evidence_url: url });

  // Tuyển dụng vị trí video
  const roleRe = new RegExp(HIRING_ROLE.source, "gi");
  for (const m of text.matchAll(roleRe)) {
    if (kind === "careers") {
      push("HIRING_VIDEO_ROLE", 0.9, m[0]);
      break;
    }
    if (near(text, m.index ?? 0, HIRING_CONTEXT)) {
      push("HIRING_VIDEO_ROLE", 0.7, m[0]);
      break;
    }
  }

  // Showreel / video nhúng
  const iframes = extractIframeSrcs(html, url);
  const embeds = iframes.filter((s) => /(youtube(-nocookie)?\.com\/embed|player\.vimeo\.com\/video)/i.test(s));
  if (/\bshow\s?-?reels?\b/i.test(text) || page.links.some((l) => /show-?reel/i.test(l.href))) {
    push("HAS_SHOWREEL", 0.9, "showreel");
  } else if (embeds.length > 0) {
    push("HAS_SHOWREEL", 0.6, embeds[0]);
  } else if (/<video\b/i.test(html)) {
    push("HAS_SHOWREEL", 0.5, "<video>");
  }

  // Portfolio TVC / video quảng cáo
  if (/\bTVCs?\b/.test(text)) {
    push("TVC_PORTFOLIO", kind === "portfolio" ? 0.9 : 0.8, "TVC");
  } else if (
    (kind === "portfolio" || /(portfolio|dự án|our work|projects|tác phẩm)/i.test(text)) &&
    /(quảng cáo|commercial|viral video|brand film|music video|phim doanh nghiệp|corporate video)/i.test(text)
  ) {
    push("TVC_PORTFOLIO", 0.6, "portfolio video");
  }

  // Phiên bản tiếng Anh
  const lang = html.match(/<html\b[^>]*\blang\s*=\s*["']?([a-z-]+)/i)?.[1]?.toLowerCase();
  if (lang?.startsWith("en")) {
    push("ENGLISH_SITE", 0.9, `lang=${lang}`);
  } else if (/hreflang\s*=\s*["']?en/i.test(html)) {
    push("ENGLISH_SITE", 0.9, "hreflang=en");
  } else {
    const enLink = page.links.find((l) => {
      try {
        const u = new URL(l.href);
        return /^\/en(\/|$|-)/i.test(u.pathname) || /[?&](lang|language|hl|locale)=en\b/i.test(u.search) ||
          /^(en|english|eng)$/i.test(l.text);
      } catch {
        return false;
      }
    });
    if (enLink) push("ENGLISH_SITE", 0.8, enLink.href);
  }

  // Pixel quảng cáo — chỉ là DẤU HIỆU đã cài đặt
  if (/fbq\(\s*['"]init/i.test(html) || /connect\.facebook\.net\/[^"']*fbevents\.js/i.test(html)) {
    push("RUNNING_META_ADS", 0.9, "Meta Pixel");
  } else if (/fbq\(/.test(html)) {
    push("RUNNING_META_ADS", 0.7, "fbq(");
  }
  const aw = html.match(/['"\s=]AW-\d{6,}/);
  if (aw || /googleadservices\.com\/pagead\/conversion/i.test(html)) {
    push("RUNNING_GOOGLE_ADS", 0.9, aw ? aw[0].replace(/^['"\s=]/, "") : "googleadservices");
  } else if (/googletagmanager\.com\/gtag\/js/i.test(html)) {
    push("RUNNING_GOOGLE_ADS", 0.4, "gtag.js (có thể chỉ là Analytics)");
  }
  return out;
}

// ---------------------------------------------------------------------------
// Tổng hợp nhiều trang của một công ty → danh sách Finding (1 dòng / tín hiệu)
// ---------------------------------------------------------------------------
export interface SiteExtraction {
  findings: Finding[];
  emails: FoundValue[];
  phones: FoundValue[];
  youtube: FoundValue[];
  tiktok: FoundValue[];
  zalo: FoundValue[];
}

/** Các tín hiệu website được kiểm tra; không phát hiện → ghi observation value 0. */
export const WEBSITE_SIGNALS = [
  "HIRING_VIDEO_ROLE", "HAS_SHOWREEL", "TVC_PORTFOLIO", "ENGLISH_SITE", "RUNNING_META_ADS",
  "RUNNING_GOOGLE_ADS", "HAS_TIKTOK", "HAS_YOUTUBE", "HAS_EMAIL", "HAS_PHONE", "HAS_ZALO",
] as const;

function bestOf(list: Finding[]): Finding {
  return list.reduce((a, b) => (b.confidence > a.confidence ? b : a));
}

function mergeValues(lists: FoundValue[][]): FoundValue[] {
  const map = new Map<string, FoundValue>();
  for (const l of lists) for (const v of l) addFound(map, v.value, v.confidence, v.evidence_url);
  return [...map.values()].sort((a, b) => b.confidence - a.confidence);
}

export function extractSite(pages: PageData[], opts: { excludeEmail?: (e: string) => boolean } = {}): SiteExtraction {
  const homeUrl = pages[0]?.url ?? "";
  const emails = mergeValues(pages.map(extractEmails)).filter((e) => !opts.excludeEmail?.(e.value));
  const phones = mergeValues(pages.map(extractPhones));
  const linkVals = (fn: (h: string) => string | null, conf: number) =>
    mergeValues(pages.map((p) =>
      p.links.map((l) => fn(l.href)).filter((v): v is string => !!v).map((v) => ({
        value: v,
        confidence: conf,
        evidence_url: p.url,
      }))
    ));
  const youtube = linkVals(normalizeYoutubeChannelUrl, 0.9);
  const tiktok = linkVals(normalizeTiktokUrl, 0.9);
  const zalo = linkVals(normalizeZaloUrl, 0.9);

  const byCode = new Map<string, Finding[]>();
  for (const f of pages.flatMap(detectPageSignals)) {
    byCode.set(f.code, [...(byCode.get(f.code) ?? []), f]);
  }
  const findings: Finding[] = [...byCode.values()].map(bestOf);

  const listFinding = (code: string, vals: FoundValue[], valueNum?: number) => {
    if (!vals.length) return;
    findings.push({
      code,
      value_num: valueNum ?? 1,
      value_text: vals.slice(0, 10).map((v) => v.value).join("\n"),
      confidence: vals[0].confidence,
      evidence_url: vals[0].evidence_url,
    });
  };
  listFinding("HAS_EMAIL", emails);
  listFinding("HAS_PHONE", phones.map((p) => ({ ...p, value: formatVnPhone(p.value) })));
  listFinding("HAS_TIKTOK", tiktok);
  listFinding("HAS_YOUTUBE", youtube, youtube.length);
  if (zalo.length) {
    listFinding("HAS_ZALO", zalo);
  } else if (/\bzalo\b/i.test(pages.map((p) => p.text).join("\n")) && phones.length) {
    findings.push({
      code: "HAS_ZALO",
      value_num: 1,
      value_text: `Zalo (SĐT ${formatVnPhone(phones[0].value)})`,
      confidence: 0.5,
      evidence_url: phones[0].evidence_url,
    });
  }

  // Tín hiệu đã kiểm tra nhưng không thấy → value 0 để observation mới nhất phản ánh
  // đúng hiện trạng (ví dụ công ty đã ngừng tuyển dụng).
  const present = new Set(findings.map((f) => f.code));
  for (const code of WEBSITE_SIGNALS) {
    if (!present.has(code) && homeUrl) {
      findings.push({ code, value_num: 0, value_text: null, confidence: 0.7, evidence_url: homeUrl });
    }
  }
  return { findings, emails, phones, youtube, tiktok, zalo };
}
