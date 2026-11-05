-- Lịch 19 điểm chạm khớp bộ email v4 (trang trọng): đổi tên và gợi ý các bước 1, 2, 4, 5, 7, 8, 11, 12.
create or replace function public.default_cadence_v4() returns jsonb
language sql immutable set search_path = '' as $fn$
  select $json$[
 {
  "day": 0,
  "hint": "Giới thiệu người gửi và Epidemic Sound, 3 lợi ích đúng nhóm khách, danh sách nhạc tham khảo, đề xuất buổi trao đổi 20 phút.",
  "step": 1,
  "title": "Email mở lời",
  "channel": "email"
 },
 {
  "day": 0,
  "hint": "Nhắc tới email vừa gửi.",
  "step": 2,
  "title": "Kết nối LinkedIn",
  "channel": "linkedin"
 },
 {
  "day": 1,
  "hint": "Không nghe máy → gửi Zalo ngay trong ngày.",
  "step": 3,
  "title": "Gọi điện lần 1",
  "channel": "call"
 },
 {
  "day": 2,
  "hint": "Ngắn gọn, lịch sự; nhắc email đã gửi.",
  "step": 4,
  "title": "Zalo: gửi danh sách nhạc tham khảo",
  "channel": "zalo"
 },
 {
  "day": 4,
  "hint": "Đề nghị minh hoạ phương án nhạc nền trên một video mẫu của khách, gửi lại trong 1–2 ngày làm việc.",
  "step": 5,
  "title": "Email: tư liệu tham khảo và minh hoạ nhạc trên video của khách",
  "channel": "email"
 },
 {
  "day": 6,
  "hint": "Đổi khung giờ so với lần 1.",
  "step": 6,
  "title": "Gọi điện lần 2",
  "channel": "call"
 },
 {
  "day": 7,
  "hint": "Gửi danh sách nhạc tham khảo, ngỏ ý hỗ trợ demo.",
  "step": 7,
  "title": "Nhắn tin LinkedIn",
  "channel": "linkedin"
 },
 {
  "day": 10,
  "hint": "Quyền biểu diễn trước công chúng; đề nghị gửi bản tóm tắt pháp lý một trang.",
  "step": 8,
  "title": "Email: thông tin pháp lý về quyền biểu diễn",
  "channel": "email"
 },
 {
  "day": 13,
  "hint": "Tuyển chọn nhạc cho một dự án cụ thể của họ.",
  "step": 9,
  "title": "Zalo: playlist theo dự án",
  "channel": "zalo"
 },
 {
  "day": 16,
  "hint": "Hỏi thẳng nhu cầu nhạc quý tới.",
  "step": 10,
  "title": "Gọi điện lần 3",
  "channel": "call"
 },
 {
  "day": 20,
  "hint": "Đưa 2 khung giờ cụ thể.",
  "step": 11,
  "title": "Email: đề xuất buổi giới thiệu 20 phút",
  "channel": "email"
 },
 {
  "day": 27,
  "hint": "Không phản hồi sau bước này → chuyển Nuôi dưỡng.",
  "step": 12,
  "title": "Email: xin phép tạm dừng, nhờ giới thiệu đầu mối",
  "channel": "email"
 },
 {
  "day": 35,
  "hint": "Xác nhận 8 tiêu chí đánh giá.",
  "step": 13,
  "title": "Buổi tìm hiểu nhu cầu",
  "channel": "meeting"
 },
 {
  "day": 40,
  "hint": "Dùng nội dung thật của khách.",
  "step": 14,
  "title": "Demo sản phẩm",
  "channel": "meeting"
 },
 {
  "day": 44,
  "hint": "Ghi ARR dự kiến và ngày chốt.",
  "step": 15,
  "title": "Gửi đề xuất & báo giá",
  "channel": "email"
 },
 {
  "day": 48,
  "hint": "Hỏi phản hồi, ai cần duyệt.",
  "step": 16,
  "title": "Theo dõi đề xuất",
  "channel": "call"
 },
 {
  "day": 55,
  "hint": "Có người ủng hộ nội bộ đi cùng nếu được.",
  "step": 17,
  "title": "Gặp người quyết định",
  "channel": "meeting"
 },
 {
  "day": 60,
  "hint": "Giá, điều khoản, kỹ thuật — xem kho Xử lý từ chối.",
  "step": 18,
  "title": "Xử lý băn khoăn",
  "channel": "email"
 },
 {
  "day": 66,
  "hint": "Chuyển sang Thắng và bàn giao.",
  "step": 19,
  "title": "Ký hợp đồng",
  "channel": "meeting"
 }
]$json$::jsonb
$fn$;

create or replace function public.apply_sales_defaults() returns void
language plpgsql security definer set search_path = '' as $fn$
begin
  if not public.is_admin() then
    raise exception 'Chỉ admin được thay lịch và nội dung soạn sẵn' using errcode = '42501';
  end if;
  update public.settings set value = public.default_cadence_v4() where key = 'cadence';
  update public.settings set value = public.default_message_templates_v4() where key = 'message_templates';
end $fn$;

-- Tự thay nếu người dùng chưa sửa lịch (chưa từng sửa, hoặc đang dùng nguyên bản v3).
update public.settings
set value = public.default_cadence_v4()
where key = 'cadence'
  and (updated_by is null or value = public.default_cadence_v3());
