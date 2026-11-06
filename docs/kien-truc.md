# Kiến trúc Bigfish Lead Finder — rà soát 11/2026

## 1. Hạ tầng

```
Trình duyệt (React + Vite, host trên Vercel, deploy từ nhánh main)
   │  supabase-js: đăng nhập, đọc/ghi bảng qua PostgREST (RLS), gọi Edge Function
   ▼
Supabase (deploy migration + function từ main)
   ├─ Postgres: companies, contacts, observations, signal_codes, runs, run_companies,
   │            deals, activities, settings, do_not_contact, cohorts, audit_log …
   ├─ Auth (mật khẩu / magic link, MFA)
   └─ Edge Functions (Deno): discover · estimate · profile · enrich_youtube ·
                             enrich_contact · score · cohort_query · export
          │
          ▼  Serper (Google Search/Maps) · YouTube Data API · website của công ty
```

## 2. Luồng dữ liệu — kết quả đi đâu

| Bước | Màn hình | Ghi vào | Hiện ở đâu |
|---|---|---|---|
| 1. Tìm trên Google | Tìm khách mới | `companies`, `run_companies` (mới) | Ngay dưới form: bảng kết quả của lượt tìm; cũng có trong **Công ty** |
| 2. Phân tích website | nút trong bảng kết quả / Công ty | `observations`, `contacts`, `companies.score` | Cột Phân tích + Điểm của bảng kết quả; trang chi tiết công ty |
| 3. Đưa vào Pipeline | nút trong bảng kết quả / Công ty | `deals` (Lead mới) | **Hôm nay → Cần đánh giá**, cột Lead mới của **Pipeline** |
| 4. Tiếp cận 19 điểm chạm | Hôm nay → Bắt đầu | `activities`, `deals.next_action*` | Hôm nay, Pipeline, khung chi tiết deal |
| 5. Khách từ chối | khung deal → “Khách từ chối…” | `deals.lost_reason_code`, ngày liên hệ lại | **Xử lý từ chối** (theo lý do), Hôm nay khi đến hạn |

Trước đây bước 1 chỉ hiện con số (“7 mới, 3 đã có”), không có danh sách công ty và không nói chúng nằm ở đâu.
Bảng `run_companies` (migration `20261105000700`) ghi lại mỗi lượt tìm ra công ty nào, kể cả công ty đã có từ trước;
các lượt tìm cũ được điền lại từ `companies.source_run_id` (chỉ biết công ty mới).

## 3. Chỗ trùng lặp

| Trùng | Trước | Đã xử lý |
|---|---|---|
| Hai nghĩa của “pipeline” | “Chạy pipeline” (đọc website) và “Pipeline bán hàng” | Bước dữ liệu đổi tên **Phân tích website**; “Pipeline” chỉ còn nghĩa bán hàng |
| Hai trang tổng quan | Tổng quan (số liệu dữ liệu) + Việc hôm nay | Gộp: **Hôm nay** là trang chủ; hạn mức Google chuyển sang Tìm khách mới |
| 12 mục menu | 5 mục quản trị riêng lẻ | 10 mục trong 4 nhóm; Tín hiệu, Loại trừ, Nhật ký thành tab trong **Cài đặt** |
| Email mẫu / kịch bản từ chối | Chỉ sửa được dạng JSON trong Cài đặt | Trang riêng ở **Kho nội dung** (lọc, xem trước, chép, sửa, xoá); JSON giữ ở “nâng cao” |
| CSS 3 lớp chồng | gốc → colorful → glass, 2 khối “Nhạc mẫu” cũ còn sót, 9 chỗ `backdrop-filter` | Một lớp duy nhất, bỏ mọi blur và nền gradient |
| Tải `settings` | Mỗi trang và mỗi lần mở khung deal tự tải lại cả bảng (7 nơi) | `SettingsProvider`: tải 1 lần mỗi phiên, cập nhật sau khi lưu |
| Thêm vào pipeline | Viết riêng ở Công ty | Một hàm `addToSalesPipeline` dùng chung |
| Nút “Chép” | Định nghĩa trong khung deal | `CopyButton` dùng chung |

Còn để nguyên (có lý do):

- **Xuất danh sách (Cohort) và Công ty** đều là danh sách công ty có bộ lọc, nhưng chạy bằng hai cơ chế khác nhau
  (PostgREST và Edge Function `cohort_query` có lọc theo tín hiệu). Gộp được, nhưng là việc lớn; nên làm khi
  Cohort được dùng thường xuyên.
- **`web/src/lib/api-types.ts` là bản sao `supabase/functions/_shared/types.ts`**: frontend (Vite) và Edge Function (Deno)
  không chia sẻ được file trực tiếp. Giữ bản sao, sửa cả hai.
- **Migration định nghĩa lại `deal_board`, `import_leads`, `cohort_search`** nhiều lần: đó là lịch sử thay đổi,
  database chỉ chạy bản cuối, không làm app nặng. Không gộp vì production đã ghi nhận từng migration.

## 4. Vì sao app nặng và đã làm gì

