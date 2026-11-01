import { assert, assertEquals, assertRejects } from "jsr:@std/assert@1";
import { isBlockedIp, parseIPv6 } from "../_shared/ip.ts";
import { assertPublicHost, safeFetch, SafeFetchError, TEXT_TYPES } from "../_shared/safeFetch.ts";

// Resolver giả: hostname → IP cố định, không gọi DNS thật.
const DNS: Record<string, string[]> = {
  "public.example.vn": ["93.184.216.34"],
  "evil-internal.example.vn": ["10.0.0.5"],
  "mixed.example.vn": ["93.184.216.34", "127.0.0.1"],
  "v6local.example.vn": ["fd12::1"],
  "metadata-alias.example.vn": ["169.254.169.254"],
};
const resolver = (h: string) => Promise.resolve(DNS[h] ?? []);

function fakeFetch(routes: Record<string, () => Response>): typeof fetch {
  return ((input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const r = routes[url];
    if (!r) return Promise.reject(new TypeError(`no route ${url}`));
    return Promise.resolve(r());
  }) as typeof fetch;
}
const html = (body: string, extra: Record<string, string> = {}) =>
  new Response(body, { status: 200, headers: { "content-type": "text/html; charset=utf-8", ...extra } });

async function code(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    if (e instanceof SafeFetchError) return e.code;
    throw e;
  }
  return "NO_ERROR";
}

Deno.test("isBlockedIp: các dải nội bộ trong mục 8.3 và mục 12", () => {
  for (
    const ip of [
      "127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "0.0.0.0",
      "100.64.0.1", "224.0.0.1", "255.255.255.255", "198.18.0.1",
      "::1", "::", "fc00::", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:10.0.0.1",
      "64:ff9b::a00:1", "2002:a00:1::", "ff02::1", "fec0::1", "not-an-ip",
    ]
  ) assert(isBlockedIp(ip), `${ip} phải bị chặn`);
});

Deno.test("isBlockedIp: IP công khai được phép", () => {
  for (const ip of ["93.184.216.34", "8.8.8.8", "172.32.0.1", "2606:4700:4700::1111", "::ffff:8.8.8.8", "2002:808:808::"]) {
    assert(!isBlockedIp(ip), `${ip} không được chặn`);
  }
});

Deno.test("parseIPv6 xử lý :: và đuôi IPv4", () => {
  assertEquals(parseIPv6("::ffff:127.0.0.1"), [0, 0, 0, 0, 0, 0xffff, 0x7f00, 1]);
  assertEquals(parseIPv6("[fe80::1%eth0]"), [0xfe80, 0, 0, 0, 0, 0, 0, 1]);
  assertEquals(parseIPv6("1::2::3"), null);
});

Deno.test("assertPublicHost: hostname nội bộ và hostname phân giải về IP nội bộ", async () => {
  assertEquals(await code(assertPublicHost("localhost", resolver)), "BLOCKED_HOST");
  assertEquals(await code(assertPublicHost("metadata.google.internal", resolver)), "BLOCKED_HOST");
  assertEquals(await code(assertPublicHost("intranet", resolver)), "BLOCKED_HOST");
  assertEquals(await code(assertPublicHost("evil-internal.example.vn", resolver)), "BLOCKED_IP");
  assertEquals(await code(assertPublicHost("mixed.example.vn", resolver)), "BLOCKED_IP");
  assertEquals(await code(assertPublicHost("v6local.example.vn", resolver)), "BLOCKED_IP");
  assertEquals(await code(assertPublicHost("metadata-alias.example.vn", resolver)), "BLOCKED_IP");
  assertEquals(await code(assertPublicHost("nxdomain.example.vn", resolver)), "DNS_FAIL");
  assertEquals(await code(assertPublicHost("public.example.vn", resolver)), "NO_ERROR");
});

Deno.test("safeFetch: chặn IP literal nội bộ, scheme lạ, cổng lạ, thông tin đăng nhập", async () => {
  const f = fakeFetch({});
  for (const url of ["http://127.0.0.1/", "http://10.0.0.1/", "http://172.16.0.1/", "http://192.168.0.1/",
    "http://169.254.169.254/latest/meta-data/", "http://[::1]/", "http://[fc00::1]/", "http://2130706433/",
    "http://0x7f.0.0.1/"]) {
    assertEquals(await code(safeFetch(url, { resolver, fetchImpl: f })), "BLOCKED_IP", url);
  }
  assertEquals(await code(safeFetch("file:///etc/passwd", { resolver, fetchImpl: f })), "BAD_SCHEME");
  assertEquals(await code(safeFetch("ftp://public.example.vn/", { resolver, fetchImpl: f })), "BAD_SCHEME");
  assertEquals(await code(safeFetch("http://public.example.vn:6379/", { resolver, fetchImpl: f })), "BAD_PORT");
  assertEquals(await code(safeFetch("http://u:p@public.example.vn/", { resolver, fetchImpl: f })), "BAD_URL");
});

