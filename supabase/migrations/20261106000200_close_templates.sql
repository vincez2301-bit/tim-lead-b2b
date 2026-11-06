-- Nội dung soạn sẵn cho các bước chặng chốt còn thiếu: 14 demo, 17 gặp người quyết định,
-- 18 xử lý băn khoăn, 19 gửi hợp đồng. Chỉ thêm bước chưa có mẫu (không đè mẫu đã sửa).
create or replace function public.default_close_templates() returns jsonb
language sql immutable set search_path = '' as $fn$
  select $json$[
    {
      "step": 14,
      "channel": "meeting",
      "segment": "all",
      "title": "Kịch bản demo 20 phút",
      "body": "• Mở đầu (2 phút): nhắc lại nhu cầu {cong_ty} đã chia sẻ ở buổi trước.\n• Demo trên nội dung thật (10 phút): tìm nhạc cho 1–2 video gần đây của {cong_ty}, tải bản tách lời / stems, cách xử lý cảnh báo bản quyền trên YouTube.\n• Hỏi chốt (5 phút): \"Nếu phương án này phù hợp, {anh_chi} muốn bắt đầu dùng từ ngày nào?\" · \"Ngoài {anh_chi}, ai cần xem báo giá?\"\n• Kết thúc: hứa gửi báo giá trong 24 giờ và hẹn ngày gọi lại.",
      "version": 5
    },
    {
      "step": 17,
      "channel": "email",
      "segment": "all",
      "title": "Email hẹn gặp người phê duyệt",
      "subject": "Trao đổi 15 phút để hoàn tất phương án – Epidemic Sound và {cong_ty}",
      "body": "Kính gửi {xung_ho},\n\nĐể {anh_chi} thuận tiện trình duyệt, em xin đề xuất một buổi trao đổi ngắn khoảng 15 phút với {anh_chi} và người phụ trách phê duyệt bên {cong_ty}. Em sẽ tóm tắt phạm vi sử dụng, chi phí và giải đáp các câu hỏi về bản quyền.\n\nEm xin đề xuất: [Thứ …, …h] hoặc [Thứ …, …h], trực tuyến hoặc tại văn phòng {cong_ty}.\n\nTrân trọng,\n{chu_ky}",
      "version": 5
    },
    {
      "step": 18,
      "channel": "call",
      "segment": "all",
      "title": "Gọi xử lý băn khoăn",
      "body": "• \"Em muốn chắc là phương án này phù hợp với {cong_ty}. Hiện {anh_chi} còn băn khoăn điểm nào nhất: chi phí, phạm vi sử dụng hay thủ tục?\"\n• Lắng nghe, nhắc lại đúng điều khách lo, rồi mở kho Xử lý từ chối bên dưới.\n• Chi phí: đề xuất thanh toán theo đợt hoặc bắt đầu với phạm vi nhỏ hơn, tránh giảm giá ngay.\n• Chốt bước tiếp: \"Nếu em giải quyết được điểm này, mình có thể ký trong tuần này không ạ?\"\n• Khách đồng ý → bấm “Khách đồng ý” ở khung Tiến độ chốt.",
      "version": 5
    },
    {
      "step": 19,
      "channel": "email",
      "segment": "all",
      "title": "Email gửi hợp đồng",
      "subject": "Hợp đồng và các bước kích hoạt – Epidemic Sound và {cong_ty}",
      "body": "Kính gửi {xung_ho},\n\nEm cảm ơn {anh_chi} đã đồng ý hợp tác. Em xin gửi hợp đồng (đính kèm) để {anh_chi} xem và ký. Các bước tiếp theo:\n1. {anh_chi} ký và gửi lại hợp đồng (bản scan hoặc ký điện tử).\n2. Em gửi hoá đơn và hướng dẫn thanh toán.\n3. Em kích hoạt tài khoản cho {cong_ty} ngay khi hoàn tất thủ tục.\n\nNếu cần chỉnh điều khoản nào, {anh_chi} cứ trả lời email này hoặc gọi trực tiếp cho em.\n\nTrân trọng,\n{chu_ky}",
      "version": 5
    }
  ]$json$::jsonb
$fn$;

update public.settings s
set value = s.value || coalesce((
  select jsonb_agg(t)
  from jsonb_array_elements(public.default_close_templates()) t
  where not exists (
    select 1 from jsonb_array_elements(s.value) x where x->>'step' = t->>'step'
  )
), '[]'::jsonb)
where s.key = 'message_templates' and jsonb_typeof(s.value) = 'array';

-- “Dùng bộ mẫu mới” ở Kho nội dung: bộ v4 + mẫu chặng chốt.
create or replace function public.apply_sales_defaults() returns void
language plpgsql security definer set search_path = '' as $fn$
begin
  if not public.is_admin() then
    raise exception 'Chỉ admin được thay lịch và nội dung soạn sẵn' using errcode = '42501';
  end if;
  update public.settings set value = public.default_cadence_v4() where key = 'cadence';
  update public.settings set value = public.default_message_templates_v4() || public.default_close_templates()
  where key = 'message_templates';
end $fn$;
revoke execute on function public.apply_sales_defaults(), public.default_close_templates() from public, anon;
grant execute on function public.apply_sales_defaults() to authenticated;
