// safeFetch — đọc website công khai an toàn, chống SSRF (mục 8.3, 10.3).
//
// So với khung trong tài liệu, bản này bổ sung:
// - chặn hostname nội bộ (localhost, *.internal, metadata.google.internal, tên một nhãn...);
// - IP literal được kiểm tra trực tiếp; chỉ cổng 80/443; cấm user:pass trong URL;
// - danh sách dải IP đầy đủ hơn (ip.ts), phân tích IPv6 đúng chuẩn;
// - content-type cấu hình được (robots.txt = text/plain, sitemap = xml);
// - giải mã theo charset; kiểm tra Content-Length trước khi đọc;
// - User-Agent chỉ dùng ký tự ASCII (header HTTP không chấp nhận "liên hệ" có dấu);
// - phân giải DNS bằng Deno.resolveDns, dự phòng DNS-over-HTTPS nếu runtime không hỗ trợ.
//
// HẠN CHẾ CÒN LẠI: khoảng hở DNS rebinding giữa lúc kiểm tra DNS và lúc fetch() tự phân
// giải lại. fetch của Deno không cho "ghim" IP; muốn đóng hoàn toàn cần proxy egress
// chặn dải nội bộ ở tầng mạng (xem README → Bảo mật).

import { isBlockedIp, isIpLiteral } from "./ip.ts";

export type Resolver = (hostname: string) => Promise<string[]>;

export class SafeFetchError extends Error {
  constructor(public code: string, message?: string) {
    super(message ?? code);
    this.name = "SafeFetchError";
  }
}

export interface SafeFetchOptions {
  /** Tiền tố MIME được chấp nhận. Mặc định HTML. */
  accept?: string[];
  /** Cho phép response không có Content-Type (vd. robots.txt trên server cũ). */
  allowMissingContentType?: boolean;
  maxBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
  userAgent?: string;
  resolver?: Resolver;
  fetchImpl?: typeof fetch;
}

export interface SafeFetchResult {
  status: number;
  ok: boolean;
  text: string; // rỗng khi status không phải 2xx
  finalUrl: string;
  contentType: string;
}

export const DEFAULT_MAX_BYTES = 2 * 1024 * 1024; // 2MB
export const DEFAULT_MAX_REDIRECTS = 3;
export const DEFAULT_TIMEOUT_MS = 8000;
export const DEFAULT_USER_AGENT = "SyncLeadFinderBot/1.0 (+https://example.com/bot)";
export const HTML_TYPES = ["text/html", "application/xhtml+xml"];
export const TEXT_TYPES = ["text/plain"];
export const XML_TYPES = ["application/xml", "text/xml", "application/rss+xml", "application/atom+xml"];

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata",
  "metadata.google.internal",
  "metadata.goog",
  "instance-data",
  "instance-data.ec2.internal",
  "kubernetes.default",
]);
const BLOCKED_SUFFIXES = [
  ".localhost",
  ".local",
  ".localdomain",
  ".internal",
  ".intranet",
  ".lan",
  ".home",
  ".corp",
  ".home.arpa",
  ".svc",
  ".cluster.local",
  ".arpa",
];
const ALLOWED_PORTS = new Set(["", "80", "443"]);

/** Ném lỗi nếu hostname thuộc mạng nội bộ theo tên. */
export function assertHostnameAllowed(hostname: string): void {
  const h = hostname.toLowerCase().replace(/\.$/, "");
  if (!h) throw new SafeFetchError("BLOCKED_HOST", "hostname rỗng");
  if (BLOCKED_HOSTNAMES.has(h)) throw new SafeFetchError("BLOCKED_HOST", h);
  if (BLOCKED_SUFFIXES.some((s) => h.endsWith(s))) throw new SafeFetchError("BLOCKED_HOST", h);
  if (!isIpLiteral(h) && !h.includes(".")) throw new SafeFetchError("BLOCKED_HOST", `${h} (tên một nhãn)`);
}

async function dohResolve(hostname: string, fetchImpl: typeof fetch): Promise<string[]> {
  const out: string[] = [];
  for (const type of ["A", "AAAA"]) {
    try {
      const res = await fetchImpl(
        `https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=${type}`,
        { headers: { accept: "application/dns-json" }, signal: AbortSignal.timeout(4000) },
      );
      if (!res.ok) continue;
      const body = await res.json() as { Answer?: { type: number; data: string }[] };
      for (const a of body.Answer ?? []) {
        if (a.type === 1 || a.type === 28) out.push(a.data);
      }
    } catch { /* bỏ qua */ }
  }
  return out;
}

