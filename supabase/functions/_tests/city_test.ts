import { assertEquals } from "jsr:@std/assert@1";
import { cityFromPages, cityFromText } from "../_shared/city.ts";
import type { Region } from "../_shared/settings.ts";

const VN: Region = {
  code: "VN", name: "Việt Nam", gl: "vn", hl: "vi",
  locations: [
    { name: "TP.HCM", aliases: ["TP.HCM", "TP HCM", "Hồ Chí Minh", "Ho Chi Minh", "HCMC", "Sài Gòn", "Saigon"] },
    { name: "Hà Nội", aliases: ["Hà Nội", "Ha Noi", "Hanoi"] },
    { name: "Đà Nẵng", aliases: ["Đà Nẵng", "Da Nang"] },
  ],
};

Deno.test("cityFromText: địa chỉ Google Maps", () => {
  assertEquals(cityFromText("12 Nguyễn Huệ, Bến Nghé, Quận 1, Hồ Chí Minh, Việt Nam", VN), "TP.HCM");
  assertEquals(cityFromText("Tầng 5, 18 Trần Duy Hưng, Cầu Giấy", VN), "Hà Nội");
  assertEquals(cityFromText("107 Lê Lợi, Phường 1, TP. Hà Tĩnh, Hà Tĩnh", VN), "Hà Tĩnh");
  assertEquals(cityFromText("Số 5 Đường Thái Bình, Biên Hòa, Đồng Nai", VN), "Đồng Nai");
  assertEquals(cityFromText("Quận 10", VN), "TP.HCM");
  assertEquals(cityFromText("Tầng 3, Phường 7", VN), null);
  assertEquals(cityFromText(null, VN), null);
});

Deno.test("cityFromPages: ưu tiên dòng địa chỉ ở trang Liên hệ, bỏ qua tên nhắc lướt", () => {
  const pages = [
    { kind: "home" as const, text: "Production house hàng đầu\nDự án tại Hà Nội và Đà Nẵng\nShowreel 2026" },
    { kind: "contact" as const, text: "Liên hệ\nĐịa chỉ: 25 Nguyễn Văn Trỗi, Phường 12, Phú Nhuận, TP.HCM\nHotline: 0901 234 567" },
  ];
  assertEquals(cityFromPages(pages, VN), "TP.HCM");
  assertEquals(cityFromPages([{ kind: "home", text: "Chúng tôi từng quay ở Đà Nẵng" }], VN), null);
  assertEquals(cityFromPages([{ kind: "about", text: "Trụ sở: 88 Láng Hạ, Đống Đa\nVăn phòng đại diện" }], VN), "Hà Nội");
});
