-- Xử lý từ chối: lý do từ chối có cấu trúc, nhà cung cấp hiện tại, ngày hết hợp đồng của họ
-- (để hẹn liên hệ lại đúng lúc). Kèm cấu hình kịch bản xử lý từ chối và thư viện playlist.

alter table public.deals
  add column lost_reason_code text check (lost_reason_code in ('price','competitor','no_need','no_contact','timing','other')),
  add column competitor text check (length(competitor) <= 200),
  add column contract_end date;

grant update (lost_reason_code, competitor, contract_end) on public.deals to authenticated;

-- deal_board dùng d.* nên phải tạo lại để có cột mới.
drop view public.deal_board;
create view public.deal_board with (security_invoker = true) as
  select d.*,
         c.name as company_name, c.domain, c.website_url, c.segment, c.city, c.score,
         public.is_domain_dnc(c.domain) as is_dnc,
         coalesce(a.touches, 0) as touches,
         a.last_touch_at
  from public.deals d
  join public.companies c on c.id = d.company_id
  left join lateral (
    select count(*)::int as touches, max(x.happened_at) as last_touch_at
    from public.activities x where x.deal_id = d.id
  ) a on true;
revoke all on public.deal_board from anon;
grant select on public.deal_board to authenticated;

insert into public.settings (key, value) values
  ('objection_playbook', $json$[
    {"reason": "price", "title": "Hỏi rõ “mắc so với gì”",
     "text": "Dạ em hiểu. Anh/chị thấy mắc là so với bên đang dùng, so với ngân sách năm nay, hay so với việc hiện chưa phải trả cho nhạc ạ? Em hỏi để đề xuất đúng phạm vi cho bên mình."},
    {"reason": "price", "title": "Quy ra chi phí mỗi video",
     "text": "Nếu bên mình làm khoảng {n} video/năm thì chi phí chỉ khoảng {x} USD mỗi video — thấp hơn nhiều so với một video bị claim phải gỡ hoặc làm lại, chưa kể thời gian producer tìm nhạc."},
    {"reason": "price", "title": "Bắt đầu nhỏ, mở rộng sau",
     "text": "Hay mình bắt đầu với một team/kênh trước để đo hiệu quả, sau đó mới mở rộng cho cả công ty ạ?"},
    {"reason": "price", "title": "Bám mùa ngân sách",
     "text": "Bên mình thường lên ngân sách năm sau vào khoảng tháng nào ạ? Em gửi đề xuất trước thời điểm đó để anh/chị có số liệu trình lên."},
    {"reason": "competitor", "title": "Hỏi ngày gia hạn + điểm chưa hài lòng",
     "text": "Dạ hay quá. Hợp đồng hiện tại của bên mình hết hạn khoảng khi nào ạ? Và bên mình đang hài lòng nhất điểm nào, còn vướng ở đâu — ví dụ nhạc quốc tế, xử lý claim, hay giới hạn nền tảng?"},
    {"reason": "competitor", "title": "So sánh trên dự án thật",
     "text": "Em gửi anh/chị một playlist chọn riêng cho dự án sắp tới của bên mình, anh/chị so thử với kho đang dùng xem có phù hợp hơn không nhé."},
    {"reason": "competitor", "title": "Bổ sung, không thay thế",
     "text": "Bên em không cần thay nhà cung cấp hiện tại — nhiều đối tác dùng song song cho các dự án phát hành quốc tế hoặc cần hiệu ứng âm thanh."},
    {"reason": "no_need", "title": "Giữ liên lạc bằng giá trị",
     "text": "Dạ em hiểu. Em xin phép thỉnh thoảng gửi anh/chị playlist theo mùa và cập nhật về bản quyền / Content ID, khi nào bên mình cần thì mình trao đổi tiếp ạ."}
  ]$json$::jsonb),
  ('playlists', '[]'::jsonb),
  ('sales_calendar', '{"budget_month": 11}'::jsonb)
on conflict (key) do nothing;
