// Đọc một website công ty: robots.txt → trang chủ → các trang liên hệ/giới thiệu/tuyển dụng...
// Tuân thủ mục 3: robots.txt, nghỉ giữa các request cùng domain, UA minh bạch, tối đa ~6 trang.
import {
  HTML_TYPES,
  type Resolver,
  safeFetch,
  SafeFetchError,
  type SafeFetchResult,
  TEXT_TYPES,
  XML_TYPES,
} from "./safeFetch.ts";
import { ALLOW_ALL, DISALLOW_ALL, parseRobots, type RobotsRules } from "./robots.ts";
import { classifyUrl, KIND_PATTERNS, makePage, type PageData, type PageKind } from "./extract.ts";
import { isSameSite } from "./domain.ts";
import { sleep } from "./http.ts";

export interface CrawlOptions {
  delayMs: number;
  maxPages: number;
  maxAttempts: number;
  timeoutMs: number;
  userAgent: string;
  deadline: number; // epoch ms — không bắt đầu request mới sau thời điểm này
  resolver?: Resolver;
  fetchImpl?: typeof fetch;
  sleepImpl?: (ms: number) => Promise<void>;
}

export interface CrawlResult {
  ok: boolean;
  dnsFail: boolean;
  robotsBlocked: boolean;
  homeUrl: string | null;
  pages: PageData[];
  errors: { url: string; error: string }[];
  attempts: number;
}

const DEFAULT_PATHS: Record<Exclude<PageKind, "home" | "other">, string[]> = {
  contact: ["/lien-he", "/contact"],
  about: ["/gioi-thieu", "/about"],
  team: ["/doi-ngu", "/team"],
  careers: ["/tuyen-dung", "/careers"],
  portfolio: ["/du-an", "/portfolio"],
};
const SKIP_EXT = /\.(pdf|jpe?g|png|gif|webp|svg|zip|rar|docx?|xlsx?|pptx?|mp4|mp3|avi|mov)(\?|$)/i;

class Fetcher {
  private last = 0;
  attempts = 0;
  crawlDelayMs = 0;
  constructor(private opts: CrawlOptions) {}

  timeLeft(): boolean {
    return Date.now() + this.opts.timeoutMs < this.opts.deadline;
  }

  async get(url: string, accept: string[], allowMissing = false): Promise<SafeFetchResult> {
    this.attempts++;
    const wait = this.last + Math.max(this.opts.delayMs, this.crawlDelayMs) - Date.now();
    if (this.last && wait > 0) await (this.opts.sleepImpl ?? sleep)(wait);
    this.last = Date.now();
    try {
      return await safeFetch(url, {
        accept,
        allowMissingContentType: allowMissing,
        timeoutMs: this.opts.timeoutMs,
        userAgent: this.opts.userAgent,
        resolver: this.opts.resolver,
        fetchImpl: this.opts.fetchImpl,
      });
    } finally {
      this.last = Date.now();
    }
  }
}

function errCode(e: unknown): string {
  return e instanceof SafeFetchError ? e.code : (e as Error)?.message ?? String(e);
}

export function parseSitemapLocs(xml: string, limit = 1000): { locs: string[]; isIndex: boolean } {
  const locs: string[] = [];
  for (const m of xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)\s*(?:\]\]>)?\s*<\/loc>/gi)) {
    locs.push(m[1].replace(/&amp;/g, "&"));
    if (locs.length >= limit) break;
  }
  return { locs, isIndex: /<sitemapindex\b/i.test(xml) };
}

/**
 * Đọc website. wantKinds: các loại trang cần lấy ngoài trang chủ (theo thứ tự ưu tiên).
 */
