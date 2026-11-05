-- Bộ email mẫu v4 (trang trọng): "Kính gửi chị Lan", giới thiệu người gửi và Epidemic Sound,
-- 3 lợi ích theo nhóm khách, đề xuất buổi trao đổi, chữ ký đầy đủ. Biến mới: {xung_ho} (chị Lan /
-- anh Minh / Quý Công ty …) và {anh_chi} (đoán từ tên đệm Thị/Văn, không rõ thì "anh/chị").

create or replace function public.default_message_templates_v4() returns jsonb
language sql immutable set search_path = '' as $fn$
  select $json$[
 {
  "step": 1,
  "channel": "email",
  "segment": "broadcaster",
  "title": "Email mở lời — đài truyền hình",
  "subject": "Epidemic Sound – Giải pháp âm nhạc bản quyền cho {cong_ty}",
  "body": "Kính gửi {xung_ho},\n\nEm là {nguoi_gui}, {chuc_danh} của Epidemic Sound tại Việt Nam. Em xin phép liên hệ để giới thiệu giải pháp âm nhạc bản quyền dành cho các đài truyền hình.\n\nEpidemic Sound (Thuỵ Điển, thành lập năm 2009) là nhà cung cấp nhạc thư viện lớn nhất cho các đài truyền hình lớn tại Bắc Âu và hiện phục vụ khách hàng tại gần 200 quốc gia. Với {cong_ty}, giải pháp có ba điểm đáng chú ý:\n\n• Phát sóng và đăng tải an toàn: Epidemic Sound sở hữu 100% quyền đối với toàn bộ kho nhạc, bao gồm quyền biểu diễn trước công chúng, nên không phát sinh phí với Trung tâm/Hiệp hội tác quyền và hạn chế tối đa việc bị claim trên YouTube, Facebook.\n• Kho nhạc cho mọi thể loại chương trình: hơn 55.000 bản nhạc và 250.000 hiệu ứng âm thanh cho bản tin, gameshow, phim truyền hình, quảng cáo và nội dung số.\n• Tiết kiệm thời gian hậu kỳ: công cụ Adapt rút gọn một bản nhạc thành 15s/30s/60s và tách vocal chỉ trong vài giây.\n\nEm xin gửi kèm danh sách nhạc tham khảo cho mảng tin tức – giải trí: {playlist}\n\nRất mong {anh_chi} dành cho em khoảng 20 phút trong tuần này hoặc tuần sau để em tìm hiểu nhu cầu của {cong_ty} và giới thiệu chi tiết hơn. Em xin phép liên hệ lại để sắp xếp thời gian phù hợp.\n\nTrân trọng,\n{chu_ky}",
  "version": 4
 },
 {
  "step": 1,
  "channel": "email",
  "segment": "mcn",
  "title": "Email mở lời — MCN / mạng creator",
  "subject": "Epidemic Sound – Giải pháp âm nhạc cho mạng lưới creator của {cong_ty}",
  "body": "Kính gửi {xung_ho},\n\nEm là {nguoi_gui}, {chuc_danh} của Epidemic Sound tại Việt Nam. Em xin phép liên hệ để giới thiệu giải pháp âm nhạc bản quyền dành cho các MCN và mạng lưới nhà sáng tạo nội dung.\n\nEpidemic Sound (Thuỵ Điển, thành lập năm 2009) là nhà cung cấp nhạc thư viện lớn nhất cho các đài truyền hình lớn tại Bắc Âu và hiện phục vụ khách hàng tại gần 200 quốc gia. Với {cong_ty}, giải pháp có ba điểm đáng chú ý:\n\n• Hạn chế claim trên toàn mạng lưới: các kênh được kết nối giấy phép sử dụng nhạc Epidemic Sound trên YouTube, TikTok, Facebook mà không lo bị claim hay mất doanh thu quảng cáo.\n• Giảm tải cho đội vận hành: creator chủ động chọn nhạc trong kho đã được cấp phép, đội ngũ của {cong_ty} không phải xử lý khiếu nại bản quyền cho từng video.\n• Kho nhạc cập nhật liên tục: hơn 55.000 bản nhạc và 250.000 hiệu ứng âm thanh cho vlog, gaming, giải trí, giáo dục.\n\nEm xin gửi kèm danh sách nhạc được nhiều creator sử dụng: {playlist}\n\nRất mong {anh_chi} dành cho em khoảng 20 phút trong tuần này hoặc tuần sau để em tìm hiểu nhu cầu của {cong_ty} và giới thiệu chi tiết hơn. Em xin phép liên hệ lại để sắp xếp thời gian phù hợp.\n\nTrân trọng,\n{chu_ky}",
  "version": 4
 },
 {
  "step": 1,
  "channel": "email",
  "segment": "agency",
  "title": "Email mở lời — production house / agency",
  "subject": "Epidemic Sound – Âm nhạc bản quyền cho các dự án của {cong_ty}",
  "body": "Kính gửi {xung_ho},\n\nEm là {nguoi_gui}, {chuc_danh} của Epidemic Sound tại Việt Nam. Em xin phép liên hệ để giới thiệu giải pháp âm nhạc bản quyền dành cho các công ty sản xuất và agency.\n\nEpidemic Sound (Thuỵ Điển, thành lập năm 2009) là nhà cung cấp nhạc thư viện lớn nhất cho các đài truyền hình lớn tại Bắc Âu và hiện phục vụ khách hàng tại gần 200 quốc gia. Với {cong_ty}, giải pháp có ba điểm đáng chú ý:\n\n• Một giấy phép trọn gói theo năm cho các dự án: TVC, video doanh nghiệp, sự kiện; khách hàng của {cong_ty} được phép đăng tải nội dung do {cong_ty} sản xuất.\n• Hậu kỳ linh hoạt: mỗi bản nhạc có stems (trống, bass, giai điệu…), công cụ Adapt rút gọn thành 15s/30s/60s trong vài giây — thuận tiện khi khách hàng yêu cầu chỉnh sửa.\n• Pháp lý rõ ràng: Epidemic Sound sở hữu 100% quyền đối với toàn bộ kho nhạc, bao gồm quyền biểu diễn trước công chúng, nên không phát sinh phí với Trung tâm/Hiệp hội tác quyền.\n\nEm xin gửi kèm danh sách nhạc tham khảo cho TVC và video doanh nghiệp: {playlist}\n\nRất mong {anh_chi} dành cho em khoảng 20 phút trong tuần này hoặc tuần sau để em tìm hiểu nhu cầu của {cong_ty} và giới thiệu chi tiết hơn. Em xin phép liên hệ lại để sắp xếp thời gian phù hợp.\n\nTrân trọng,\n{chu_ky}",
  "version": 4
 },
 {
  "step": 1,
  "channel": "email",
  "segment": "film",
  "title": "Email mở lời — hãng phim / hậu kỳ",
  "subject": "Epidemic Sound – Âm nhạc và hiệu ứng âm thanh cho dự án của {cong_ty}",
  "body": "Kính gửi {xung_ho},\n\nEm là {nguoi_gui}, {chuc_danh} của Epidemic Sound tại Việt Nam. Em xin phép liên hệ để giới thiệu giải pháp âm nhạc bản quyền dành cho các hãng phim và đơn vị hậu kỳ.\n\nEpidemic Sound (Thuỵ Điển, thành lập năm 2009) là nhà cung cấp nhạc thư viện lớn nhất cho các đài truyền hình lớn tại Bắc Âu và hiện phục vụ khách hàng tại gần 200 quốc gia. Với {cong_ty}, giải pháp có ba điểm đáng chú ý:\n\n• Kho nhạc điện ảnh chất lượng cao, có stems để phối lại, định dạng WAV 24-bit/48 kHz đáp ứng chuẩn phát sóng và rạp chiếu.\n• 250.000 hiệu ứng âm thanh phục vụ hậu kỳ.\n• Quyền sử dụng rõ ràng cho trailer, teaser và nội dung quảng bá trên mọi nền tảng; quyền biểu diễn trước công chúng đã được bao gồm.\n\nEm xin gửi kèm danh sách nhạc tham khảo cho trailer và phim: {playlist}\n\nRất mong {anh_chi} dành cho em khoảng 20 phút trong tuần này hoặc tuần sau để em tìm hiểu nhu cầu của {cong_ty} và giới thiệu chi tiết hơn. Em xin phép liên hệ lại để sắp xếp thời gian phù hợp.\n\nTrân trọng,\n{chu_ky}",
  "version": 4
 },
 {
  "step": 1,
  "channel": "email",
  "segment": "brand",
  "title": "Email mở lời — nhãn hàng",
  "subject": "Epidemic Sound – Âm nhạc bản quyền cho truyền thông của {cong_ty}",
  "body": "Kính gửi {xung_ho},\n\nEm là {nguoi_gui}, {chuc_danh} của Epidemic Sound tại Việt Nam. Em xin phép liên hệ để giới thiệu giải pháp âm nhạc bản quyền dành cho các thương hiệu.\n\nEpidemic Sound (Thuỵ Điển, thành lập năm 2009) là nhà cung cấp nhạc thư viện lớn nhất cho các đài truyền hình lớn tại Bắc Âu và hiện phục vụ khách hàng tại gần 200 quốc gia. Với {cong_ty}, giải pháp có ba điểm đáng chú ý:\n\n• Một giấy phép cho mọi kênh: mạng xã hội, quảng cáo trực tuyến, sự kiện — dùng chung cho đội marketing và các agency đối tác của {cong_ty}.\n• Nhận diện âm thanh nhất quán: đội ngũ Epidemic Sound tư vấn lựa chọn âm nhạc phù hợp với bản sắc thương hiệu (Sonic Branding).\n• Pháp lý rõ ràng: Epidemic Sound sở hữu 100% quyền đối với toàn bộ kho nhạc, bao gồm quyền biểu diễn trước công chúng, nên không phát sinh phí với Trung tâm/Hiệp hội tác quyền.\n\nEm xin gửi kèm danh sách nhạc tham khảo cho truyền thông thương hiệu: {playlist}\n\nRất mong {anh_chi} dành cho em khoảng 20 phút trong tuần này hoặc tuần sau để em tìm hiểu nhu cầu của {cong_ty} và giới thiệu chi tiết hơn. Em xin phép liên hệ lại để sắp xếp thời gian phù hợp.\n\nTrân trọng,\n{chu_ky}",
  "version": 4
 },
 {
  "step": 2,
  "channel": "linkedin",
  "segment": "all",
  "title": "Kết nối LinkedIn (≤ 300 ký tự)",
  "body": "Kính chào {xung_ho}, em là {nguoi_gui}, {chuc_danh} của Epidemic Sound tại Việt Nam. Em vừa gửi email giới thiệu giải pháp âm nhạc bản quyền tới {cong_ty} và rất mong được kết nối với {anh_chi}.",
  "version": 4
 },
 {
  "step": 3,
  "channel": "call",
  "segment": "all",
  "title": "Kịch bản gọi lần 1",
  "body": "• Mở lời: \"Em chào {xung_ho}, em là {nguoi_gui}, {chuc_danh} của Epidemic Sound tại Việt Nam. Em gọi để tiếp nối email giới thiệu giải pháp âm nhạc bản quyền em đã gửi hôm qua. Không biết {anh_chi} có thể dành cho em khoảng 2 phút không ạ?\"\n• Câu hỏi: \"Hiện {cong_ty} đang sử dụng nguồn nhạc nào cho các chương trình, video, và có gặp vấn đề về bản quyền hoặc phí tác quyền không ạ?\"\n• Đề xuất: hẹn buổi trao đổi 20 phút, đưa hai khung giờ cụ thể.\n• Không nghe máy → gửi tin Zalo trong ngày.",
  "version": 4
 },
 {
  "step": 4,
  "channel": "zalo",
  "segment": "all",
  "title": "Zalo: gửi danh sách nhạc tham khảo",
  "body": "Dạ em chào {xung_ho}, em là {nguoi_gui}, {chuc_danh} Epidemic Sound tại Việt Nam. Em đã gửi email giới thiệu giải pháp âm nhạc bản quyền tới {anh_chi}; em xin gửi kèm danh sách nhạc tham khảo cho {cong_ty}: {playlist}\nNếu cần thêm thông tin, em xin phép được hỗ trợ ạ. Em cảm ơn {anh_chi}.",
  "version": 4
 },
 {
  "step": 5,
  "channel": "email",
  "segment": "all",
  "title": "Email tiếp theo: tư liệu tham khảo (ngày 4)",
  "body": "Kính gửi {xung_ho},\n\nTiếp theo email giới thiệu trước, em xin gửi {anh_chi} danh sách nhạc được chọn phù hợp với nội dung của {cong_ty}: {playlist}\n\nĐể {anh_chi} dễ đánh giá hơn, nếu {cong_ty} gửi một video mẫu, em sẽ minh hoạ phương án nhạc nền cho chính video đó và gửi lại trong vòng 1–2 ngày làm việc, không phát sinh chi phí.\n\nEm xin cảm ơn và mong nhận được phản hồi của {anh_chi}.\n\nTrân trọng,\n{chu_ky}",
  "version": 4,
  "subject": "Epidemic Sound – Tư liệu tham khảo cho {cong_ty}"
 },
 {
  "step": 6,
  "channel": "call",
  "segment": "all",
  "title": "Kịch bản gọi lần 2 (đổi khung giờ)",
  "body": "• Gọi khác khung giờ lần 1 (8:30–9:30 hoặc 16:30–17:30).\n• \"Em gọi để hỏi {anh_chi} đã có dịp xem danh sách nhạc em gửi chưa ạ, và nội dung nào gần với nhu cầu của {cong_ty} nhất?\"\n• Nếu bận: \"Em xin phép gọi lại vào lúc nào thuận tiện cho {anh_chi} ạ?\" → ghi giờ vào Việc tiếp theo.",
  "version": 4
 },
 {
  "step": 7,
  "channel": "linkedin",
  "segment": "all",
  "title": "Tin nhắn LinkedIn",
  "body": "Em cảm ơn {anh_chi} đã kết nối. Em xin gửi danh sách nhạc tham khảo cho {cong_ty}: {playlist}\nNếu {anh_chi} cần thêm thông tin về giấy phép hoặc muốn xem demo, em rất sẵn lòng hỗ trợ.",
  "version": 4
 },
 {
  "step": 8,
  "channel": "email",
  "segment": "all",
  "title": "Email: thông tin pháp lý (ngày 10)",
  "body": "Kính gửi {xung_ho},\n\nEm xin phép chia sẻ thêm một điểm nhiều đơn vị sản xuất nội dung quan tâm: khi phát sóng, livestream hoặc trình chiếu tại sự kiện, ngoài giấy phép sử dụng bản nhạc còn có quyền biểu diễn trước công chúng, thường phải trả phí riêng cho Trung tâm/Hiệp hội tác quyền.\n\nVới mô hình Direct Licensing, Epidemic Sound sở hữu toàn bộ quyền đối với kho nhạc và đã thanh toán cho nhạc sĩ từ trước, nên quyền này được bao gồm trong giấy phép. {cong_ty} chỉ làm việc với một đầu mối duy nhất.\n\nNếu cần, em xin gửi bản tóm tắt pháp lý một trang để bộ phận pháp chế của {cong_ty} tham khảo.\n\nTrân trọng,\n{chu_ky}",
  "version": 4,
  "subject": "Epidemic Sound – Thông tin về quyền biểu diễn trước công chúng"
 },
 {
  "step": 9,
  "channel": "zalo",
  "segment": "all",
  "title": "Zalo: danh sách nhạc theo dự án",
  "body": "Dạ em chào {xung_ho}, em được biết {cong_ty} đang thực hiện [tên dự án / chương trình]. Em xin gửi danh sách nhạc tham khảo phù hợp với dự án: {playlist}\nHy vọng hữu ích cho đội sản xuất ạ.",
  "version": 4
 },
 {
  "step": 10,
  "channel": "call",
  "segment": "all",
  "title": "Kịch bản gọi lần 3",
  "body": "• \"Em xin phép hỏi ngắn gọn để không làm mất thời gian của {anh_chi}: trong quý tới {cong_ty} có dự án nào cần sử dụng âm nhạc không ạ?\"\n• Có → hẹn buổi giới thiệu 20 phút. Chưa → hỏi thời điểm lập ngân sách, ghi vào Việc tiếp theo.",
  "version": 4
 },
 {
  "step": 11,
  "channel": "email",
  "segment": "all",
  "title": "Email: đề xuất buổi giới thiệu (ngày 20)",
  "body": "Kính gửi {xung_ho},\n\nEm xin đề xuất một buổi giới thiệu trực tuyến khoảng 20 phút, trình bày trực tiếp trên nội dung của {cong_ty}:\n• Studio: gợi ý nhạc phù hợp với từng cảnh khi tải video lên.\n• Adapt: rút gọn bản nhạc thành 15s/30s/60s, tách vocal để chừa chỗ lồng tiếng.\n• Kho 250.000 hiệu ứng âm thanh tích hợp trong phần mềm dựng.\n\nEm xin đề xuất hai khung giờ: [Thứ …, …h] hoặc [Thứ …, …h]. Nếu chưa thuận tiện, rất mong {anh_chi} gợi ý thời gian khác.\n\nTrân trọng,\n{chu_ky}",
  "version": 4,
  "subject": "Đề xuất buổi giới thiệu 20 phút – Epidemic Sound và {cong_ty}"
 },
 {
  "step": 12,
  "channel": "email",
  "segment": "all",
  "title": "Email: xin phép tạm dừng (ngày 27)",
  "body": "Kính gửi {xung_ho},\n\nEm đã gửi một số thông tin về giải pháp âm nhạc của Epidemic Sound, nhưng có lẽ thời điểm này chưa phù hợp với {cong_ty}. Em xin phép tạm dừng liên hệ để không làm phiền {anh_chi}.\n\nNếu việc lựa chọn âm nhạc thuộc phụ trách của một bộ phận khác, em rất mong được {anh_chi} giới thiệu đầu mối phù hợp. Khi {cong_ty} có nhu cầu, em luôn sẵn sàng hỗ trợ.\n\nEm xin chân thành cảm ơn {anh_chi} đã dành thời gian.\n\nTrân trọng,\n{chu_ky}",
  "version": 4,
  "subject": "Epidemic Sound – Xin phép tạm dừng liên hệ"
 },
 {
  "step": 13,
  "channel": "email",
  "segment": "all",
  "title": "Email hẹn buổi trao đổi nhu cầu",
  "body": "Kính gửi {xung_ho},\n\nEm cảm ơn {anh_chi} đã phản hồi. Để đề xuất phương án phù hợp, em xin phép hẹn một buổi trao đổi khoảng 20 phút về nhu cầu sử dụng nhạc của {cong_ty}: loại nội dung, số lượng sản phẩm mỗi tháng và nền tảng phát hành.\n\nEm xin đề xuất: [Thứ …, …h] hoặc [Thứ …, …h], trực tuyến hoặc tại văn phòng {cong_ty}.\n\nTrân trọng,\n{chu_ky}",
  "version": 4,
  "subject": "Lịch trao đổi – Epidemic Sound và {cong_ty}"
 },
 {
  "step": 15,
  "channel": "email",
  "segment": "all",
  "title": "Email gửi đề xuất",
  "body": "Kính gửi {xung_ho},\n\nEm cảm ơn {anh_chi} đã dành thời gian trao đổi. Em xin gửi đề xuất chi tiết (đính kèm), tóm tắt như sau:\n• Phạm vi sử dụng: [số người dùng / kênh / nền tảng]\n• Phí giấy phép: [… USD/năm]\n• Thời gian bắt đầu: [ngày]\n\nKính mong {anh_chi} xem xét và cho em biết những điểm cần làm rõ. Em xin phép liên hệ lại vào [ngày] để trao đổi thêm.\n\nTrân trọng,\n{chu_ky}",
  "version": 4,
  "subject": "Đề xuất giải pháp Epidemic Sound cho {cong_ty}"
 },
 {
  "step": 16,
  "channel": "call",
  "segment": "all",
  "title": "Gọi theo dõi đề xuất",
  "body": "• \"Em xin phép hỏi {anh_chi} đã có dịp xem đề xuất em gửi chưa ạ, và có điểm nào cần điều chỉnh không?\"\n• Hỏi: ai tham gia phê duyệt, thời gian phê duyệt, có vướng mắc về ngân sách không.\n• Nếu khách băn khoăn → mở kho Xử lý từ chối.\n• Ghi rõ ngày phê duyệt vào Việc tiếp theo.",
  "version": 4
 },
 {
  "step": 90,
  "channel": "email",
  "segment": "all",
  "title": "Điểm chạm nuôi dưỡng (cập nhật, không chào bán)",
  "body": "Kính gửi {xung_ho},\n\nEm xin gửi {anh_chi} danh sách nhạc mới được tuyển chọn trong tháng, phù hợp với nội dung của {cong_ty}: {playlist}\n\nKhi {cong_ty} có dự án mới cần âm nhạc, em luôn sẵn sàng hỗ trợ.\n\nTrân trọng,\n{chu_ky}",
  "version": 4,
  "subject": "Epidemic Sound – Cập nhật âm nhạc tháng này cho {cong_ty}"
 }
]$json$::jsonb
$fn$;

-- Nút "Dùng bộ mới" trên trang Email mẫu: lịch bắt đầu bằng email + bộ mẫu mới nhất.
create or replace function public.apply_sales_defaults() returns void
language plpgsql security definer set search_path = '' as $fn$
begin
  if not public.is_admin() then
    raise exception 'Chỉ admin được thay lịch và nội dung soạn sẵn' using errcode = '42501';
  end if;
  update public.settings set value = public.default_cadence_v3() where key = 'cadence';
  update public.settings set value = public.default_message_templates_v4() where key = 'message_templates';
end $fn$;
revoke execute on function public.apply_sales_defaults() from public, anon;
grant execute on function public.apply_sales_defaults() to authenticated;

-- Tự thay nếu người dùng chưa sửa gì (chưa từng sửa, hoặc đang dùng nguyên bộ v3).
update public.settings
set value = public.default_message_templates_v4()
where key = 'message_templates'
  and (updated_by is null or value = public.default_message_templates_v3());
