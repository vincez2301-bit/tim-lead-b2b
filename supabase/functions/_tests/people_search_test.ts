import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  companyKeys,
  emailQuery,
  hasPersonEmail,
  isHiddenEmail,
  mentionsCompany,
  mergeFound,
  parseLinkedInResults,
  parseWebEmails,
  peopleQuery,
  personName,
  rolesFor,
} from "../_shared/people_search.ts";

Deno.test("companyKeys: bỏ hình thức pháp lý, có tên thương hiệu ngắn và tên miền", () => {
  const k = companyKeys("Công ty TNHH Truyền thông Alpha Media", "alphamedia.vn");
  assertEquals(k.names, ["Truyền thông Alpha Media", "Alpha"]);
  assert(mentionsCompany("Producer at ALPHA MEDIA", k));
  assert(mentionsCompany("Làm việc tại AlphaMedia", k));
  assert(!mentionsCompany("Producer at Beta Studio", k));
  // Tên thương hiệu một từ quá ngắn không dùng để so khớp.
  const short = companyKeys("Công ty Cổ phần Sao Media", null);
  assertEquals(short.names, ["Sao Media", "Sao"]);
  assert(!mentionsCompany("Ngôi sao truyền hình", short));
  assert(mentionsCompany("Sao Media Production", short));
});

Deno.test("peopleQuery / emailQuery / rolesFor", () => {
  const k = companyKeys("Alpha Media JSC", null);
  assertEquals(
    peopleQuery(k, ["Producer", "Creative Director"]),
    'site:linkedin.com/in ("Alpha Media" OR "Alpha") ("Producer" OR "Creative Director")',
  );
  assertEquals(emailQuery("Alpha.VN"), '"@alpha.vn"');
  assertEquals(rolesFor({ agency: ["Producer"] }, "agency"), ["Producer"]);
  assert(rolesFor({}, null).includes("Director"));
});

Deno.test("personName: họ Việt đầu/cuối, tên phương Tây, loại tên công ty", () => {
  assertEquals(personName("NGUYỄN THỊ LAN")?.name, "Nguyễn Thị Lan");
  assertEquals(personName("Lan Nguyễn")?.conf, 0.6);
  assertEquals(personName("John Smith, MBA")?.name, "John Smith");
  assertEquals(personName("Alpha Media"), null);
  assertEquals(personName("An"), null);
});

const linkedin = {
  organic: [
    {
      title: "Nguyễn Thị Lan - Producer - Alpha Media | LinkedIn",
      link: "https://vn.linkedin.com/in/lan-nguyen-123?trk=x",
      snippet: "Producer at Alpha Media · Experience: Alpha Media · Location: Ho Chi Minh City",
    },
    {
      title: "Minh Tran – Alpha Media | LinkedIn",
      link: "https://www.linkedin.com/in/minhtran",
      snippet: "Creative Director tại Alpha Media. Hơn 10 năm làm TVC.",
    },
    { title: "Trần Văn Bình - Producer - Beta Studio | LinkedIn", link: "https://vn.linkedin.com/in/binh", snippet: "Producer at Beta" },
    { title: "Lê Hoa - Thực tập sinh - Alpha Media | LinkedIn", link: "https://vn.linkedin.com/in/hoa", snippet: "Intern" },
    { title: "Alpha Media - Producer | LinkedIn", link: "https://vn.linkedin.com/company/alpha", snippet: "Alpha Media" },
    { title: "Phạm Quốc Huy - Kế toán - Alpha Media | LinkedIn", link: "https://vn.linkedin.com/in/huy", snippet: "Kế toán" },
  ],
};

Deno.test("parseLinkedInResults: chỉ người đúng công ty + đúng vai trò", () => {
  const k = companyKeys("Công ty TNHH Alpha Media", "alphamedia.vn");
  const people = parseLinkedInResults(linkedin, k, ["Producer", "Creative Director"]);
  assertEquals(people.map((p) => [p.full_name, p.job_title]), [
    ["Nguyễn Thị Lan", "Producer"],
    ["Minh Tran", "Creative Director"],
  ]);
  assertEquals(people[0].evidence_url, "https://vn.linkedin.com/in/lan-nguyen-123");
});

