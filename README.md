# Bigfish Lead Finder

Web app giúp Licensing Manager **tìm và lọc lead B2B cần giấy phép nhạc (sync license)** tại Việt Nam: agency/production house, nhãn hàng làm nhiều video, hãng phim/hậu kỳ và MCN nhỏ.

Pipeline: **discover** (Serper) hoặc nhập danh sách tên → **find_website** (Google qua Serper, cho công ty chưa có website) → **profile** (đọc website bằng regex, tìm luôn người quyết định + email + điện thoại) → **enrich_youtube** (YouTube Data API, lấy cả email hợp tác trong mô tả kênh) → **find_people** (người phụ trách trên LinkedIn công khai + email của công ty trên Google, chỉ lead trong pipeline) → **score** → **cohort / export**. **enrich_contact** vẫn chạy riêng được ở trang công ty.

Mỗi phát hiện là một dòng trong bảng `observations`, kèm `evidence_url` và `confidence`. Admin duyệt tín hiệu nào được thu thập; cohort là truy vấn SQL tham số hoá. Ý tưởng lấy từ [Harvey](https://github.com/ethanplusai/harvey) (MIT).

> ⚠️ Dữ liệu liên hệ cá nhân có thể thuộc phạm vi NĐ 13/2023, Luật BVDLCN, NĐ 91/2020 và GDPR. **Cần pháp chế và IT Security phê duyệt trước khi dùng thật.**

## Pipeline bán hàng

Dùng chung cho cả nhóm (ai cũng xem và cập nhật được deal của nhau; chỉ admin xoá deal, nhập file).

- **Giai đoạn:** Lead mới → Đánh giá → Đang tiếp cận → Đã phản hồi → Gặp / demo → Đề xuất → Chờ ký → Thắng / Thua / Nuôi dưỡng.
- **Đánh giá trước khi tiếp cận:** 8 tiêu chí (`settings.qualification_criteria`) + nhóm khách + điểm tín hiệu → gợi ý hạng A/B/C.
  Ưu tiên nhóm khách: đài truyền hình → MCN → production house → hãng phim → nhãn hàng.
- **Chỉ tiếp cận bằng email** (`settings.cadence`, spec 002): chặng tiếp cận 6 email trong ~4 tuần (mở lời → rủi ro bản quyền → thử nhạc miễn phí trên video của khách → quyền biểu diễn trước công chúng → đơn vị cùng ngành dùng thế nào → chia tay lịch sự), mỗi email một lý do để dùng Epidemic Sound; chặng chốt 13–19 cũng qua email (họp online chỉ khi khách đề nghị). Email kế tiếp tính theo số email đã gửi (`deal_board.outreach_emails`). Email mở lời có câu riêng về khách (`{cau_rieng}`, từ kênh YouTube), email theo dõi dùng tiêu đề “Re: {tieu_de_dau}” để cùng luồng. Mẫu v6: 6 email × 5 nhóm khách. Lead mới không cần đánh giá trước: gửi email đầu tiên là khách sang “Đang tiếp cận”; mỗi ngày Hôm nay đưa vào 2 lead ưu tiên nhất (đổi được).
  Ghi một điểm chạm thì app tự đặt việc kế tiếp; khách trả lời thì chuyển sang "Đã phản hồi".
- **Màn hình:** Hôm nay (việc trong ngày + lead mới gửi email, làm lần lượt), Kết quả (tỷ lệ trả lời theo nhóm khách, kênh, số lần liên hệ, theo tuần), Pipeline (mặc định là danh sách “việc tiếp theo” theo 5 nhóm: Chưa liên hệ, Đang tiếp cận, Đang trao đổi, Đã ký, Tạm dừng; bảng kéo thả là tuỳ chọn),
  Kho nội dung (email & tin nhắn mẫu, xử lý từ chối, nhạc mẫu), Tìm khách mới (lượt tìm → kết quả → phân tích → đưa vào Pipeline),
  Nhập file (JSON hoặc CSV; chạy lại cùng file không nhân đôi). Bảng: `deals`, `activities`, `quotes`, `run_companies`, view `deal_board`.
- **Lead không phù hợp:** nút “Không phù hợp…” (khung khách, Pipeline, kết quả tìm kiếm, Công ty) ghi lý do trên công ty (`disqualify_companies`), gỡ lead chưa liên hệ khỏi pipeline; `discover` tự bỏ qua công ty đã loại và công ty khớp từ khoá tự loại (`settings.discover_exclude_words`). Khôi phục ở trang Công ty.
- **Chặng chốt (khách đã trả lời):** bước kế tiếp đi theo giai đoạn chứ không theo số điểm chạm: Đã phản hồi → 13 hẹn buổi tìm hiểu nhu cầu (việc ngay trong ngày khách trả lời), Gặp / demo → 14 demo, 15 gửi báo giá, Đề xuất → 16–18 theo dõi, gặp người duyệt, xử lý băn khoăn, Chờ ký → 19 gửi hợp đồng. Ghi bước 13 tự sang Gặp / demo, gửi báo giá tự sang Đề xuất; các bước cách nhau tối đa 3 ngày. Khung **Tiến độ chốt** trong tab Điểm chạm có nút Tạo báo giá, Khách đồng ý (→ Chờ ký, gửi hợp đồng hôm nay), Đã ký hợp đồng (→ Thắng, điền ngày ký, ARR lấy từ báo giá). Hôm nay xếp khách đang chốt lên đầu (gần ký nhất trước) và kéo vào việc hôm nay khách có báo giá hết hạn trong 2 ngày.
- **Báo giá nhanh:** bảng giá ở Cài đặt → Bảng giá (`settings.price_book`, giá chỉ nằm trong database). Tạo báo giá trong khung khách: chọn gói, số lượng, giảm giá, hạn hiệu lực; database đánh số `BG-2026-0001` và tự tính tổng (bảng `quotes`). Trang `/quotes/:id` in / lưu PDF (VND có dòng “bằng chữ”), email gửi báo giá soạn sẵn có số tiền và hạn hiệu lực.
- **Nhập danh sách tên công ty:** Nhập file → “Dán danh sách tên công ty” (mỗi dòng một tên, dán thẳng từ Excel được). App đưa vào Pipeline rồi tự chạy: tìm website trên Google (`find_website`: so tên với domain / tiêu đề, bỏ trang danh bạ, báo, mạng xã hội; không thấy thì thử Google Maps và lấy số điện thoại công ty) → đọc website lấy email, số điện thoại, người phụ trách → tìm kênh YouTube. Mỗi công ty chưa có website tốn 1–2 lượt Serper; hết hạn mức ngày thì chạy lại hôm sau, công ty đã có website không tốn lượt. Nhập file Excel xong cũng có nút “Tìm website & liên hệ”.
- **Tìm người phụ trách** (`find_people`, spec 003): website Việt Nam ít ghi tên nhân sự nên app tìm thêm hồ sơ LinkedIn công khai qua Google (đúng tên công ty + vai trò theo nhóm khách, `settings.contact_roles`) và email của công ty xuất hiện trên Internet; chỉ đoán email khi đã thấy email thật cùng mẫu (ghi rõ trong ghi chú). Tối đa 2 lượt Google mỗi công ty, chỉ công ty đang trong pipeline, không tìm lại trong 30 ngày (nút trong khung khách luôn tìm lại). Lead mới tự chạy sau Đọc website; lead cũ: nút trong khung khách hoặc chọn nhiều ở trang Công ty. Danh sách liên hệ xếp người đúng vai trò có email lên đầu (người nhận mặc định); email tuyển dụng / CSKH / kế toán bị ẩn.
- **Thành phố:** ngoài lúc tìm trên Google (chọn địa điểm) và nhập file, Đọc website / Người liên hệ tự điền thành phố từ địa chỉ trên website (dòng “Địa chỉ”, trang Liên hệ, tên quận đặc trưng như Phú Nhuận, Cầu Giấy) và Tìm website lấy từ địa chỉ Google Maps; chỉ điền khi công ty chưa có thành phố. Trang Công ty lọc được “Chưa có thành phố”.
- **Email nhắc việc mỗi sáng:** Edge Function `daily_digest` (Resend) được `pg_cron` gọi mỗi giờ; chỉ gửi khi đã bật, đúng giờ hẹn (giờ Việt Nam) và mỗi ngày một lần (`digest_log`). Bật ở Cài đặt → Email nhắc việc mỗi sáng.
- **Không bị Supabase tạm dừng (gói Free):** GitHub Actions `keepalive.yml` 4 lần/ngày gọi thẳng REST API (`rpc/keepalive`) và Edge Function `keepalive` (ghi một dòng `heartbeat`); hoạt động nội bộ như pg_cron không được Supabase tính. Workflow báo lỗi = project có thể đã bị tạm dừng → vào dashboard Supabase bấm Restore.
- Kiến trúc, chỗ trùng lặp và cách giảm nặng: [docs/kien-truc.md](docs/kien-truc.md).
- Tính năng lớn: spec ngắn bằng tiếng Việt, duyệt trước khi code — [specs/README.md](specs/README.md).
- File lead có dữ liệu cá nhân: **không commit vào repo** (repo công khai).

## Cấu trúc

```
.
├─ supabase/
│  ├─ config.toml              # cấu hình local; verify_jwt = true cho mọi function; tắt đăng ký
│  ├─ migrations/              # schema, hàm/trigger/view, RLS, dữ liệu mặc định
│  ├─ seed.sql                 # dữ liệu mẫu cho DEV (tự xác nhận mọi tín hiệu)
│  └─ functions/
│     ├─ _shared/              # safeFetch, extract, crawler, people, youtube, serper, csv, xlsx...
│     ├─ _tests/               # deno test
│     └─ estimate | discover | find_website | profile | enrich_youtube | enrich_contact | score | cohort_query | export
├─ web/                        # React + Vite + TypeScript (xem web/README.md)
├─ tests/sql/                  # test SQL: RLS, trigger, chấm điểm, cohort, hạn mức
├─ scripts/test-db.sh          # chạy migration + test SQL trên Postgres thường
└─ .github/workflows/          # CI tách theo phần (functions, database, web), chỉ chạy khi phần đó đổi
```

## Triển khai lên một project Supabase

Có hai cách đưa schema và Edge Functions lên Supabase:

- **Cách A — GitHub integration (khuyến nghị, dùng được ở mọi gói kể cả Free).** Trong Dashboard của project, vào Project Settings → Integrations → GitHub Integration → **Authorize GitHub**. Chọn repo này, đặt Working directory là `.`, bật **Deploy to production** với nhánh `main`, rồi bấm Enable integration. Từ đó mỗi lần push hoặc merge vào `main`, Supabase tự chạy migration mới và deploy mọi function khai báo trong `config.toml`. Auth config và `seed.sql` KHÔNG được áp lên production. Sau đó làm tiếp từ bước 3 bên dưới; bước 3 có thể làm trên Dashboard tại Edge Functions → Secrets.
- **Cách B — Supabase CLI**, theo các bước 1–4 bên dưới.

Cần [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) (hoặc dùng `npx supabase`). Lấy **project ref** trong Dashboard → Project Settings → General.

1. Đăng nhập và liên kết project:

   ```bash
   npx supabase login
   ```

   ```bash
   npx supabase link --project-ref <PROJECT_REF>
   ```

2. Tạo schema, RLS và dữ liệu mặc định. **Không** chạy `seed.sql` trên production.

   ```bash
   npx supabase db push
   ```

3. Đặt khoá bí mật cho Edge Functions. Khoá chỉ nằm ở đây, không bao giờ nằm trong frontend hay git.

   ```bash
   npx supabase secrets set SERPER_API_KEY=xxx YOUTUBE_API_KEY=yyy
   # Tuỳ chọn — email nhắc việc mỗi sáng (Resend, gói miễn phí): RESEND_API_KEY=re_...  (DIGEST_FROM nếu đã xác minh tên miền)
   ```

4. Deploy các function. `verify_jwt = true` đã khai báo trong `config.toml`.

   ```bash
   npx supabase functions deploy
   ```

5. Cấu hình Auth trên Dashboard (Authentication → Sign In / Providers):
   - tắt **Allow new users to sign up**;
   - đặt độ dài mật khẩu tối thiểu;
   - bật MFA (TOTP);
   - đặt Site URL bằng URL của frontend.

6. Tạo người dùng: Authentication → Users → **Add user → Create new user**, nhập email và mật khẩu, tích **Auto Confirm User**. Trigger sẽ tự tạo `profiles` với vai trò `user`. (Không nên dùng **Invite user**: app chưa có màn hình đặt mật khẩu cho link mời, và email mặc định của Supabase chỉ gửi được cho thành viên của organization, giới hạn vài email mỗi giờ.) Nâng admin đầu tiên bằng SQL Editor:

   ```sql
   update public.profiles set role = 'admin' where email = 'ban@congty.com';
   ```

   Các admin sau đó được cấp quyền ngay trên màn hình **Cài đặt → Người dùng**.

7. Đăng nhập app bằng tài khoản admin, vào **Cài đặt → Tín hiệu chấm điểm** và **xác nhận** các tín hiệu muốn thu thập. Mọi tín hiệu khởi đầu ở trạng thái `proposed`, và pipeline không ghi observation cho tín hiệu chưa xác nhận.

8. Frontend: xem [web/README.md](web/README.md). Chỉ cần `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY`. Lấy cả hai ở Project Settings → API Keys: dùng **Publishable key** (`sb_publishable_...`) hoặc khoá legacy `anon`.

Edge Functions tự nhận `SUPABASE_URL` và khoá server từ Supabase. Code ưu tiên `SUPABASE_SERVICE_ROLE_KEY` (legacy), và tự chuyển sang `SUPABASE_SECRET_KEYS` nếu project đã tắt khoá legacy, nên không cần đặt thủ công.

Sau mỗi thay đổi schema, chạy **Security Advisor** và **Performance Advisor** của Supabase (Dashboard → Advisors).

### Xoá lead cũ theo thời hạn lưu trữ (tuỳ chọn)

Hàm `purge_stale_leads()` xoá lead không có tương tác quá `settings.retention.months` tháng (mặc định 12, cần pháp chế xác nhận). Admin có thể chạy tay từ màn hình Cài đặt, hoặc lên lịch bằng pg_cron (Dashboard → Integrations → Cron):

```sql
select cron.schedule('purge-stale-leads', '0 3 1 * *', $$select public.purge_stale_leads()$$);
```

## Phát triển và kiểm thử

| Việc | Lệnh |
|---|---|
| Test Edge Functions (regex, safeFetch/SSRF, robots, email pattern, CSV/XLSX...) | `deno task test` |
| Type-check, lint | `deno task check`, `deno task lint` |
| Test SQL (RLS theo vai trò, trigger tín hiệu, chấm điểm, cohort, hạn mức, xoá theo yêu cầu) | `PGHOST=... PGUSER=postgres scripts/test-db.sh` |
| Chạy toàn bộ stack local | `npx supabase start`, rồi `npx supabase functions serve` và `cd web && npm run dev` |

`scripts/test-db.sh` chạy được trên Postgres thường (không cần Docker/Supabase), nhờ file giả lập `tests/sql/00_supabase_shim.sql`. **Không chạy file shim trên project Supabase thật.**

## Khác biệt so với tài liệu kỹ thuật v0.1 (và lý do)

| Mục | Thay đổi |
|---|---|
| 7 – Settings | Người dùng đăng nhập được **đọc** `settings` (cần khu vực, bộ từ khoá, hạn mức cho màn hình Tìm kiếm); chỉ admin ghi. Bảng này không chứa bí mật. |
| 7 – Schema | Thêm bảng `api_usage` (sổ cái hạn mức, giữ chỗ nguyên tử bằng advisory lock), `cohorts` (lưu cohort), cột `runs.provider/input/progress/stats`, `companies.website_url/last_exported_at`. `observations.evidence_url` bắt buộc và chỉ nhận http(s). |
| 5 – Tín hiệu | Thêm `HAS_YOUTUBE` (trọng số 0): lưu link kênh tìm thấy trên website, là đầu vào cho `enrich_youtube`. |
| 4.2 – Observation | Tín hiệu website đã kiểm tra mà không thấy được ghi `value_num = 0`. Nhờ vậy "observation mới nhất" phản ánh đúng hiện trạng, ví dụ công ty đã ngừng tuyển dụng. |
| 6 – Cohort | "Có tín hiệu" = observation **mới nhất** có strength > 0 theo `settings.signal_rules` (ví dụ `ACTIVE_YOUTUBE` cần ≥ 4 video/30 ngày). Công thức điểm và cohort nằm trong SQL (`recompute_scores`, `cohort_search`) để dùng chung một nguồn sự thật. |
| 4.2 – SĐT | Ngoài di động 10 số, chấp nhận **số cố định 11 số bắt đầu bằng 02** (ví dụ 028 3822 1234). Quy tắc "tổng 10 số" trong tài liệu sẽ loại toàn bộ số cố định. Số di động 9 hoặc 11 chữ số vẫn bị loại, và mã số thuế (MST) không bị nhận nhầm là SĐT. |
| 8.3 – safeFetch | Bổ sung chặn CGNAT, multicast, dải dành riêng, NAT64/6to4/Teredo; phân tích IPv6 đầy đủ; chặn `localhost`, `*.internal`, tên một nhãn; chỉ cổng 80/443; cấm `user:pass@`. UA chỉ dùng ASCII, vì UA trong tài liệu có chữ "liên hệ" có dấu sẽ làm `fetch` lỗi. |
| 4.4 – Email | Chỉ tạo email `guess` khi suy luận được mẫu từ một email công khai khớp tên người. `invalid` = domain không có MX lẫn A; có A nhưng không có MX → `risky`. |
| 4.1 – Maps | Địa điểm Maps không có website được lưu với `domain = null`, khử trùng theo tên + thành phố, và được gắn `NO_WEBSITE`. |

## Bảo mật: những điều cần biết

- `service_role` chỉ dùng trong Edge Function. Mọi function đều xác thực người gọi và đọc vai trò từ `profiles`, không tin vai trò do client gửi lên.
- RLS bật trên mọi bảng. Client không ghi được dữ liệu lead (đã thu hồi cả quyền GRANT). Admin chỉ ghi được những cột cho phép, và có trigger audit.
- **Khoảng hở DNS rebinding còn lại:** `fetch` của Deno tự phân giải DNS lại sau khi `safeFetch` đã kiểm tra. Muốn đóng hoàn toàn thì cần proxy egress chặn dải IP nội bộ ở tầng mạng.
- Export luôn loại DNC ở server (cả domain lẫn email), chống CSV injection và ghi `audit_log`.
- Pixel quảng cáo chỉ là **dấu hiệu đã cài đặt**, không chứng minh công ty đang chạy quảng cáo.

## Checklist trước go-live (mục 10.8)

Mã nguồn đã đáp ứng các mục: 2, 5 (test RLS trong `tests/sql`), 7, 8 (test safeFetch), 9, 10, 11. Các mục còn lại cần người vận hành thực hiện:
- 1: quét lịch sử git tìm khoá bí mật;
- 3: giới hạn khoá YouTube chỉ cho YouTube Data API v3;
- 4: tắt đăng ký công khai, bật MFA cho admin;
- 6: chạy Advisors;
- 12–13: pháp chế và IT Security phê duyệt, duyệt chính sách lưu trữ;
- 14: tách project dev/prod, lập kế hoạch sao lưu.
