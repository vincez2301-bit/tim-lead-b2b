import { assert, assertEquals, assertRejects } from "jsr:@std/assert@1";
import { applyPattern, buildContacts, findDecisionMakers, isRoleEmail, matchPattern } from "../_shared/people.ts";
import { countSince, parseChannelUrl, QuotaExceededError, YoutubeClient } from "../_shared/youtube.ts";
import { crawlSite } from "../_shared/crawler.ts";
import { mxStatus } from "../_shared/mx.ts";

Deno.test("findDecisionMakers: tên Việt gần chức danh, cùng dòng hoặc dòng kề", () => {
  const people = findDecisionMakers([{
    url: "https://a.vn/doi-ngu",
    text: "Đội ngũ\nNGUYỄN VĂN AN\nGiám đốc sáng tạo\nTrần Thị Bích - Producer\nLiên hệ với chúng tôi\nCông ty TNHH Alpha",
  }]);
  assertEquals(people.map((p) => [p.full_name, p.job_title]), [
    ["Trần Thị Bích", "Producer"],
    ["Nguyễn Văn An", "Giám Đốc Sáng Tạo"],
  ]);
  assert(people[0].confidence > people[1].confidence);
});

Deno.test("email pattern: suy luận từ email công khai và áp dụng cho người khác", () => {
  assertEquals(matchPattern("Nguyễn Văn An", "annv@alpha.vn"), "given+initials");
  assertEquals(matchPattern("Nguyễn Văn An", "an.nguyen@alpha.vn"), "given.surname");
  assertEquals(applyPattern("given+initials", "Trần Thị Bích", "alpha.vn"), "bichtt@alpha.vn");
  assertEquals(applyPattern("given.surname", "Đặng Đức Đạt", "alpha.vn"), "dat.dang@alpha.vn");
  assert(isRoleEmail("info@alpha.vn") && isRoleEmail("tuyendung@alpha.vn") && !isRoleEmail("annv@alpha.vn"));

  const contacts = buildContacts(
    "alpha.vn",
    [
      { full_name: "Nguyễn Văn An", job_title: "CEO", confidence: 0.75, evidence_url: "https://alpha.vn/team" },
      { full_name: "Trần Thị Bích", job_title: "Producer", confidence: 0.75, evidence_url: "https://alpha.vn/team" },
    ],
    [
      { value: "annv@alpha.vn", confidence: 0.85, evidence_url: "https://alpha.vn/lien-he" },
      { value: "info@alpha.vn", confidence: 0.95, evidence_url: "https://alpha.vn/lien-he" },
      { value: "old@deadmail.vn", confidence: 0.6, evidence_url: "https://alpha.vn/" },
    ],
    ["0901234567"],
    (d) => d === "deadmail.vn" ? "none" : "ok",
  );
  const by = Object.fromEntries(contacts.map((c) => [c.email, c]));
  assertEquals(by["annv@alpha.vn"].email_label, "published");
  assertEquals(by["annv@alpha.vn"].full_name, "Nguyễn Văn An");
  assertEquals(by["bichtt@alpha.vn"].email_label, "guess");
  assertEquals(by["info@alpha.vn"].email_label, "risky");
  assertEquals(by["info@alpha.vn"].phone, "0901234567");
  assertEquals(by["old@deadmail.vn"].email_label, "invalid");
});

Deno.test("buildContacts: không có email để suy luận → không đoán email", () => {
  const c = buildContacts("a.vn", [{ full_name: "Lê Minh", job_title: "CEO", confidence: 0.7, evidence_url: "https://a.vn/" }], [], [], () => "ok");
  assertEquals(c[0].email, null);
  assertEquals(c[0].email_label, null);
});

