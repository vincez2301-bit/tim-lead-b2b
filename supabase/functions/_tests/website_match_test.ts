import { assert, assertEquals } from "jsr:@std/assert@1";
import { domainLabel, matchScore, nameTokens, pickFromMaps, pickFromSearch } from "../_shared/website_match.ts";

const BLOCK = ["facebook.com", "youtube.com", "masothue.com", "thanhnien.vn", "dantri.com.vn", "topcv.vn"];

Deno.test("nameTokens: bỏ loại hình doanh nghiệp, tách từ chung của ngành", () => {
  assertEquals(nameTokens("Công ty TNHH Truyền Thông PINKHOUSE MEDIA"), { all: ["truyen", "thong", "pinkhouse", "media"], core: ["pinkhouse"] });
  assertEquals(nameTokens("Công ty Cổ phần Nghe nhìn Thăng Long").core, ["nghe", "nhin", "thang", "long"]);
  assertEquals(nameTokens("Báo Thanh Niên").core, ["thanh", "nien"]);
  assertEquals(domainLabel("www.songviet.com.vn"), "songviet");
});

Deno.test("matchScore: domain trùng tên thì nhận, chỉ trùng tiêu đề thì không", () => {
  for (const [name, domain] of [
    ["Yeah1", "yeah1.com"], ["VTV", "vtv.vn"], ["SCTV", "sctv.com.vn"], ["Box Studio", "boxstudio.vn"],
    ["Báo Thanh Niên", "thanhnien.vn"], ["Dan Tri", "dantri.com.vn"], ["Công ty TNHH Phim Mới", "phimmoi.vn"],
  ]) assert(matchScore(name, domain) >= 0.95, `${name} ~ ${domain}`);
  assert(matchScore("Tran Thanh Entertainment", "tranthanhtown.vn") >= 0.9);
  assert(matchScore("Gãy Media & 88 Entertainment", "gaymedia.vn", "Gãy Media - Trang chủ") >= 0.55);
  // Domain không liên quan: dù tiêu đề có tên công ty cũng không đủ ngưỡng.
  assert(matchScore("Sen Vang", "vnexpress.net", "Sen Vàng ra mắt phim mới") < 0.55);
  // Tên ngắn (3 ký tự) nằm trong domain dài khác: không nhận nếu thiếu tiêu đề xác nhận.
  assert(matchScore("LOF", "lofoten.no") < 0.55);
});

Deno.test("pickFromSearch: Knowledge Graph trước; bỏ mạng xã hội, danh bạ; báo chính chủ vẫn nhận", () => {
  const kg = pickFromSearch("Yeah1", {
    knowledgeGraph: { title: "Yeah1 Group", website: "https://yeah1group.com/" },
    organic: [{ link: "https://www.facebook.com/yeah1", title: "Yeah1 | Facebook" }],
  }, BLOCK);
  assertEquals(kg?.domain, "yeah1group.com");
  assertEquals(kg?.via, "knowledge_graph");

  const org = pickFromSearch("Công ty TNHH Truyền Thông PINKHOUSE MEDIA", {
    organic: [
      { link: "https://masothue.com/0312-pinkhouse", title: "CÔNG TY TNHH TRUYỀN THÔNG PINKHOUSE MEDIA - Mã số thuế" },
      { link: "https://www.youtube.com/@pinkhousetv", title: "PINKHOUSE TV - YouTube" },
      { link: "https://pinkhouse.vn/gioi-thieu", title: "Pinkhouse Media – Giới thiệu" },
    ],
  }, BLOCK);
  assertEquals(org?.domain, "pinkhouse.vn");
  assertEquals(org?.website_url, "https://pinkhouse.vn/");

  assertEquals(pickFromSearch("Báo Thanh Niên", { organic: [{ link: "https://thanhnien.vn/", title: "Báo Thanh Niên" }] }, BLOCK)?.domain, "thanhnien.vn");
  assertEquals(pickFromSearch("Sen Vang", { organic: [{ link: "https://topcv.vn/sen-vang", title: "Sen Vàng tuyển dụng" }] }, BLOCK), null);
});

Deno.test("pickFromMaps: địa điểm khớp tên → website + số điện thoại; website là Facebook thì bỏ website", () => {
  const p = pickFromMaps("Ren Animation Studio", {
    places: [{ title: "Ren Animation Studio", website: "https://www.facebook.com/renanimation", phoneNumber: "028 3838 3838", cid: "123" }],
  }, BLOCK);
  assertEquals(p?.domain, null);
  assertEquals(p?.phone, "028 3838 3838");
  assert(p?.maps_url?.includes("cid=123"));
  assertEquals(pickFromMaps("Ren Animation Studio", { places: [{ title: "Quán cà phê Ren" }] }, BLOCK), null);
});