export async function crawlSite(
  domain: string,
  startUrl: string,
  wantKinds: Exclude<PageKind, "home" | "other">[],
  opts: CrawlOptions,
): Promise<CrawlResult> {
  const f = new Fetcher(opts);
  const result: CrawlResult = {
    ok: false,
    dnsFail: false,
    robotsBlocked: false,
    homeUrl: null,
    pages: [],
    errors: [],
    attempts: 0,
  };
  const fail = (url: string, e: unknown) => result.errors.push({ url, error: errCode(e) });

  // 1. robots.txt (thử https rồi http)
  let origin = new URL(startUrl).origin;
  let robots: RobotsRules = ALLOW_ALL;
  const origins = origin.startsWith("https:") ? [origin, origin.replace(/^https:/, "http:")] : [origin];
  let reached = false;
  for (const o of origins) {
    try {
      const r = await f.get(`${o}/robots.txt`, [...TEXT_TYPES, ...HTML_TYPES], true);
      reached = true;
      origin = o;
      if (r.ok && !r.contentType.startsWith("text/html")) robots = parseRobots(r.text, opts.userAgent);
      else if (r.status >= 500) robots = DISALLOW_ALL; // RFC 9309: lỗi server → coi như cấm toàn bộ
      break;
    } catch (e) {
      fail(`${o}/robots.txt`, e);
      if (e instanceof SafeFetchError && (e.code === "DNS_FAIL" || e.code.startsWith("BLOCKED"))) break;
    }
  }
  if (!reached) {
    result.dnsFail = result.errors.some((x) => x.error === "DNS_FAIL");
    result.attempts = f.attempts;
    return result;
  }
  f.crawlDelayMs = Math.min(10_000, (robots.crawlDelaySec ?? 0) * 1000);

  // 2. Trang chủ
  const startPath = (() => {
    const u = new URL(startUrl);
    return u.origin === origin ? u.pathname + u.search : "/";
  })();
  if (!robots.isAllowed(startPath)) {
    result.robotsBlocked = true;
    result.attempts = f.attempts;
    return result;
  }
  let home: SafeFetchResult | null = null;
  try {
    home = await f.get(origin + startPath, HTML_TYPES);
  } catch (e) {
    fail(origin + startPath, e);
  }
  if (!home || !home.ok) {
    if (home) result.errors.push({ url: origin + startPath, error: `HTTP_${home.status}` });
    result.attempts = f.attempts;
    return result;
  }
  result.ok = true;
  result.homeUrl = home.finalUrl;
  const homePage = makePage(home.finalUrl, "home", home.text);
  result.pages.push(homePage);
  const finalOrigin = new URL(home.finalUrl).origin;
  const sameSite = (u: URL) => isSameSite(u, domain) || u.origin === finalOrigin;

  // 3. Chọn trang ứng viên theo loại: link trên trang chủ → sitemap → đường dẫn mặc định
  const seen = new Set<string>([home.finalUrl.replace(/\/$/, "")]);
  const candidates = new Map<string, string[]>();
  for (const kind of wantKinds) candidates.set(kind, []);
  for (const link of homePage.links) {
    let u: URL;
    try {
      u = new URL(link.href);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(u.protocol) || !sameSite(u) || SKIP_EXT.test(u.pathname)) continue;
    u.hash = "";
    const kind = classifyUrl(u.toString(), link.text);
    const list = candidates.get(kind as never);
    if (list && !list.includes(u.toString())) list.push(u.toString());
  }

  let sitemapLoaded = false;
  const loadSitemap = async () => {
    if (sitemapLoaded) return;
    sitemapLoaded = true;
    const urls = robots.sitemaps.length ? robots.sitemaps.slice(0, 1) : [`${finalOrigin}/sitemap.xml`];
    let locs: string[] = [];
    for (let i = 0; i < 2 && urls[i] && f.attempts < opts.maxAttempts && f.timeLeft(); i++) {
      try {
        const u = new URL(urls[i]);
        if (!robots.isAllowed(u.pathname)) break;
        const r = await f.get(u.toString(), XML_TYPES, true);
        if (!r.ok) break;
        const parsed = parseSitemapLocs(r.text);
        if (parsed.isIndex) {
          const child = parsed.locs.find((l) => /page|post-sitemap|sitemap-?pages?/i.test(l)) ?? parsed.locs[0];
          if (child) urls.push(child);
        } else {
          locs = parsed.locs;
        }
      } catch (e) {
        fail(urls[i], e);
        break;
      }
    }
    for (const loc of locs) {
      try {
        const u = new URL(loc);
        if (!sameSite(u) || SKIP_EXT.test(u.pathname)) continue;
        const kind = classifyUrl(u.toString());
        const list = candidates.get(kind as never);
        if (list && !list.includes(u.toString())) list.push(u.toString());
      } catch { /* bỏ qua */ }
    }
  };

  for (const kind of wantKinds) {
    if (result.pages.length >= opts.maxPages) break;
    if (!(candidates.get(kind)?.length)) await loadSitemap();
    const list = [...(candidates.get(kind) ?? [])];
    // Ưu tiên URL có đường dẫn khớp mẫu của loại trang, ngắn trước.
    list.sort((a, b) => Number(KIND_PATTERNS[kind].test(b)) - Number(KIND_PATTERNS[kind].test(a)) || a.length - b.length);
    if (!list.length) list.push(...DEFAULT_PATHS[kind].map((p) => finalOrigin + p));
    for (const url of list.slice(0, 2)) {
      if (result.pages.length >= opts.maxPages || f.attempts >= opts.maxAttempts || !f.timeLeft()) break;
      const key = url.replace(/\/$/, "");
      if (seen.has(key)) continue;
      seen.add(key);
      const u = new URL(url);
      if (!robots.isAllowed(u.pathname + u.search)) {
        result.errors.push({ url, error: "ROBOTS_DISALLOW" });
        continue;
      }
      try {
        const r = await f.get(url, HTML_TYPES);
        if (!r.ok) {
          result.errors.push({ url, error: `HTTP_${r.status}` });
          continue;
        }
        if (!sameSite(new URL(r.finalUrl))) continue; // chuyển hướng ra ngoài site
        result.pages.push(makePage(r.finalUrl, kind, r.text));
        break; // đủ 1 trang cho loại này
      } catch (e) {
        fail(url, e);
      }
    }
  }
  result.attempts = f.attempts;
  return result;
}
