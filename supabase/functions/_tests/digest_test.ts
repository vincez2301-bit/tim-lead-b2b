import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  buildDigest,
  dayLabel,
  type DigestDeal,
  digestSubject,
  escapeHtml,
  parseDigestConfig,
  renderDigest,
  vnNow,
} from "../_shared/digest.ts";

const deal = (p: Partial<DigestDeal>): DigestDeal => ({
  id: crypto.randomUUID(),
  company_name: "Công ty",
  segment: "agency",
  city: "TP.HCM",
  stage: "outreach",
  tier: "B",
  score: 50,
  next_action: null,
  next_action_at: null,
  renewal_at: null,
  est_arr_usd: null,
  cadence_started_at: null,
  ...p,
});

Deno.test("vnNow: giờ Việt Nam qua nửa đêm UTC", () => {
  assertEquals(vnNow(new Date("2026-11-05T23:30:00Z")), { day: "2026-11-06", hour: 6 });
  assertEquals(vnNow(new Date("2026-11-05T00:30:00Z")), { day: "2026-11-05", hour: 7 });
});

Deno.test("dayLabel", () => {
  assertEquals(dayLabel("2026-11-05", "2026-11-05"), "Hôm nay");
  assertEquals(dayLabel("2026-11-03", "2026-11-05"), "Quá hạn 2 ngày");
  assertEquals(dayLabel("2026-11-06", "2026-11-05"), "Ngày mai");
  assertEquals(dayLabel("2027-02-01", "2026-11-05"), "01/02/2027");
});

Deno.test("buildDigest: việc đến hạn, lead mới theo ưu tiên, gia hạn", () => {
  const t = "2026-11-05";
  const deals = [
    deal({ company_name: "Quá hạn", next_action: "Gọi điện lần 2", next_action_at: "2026-11-03" }),
    deal({ company_name: "Hôm nay", next_action: "Email", next_action_at: t }),
    deal({ company_name: "Sau này", next_action_at: "2026-11-07" }),
    deal({ company_name: "Brand C", stage: "new", segment: "brand", tier: "C" }),
    deal({ company_name: "Đài A", stage: "new", segment: "broadcaster", tier: "A" }),
    deal({ company_name: "MCN A", stage: "research", segment: "mcn", tier: "A" }),
    deal({ company_name: "HTV", stage: "won", renewal_at: "2026-12-15", est_arr_usd: 24000 }),
    deal({ company_name: "Ký xa", stage: "won", renewal_at: "2027-06-01" }),
    deal({ company_name: "Thua", stage: "lost", next_action_at: "2026-11-01" }),
  ];
  const g = buildDigest(deals, t, 2);
  assertEquals(g.due.map((x) => x.company), ["Quá hạn", "Hôm nay"]);
  assert(g.due[0].overdue);
  assertEquals(g.newLeads.map((x) => x.company), ["Đài A", "MCN A"]);
  assertEquals(g.waitingNew, 1);
  assertEquals(g.renewals.map((x) => x.company), ["HTV"]);
  assertEquals(g.soon, 1);
  assertEquals(digestSubject(g), "Bigfish 05/11: 2 việc đến hạn, 2 lead mới cần gửi email, 1 khách sắp gia hạn");
});

Deno.test("buildDigest: đã gửi email mở lời hôm nay thì trừ vào hạn mức", () => {
  const t = "2026-11-05";
  const g = buildDigest(
    [deal({ stage: "outreach", cadence_started_at: t }), deal({ stage: "new" }), deal({ stage: "new" })],
    t,
    2,
  );
  assertEquals(g.newLeads.length, 1);
});

Deno.test("renderDigest: mã hoá tên công ty, link chỉ https", () => {
  const g = buildDigest([deal({ company_name: "<b>X&Y</b>", next_action: "Gọi", next_action_at: "2026-11-05" })], "2026-11-05", 0);
  const { html, text } = renderDigest(g, { appUrl: "https://app.example.com/path", senderName: "Việt" });
  assert(html.includes("&lt;b&gt;X&amp;Y&lt;/b&gt;"));
  assert(!html.includes("<b>X"));
  assert(html.includes("https://app.example.com/?deal="));
  assert(text.includes("Chào buổi sáng Việt"));
  const bad = renderDigest(g, { appUrl: "javascript:alert(1)", senderName: "" });
  assert(!bad.html.includes("javascript:"));
  assertEquals(escapeHtml(`"'`), "&quot;&#39;");
});

Deno.test("parseDigestConfig: giá trị mặc định và lọc email", () => {
  const c = parseDigestConfig({ enabled: true, hour: 30, recipients: ["a@b.vn", "sai", " c@d.com "], new_per_day: "x" }, "");
  assertEquals(c.hour, 7);
  assertEquals(c.newPerDay, 2);
  assertEquals(c.recipients, ["a@b.vn", "c@d.com"]);
  assertEquals(parseDigestConfig(null, "").enabled, false);
});
