import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  classifyUrl, decodeCfEmail, detectPageSignals, extractEmails, extractPhones, extractSite, formatVnPhone, htmlToText,
  makePage, MAX_PAGE_HTML_CHARS, normalizeVnPhone, normalizeYoutubeChannelUrl, slimHtml,
} from "../_shared/extract.ts";

const page = (html: string, url = "https://congty.vn/", kind: Parameters<typeof makePage>[1] = "home") => makePage(url, kind, html);
const emails = (html: string, kind: Parameters<typeof makePage>[1] = "home") =>
  extractEmails(page(html, "https://congty.vn/x", kind)).map((e) => e.value).sort();

Deno.test("email: mailto, chữ hoa, [at]/(dot), loại asset", () => {
  assertEquals(emails('<a href="mailto:Info@CongTy.vn?subject=Hi">Liên hệ</a>'), ["info@congty.vn"]);
  assertEquals(emails("<p>Email: Sales@CongTy.VN.</p>"), ["sales@congty.vn"]);
  assertEquals(emails("<p>lienhe [at] congty [dot] vn</p>"), ["lienhe@congty.vn"]);
  assertEquals(emails("<p>hr(at)congty(dot)com.vn</p>"), ["hr@congty.com.vn"]);
  assertEquals(emails('<img src="logo@2x.png"><img srcset="banner@3x.webp 3x">'), []);
  assertEquals(emails("<p>name@example.com your@domain.com</p>"), []);
  assertEquals(emails('<a href="/cdn-cgi/l/email-protection#' + "0f" + [..."info@a.vn"].map((c) => (c.charCodeAt(0) ^ 0x0f).toString(16).padStart(2, "0")).join("") + '">[email&#160;protected]</a>'), ["info@a.vn"]);
});

Deno.test("email: mailto trên trang liên hệ có confidence cao hơn văn bản tự do", () => {
  const a = extractEmails(page('<a href="mailto:a@congty.vn">x</a>', "https://congty.vn/lien-he", "contact"))[0];
  const b = extractEmails(page("<p>b@congty.vn</p>"))[0];
  assert(a.confidence > b.confidence);
});

Deno.test("decodeCfEmail", () => {
  const hex = "42" + [..."ab@c.vn"].map((c) => (c.charCodeAt(0) ^ 0x42).toString(16).padStart(2, "0")).join("");
  assertEquals(decodeCfEmail(hex), "ab@c.vn");
  assertEquals(decodeCfEmail("zz"), null);
});

Deno.test("SĐT Việt Nam: các định dạng hợp lệ trong mục 12", () => {
  assertEquals(normalizeVnPhone("0901 234 567"), "0901234567");
  assertEquals(normalizeVnPhone("+84 90 123 4567"), "0901234567");
  assertEquals(normalizeVnPhone("090.123.4567"), "0901234567");
  assertEquals(normalizeVnPhone("(028) 3822 1234"), "02838221234"); // cố định 11 số
  assertEquals(formatVnPhone("0901234567"), "0901 234 567");
  assertEquals(formatVnPhone("02838221234"), "028 3822 1234");
});

Deno.test("SĐT Việt Nam: số không hợp lệ (9 hoặc 11 chữ số di động) bị loại", () => {
  assertEquals(normalizeVnPhone("090 123 456"), null); // 9 số
  assertEquals(normalizeVnPhone("0901 234 5678"), null); // 11 số, không phải cố định
  assertEquals(normalizeVnPhone("0123 456 789"), null); // đầu số cũ không còn dùng
  const found = (t: string) => extractPhones(page(`<p>${t}</p>`)).map((p) => p.value);
  assertEquals(found("Hotline: 0901 234 567"), ["0901234567"]);
  assertEquals(found("Gọi 090 123 456 ngay"), []);
  assertEquals(found("Gọi 09012345678"), []);
  assertEquals(found("MST: 0312345678"), []); // mã số thuế, không phải SĐT
  assertEquals(extractPhones(page('<a href="tel:+84901234567">Gọi</a>'))[0].confidence, 0.9);
});

Deno.test("link kênh YouTube được chuẩn hoá; link video bị bỏ qua", () => {
  assertEquals(normalizeYoutubeChannelUrl("https://m.youtube.com/@CongTyTV/videos"), "https://www.youtube.com/@congtytv");
  assertEquals(normalizeYoutubeChannelUrl("https://youtube.com/channel/UCabcdefghijklmnopqrstuv"), "https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv");
  assertEquals(normalizeYoutubeChannelUrl("https://www.youtube.com/c/CongTy"), "https://www.youtube.com/c/CongTy");
  assertEquals(normalizeYoutubeChannelUrl("https://www.youtube.com/watch?v=abc"), null);
  assertEquals(normalizeYoutubeChannelUrl("https://notyoutube.com/@x"), null);
});

Deno.test("tuyển dụng: cần ngữ cảnh tuyển dụng, trừ khi là trang tuyển dụng", () => {
  const codes = (html: string, kind: Parameters<typeof makePage>[1] = "home") =>
    detectPageSignals(page(html, "https://congty.vn/p", kind)).map((f) => f.code);
  // Agency mô tả dịch vụ "quay dựng" → không phải tín hiệu tuyển dụng
  assert(!codes("<p>Dịch vụ quay dựng TVC chuyên nghiệp</p>").includes("HIRING_VIDEO_ROLE"));
  assert(codes("<h2>Tuyển dụng</h2><p>Vị trí: Video Editor (full-time)</p>").includes("HIRING_VIDEO_ROLE"));
  assert(codes("<p>Motion Designer</p>", "careers").includes("HIRING_VIDEO_ROLE"));
});