Deno.test("YouTube: parse URL kênh, đếm video 30/90 ngày", () => {
  assertEquals(parseChannelUrl("https://www.youtube.com/@brand")?.handle, "@brand");
  assertEquals(parseChannelUrl("https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv")?.id, "UCabcdefghijklmnopqrstuv");
  assertEquals(parseChannelUrl("https://www.youtube.com/c/Brand")?.username, "Brand");
  const now = Date.parse("2026-11-01T00:00:00Z");
  const d = (days: number) => new Date(now - days * 86_400_000).toISOString();
  assertEquals(countSince([d(1), d(10), d(29), d(31), d(80), d(100)], 30, now), 3);
  assertEquals(countSince([d(1), d(10), d(29), d(31), d(80), d(100)], 90, now), 5);
});

function ytFetch(handler: (url: URL) => Response): typeof fetch {
  return ((input: string | URL | Request) => Promise.resolve(handler(new URL(String(input))))) as typeof fetch;
}

Deno.test("YouTube: dùng forHandle + playlistItems (không search.list), subscriber ẩn → null", async () => {
  const now = Date.now();
  const calls: string[] = [];
  const yt = new YoutubeClient({
    apiKey: "k",
    beforeCall: () => Promise.resolve(true),
    fetchImpl: ytFetch((u) => {
      calls.push(u.pathname.split("/").pop()!);
      if (u.pathname.endsWith("/channels")) {
        assertEquals(u.searchParams.get("forHandle"), "@brand");
        return Response.json({ items: [{ id: "UC1", snippet: { title: "Brand" }, statistics: { hiddenSubscriberCount: true, videoCount: "10" }, contentDetails: { relatedPlaylists: { uploads: "UU1" } } }] });
      }
      return Response.json({ items: [0, 5, 20, 45, 95].map((days) => ({ contentDetails: { videoPublishedAt: new Date(now - days * 86_400_000).toISOString() } })) });
    }),
  });
  const s = await yt.channel({ url: "https://www.youtube.com/@brand", handle: "@brand" });
  assertEquals(calls, ["channels", "playlistItems"]);
  assertEquals(s?.subscribers, null);
  assertEquals(s?.videos30d, 3);
  assertEquals(s?.videos90d, 4);
  assertEquals(yt.unitsUsed, 2);
});

Deno.test("YouTube: quotaExceeded từ API hoặc hạn mức nội bộ → QuotaExceededError", async () => {
  const api = new YoutubeClient({
    apiKey: "k",
    beforeCall: () => Promise.resolve(true),
    fetchImpl: ytFetch(() => Response.json({ error: { code: 403, errors: [{ reason: "quotaExceeded" }] } }, { status: 403 })),
  });
  await assertRejects(() => api.channel({ url: "x", id: "UCabcdefghijklmnopqrstuv" }), QuotaExceededError);
  const internal = new YoutubeClient({ apiKey: "k", beforeCall: () => Promise.resolve(false), fetchImpl: ytFetch(() => Response.json({})) });
  await assertRejects(() => internal.channel({ url: "x", id: "UCabcdefghijklmnopqrstuv" }), QuotaExceededError);
});

Deno.test("crawlSite: tuân thủ robots.txt, chọn trang từ link trang chủ, giới hạn trang", async () => {
  const pages: Record<string, Response | (() => Response)> = {
    "https://alpha.vn/robots.txt": () => new Response("User-agent: *\nDisallow: /tuyen-dung", { headers: { "content-type": "text/plain" } }),
    "https://alpha.vn/": () => new Response(
      '<a href="/lien-he">Liên hệ</a><a href="/tuyen-dung">Tuyển dụng</a><a href="/gioi-thieu">Giới thiệu</a><a href="https://other.vn/lien-he">x</a>',
      { headers: { "content-type": "text/html" } },
    ),
    "https://alpha.vn/lien-he": () => new Response("<p>info@alpha.vn</p>", { headers: { "content-type": "text/html" } }),
    "https://alpha.vn/gioi-thieu": () => new Response("<p>Về chúng tôi</p>", { headers: { "content-type": "text/html" } }),
  };
  const requested: string[] = [];
  const fetchImpl = ((input: string | URL | Request) => {
    const url = String(input);
    requested.push(url);
    const r = pages[url];
    return Promise.resolve(r ? (typeof r === "function" ? r() : r) : new Response("nf", { status: 404, headers: { "content-type": "text/html" } }));
  }) as typeof fetch;
  const res = await crawlSite("alpha.vn", "https://alpha.vn/", ["contact", "careers", "about"], {
    delayMs: 0, maxPages: 6, maxAttempts: 10, timeoutMs: 1000, userAgent: "SyncLeadFinderBot/1.0",
    deadline: Date.now() + 60_000, resolver: () => Promise.resolve(["93.184.216.34"]), fetchImpl,
  });
  assert(res.ok);
  assertEquals(res.pages.map((p) => p.kind), ["home", "contact", "about"]);
  assert(!requested.some((u) => u.includes("tuyen-dung")), "không được tải trang bị robots.txt cấm");
  assert(!requested.some((u) => u.includes("other.vn")), "không đi ra ngoài site");
  assert(res.errors.some((e) => e.error === "ROBOTS_DISALLOW"));
});

