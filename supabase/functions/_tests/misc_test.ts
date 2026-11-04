import { assert, assertEquals, assertThrows } from "jsr:@std/assert@1";
import { parseRobots } from "../_shared/robots.ts";
import { hostInList, isSameSite, normalizeDomain } from "../_shared/domain.ts";
import { csvCell, toCsv } from "../_shared/csv.ts";
import { colName, toXlsx } from "../_shared/xlsx.ts";
import { buildQuery, cleanTitle, parseSerperResults } from "../_shared/serper.ts";
import { parseCohortFilter } from "../_shared/cohort.ts";
import { makeDnc } from "../_shared/dnc.ts";
import { HttpError } from "../_shared/http.ts";
import type { Region } from "../_shared/settings.ts";
import { pickServerKey } from "../_shared/db.ts";

const UA = "SyncLeadFinderBot/1.0 (+https://example.com/bot)";

Deno.test("robots.txt: nhóm riêng của bot, khớp dài nhất, Allow thắng khi bằng nhau", () => {
  const r = parseRobots(`
User-agent: *
Disallow: /

User-agent: SyncLeadFinderBot
Disallow: /private
Allow: /private/public
Disallow: /*.pdf$
Crawl-delay: 3
Sitemap: https://a.vn/sitemap.xml`, UA);
  assert(r.isAllowed("/"));
  assert(!r.isAllowed("/private/x"));
  assert(r.isAllowed("/private/public/y"));
  assert(!r.isAllowed("/files/a.pdf"));
  assert(r.isAllowed("/files/a.pdf?x=1"));
  assertEquals(r.crawlDelaySec, 3);
  assertEquals(r.sitemaps, ["https://a.vn/sitemap.xml"]);
});

Deno.test("robots.txt: nhóm * khi không có nhóm riêng; Disallow rỗng = cho phép", () => {
  const r = parseRobots("User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nDisallow: /tuyen-dung\nDisallow:", UA);
  assert(r.isAllowed("/"));
  assert(!r.isAllowed("/tuyen-dung"));
  assert(parseRobots("", UA).isAllowed("/anything"));
});

Deno.test("normalizeDomain (mục 4.1 bước 3)", () => {
  assertEquals(normalizeDomain("https://WWW.CongTy.com.vn/lien-he?x=1"), "congty.com.vn");
  assertEquals(normalizeDomain("congty.vn"), "congty.vn");
  assertEquals(normalizeDomain("http://www2.abc.vn:8080/"), "abc.vn");
  assertEquals(normalizeDomain("https://phim.việt.vn/"), "phim.xn--vit-zpa.vn".replace("vit-zpa", normalizeDomain("việt.vn")!.split(".")[0].slice(4)));
  assertEquals(normalizeDomain("http://127.0.0.1/"), null);
  assertEquals(normalizeDomain("not a url"), null);
  assert(hostInList("vn.linkedin.com", ["linkedin.com"]));
  assert(!hostInList("notlinkedin.com", ["linkedin.com"]));
  assert(isSameSite("https://www.congty.vn/x", "congty.vn"));
  assert(isSameSite("https://careers.congty.vn/x", "congty.vn"));
  assert(!isSameSite("https://congty.vn.evil.com/", "congty.vn"));
});

Deno.test("CSV: BOM UTF-8, chống CSV injection, escape dấu nháy", () => {
  const bytes = toCsv(["Tên", "Điểm"], [["=HYPERLINK(\"x\")", 80], ["Công ty \"A\", B", null], ["@SUM(A1)", -5], ["+84 901", 0]]);
  assertEquals([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf]);
  const text = new TextDecoder().decode(bytes.slice(3));
  assertEquals(text.split("\r\n")[0], "Tên,Điểm");
  assertEquals(text.split("\r\n")[1], `"'=HYPERLINK(""x"")",80`);
  assertEquals(text.split("\r\n")[2], `"Công ty ""A"", B",`);
  assertEquals(text.split("\r\n")[3], "'@SUM(A1),-5");
  assertEquals(csvCell("-1+2"), "'-1+2");
  assertEquals(csvCell("\tcmd"), "'\tcmd");
});

Deno.test("XLSX: file zip hợp lệ, chuỗi là inlineStr (không thành công thức)", () => {
  const bytes = toXlsx(["A", "B"], [["=1+1", 2], ["Đà Nẵng <&>", null]]);
  assertEquals(String.fromCharCode(bytes[0], bytes[1]), "PK");
  assertEquals(colName(0), "A");
  assertEquals(colName(26), "AA");
  assertEquals(colName(701), "ZZ");
});

const region: Region = {
  code: "VN", name: "Việt Nam", gl: "vn", hl: "vi",
  locations: [{ name: "TP.HCM", aliases: ["Hồ Chí Minh", "Sài Gòn"] }, { name: "Hà Nội", aliases: ["Hanoi"] }],
};

