# Bigfish Lead Finder — ghi chú cho Claude

Tổng quan, cấu trúc, triển khai: `README.md`. Frontend: `web/README.md`. Cách làm việc tiết kiệm: `docs/lam-viec-voi-claude.md`.

## Kiểm tra trước khi push (CI chỉ là lưới an toàn; chỉ chạy phần liên quan)
- Edge Functions: `deno task lint && deno task check && deno task test` (chưa có deno: `npm i -g deno`)
- SQL: `PGHOST=... PGUSER=postgres scripts/test-db.sh`
- Web: `cd web && npm run build`

## Lưu ý
- Supabase deploy production từ `main`: push lên `main` = deploy thật.
- Không tạo PR khi chưa được yêu cầu.
- Không dùng Supabase MCP khi người dùng chưa xác nhận đúng project (các kết nối hiện có thuộc tài khoản cũ).
- Cloud: supabase.com bị chặn mạng, tra tài liệu bằng WebSearch.
- `web/src/lib/api-types.ts` là bản sao `supabase/functions/_shared/types.ts`: sửa cả hai.

## Cách làm việc
- Trả lời ngắn, tiếng Việt; không nhắc lại điều đã chốt, không liệt kê phương án không làm.
- grep trước, chỉ đọc đoạn cần; sửa xong không đọc lại.
- Gộp các lệnh độc lập vào một lượt.
- Tra cứu rộng (nhiều tệp): agent phụ Haiku chỉ đọc, trả kết luận. Việc vài lệnh thì tự làm.
- Một cách làm thất bại 2 lần: dừng, đổi hướng hoặc hỏi; không thử lại y nguyên.
- Gom câu hỏi duyệt vào một lần; chỉ hỏi giữa chừng khi tốn tiền hoặc đổi điều đã chốt.
- Tác vụ tự động: báo cáo tối đa ~15 dòng.
- GitHub Actions: không push cùng một commit nhiều lần; sửa tài liệu không kích hoạt CI.
