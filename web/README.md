# Sync Lead Finder — Frontend

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
| `VITE_SUPABASE_URL` | URL project Supabase |
| `VITE_SUPABASE_ANON_KEY` | Khoá anon / publishable |

**Không bao giờ** đặt `service_role`, `SERPER_API_KEY` hay `YOUTUBE_API_KEY` vào frontend.

Lệnh khác: `npm run typecheck`, `npm run build` (kiểm tra kiểu rồi build vào `dist/`), `npm run preview`.

## Màn hình

Đăng nhập (mật khẩu / magic link, không có đăng ký; hỗ trợ MFA TOTP) · Tổng quan · Tìm kiếm (ước tính
lượt API trước khi chạy, xác nhận khi vượt ngưỡng, chạy pipeline theo lô) · Tín hiệu (admin duyệt, chỉnh
trọng số) · Danh sách công ty + chi tiết (observation, bằng chứng, breakdown điểm, liên hệ) · Cohort
builder (lưu cohort, export CSV/Excel) · Danh sách loại trừ (thêm/xoá, import CSV, xoá dữ liệu theo yêu cầu)
· Cài đặt (JSON theo khoá, người dùng/vai trò, xoá lead cũ, bật MFA) · Nhật ký (runs, audit, tiếp tục run
YouTube bị dừng vì hết quota).

## Triển khai (hosting tĩnh)

```bash
VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npm run build
```

Tải thư mục `dist/` lên bất kỳ hosting tĩnh nào (Netlify, Cloudflare Pages, Vercel, S3 + CloudFront...).

- **SPA fallback**: mọi đường dẫn phải trả về `index.html`. `public/_redirects` đã cấu hình cho
  Netlify / Cloudflare Pages; Vercel dùng `vercel.json` (cùng fallback + header). Hosting khác cần cấu hình tương đương.
- **Vercel**: Import repo → Root Directory = `web` (Vite tự nhận), thêm 2 biến `VITE_SUPABASE_*` cho Production.
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