Deno.test("Serper: lọc aggregator, chuẩn hoá domain, tên gọn, thành phố từ địa chỉ", () => {
  const s = parseSerperResults("search", {
    organic: [
      { title: "Trang chủ - Alpha Production", link: "https://www.alpha.vn/", snippet: "Sản xuất TVC tại Sài Gòn" },
      { title: "Alpha trên Facebook", link: "https://www.facebook.com/alpha" },
      { title: "Top 10 production house", link: "https://vnexpress.net/abc" },
    ],
  }, { blocklist: ["facebook.com", "vnexpress.net"], region });
  assertEquals(s.blocked, 2);
  assertEquals(s.candidates.length, 1);
  assertEquals(s.candidates[0].name, "Alpha Production");
  assertEquals(s.candidates[0].domain, "alpha.vn");
  assertEquals(s.candidates[0].city, "TP.HCM");

  const m = parseSerperResults("maps", {
    places: [
      { title: "Beta Films", website: "https://beta.vn/home", address: "12 Lê Lợi, Hanoi", phoneNumber: "024 3822 1234", cid: "123" },
      { title: "Quán Gamma", address: "Đà Lạt", phoneNumber: "0901 234 567", website: "https://facebook.com/gamma" },
    ],
  }, { blocklist: ["facebook.com"], region });
  assertEquals(m.candidates[0].domain, "beta.vn");
  assertEquals(m.candidates[0].city, "Hà Nội");
  assertEquals(m.candidates[0].maps_url, "https://www.google.com/maps?cid=123");
  assertEquals(m.candidates[1].domain, null); // website là Facebook → coi như không có website
  assertEquals(cleanTitle("Gamma Studio | Home"), "Gamma Studio");
  assertEquals(buildQuery("production house", "TP.HCM", region), "production house TP.HCM");
  assertEquals(buildQuery("production house Sài Gòn", "TP.HCM", region), "production house Sài Gòn");
});

Deno.test("Cohort filter: chỉ chấp nhận tín hiệu đã xác nhận và giá trị hợp lệ", () => {
  const codes = new Set(["HAS_EMAIL", "ACTIVE_YOUTUBE"]);
  const f = parseCohortFilter({
    must: ["HAS_EMAIL"], ranges: [{ code: "ACTIVE_YOUTUBE", min: 4 }, { code: "ACTIVE_YOUTUBE" }],
    min_score: 60, segments: ["agency"], q: "  phim  ", include_dnc: "yes",
  }, codes);
  assertEquals(f.must, ["HAS_EMAIL"]);
  assertEquals(f.ranges, [{ code: "ACTIVE_YOUTUBE", min: 4, max: null }]);
  assertEquals(f.q, "phim");
  assertEquals(f.include_dnc, false);
  assertThrows(() => parseCohortFilter({ must: ["NO_SUCH"] }, codes), HttpError);
  assertThrows(() => parseCohortFilter({ must: ["x'); drop table companies;--"] }, codes), HttpError);
  assertThrows(() => parseCohortFilter({ min_score: 101 }, codes), HttpError);
  assertThrows(() => parseCohortFilter({ segments: ["hacker"] }, codes), HttpError);
  assertEquals(parseCohortFilter({ cities: [" TP.HCM ", "TP.HCM"] }, codes).cities, ["TP.HCM"]);
  assertEquals(parseCohortFilter({}, codes).cities, []);
  assertThrows(() => parseCohortFilter({ cities: [1] }, codes), HttpError);
  assertThrows(() => parseCohortFilter({ cities: ["x".repeat(61)] }, codes), HttpError);
});

Deno.test("DNC: domain cha và email theo domain", () => {
  const d = makeDnc([{ kind: "domain", value: "gamma.vn" }, { kind: "email", value: "boss@beta.vn" }]);
  assert(d.isDomain("studio.gamma.vn"));
  assert(!d.isDomain("notgamma.vn"));
  assert(d.isEmail("Boss@Beta.vn"));
  assert(d.isEmail("a@gamma.vn"));
  assert(!d.isEmail("a@beta.vn"));
});

Deno.test("pickServerKey: ưu tiên service_role, rồi SUPABASE_SECRET_KEYS", () => {
  const env = (vars: Record<string, string>) => (n: string) => vars[n];
  assertEquals(pickServerKey(env({ SUPABASE_SERVICE_ROLE_KEY: "eyJlegacy", SUPABASE_SECRET_KEYS: '{"default":"sb_secret_x"}' })), "eyJlegacy");
  assertEquals(pickServerKey(env({ SUPABASE_SECRET_KEYS: '{"default":"sb_secret_x","other":"sb_secret_y"}' })), "sb_secret_x");
  assertEquals(pickServerKey(env({ SUPABASE_SECRET_KEYS: '{"backend":"sb_secret_y"}' })), "sb_secret_y");
  assertEquals(pickServerKey(env({ SUPABASE_SECRET_KEYS: "sb_secret_raw" })), "sb_secret_raw");
  assertEquals(pickServerKey(env({ SUPABASE_SECRET_KEYS: "not-json" })), null);
  assertEquals(pickServerKey(env({})), null);
});
