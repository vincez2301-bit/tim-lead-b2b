-- Lịch tiếp cận bắt đầu bằng email (trước đây bước 1 là LinkedIn) và bộ email mẫu v3:
-- mở đầu bằng một câu về chính khách hàng, một lời mời cụ thể dễ trả lời, ngắn, tiêu đề gây tò mò.

create or replace function public.default_cadence_v3() returns jsonb
language sql immutable set search_path = '' as $fn$
  select $json$[
    {"step": 1,  "day": 0,  "channel": "email",    "title": "Email mở lời", "hint": "Câu đầu nói về nội dung gần đây của họ, gửi playlist chọn sẵn, hỏi một câu dễ trả lời."},
    {"step": 2,  "day": 0,  "channel": "linkedin", "title": "Kết nối LinkedIn", "hint": "Nhắc tới email vừa gửi."},
    {"step": 3,  "day": 1,  "channel": "call",     "title": "Gọi điện lần 1", "hint": "Không nghe máy → gửi Zalo ngay trong ngày."},
    {"step": 4,  "day": 2,  "channel": "zalo",     "title": "Zalo: gửi playlist chọn sẵn", "hint": "2–3 bài hợp nội dung họ đang làm; xin họ thả một biểu tượng cảm xúc nếu thấy hợp."},
    {"step": 5,  "day": 4,  "channel": "email",    "title": "Email: ghép thử nhạc vào video của khách", "hint": "Xin link một video gần đây, gửi lại bản so sánh trong 24 giờ."},
    {"step": 6,  "day": 6,  "channel": "call",     "title": "Gọi điện lần 2", "hint": "Đổi khung giờ so với lần 1."},
    {"step": 7,  "day": 7,  "channel": "linkedin", "title": "Nhắn tin LinkedIn", "hint": "Gửi playlist, nhắc lời mời ghép thử nhạc."},
    {"step": 8,  "day": 10, "channel": "email",    "title": "Email: phí tác quyền khi phát sóng, đăng mạng", "hint": "Quyền biểu diễn trước công chúng; mời nhận bản tóm tắt 1 trang."},
    {"step": 9,  "day": 13, "channel": "zalo",     "title": "Zalo: playlist theo dự án", "hint": "Tuyển chọn nhạc cho một dự án cụ thể của họ."},
    {"step": 10, "day": 16, "channel": "call",     "title": "Gọi điện lần 3", "hint": "Hỏi thẳng nhu cầu nhạc quý tới."},
    {"step": 11, "day": 20, "channel": "email",    "title": "Email: mời demo 15 phút trên video của khách", "hint": "Đưa 2 khung giờ cụ thể."},
    {"step": 12, "day": 27, "channel": "email",    "title": "Email chia tay: trả lời 1 – 2 – 3", "hint": "Không phản hồi sau bước này → chuyển Nuôi dưỡng."},
    {"step": 13, "day": 35, "channel": "meeting",  "title": "Buổi tìm hiểu nhu cầu", "hint": "Xác nhận 8 tiêu chí đánh giá."},
    {"step": 14, "day": 40, "channel": "meeting",  "title": "Demo sản phẩm", "hint": "Dùng nội dung thật của khách."},
    {"step": 15, "day": 44, "channel": "email",    "title": "Gửi đề xuất & báo giá", "hint": "Ghi ARR dự kiến và ngày chốt."},
    {"step": 16, "day": 48, "channel": "call",     "title": "Theo dõi đề xuất", "hint": "Hỏi phản hồi, ai cần duyệt."},
    {"step": 17, "day": 55, "channel": "meeting",  "title": "Gặp người quyết định", "hint": "Có người ủng hộ nội bộ đi cùng nếu được."},
    {"step": 18, "day": 60, "channel": "email",    "title": "Xử lý băn khoăn", "hint": "Giá, điều khoản, kỹ thuật — xem kho Xử lý từ chối."},
    {"step": 19, "day": 66, "channel": "meeting",  "title": "Ký hợp đồng", "hint": "Chuyển sang Thắng và bàn giao."}
  ]$json$::jsonb
