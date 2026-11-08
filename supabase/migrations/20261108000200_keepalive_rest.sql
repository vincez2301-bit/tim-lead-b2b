-- Supabase vẫn cảnh báo tạm dừng dù pg_cron truy vấn mỗi giờ: hoạt động nội bộ không được tính.
-- Cho GitHub Actions gọi thẳng REST API (khoá anon công khai) → hoạt động từ bên ngoài.
-- Hàm chỉ ghi heartbeat (tối đa mỗi phút một lần) và trả thời điểm; Edge Function keepalive vốn đã công khai.
grant execute on function public.keepalive() to anon;