Deno.test("tín hiệu website: showreel, TVC, tiếng Anh, pixel", () => {
  const f = detectPageSignals(page(`<html lang="vi"><head>
      <script>!function(f,b,e,v,n,t,s){};fbq('init','123');</script>
      <script async src="https://www.googletagmanager.com/gtag/js?id=AW-123456789"></script></head>
      <body><a href="/en/">EN</a><h2>Showreel 2024</h2><p>Dự án TVC cho nhãn hàng</p>
      <iframe src="https://www.youtube.com/embed/abc"></iframe></body></html>`));
  const by = Object.fromEntries(f.map((x) => [x.code, x]));
  assertEquals(by.HAS_SHOWREEL.confidence, 0.9);
  assert(by.TVC_PORTFOLIO);
  assertEquals(by.ENGLISH_SITE.value_text, "https://congty.vn/en/");
  assertEquals(by.RUNNING_META_ADS.confidence, 0.9);
  assertEquals(by.RUNNING_GOOGLE_ADS.confidence, 0.9);
  const ga = detectPageSignals(page('<script src="https://www.googletagmanager.com/gtag/js?id=G-XYZ"></script>'));
  assertEquals(ga.find((x) => x.code === "RUNNING_GOOGLE_ADS")?.confidence, 0.4);
});

Deno.test("extractSite: gộp nhiều trang, ghi value 0 cho tín hiệu không thấy, loại email DNC", () => {
  const home = page('<a href="https://www.youtube.com/@brand">YT</a><a href="https://www.tiktok.com/@Brand">TT</a><a href="https://zalo.me/0901234567">Zalo</a>');
  const contact = page('<a href="mailto:info@congty.vn">m</a><p>ceo@congty.vn</p><p>Hotline: 0901 234 567</p>', "https://congty.vn/lien-he", "contact");
  const ex = extractSite([home, contact], { excludeEmail: (e) => e === "ceo@congty.vn" });
  const by = Object.fromEntries(ex.findings.map((x) => [x.code, x]));
  assertEquals(by.HAS_EMAIL.value_text, "info@congty.vn");
  assertEquals(by.HAS_EMAIL.evidence_url, "https://congty.vn/lien-he");
  assertEquals(by.HAS_PHONE.value_text, "0901 234 567");
  assertEquals(by.HAS_YOUTUBE.value_num, 1);
  assertEquals(by.HAS_TIKTOK.value_text, "https://www.tiktok.com/@brand");
  assertEquals(by.HAS_ZALO.value_num, 1);
  assertEquals(by.HIRING_VIDEO_ROLE.value_num, 0);
  assertEquals(by.HIRING_VIDEO_ROLE.evidence_url, "https://congty.vn/");
  assert(ex.findings.every((x) => /^https?:\/\//.test(x.evidence_url)));
});

Deno.test("htmlToText bỏ script/style và giải mã entity", () => {
  assertEquals(htmlToText("<style>a{}</style><p>A&amp;B&nbsp;C</p><script>x()</script><div>Đ&#7841;i</div>"), "A&B C\nĐại");
});

Deno.test("classifyUrl", () => {
  assertEquals(classifyUrl("https://a.vn/lien-he"), "contact");
  assertEquals(classifyUrl("https://a.vn/tuyen-dung/video-editor"), "careers");
  assertEquals(classifyUrl("https://a.vn/gioi-thieu"), "about");
  assertEquals(classifyUrl("https://a.vn/doi-ngu"), "team");
  assertEquals(classifyUrl("https://a.vn/du-an"), "portfolio");
  assertEquals(classifyUrl("https://a.vn/p?id=3", "Liên hệ"), "contact");
  assertEquals(classifyUrl("https://a.vn/"), "home");
});

Deno.test("slimHtml: bỏ script/style nặng, giữ mailto/iframe/dấu hiệu pixel, cắt độ dài", () => {
  const big = "x".repeat(3_000_000);
  const html = `<html lang="vi"><style>${big}</style><script>var a="${big}";fbq('init','123');</script>` +
    `<script async src="https://www.googletagmanager.com/gtag/js?id=AW-1234567"></script>` +
    `<a href="mailto:info@congty.vn">Mail</a><iframe src="https://www.youtube.com/embed/abc"></iframe></html>`;
  const slim = slimHtml(html);
  assert(slim.length < 2_000);
  assert(slim.includes("mailto:info@congty.vn") && slim.includes("youtube.com/embed/abc"));
  const codes = detectPageSignals(makePage("https://congty.vn/", "home", html)).map((f) => f.code);
  assert(codes.includes("RUNNING_META_ADS") && codes.includes("RUNNING_GOOGLE_ADS"));
  assertEquals(slimHtml("<p>" + "y".repeat(MAX_PAGE_HTML_CHARS + 10) + "</p>").length, MAX_PAGE_HTML_CHARS);
});
