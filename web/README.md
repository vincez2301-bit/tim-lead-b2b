# Bigfish Lead Finder — Frontend

React 18 + Vite 6 + TypeScript, giao diện tiếng Việt, responsive (điện thoại và máy tính).
Frontend chỉ đọc dữ liệu qua RLS bằng khoá **anon/publishable**; mọi thao tác pipeline đi qua
Edge Functions (mục 8, mục 10 tài liệu kỹ thuật).

## Chạy local

```bash
cd web
cp .env.example .env        # điền VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY
npm ci
npm run dev                 # http://localhost:5173
```

Chỉ có hai biến môi trường, đều công khai:

| Biến | Ý nghĩa |
|---|---|
| `VITE_SUPABASE_URL` (hoặc `SUPABASE_URL`) | URL project Supabase |
| `VITE_SUPABASE_ANON_KEY` (hoặc `SUPABASE_PUBLISHABLE_KEY`) | Khoá anon / publishable; build dừng nếu là khoá bí mật |

**Không bao giờ** đặt `service_role`, `SERPER_API_KEY` hay `YOUTUBE_API_KEY` vào frontend.

Lệnh khác: `npm run typecheck`, `npm run build` (kiểm tra kiểu rồi build vào `dist/`), `npm run preview`.

## Màn hình

Menu theo thứ tự công việc:

- **Bán hàng:** Hôm nay (trang chủ: việc trong ngày gồm điểm chạm đến hạn và lead mới gửi email mở lời, làm lần lượt) · Pipeline (danh sách “việc tiếp theo” của từng khách; bảng kéo thả là tuỳ chọn).
- **Kho nội dung:** Email & tin nhắn mẫu (theo bước 19 điểm chạm × nhóm khách, chép / sửa tại chỗ) · Xử lý từ chối
  (câu trả lời mẫu + khách đã từ chối chờ liên hệ lại) · Nhạc mẫu (chủ đề, trình phát).
- **Tìm khách:** Tìm khách mới (form tìm Google → danh sách lượt tìm → bảng công ty của từng lượt: đã phân tích chưa,
  điểm, đã vào Pipeline chưa; phân tích website và đưa vào Pipeline ngay tại đó) · Công ty · Nhập file.
- **Hệ thống:** Xuất danh sách (cohort CSV/Excel) · Cài đặt (tab Chung: người gửi, MFA, người dùng, xoá lead cũ, JSON
  nâng cao · Tín hiệu chấm điểm · Danh sách loại trừ · Nhật ký).

Mỗi trang là một chunk riêng (`React.lazy`); React, Supabase và icon tách chunk vendor để trình duyệt giữ cache
qua các lần deploy. Bảng `settings` tải một lần mỗi phiên (`SettingsProvider`).

## Triển khai (hosting tĩnh)

```bash
VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npm run build
```

Tải thư mục `dist/` lên bất kỳ hosting tĩnh nào (Netlify, Cloudflare Pages, Vercel, S3 + CloudFront...).

- **SPA fallback**: mọi đường dẫn phải trả về `index.html`. `public/_redirects` đã cấu hình cho
  Netlify / Cloudflare Pages; Vercel dùng `vercel.json` (cùng fallback + header). Hosting khác cần cấu hình tương đương.
- **Vercel**: Import repo → Root Directory = `web` (Vite tự nhận), thêm 2 biến `SUPABASE_URL` và `SUPABASE_PUBLISHABLE_KEY` (Vercel không cho đặt `VITE_*` ở loại bí mật; build tự đổi tên). `vercel.json` bỏ qua build khi `web/` không đổi và không deploy nhánh `claude/*`.
- **Header bảo mật**: `public/_headers` (Netlify / Cloudflare Pages), `vercel.json` (Vercel) đặt CSP, `X-Frame-Options`,
  `X-Content-Type-Options`, `Referrer-Policy`. Nên thay `https://*.supabase.co` bằng URL project cụ thể.
- Bản build tự chèn thẻ `<meta http-equiv="Content-Security-Policy">` với `connect-src` = URL Supabase
  lúc build; không có script/style inline.
- Thêm URL production vào Supabase Dashboard → Authentication → URL Configuration (Site URL và
  Redirect URLs) để magic link hoạt động.

## Nguyên tắc bảo mật trong code (mục 10.3)

- Không dùng `innerHTML` / `dangerouslySetInnerHTML`; mọi dữ liệu cào được hiển thị dạng văn bản.
- Link ngoài đi qua `SafeLink`: chỉ `http/https`, `target="_blank" rel="noopener noreferrer nofollow"`.
- Export tải file bằng `fetch` trực tiếp để giữ nguyên BOM UTF-8 của CSV.
- `src/lib/api-types.ts` là bản sao của `supabase/functions/_shared/types.ts` — sửa cả hai khi đổi API.
