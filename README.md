# Sync Lead Finder

Web app giúp Licensing Manager **tìm và lọc lead B2B cần giấy phép nhạc (sync license)** tại Việt Nam: agency/production house, nhãn hàng làm nhiều video, hãng phim/hậu kỳ và MCN nhỏ.

Pipeline: **discover** (Serper) → **profile** (đọc website bằng regex) → **enrich_youtube** (YouTube Data API) → **enrich_contact** (người quyết định + nhãn email) → **score** → **cohort / export**.

Mỗi phát hiện là một dòng trong bảng `observations`, kèm `evidence_url` và `confidence`. Admin duyệt tín hiệu nào được thu thập; cohort là truy vấn SQL tham số hoá. Ý tưởng lấy từ [Harvey](https://github.com/ethanplusai/harvey) (MIT).

> ⚠️ Dữ liệu liên hệ cá nhân có thể thuộc phạm vi NĐ 13/2023, Luật BVDLCN, NĐ 91/2020 và GDPR. **Cần pháp chế và IT Security phê duyệt trước khi dùng thật.**

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
│     └─ estimate | discover | profile | enrich_youtube | enrich_contact | score | cohort_query | export
├─ web/                        # React + Vite + TypeScript (xem web/README.md)
├─ tests/sql/                  # test SQL: RLS, trigger, chấm điểm, cohort, hạn mức
├─ scripts/test-db.sh          # chạy migration + test SQL trên Postgres thường
└─ .github/workflows/ci.yml    # lint, type-check, test Deno, test SQL, build web
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

6. Mời người dùng: Authentication → Users → **Invite user**. Trigger sẽ tự tạo `profiles` với vai trò `user`. Nâng admin đầu tiên bằng SQL Editor:

   ```sql
   update public.profiles set role = 'admin' where email = 'ban@congty.com';
   ```

   Các admin sau đó được cấp quyền ngay trên màn hình **Cài đặt → Người dùng**.

7. Đăng nhập app bằng tài khoản admin, vào **Tín hiệu** và **xác nhận** các tín hiệu muốn thu thập. Mọi tín hiệu khởi đầu ở trạng thái `proposed`, và pipeline không ghi observation cho tín hiệu chưa xác nhận.

8. Frontend: xem [web/README.md](web/README.md). Chỉ cần `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY`.

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