const web = {
  organic: [
    {
      title: "Thông cáo báo chí — Alpha Media ra mắt",
      link: "https://bao.vn/alpha",
      snippet: "Liên hệ báo chí: Trần Minh Anh, anhtm@alphamedia.vn hoặc info@alphamedia.vn. Tuyển dụng: hr@alphamedia.vn",
    },
    { title: "Sự kiện", link: "https://sukien.vn/a", snippet: "Gửi về hanv@alphamedia.vn hoặc khach@gmail.com" },
  ],
};

Deno.test("parseWebEmails: chỉ email đúng tên miền, ghép tên khi khớp mẫu", () => {
  const found = parseWebEmails(web, "alphamedia.vn");
  assertEquals(found.map((e) => e.value), ["anhtm@alphamedia.vn", "info@alphamedia.vn", "hr@alphamedia.vn", "hanv@alphamedia.vn"]);
  assertEquals(found[0].name, "Trần Minh Anh");
  assertEquals(found[3].name, null);
});

Deno.test("isHiddenEmail: tuyển dụng / CSKH / kế toán", () => {
  for (const e of ["hr@a.vn", "tuyendung@a.vn", "tuyen.dung@a.vn", "hr.hcm@a.vn", "cskh@a.vn", "ketoan2@a.vn", "noreply@a.vn"]) {
    assert(isHiddenEmail(e), e);
  }
  for (const e of ["info@a.vn", "marketing@a.vn", "an.nguyen@a.vn", "hanv@a.vn"]) assert(!isHiddenEmail(e), e);
});

Deno.test("mergeFound: email thật, đoán theo mẫu có bằng chứng, bỏ email ẩn và liên hệ đã có", () => {
  const k = companyKeys("Alpha Media", "alphamedia.vn");
  const people = parseLinkedInResults(linkedin, k, ["Producer", "Creative Director"]);
  const emails = parseWebEmails(web, "alphamedia.vn");
  const { drafts, pattern } = mergeFound("alphamedia.vn", people, emails, [
    { full_name: null, email: "info@alphamedia.vn", email_label: "risky" },
  ], () => "ok");
  assertEquals(pattern, "given+initials");
  const byEmail = Object.fromEntries(drafts.map((d) => [d.email ?? d.full_name, d]));
  // Lan: không thấy email riêng → đoán theo mẫu anhtm@ (given+initials) → lannt@
  assertEquals(byEmail["lannt@alphamedia.vn"].email_label, "guess");
  assert(byEmail["lannt@alphamedia.vn"].note!.includes("anhtm@alphamedia.vn"));
  // Minh Tran (tên kiểu phương Tây: given=minh, surname=tran) → minht@
  assertEquals(byEmail["minht@alphamedia.vn"].full_name, "Minh Tran");
  // Email thật từ Google có tên
  assertEquals(byEmail["anhtm@alphamedia.vn"].full_name, "Trần Minh Anh");
  assertEquals(byEmail["anhtm@alphamedia.vn"].email_label, "published");
  assertEquals(byEmail["hanv@alphamedia.vn"].source, "web");
  assert(!drafts.some((d) => d.email === "hr@alphamedia.vn"), "ẩn email tuyển dụng");
  assert(!drafts.some((d) => d.email === "info@alphamedia.vn"), "không lặp email đã có");
});

Deno.test("mergeFound: không có bằng chứng thì không đoán; tên miền không có MX → invalid", () => {
  const k = companyKeys("Alpha Media", "alphamedia.vn");
  const people = parseLinkedInResults(linkedin, k, ["Producer"]);
  const none = mergeFound("alphamedia.vn", people, [], [], () => "ok");
  assertEquals(none.pattern, null);
  assert(none.drafts.every((d) => d.email === null && d.note!.includes("LinkedIn")));
  const bad = mergeFound("alphamedia.vn", people, parseWebEmails(web, "alphamedia.vn"), [], () => "none");
  assert(bad.drafts.filter((d) => d.email).every((d) => d.email_label === "invalid"));
});

Deno.test("hasPersonEmail", () => {
  assert(hasPersonEmail([{ full_name: "A B", email: "ab@a.vn", email_label: "guess" }]));
  assert(!hasPersonEmail([{ full_name: null, email: "info@a.vn", email_label: "risky" }]));
  assert(!hasPersonEmail([{ full_name: "A B", email: "hr@a.vn", email_label: "published" }]));
  assert(!hasPersonEmail([{ full_name: "A B", email: "ab@a.vn", email_label: "invalid" }]));
});