$fn$;

create or replace function public.default_message_templates_v3() returns jsonb
language sql immutable set search_path = '' as $fn$
  select $json$[
    {"step": 1, "channel": "email", "segment": "broadcaster", "title": "Email mở lời — đài truyền hình",
     "subject": "Nhạc cho bản YouTube của {cong_ty}",
     "body": "Chào anh/chị {ten},\n\nEm vừa xem [tên chương trình / video gần đây] trên kênh của {cong_ty} — [một câu nhận xét thật, ví dụ: nhịp dựng rất nhanh, hợp xem trên điện thoại].\n\nNhiều đài gặp chung một chuyện khi đưa chương trình lên YouTube, Facebook: nhạc nền bị claim, video bị tắt tiếng, và phát sóng lại thì phát sinh phí tác quyền. Epidemic Sound sở hữu trọn quyền toàn bộ kho nhạc, kể cả quyền biểu diễn trước công chúng, nên {cong_ty} phát sóng hay đăng mạng đều không phải lo hai chuyện đó.\n\nEm chọn sẵn vài bài hợp với chương trình bên mình, nghe thử mất 2 phút: {playlist}\n\nNếu thấy hợp, em cắt sẵn bản 15s/30s cho phần intro và chuyển cảnh để đội dựng thử nhé?\n\nTrân trọng,\n{chu_ky}"},
    {"step": 1, "channel": "email", "segment": "mcn", "title": "Email mở lời — MCN / mạng creator",
     "subject": "Bớt claim nhạc cho creator của {cong_ty}",
     "body": "Chào anh/chị {ten},\n\nEm thấy {cong_ty} đang có [tên một creator / kênh nổi bật trong mạng lưới] — [một câu nhận xét thật về nội dung].\n\nVới MCN, việc tốn thời gian nhất thường là xử lý claim nhạc cho từng kênh. Epidemic Sound sở hữu trọn quyền kho nhạc, nên kênh đã kết nối giấy phép không bị claim; creator chọn bài là dùng được ngay trên YouTube, TikTok, Facebook.\n\nEm gửi vài bài đang được creator dùng nhiều: {playlist}\n\nAnh/chị có muốn em gửi cách các MCN khác đang cấp nhạc cho creator không ạ?\n\nTrân trọng,\n{chu_ky}"},
    {"step": 1, "channel": "email", "segment": "agency", "title": "Email mở lời — production house / agency",
     "subject": "Bớt một vòng sửa nhạc cho dự án của {cong_ty}",
     "body": "Chào anh/chị {ten},\n\nEm vừa xem [tên TVC / dự án gần đây] của {cong_ty} — [một câu nhận xét thật].\n\nỞ production house, nhạc thường là phần bị sửa nhiều vòng nhất: khách đổi ý, cần thêm bản 15s, 6s, rồi lại xin quyền cho từng dự án. Với Epidemic Sound, đội dựng có hơn 55.000 bài kèm stems; Adapt cắt một bài thành bản 15s/30s/60s trong vài giây; và giấy phép cho phép khách hàng của anh/chị đăng nội dung bên mình sản xuất.\n\nEm chọn thử vài bài hợp phong cách bên mình: {playlist}\n\nDự án tới của {cong_ty} là gì ạ? Em chọn sát hơn và cắt sẵn một bản để đội dựng thử.\n\nTrân trọng,\n{chu_ky}"},
    {"step": 1, "channel": "email", "segment": "film", "title": "Email mở lời — hãng phim / hậu kỳ",
     "subject": "Nhạc cho trailer dự án mới của {cong_ty}",
     "body": "Chào anh/chị {ten},\n\nEm thấy {cong_ty} đang có [tên phim / dự án sắp ra mắt] — [một câu nhận xét thật].\n\nTrailer, teaser và clip quảng bá thường cần nhạc nhanh, nhiều phiên bản, và đăng được trên mọi nền tảng. Epidemic Sound có kho nhạc điện ảnh kèm stems để hậu kỳ phối lại tự do, file WAV 24-bit/48 kHz, và quyền biểu diễn trước công chúng đã gồm sẵn.\n\nEm chọn vài bài hợp không khí dự án: {playlist}\n\nNếu hợp, em gửi thêm bài theo từng cảnh để anh/chị chọn nhé?\n\nTrân trọng,\n{chu_ky}"},
    {"step": 1, "channel": "email", "segment": "brand", "title": "Email mở lời — nhãn hàng",
     "subject": "Âm thanh nhận diện cho {cong_ty}",
     "body": "Chào anh/chị {ten},\n\nEm vừa xem [tên chiến dịch / video gần đây] của {cong_ty} — [một câu nhận xét thật].\n\nNhiều thương hiệu dùng mỗi video một kiểu nhạc, nên khán giả nhớ hình mà không nhớ âm thanh. Epidemic Sound giúp đội marketing và agency dùng chung một kho nhạc đã có giấy phép cho mọi kênh — social, quảng cáo, sự kiện — và giữ một chất âm nhất quán cho thương hiệu.\n\nEm chọn thử vài bài hợp tinh thần {cong_ty}: {playlist}\n\nAnh/chị có muốn em gợi ý 3 bài làm âm thanh nhận diện cho quý tới không ạ?\n\nTrân trọng,\n{chu_ky}"},

    {"step": 2, "channel": "linkedin", "segment": "all", "title": "Kết nối LinkedIn (≤ 300 ký tự)",
     "body": "Chào {ten}, em là {nguoi_gui} ở Epidemic Sound. Em vừa gửi anh/chị email về nhạc cho nội dung của {cong_ty} — kết nối ở đây để tiện trao đổi ạ."},

    {"step": 3, "channel": "call", "segment": "all", "title": "Kịch bản gọi lần 1",
     "body": "• Mở lời (10 giây): \"Chào anh/chị {ten}, em {nguoi_gui} bên Epidemic Sound. Hôm qua em gửi anh/chị vài bài nhạc chọn riêng cho {cong_ty} — anh/chị cho em 1 phút được không ạ?\"\n• Hỏi 1 câu: \"Hiện bên mình chọn nhạc cho video thế nào ạ? Có hay bị claim hoặc phải trả phí tác quyền riêng không?\"\n• Chốt nhẹ: \"Anh/chị gửi em link một video gần đây, em ghép thử nhạc để anh/chị so sánh nhé?\"\n• Không nghe máy → gửi Zalo ngay trong ngày."},

    {"step": 4, "channel": "zalo", "segment": "all", "title": "Zalo: playlist chọn sẵn",
     "body": "Chào anh/chị {ten}, em là {nguoi_gui} bên Epidemic Sound ạ. Em có gửi email, em gửi nhanh qua đây vài bài em chọn cho {cong_ty}, nghe trên điện thoại 1 phút là thấy: {playlist}\nBài nào hợp, anh/chị thả giúp em một biểu tượng cảm xúc để em chọn thêm kiểu tương tự nhé!"},

    {"step": 5, "channel": "email", "segment": "all", "title": "Email: ghép thử nhạc vào video của khách (ngày 4)",
     "subject": "Ghép thử nhạc vào video của {cong_ty}?",
     "body": "Chào anh/chị {ten},\n\nEm có ý này để anh/chị dễ hình dung hơn một playlist: anh/chị gửi em link một video gần đây của {cong_ty}, em ghép thử nhạc Epidemic Sound vào đúng đoạn đó và gửi lại bản so sánh trong 24 giờ.\n\nKhông mất phí, không cần cài đặt gì. Anh/chị thấy được không ạ?\n\nTrân trọng,\n{chu_ky}"},

    {"step": 6, "channel": "call", "segment": "all", "title": "Kịch bản gọi lần 2 (đổi khung giờ)",
     "body": "• Gọi khác giờ lần 1 (8:30–9:30 hoặc 16:30–17:30).\n• \"Em gọi lại về mấy bài nhạc em gửi hôm trước — anh/chị nghe thử chưa ạ? Bài nào gần với nội dung bên mình nhất?\"\n• Bận: \"Khi nào em gọi lại tiện nhất ạ?\" → ghi giờ vào Việc tiếp theo."},

    {"step": 7, "channel": "linkedin", "segment": "all", "title": "Tin nhắn LinkedIn",
     "body": "Cảm ơn {ten} đã kết nối! Em để ở đây playlist em chọn riêng cho {cong_ty}: {playlist}\nNếu anh/chị gửi em một video gần đây, em ghép thử nhạc để anh/chị so sánh nhé."},

    {"step": 8, "channel": "email", "segment": "all", "title": "Email: phí tác quyền khi phát sóng, đăng mạng (ngày 10)",
     "subject": "Vì sao nhạc đã mua vẫn bị claim",
     "body": "Chào anh/chị {ten},\n\nMột chuyện em hay gặp ở các đơn vị làm nội dung: nhạc đã mua bản quyền vẫn bị claim trên YouTube, hoặc phát sinh phí với Trung tâm tác quyền khi phát sóng, livestream, chiếu ở sự kiện — vì giấy phép bài nhạc chưa gồm quyền biểu diễn trước công chúng.\n\nNhạc Epidemic Sound đã gồm sẵn quyền này: Epidemic sở hữu trọn quyền và trả cho nghệ sĩ từ đầu, nên {cong_ty} chỉ làm việc với một bên duy nhất.\n\nEm có bản tóm tắt 1 trang để đội pháp chế hoặc sản xuất xem nhanh. Em gửi anh/chị nhé?\n\nTrân trọng,\n{chu_ky}"},

    {"step": 9, "channel": "zalo", "segment": "all", "title": "Zalo: playlist theo dự án",
     "body": "Anh/chị {ten} ơi, em thấy {cong_ty} vừa có [tên dự án / chương trình] — em chọn thử playlist hợp không khí dự án này: {playlist}\nAnh/chị nghe 1–2 bài xem có hợp không nhé!"},

    {"step": 10, "channel": "call", "segment": "all", "title": "Kịch bản gọi lần 3",
     "body": "• \"Em hỏi thẳng để không làm mất thời gian của anh/chị: quý tới bên mình có dự án nào cần nhạc không ạ?\"\n• Có → hẹn demo 15 phút trên video của họ. Chưa → hỏi tháng lên ngân sách, ghi vào Việc tiếp theo."},

    {"step": 11, "channel": "email", "segment": "all", "title": "Email: mời demo 15 phút (ngày 20)",
     "subject": "Chọn nhạc cho một video trong 2 phút",
     "body": "Chào anh/chị {ten},\n\nĐội dựng thường mất cả buổi để tìm một bài vừa ý. Với Epidemic Sound: tải video lên Studio là có gợi ý nhạc khớp từng cảnh; Adapt cắt bài thành bản 15s/30s/60s và bỏ vocal để chừa chỗ lồng tiếng.\n\nEm demo 15 phút ngay trên một video của {cong_ty} được không ạ? Anh/chị chọn giúp em một khung giờ: [Thứ …, …h] hoặc [Thứ …, …h].\n\nTrân trọng,\n{chu_ky}"},

    {"step": 12, "channel": "email", "segment": "all", "title": "Email chia tay: trả lời 1 – 2 – 3 (ngày 27)",
     "subject": "Em có nên dừng ở đây không ạ?",
     "body": "Chào anh/chị {ten},\n\nEm đã liên hệ vài lần mà chưa nghe phản hồi, nên em đoán là chưa đúng lúc hoặc chưa đúng người. Anh/chị trả lời giúp em một số thôi cũng được:\n\n1 – Chưa phải lúc, liên hệ lại sau vài tháng\n2 – Người khác phụ trách nhạc (cho em xin tên nhé)\n3 – Không quan tâm, em sẽ không làm phiền nữa\n\nCảm ơn anh/chị nhiều!\n{chu_ky}"},

    {"step": 13, "channel": "email", "segment": "all", "title": "Email hẹn buổi tìm hiểu nhu cầu",
     "subject": "20 phút về nhạc của {cong_ty}",
     "body": "Chào anh/chị {ten},\n\nCảm ơn anh/chị đã phản hồi! Em xin 20 phút để hiểu cách {cong_ty} đang dùng nhạc (loại nội dung, số video mỗi tháng, nền tảng phát), rồi đề xuất gói vừa đúng nhu cầu — không thừa.\n\nAnh/chị tiện khung nào ạ: [Thứ …, …h] hoặc [Thứ …, …h]?\n\nTrân trọng,\n{chu_ky}"},

    {"step": 15, "channel": "email", "segment": "all", "title": "Email gửi đề xuất",
     "subject": "Đề xuất cho {cong_ty} — gọn trong 1 trang",
     "body": "Chào anh/chị {ten},\n\nEm gửi đề xuất theo buổi trao đổi vừa rồi (đính kèm). Tóm tắt:\n• Phạm vi: [số người dùng / kênh / nền tảng]\n• Chi phí: [… USD/năm]\n• Bắt đầu: [ngày]\n\nAnh/chị xem giúp em và cho em biết cần làm rõ điểm nào. Em sẽ gọi lại vào [ngày] để trao đổi tiếp.\n\nTrân trọng,\n{chu_ky}"},

    {"step": 16, "channel": "call", "segment": "all", "title": "Gọi theo dõi đề xuất",
     "body": "• \"Anh/chị đã xem đề xuất em gửi chưa ạ? Có điểm nào cần điều chỉnh không?\"\n• Hỏi: ai cần duyệt, khi nào duyệt, có vướng ngân sách không.\n• Khách băn khoăn → mở kho Xử lý từ chối.\n• Ghi rõ ngày duyệt vào Việc tiếp theo."},

    {"step": 90, "channel": "email", "segment": "all", "title": "Điểm chạm nuôi dưỡng (giá trị, không chào bán)",
     "subject": "Vài bài mới hợp với {cong_ty} tháng này",
     "body": "Chào anh/chị {ten},\n\nEm gửi anh/chị vài bài mới tuyển chọn tháng này, hợp với nội dung bên mình: {playlist}\n\nKhông cần trả lời đâu ạ — khi nào {cong_ty} có dự án mới cần nhạc, anh/chị nhắn em nhé.\n\nTrân trọng,\n{chu_ky}"}
  ]$json$::jsonb
$fn$;

-- Admin bấm "Dùng bộ email mới" trên trang Email mẫu: áp dụng cả lịch lẫn mẫu (ghi đè bản đã sửa).
create or replace function public.apply_sales_defaults_v3() returns void
language plpgsql security definer set search_path = '' as $fn$
begin
  if not public.is_admin() then
    raise exception 'Chỉ admin được thay lịch và nội dung soạn sẵn' using errcode = '42501';
  end if;
  update public.settings set value = public.default_cadence_v3() where key = 'cadence';
  update public.settings set value = public.default_message_templates_v3() where key = 'message_templates';
end $fn$;
revoke execute on function public.apply_sales_defaults_v3() from public, anon;
grant execute on function public.apply_sales_defaults_v3() to authenticated;

-- Tự áp dụng khi người dùng chưa tự sửa lịch hoặc nội dung soạn sẵn (updated_by is null).
do $$
begin
  if exists (select 1 from public.settings where key = 'cadence' and updated_by is null)
     and exists (select 1 from public.settings where key = 'message_templates' and updated_by is null) then
    update public.settings set value = public.default_cadence_v3() where key = 'cadence';
    update public.settings set value = public.default_message_templates_v3() where key = 'message_templates';
  end if;
end $$;