/** Resolver mặc định: Deno.resolveDns (A + AAAA), dự phòng DNS-over-HTTPS. */
export const defaultResolver: Resolver = async (hostname) => {
  const ips: string[] = [];
  // deno-lint-ignore no-explicit-any
  const resolveDns = (globalThis as any).Deno?.resolveDns as
    | ((h: string, t: "A" | "AAAA") => Promise<string[]>)
    | undefined;
  if (typeof resolveDns === "function") {
    for (const type of ["A", "AAAA"] as const) {
      try {
        ips.push(...await resolveDns(hostname, type));
      } catch { /* không có bản ghi loại này */ }
    }
  }
  if (ips.length === 0) ips.push(...await dohResolve(hostname, fetch));
  return ips;
};

/** Kiểm tra host: tên được phép, mọi IP phân giải ra đều công khai. */
export async function assertPublicHost(hostname: string, resolver: Resolver = defaultResolver): Promise<void> {
  const host = hostname.replace(/^\[|\]$/g, "");
  assertHostnameAllowed(host);
  if (isIpLiteral(host)) {
    if (isBlockedIp(host)) throw new SafeFetchError("BLOCKED_IP", host);
    return;
  }
  const ips = await resolver(host);
  if (ips.length === 0) throw new SafeFetchError("DNS_FAIL", host);
  const bad = ips.find((ip) => isBlockedIp(ip));
  if (bad) throw new SafeFetchError("BLOCKED_IP", `${host} → ${bad}`);
}

function charsetOf(contentType: string, head: Uint8Array): string {
  const m = contentType.match(/charset\s*=\s*["']?([\w:.-]+)/i);
  if (m) return m[1].toLowerCase();
  const sniff = new TextDecoder("latin1").decode(head.subarray(0, 2048));
  const meta = sniff.match(/<meta[^>]+charset\s*=\s*["']?([\w:.-]+)/i);
  return meta ? meta[1].toLowerCase() : "utf-8";
}

function decode(bytes: Uint8Array, contentType: string): string {
  const cs = charsetOf(contentType, bytes);
  try {
    return new TextDecoder(cs).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

async function readLimited(res: Response, maxBytes: number): Promise<Uint8Array> {
  if (!res.body) return new Uint8Array();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new SafeFetchError("TOO_LARGE", `> ${maxBytes} bytes`);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

export async function safeFetch(url: string, opts: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const accept = opts.accept ?? HTML_TYPES;
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxRedirects = opts.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const resolver = opts.resolver ?? defaultResolver;
  const fetchImpl = opts.fetchImpl ?? fetch;
  // Header HTTP chỉ nhận ByteString → loại ký tự ngoài ASCII.
  const userAgent = (opts.userAgent ?? DEFAULT_USER_AGENT).replace(/[^\x20-\x7e]/g, "");

  let current = url;
  for (let hop = 0; ; hop++) {
    if (hop > maxRedirects) throw new SafeFetchError("TOO_MANY_REDIRECTS");
    let u: URL;
    try {
      u = new URL(current);
    } catch {
      throw new SafeFetchError("BAD_URL", current);
    }
    if (u.protocol !== "http:" && u.protocol !== "https:") throw new SafeFetchError("BAD_SCHEME", u.protocol);
    if (u.username || u.password) throw new SafeFetchError("BAD_URL", "URL chứa thông tin đăng nhập");
    if (!ALLOWED_PORTS.has(u.port)) throw new SafeFetchError("BAD_PORT", u.port);
    u.hash = "";
    await assertPublicHost(u.hostname, resolver); // kiểm tra MỌI hop

    let res: Response;
    try {
      res = await fetchImpl(u.toString(), {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          "User-Agent": userAgent,
          "Accept": accept.join(", ") + ";q=1.0, */*;q=0.1",
          "Accept-Language": "vi,en;q=0.8",
        },
      });
    } catch (e) {
      const name = (e as Error)?.name;
      if (name === "TimeoutError" || name === "AbortError") throw new SafeFetchError("TIMEOUT", u.toString());
      throw new SafeFetchError("NETWORK", (e as Error)?.message ?? String(e));
    }

    if (res.status >= 300 && res.status < 400) {
      await res.body?.cancel().catch(() => {});
      const loc = res.headers.get("location");
      if (!loc) throw new SafeFetchError("BAD_REDIRECT");
      current = new URL(loc, u).toString();
      continue;
    }

    const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      return { status: res.status, ok: false, text: "", finalUrl: u.toString(), contentType };
    }
    const typeOk = contentType
      ? accept.some((t) => contentType.startsWith(t))
      : !!opts.allowMissingContentType;
    if (!typeOk) {
      await res.body?.cancel().catch(() => {});
      throw new SafeFetchError("BAD_CONTENT_TYPE", contentType || "(không có)");
    }
    const declared = Number(res.headers.get("content-length") ?? "0");
    if (declared > maxBytes) {
      await res.body?.cancel().catch(() => {});
      throw new SafeFetchError("TOO_LARGE", `content-length ${declared}`);
    }
    const bytes = await readLimited(res, maxBytes);
    return { status: res.status, ok: true, text: decode(bytes, contentType), finalUrl: u.toString(), contentType };
  }
}