| Nguyên nhân | Ảnh hưởng | Giải pháp |
|---|---|---|
| Hiệu ứng kính (`backdrop-filter: blur`) trên mọi thẻ, cột, bảng + nền gradient cố định | Trình duyệt phải làm mờ lại khi cuộn → giật, nóng máy, nhất là bảng Pipeline nhiều thẻ | Bỏ hết; thẻ nền trắng phẳng |
| Toàn bộ JS một file 591 KB (170 KB nén) | Lần đầu mở và **mỗi lần deploy** phải tải lại cả app | Mỗi trang một chunk; React (60 KB nén), Supabase (59 KB nén), icon tách riêng, trình duyệt giữ cache qua các lần deploy. Mở trang Hôm nay lần đầu ~150 KB nén; sau mỗi lần cập nhật app thường chỉ tải lại vài chục KB |
| `settings` tải lại ở mọi trang; ở chế độ làm lần lượt mỗi khách tải lại một lần | Thêm request, chậm khi chuyển khách | Tải 1 lần mỗi phiên |
| Edge Function `estimate` gọi mỗi khi gõ từ khoá (sau 0,5 giây) và mỗi lần mở Tổng quan | Mỗi lần là một lượt khởi động function (0,3–1 giây) | Số lượt tính ngay trên trình duyệt; chỉ hỏi hạn mức khi mở trang và sau mỗi lượt tìm |
| 4 độ đậm font | Thêm file font khi tải | Còn 3 (400/600/700) |
| CSS 45 KB nhiều quy tắc đè nhau | Khó sửa, dễ vỡ giao diện | 40 KB, một lớp |
| Đọc website quá nặng → lỗi 546 | Pipeline dừng giữa chừng | (đã xử lý trước) rút gọn HTML, giới hạn 200 KB, chạy theo lô, tự thử lại và bỏ qua |

Có thể làm thêm khi cần:

- `supabase-js` (59 KB nén) kèm Realtime và Storage mà app không dùng. Thay bằng `@supabase/postgrest-js` +
  `@supabase/auth-js` bớt khoảng 20–25 KB nén, nhưng phải kiểm tra kỹ đăng nhập và MFA.
- Hôm nay và Pipeline đọc `deal_board` tới 3.000 dòng mỗi lần. Với vài trăm deal là đủ nhanh; khi vượt khoảng 2.000 deal
  nên chỉ chọn cột cần dùng và lọc theo giai đoạn ở server.

## 5. Đối chiếu với “Bản đồ tính năng CRM” (11/2026)

Bigfish là công cụ một người dùng, bán thuê bao bản quyền nhạc (B2B, gia hạn theo năm). Đối chiếu các mục MVP và
phần riêng ngành “Dịch vụ B2B”:

| Mã | Tính năng | Bigfish |
|---|---|---|
| KH-01, KH-02 | Hồ sơ công ty, liên hệ; tìm và lọc | Có |
| KH-03 | Tìm không dấu | **Mới thêm**: “song viet” ra “Sóng Việt” (cột `companies.name_search`, Pipeline lọc không dấu) |
| LD-01, LD-02 | Lead có nguồn, chuyển thành cơ hội | Có (Tìm khách mới / Nhập file → Đưa vào Pipeline) |
| CH-01…03, CH-06 | Kanban, giá trị, xác suất, thắng/thua kèm lý do, dự báo | Có |
| CH-05 | Cảnh báo cơ hội đứng yên | **Mới thêm**: thẻ “Đứng yên N ngày” khi 21 ngày không có điểm chạm hay đổi giai đoạn |
| VC-01…04, BC-01 | Việc có hạn, ghi nhanh, dòng thời gian, điện thoại, “việc của tôi” | Có (Hôm nay, 19 điểm chạm) |
| B2B-02, CS-02, BG-07 | Hợp đồng, ngày hết hạn, nhắc gia hạn | **Mới thêm**: `deals.renewal_at` tự điền mốc tròn năm kế tiếp từ ngày hiệu lực; Hôm nay có mục “Sắp gia hạn” 90 ngày; KPI trên Pipeline |
| TH-01 | Nhập Excel | **Đã thêm**: đọc thẳng .xlsx / .csv trong trình duyệt (không thư viện ngoài), tự nhận cột, chỉnh ghép cột, xem trước |
| TH-03, TH-05 | Sao lưu, xuất Excel | **Mới thêm**: Cài đặt → Sao lưu dữ liệu (JSON đầy đủ, CSV pipeline có BOM cho Excel) |
| Bài học “ô tiền” | Ô số của trình duyệt đọc sai “10.206” | **Đã sửa**: ô ARR đọc được 10.206 / 10,206 / $10,206 và hiện lại số đã hiểu |
| Bài học “ngày và múi giờ” | Ngày lùi một ngày ở giờ Việt Nam | Đã đúng: mọi ngày tính theo giờ máy (`isoDate` bù múi giờ) |
| VC-05 | Nhắc qua email / thông báo | **Đã thêm**: email nhắc việc mỗi sáng (`daily_digest` + `pg_cron`, gửi qua Resend) |
| BG-01, BG-02, B2B-01 | Danh mục gói, báo giá PDF | **Mới thêm**: Cài đặt → Bảng giá; báo giá trong khung khách (bảng `quotes`, số tự sinh, tổng do database tính), trang in / lưu PDF, email gửi báo giá soạn sẵn |
| — | Bước chốt theo giai đoạn | **Mới thêm**: sửa lỗi khách đã trả lời vẫn được gợi ý bước tiếp cận; bước 13–19 theo giai đoạn, tự chuyển giai đoạn, khung Tiến độ chốt (báo giá, khách đồng ý, đã ký) |
| TH-02 | Đính kèm file (hợp đồng, đề xuất) | Chưa có |
| MK-01 | Nhật ký đồng ý nhận tin | Chưa có; đang có danh sách loại trừ và xoá dữ liệu theo yêu cầu |