Deno.test("safeFetch: redirect từ host công khai sang IP nội bộ bị chặn", async () => {
  const f = fakeFetch({
    "http://public.example.vn/": () => new Response(null, { status: 302, headers: { location: "http://169.254.169.254/" } }),
  });
  assertEquals(await code(safeFetch("http://public.example.vn/", { resolver, fetchImpl: f })), "BLOCKED_IP");
  const g = fakeFetch({
    "http://public.example.vn/": () => new Response(null, { status: 301, headers: { location: "http://evil-internal.example.vn/" } }),
  });
  assertEquals(await code(safeFetch("http://public.example.vn/", { resolver, fetchImpl: g })), "BLOCKED_IP");
});

Deno.test("safeFetch: quá số lần redirect", async () => {
  const loop = () => new Response(null, { status: 302, headers: { location: "/again" } });
  const f = fakeFetch({ "http://public.example.vn/": loop, "http://public.example.vn/again": loop });
  assertEquals(await code(safeFetch("http://public.example.vn/", { resolver, fetchImpl: f })), "TOO_MANY_REDIRECTS");
});

Deno.test("safeFetch: redirect hợp lệ trả về finalUrl", async () => {
  const f = fakeFetch({
    "http://public.example.vn/": () => new Response(null, { status: 301, headers: { location: "https://public.example.vn/vi" } }),
    "https://public.example.vn/vi": () => html("<p>Xin chào</p>"),
  });
  const r = await safeFetch("http://public.example.vn/", { resolver, fetchImpl: f });
  assertEquals(r.finalUrl, "https://public.example.vn/vi");
  assertEquals(r.text, "<p>Xin chào</p>");
});

Deno.test("safeFetch: content-type không phải HTML bị từ chối; robots.txt cho phép text/plain", async () => {
  const f = fakeFetch({
    "http://public.example.vn/file.pdf": () => new Response("%PDF", { headers: { "content-type": "application/pdf" } }),
    "http://public.example.vn/robots.txt": () => new Response("User-agent: *", { headers: { "content-type": "text/plain" } }),
  });
  assertEquals(await code(safeFetch("http://public.example.vn/file.pdf", { resolver, fetchImpl: f })), "BAD_CONTENT_TYPE");
  assertEquals(await code(safeFetch("http://public.example.vn/robots.txt", { resolver, fetchImpl: f })), "BAD_CONTENT_TYPE");
  const r = await safeFetch("http://public.example.vn/robots.txt", { resolver, fetchImpl: f, accept: TEXT_TYPES });
  assertEquals(r.text, "User-agent: *");
});

Deno.test("safeFetch: response > 2MB bị cắt (cả khi không khai báo content-length)", async () => {
  const big = "x".repeat(2 * 1024 * 1024 + 10);
  const f = fakeFetch({
    "http://public.example.vn/big": () => html(big, { "content-length": String(big.length) }),
    "http://public.example.vn/stream": () => {
      const enc = new TextEncoder().encode("y".repeat(64 * 1024));
      let sent = 0;
      const body = new ReadableStream({
        pull(c) {
          if (sent > 40) return c.close();
          sent++;
          c.enqueue(enc);
        },
      });
      return new Response(body, { headers: { "content-type": "text/html" } });
    },
  });
  assertEquals(await code(safeFetch("http://public.example.vn/big", { resolver, fetchImpl: f })), "TOO_LARGE");
  assertEquals(await code(safeFetch("http://public.example.vn/stream", { resolver, fetchImpl: f })), "TOO_LARGE");
});

Deno.test("safeFetch: timeout", async () => {
  const slow = ((_: unknown, init?: RequestInit) =>
    new Promise<Response>((_res, rej) => {
      init?.signal?.addEventListener("abort", () => rej(init.signal!.reason));
    })) as typeof fetch;
  assertEquals(await code(safeFetch("http://public.example.vn/", { resolver, fetchImpl: slow, timeoutMs: 30 })), "TIMEOUT");
});

Deno.test("safeFetch: lỗi 404 trả về ok=false không đọc body; UA chỉ ASCII", async () => {
  let ua = "";
  const f = ((_: unknown, init?: RequestInit) => {
    ua = new Headers(init?.headers).get("user-agent") ?? "";
    return Promise.resolve(new Response("not found", { status: 404, headers: { "content-type": "text/html" } }));
  }) as typeof fetch;
  const r = await safeFetch("http://public.example.vn/x", { resolver, fetchImpl: f, userAgent: "Bot/1.0 (+liên hệ nội bộ)" });
  assertEquals(r.ok, false);
  assertEquals(r.status, 404);
  assertEquals(r.text, "");
  assertEquals(ua, "Bot/1.0 (+lin h ni b)");
});

Deno.test("safeFetch: giải mã charset khai báo trong meta", async () => {
  const bytes = new Uint8Array([...new TextEncoder().encode('<meta charset="windows-1258"><p>'), 0xe2, ...new TextEncoder().encode("</p>")]);
  const f = fakeFetch({
    "http://public.example.vn/": () => new Response(bytes, { headers: { "content-type": "text/html" } }),
  });
  const r = await safeFetch("http://public.example.vn/", { resolver, fetchImpl: f });
  assert(r.text.includes("<p>â</p>"));
});