Deno.test("crawlSite: domain không phân giải → dnsFail", async () => {
  const res = await crawlSite("dead.vn", "https://dead.vn/", ["contact"], {
    delayMs: 0, maxPages: 6, maxAttempts: 10, timeoutMs: 1000, userAgent: "Bot/1.0",
    deadline: Date.now() + 60_000, resolver: () => Promise.resolve([]), fetchImpl: (() => Promise.reject(new Error("x"))) as typeof fetch,
  });
  assert(!res.ok);
  assert(res.dnsFail);
});

Deno.test("crawlSite: linkOnly — không đoán /team, /doi-ngu, không đọc sitemap khi trang chủ không có link", async () => {
  const pages: Record<string, () => Response> = {
    "https://beta.vn/robots.txt": () => new Response("User-agent: *\nAllow: /", { headers: { "content-type": "text/plain" } }),
    "https://beta.vn/": () =>
      new Response('<a href="/lien-he">Liên hệ</a><a href="/gioi-thieu">Giới thiệu</a>', { headers: { "content-type": "text/html" } }),
    "https://beta.vn/lien-he": () => new Response("<p>info@beta.vn</p>", { headers: { "content-type": "text/html" } }),
    "https://beta.vn/gioi-thieu": () => new Response("<p>Giám đốc</p>", { headers: { "content-type": "text/html" } }),
  };
  const requested: string[] = [];
  const fetchImpl = ((input: string | URL | Request) => {
    const url = String(input);
    requested.push(url.replace("https://beta.vn", ""));
    const r = pages[url];
    return Promise.resolve(r ? r() : new Response("nf", { status: 404, headers: { "content-type": "text/html" } }));
  }) as typeof fetch;
  const opts = {
    delayMs: 0, maxPages: 4, maxAttempts: 10, timeoutMs: 1000, userAgent: "SyncLeadFinderBot/1.0",
    deadline: Date.now() + 60_000, resolver: () => Promise.resolve(["93.184.216.34"]), fetchImpl,
  };
  const res = await crawlSite("beta.vn", "https://beta.vn/", ["contact", "about", "team"], { ...opts, linkOnly: ["team"] });
  assertEquals(res.pages.map((p) => p.kind), ["home", "contact", "about"]);
  assertEquals(requested, ["/robots.txt", "/", "/lien-he", "/gioi-thieu"]);

  // Không có linkOnly: vẫn đoán như trước (sitemap + đường dẫn mặc định).
  requested.length = 0;
  await crawlSite("beta.vn", "https://beta.vn/", ["contact", "about", "team"], opts);
  assert(requested.includes("/sitemap.xml") && requested.includes("/doi-ngu"));
});

Deno.test("mxStatus: DNS treo → 'unknown' sau timeout", async () => {
  // deno-lint-ignore no-explicit-any
  const d = Deno as any;
  const original = d.resolveDns;
  d.resolveDns = () => new Promise(() => {});
  try {
    const t = Date.now();
    assertEquals(await mxStatus("cham.vn", 50), "unknown");
    assert(Date.now() - t < 1000);
  } finally {
    d.resolveDns = original;
  }
});
