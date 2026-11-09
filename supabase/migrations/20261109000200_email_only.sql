-- Chỉ tiếp cận bằng email (spec 002): lịch v5 (6 email chặng tiếp cận + chặng chốt 13–19 qua email) và bộ email mẫu v6
-- (6 email × 5 nhóm khách, mỗi email một lý do để dùng Epidemic Sound; email theo dõi giữ tiêu đề "Re: …").
-- Biến mới: {cau_rieng} (câu riêng về khách, app tự điền từ kênh YouTube; thiếu dữ liệu thì để chỗ trống đánh dấu)
-- và {tieu_de_dau} (tiêu đề email mở lời, để email theo dõi trả lời trong cùng luồng).
-- Lịch và mẫu đang dùng được sao lưu (cadence_backup_v4, message_templates_backup_v4) rồi thay bằng bản mới.
-- Khách đang tiếp cận: chuyển sang email kế tiếp theo số email đã gửi (không mất lịch sử điểm chạm).

create or replace function public.default_cadence_v5() returns jsonb
language sql immutable set search_path = '' as $fn$
  select $json$[
 {
  "step": 1,
  "day": 0,
  "channel": "email",
  "title": "Email mở lời",
  "hint": "Một câu riêng về khách + 2 lợi ích đúng nhóm + playlist; hỏi một câu dễ trả lời."
 },
 {
  "step": 2,
  "day": 3,
  "channel": "email",
  "title": "Email theo dõi 1: rủi ro bản quyền",
  "hint": "Trả lời trong luồng email mở lời (tiêu đề Re:)."
 },
 {
  "step": 3,
  "day": 7,
  "channel": "email",
  "title": "Email theo dõi 2: thử nhạc miễn phí trên video của khách",
  "hint": "Khách gửi link video → gửi lại 3 lựa chọn nhạc trong 1–2 ngày."
 },
 {
  "step": 4,
  "day": 12,
  "channel": "email",
  "title": "Email theo dõi 3: quyền biểu diễn trước công chúng",
  "hint": "Đề nghị gửi bản tóm tắt pháp lý một trang."
 },
 {
  "step": 5,
  "day": 18,
  "channel": "email",
  "title": "Email theo dõi 4: đơn vị cùng ngành dùng thế nào",
  "hint": "Chỉ dùng ví dụ công khai."
 },
 {
  "step": 6,
  "day": 26,
  "channel": "email",
  "title": "Email chia tay lịch sự",
  "hint": "Không phản hồi sau email này → chuyển Nuôi dưỡng."
 },
 {
  "step": 13,
  "day": 35,
  "channel": "email",
  "title": "Hỏi nhu cầu (3 câu hỏi)",
  "hint": "Khách muốn thì hẹn gọi online 20 phút."
 },
 {
  "step": 14,
  "day": 40,
  "channel": "email",
  "title": "Gửi minh hoạ nhạc trên nội dung của khách",
  "hint": "3 lựa chọn nhạc + video hướng dẫn ngắn."
 },
 {
  "step": 15,
  "day": 44,
  "channel": "email",
  "title": "Gửi đề xuất & báo giá",
  "hint": "Ghi ARR dự kiến và ngày chốt."
 },
 {
  "step": 16,
  "day": 48,
  "channel": "email",
  "title": "Email theo dõi đề xuất",
  "hint": "Hỏi ai duyệt, khi nào quyết định."
 },
 {
  "step": 17,
  "day": 55,
  "channel": "email",
  "title": "Email tóm tắt cho người phê duyệt",
  "hint": "Bản tóm tắt để khách chuyển tiếp."
 },
 {
  "step": 18,
  "day": 60,
  "channel": "email",
  "title": "Trả lời băn khoăn",
  "hint": "Giá, điều khoản, kỹ thuật — xem kho Xử lý từ chối."
 },
 {
  "step": 19,
  "day": 66,
  "channel": "email",
  "title": "Gửi hợp đồng",
  "hint": "Chuyển sang Thắng và bàn giao."
 }
]$json$::jsonb
$fn$;

create or replace function public.default_message_templates_v6() returns jsonb
language sql immutable set search_path = '' as $fn$
  select $json$[
 {
  "step": 1,
  "channel": "email",
  "segment": "broadcaster",
  "title": "Email mở lời — đài truyền hình",
  "subject": "Nhạc bản quyền cho chương trình của {cong_ty}",
  "body": "Kính gửi {xung_ho},\n\n{cau_rieng}\n\nEm là {nguoi_gui}, {chuc_danh} của Epidemic Sound tại Việt Nam — nhà cung cấp nhạc thư viện lớn nhất cho các đài truyền hình lớn tại Bắc Âu. Hai điểm có thể hữu ích với {cong_ty}:\n• Phát sóng và đăng lại lên YouTube, Facebook yên tâm: đã gồm quyền biểu diễn trước công chúng, không phát sinh phí với Trung tâm/Hiệp hội tác quyền.\n• Hơn 55.000 bản nhạc, 250.000 hiệu ứng âm thanh cho bản tin, gameshow, phim truyền hình.\n\nNhạc tham khảo cho tin tức – giải trí: {playlist}\n\nCho em hỏi hiện các chương trình của {cong_ty} đang lấy nhạc nền từ nguồn nào ạ? Nếu không phải {anh_chi} phụ trách, mong {anh_chi} chỉ giúp em.\n\nTrân trọng,\n{chu_ky}",
  "version": 6
 },
 {
  "step": 2,
  "channel": "email",
  "segment": "broadcaster",
  "title": "Theo dõi 1: rủi ro bản quyền — đài truyền hình",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nEm xin phép nhắc lại email hôm trước, kèm một điểm nhiều đài truyền hình đang gặp: chương trình đăng lại lên YouTube, Facebook bị claim hoặc tắt tiếng vì nhạc nền, và phí quyền biểu diễn tính riêng khi phát sóng.\n\nVới Epidemic Sound, việc phát sóng, đăng tải và quyền biểu diễn trước công chúng nằm trong cùng một giấy phép; {cong_ty} chỉ làm việc với một đầu mối.\n\nNếu hữu ích, em gửi {anh_chi} bản tóm tắt một trang về cách giấy phép áp dụng cho phát sóng và kênh số nhé?\n\nTrân trọng,\n{chu_ky}",
  "version": 6
 },
 {
  "step": 3,
  "channel": "email",
  "segment": "broadcaster",
  "title": "Theo dõi 2: thử nhạc miễn phí — đài truyền hình",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nĐể {anh_chi} dễ hình dung, em xin đề nghị một việc nhỏ, không phát sinh chi phí: {anh_chi} gửi em link một chương trình hoặc đoạn giới thiệu chương trình gần đây của {cong_ty}, em sẽ chọn 3 phương án nhạc nền phù hợp từ kho Epidemic Sound và gửi lại trong 1–2 ngày làm việc.\n\nChỉ cần trả lời email này kèm đường link là được ạ.\n\nTrân trọng,\n{chu_ky}",
  "version": 6
 },
 {
  "step": 4,
  "channel": "email",
  "segment": "broadcaster",
  "title": "Theo dõi 3: quyền biểu diễn trước công chúng — đài truyền hình",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nMột điểm pháp lý nhiều đài truyền hình tại Việt Nam quan tâm: khi phát sóng hoặc phát lại chương trình, ngoài giấy phép sử dụng bản nhạc còn có quyền biểu diễn trước công chúng, thường phải trả phí riêng cho Trung tâm/Hiệp hội tác quyền.\n\nVới mô hình Direct Licensing, Epidemic Sound sở hữu toàn bộ quyền đối với kho nhạc và đã thanh toán cho nhạc sĩ từ trước, nên quyền này đã nằm trong giấy phép.\n\nEm gửi {anh_chi} bản tóm tắt pháp lý một trang để bộ phận pháp chế của {cong_ty} tham khảo nhé?\n\nTrân trọng,\n{chu_ky}",
  "version": 6
 },
 {
  "step": 5,
  "channel": "email",
  "segment": "broadcaster",
  "title": "Theo dõi 4: đơn vị cùng ngành dùng thế nào — đài truyền hình",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nEm xin chia sẻ cách các đài truyền hình đang dùng Epidemic Sound: đội sản xuất chọn nhạc theo thể loại chương trình, rút gọn bằng Adapt cho các đoạn chuyển cảnh và dùng một giấy phép cho cả phát sóng lẫn kênh số. Epidemic Sound (Thuỵ Điển, từ 2009) hiện có khách hàng ở gần 200 quốc gia.\n\nNếu {anh_chi} muốn, em gửi 2–3 ví dụ chương trình truyền hình dùng nhạc Epidemic Sound để {anh_chi} nghe thử chất lượng nhạc.\n\nTrân trọng,\n{chu_ky}",
  "version": 6
 },
 {
  "step": 6,
  "channel": "email",
  "segment": "broadcaster",
  "title": "Chia tay lịch sự — đài truyền hình",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nEm đã gửi vài email về nhạc bản quyền cho {cong_ty} nhưng chưa nhận được phản hồi, có lẽ thời điểm này chưa phù hợp. Em xin phép tạm dừng để không làm phiền {anh_chi}.\n\nTrước khi dừng, cho em hỏi một câu: việc chọn nhạc cho các chương trình của {cong_ty} do ai phụ trách ạ? Nếu {anh_chi} giới thiệu giúp đúng người, em rất cảm ơn.\n\nKhi {cong_ty} cần nhạc cho dự án mới, em luôn sẵn sàng hỗ trợ.\n\nTrân trọng,\n{chu_ky}",
  "version": 6
 },
 {
  "step": 1,
  "channel": "email",
  "segment": "mcn",
  "title": "Email mở lời — MCN",
  "subject": "Giảm claim nhạc cho các kênh của {cong_ty}",
  "body": "Kính gửi {xung_ho},\n\n{cau_rieng}\n\nEm là {nguoi_gui}, {chuc_danh} của Epidemic Sound tại Việt Nam — nhà cung cấp nhạc thư viện lớn nhất cho các đài truyền hình lớn tại Bắc Âu. Hai điểm có thể hữu ích với {cong_ty}:\n• Các kênh được kết nối giấy phép dùng nhạc trên YouTube, TikTok, Facebook không lo bị claim hay mất doanh thu quảng cáo.\n• Creator tự chọn trong hơn 55.000 bản nhạc đã cấp phép; đội vận hành không phải xử lý khiếu nại cho từng video.\n\nNhạc tham khảo cho vlog, gaming, giải trí: {playlist}\n\nCho em hỏi hiện creator trong mạng lưới của {cong_ty} thường lấy nhạc nền từ đâu ạ? Nếu không phải {anh_chi} phụ trách, mong {anh_chi} chỉ giúp em.\n\nTrân trọng,\n{chu_ky}",
  "version": 6
 },
 {
  "step": 2,
  "channel": "email",
  "segment": "mcn",
  "title": "Theo dõi 1: rủi ro bản quyền — MCN",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nEm xin phép nhắc lại email hôm trước, kèm một điểm nhiều MCN đang gặp: video của creator trong mạng lưới bị claim, mất doanh thu quảng cáo, và đội vận hành phải kháng nghị cho từng video.\n\nKhi các kênh được kết nối giấy phép Epidemic Sound, nhạc trong kho được dùng trên YouTube, TikTok, Facebook mà không lo bị claim.\n\nNếu hữu ích, em gửi {anh_chi} bản tóm tắt một trang về cách kết nối giấy phép cho các kênh trong mạng lưới nhé?\n\nTrân trọng,\n{chu_ky}",
  "version": 6
 },
 {
  "step": 3,
  "channel": "email",
  "segment": "mcn",
  "title": "Theo dõi 2: thử nhạc miễn phí — MCN",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nĐể {anh_chi} dễ hình dung, em xin đề nghị một việc nhỏ, không phát sinh chi phí: {anh_chi} gửi em link video của một kênh trong mạng lưới gần đây của {cong_ty}, em sẽ chọn 3 phương án nhạc nền phù hợp từ kho Epidemic Sound và gửi lại trong 1–2 ngày làm việc.\n\nChỉ cần trả lời email này kèm đường link là được ạ.\n\nTrân trọng,\n{chu_ky}",
  "version": 6
 },
 {
  "step": 4,
  "channel": "email",
  "segment": "mcn",
  "title": "Theo dõi 3: quyền biểu diễn trước công chúng — MCN",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nMột điểm pháp lý nhiều MCN tại Việt Nam quan tâm: khi creator livestream hoặc video được trình chiếu tại sự kiện, ngoài giấy phép sử dụng bản nhạc còn có quyền biểu diễn trước công chúng, thường phải trả phí riêng cho Trung tâm/Hiệp hội tác quyền.\n\nVới mô hình Direct Licensing, Epidemic Sound sở hữu toàn bộ quyền đối với kho nhạc và đã thanh toán cho nhạc sĩ từ trước, nên quyền này đã nằm trong giấy phép.\n\nEm gửi {anh_chi} bản tóm tắt pháp lý một trang để bộ phận pháp chế của {cong_ty} tham khảo nhé?\n\nTrân trọng,\n{chu_ky}",
  "version": 6
 },
 {
  "step": 5,
  "channel": "email",
  "segment": "mcn",
  "title": "Theo dõi 4: đơn vị cùng ngành dùng thế nào — MCN",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nEm xin chia sẻ cách các MCN đang dùng Epidemic Sound: creator tự tìm nhạc theo tâm trạng, nhịp độ ngay trong kho đã cấp phép, còn đội vận hành chỉ quản lý một giấy phép cho cả mạng lưới. Epidemic Sound (Thuỵ Điển, từ 2009) hiện có khách hàng ở gần 200 quốc gia.\n\nNếu {anh_chi} muốn, em gửi 2–3 ví dụ kênh YouTube, TikTok dùng nhạc Epidemic Sound để {anh_chi} nghe thử chất lượng nhạc.\n\nTrân trọng,\n{chu_ky}",
  "version": 6
 },
 {
  "step": 6,
  "channel": "email",
  "segment": "mcn",
  "title": "Chia tay lịch sự — MCN",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nEm đã gửi vài email về nhạc bản quyền cho {cong_ty} nhưng chưa nhận được phản hồi, có lẽ thời điểm này chưa phù hợp. Em xin phép tạm dừng để không làm phiền {anh_chi}.\n\nTrước khi dừng, cho em hỏi một câu: việc chọn nhạc cho các kênh trong mạng lưới của {cong_ty} do ai phụ trách ạ? Nếu {anh_chi} giới thiệu giúp đúng người, em rất cảm ơn.\n\nKhi {cong_ty} cần nhạc cho dự án mới, em luôn sẵn sàng hỗ trợ.\n\nTrân trọng,\n{chu_ky}",
  "version": 6
 },
 {
  "step": 1,
  "channel": "email",
  "segment": "agency",
  "title": "Email mở lời — production house / agency",
  "subject": "Nhạc bản quyền cho TVC và video của {cong_ty}",
  "body": "Kính gửi {xung_ho},\n\n{cau_rieng}\n\nEm là {nguoi_gui}, {chuc_danh} của Epidemic Sound tại Việt Nam — nhà cung cấp nhạc thư viện lớn nhất cho các đài truyền hình lớn tại Bắc Âu. Hai điểm có thể hữu ích với {cong_ty}:\n• Một giấy phép năm cho TVC, video doanh nghiệp, sự kiện; khách hàng của {cong_ty} được đăng tải nội dung {cong_ty} sản xuất.\n• Có stems và công cụ Adapt rút gọn bản nhạc thành 15s/30s/60s — khách đổi thời lượng vẫn sửa kịp.\n\nNhạc tham khảo cho TVC và video doanh nghiệp: {playlist}\n\nCho em hỏi hiện các dự án của {cong_ty} đang mua nhạc theo từng bài hay dùng thư viện nào ạ? Nếu không phải {anh_chi} phụ trách, mong {anh_chi} chỉ giúp em.\n\nTrân trọng,\n{chu_ky}",
  "version": 6
 },
 {
  "step": 2,
  "channel": "email",
  "segment": "agency",
  "title": "Theo dõi 1: rủi ro bản quyền — production house / agency",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nEm xin phép nhắc lại email hôm trước, kèm một điểm nhiều production house / agency đang gặp: TVC hoặc video bàn giao bị claim, tắt tiếng sau khi khách đăng — khách hàng phàn nàn với agency dù lỗi nằm ở nguồn nhạc.\n\nGiấy phép năm của Epidemic Sound cho phép khách hàng của {cong_ty} đăng tải nội dung {cong_ty} sản xuất, nên mỗi dự án bàn giao đều có nguồn nhạc rõ ràng.\n\nNếu hữu ích, em gửi {anh_chi} bản tóm tắt một trang về phạm vi giấy phép cho nội dung làm cho khách hàng nhé?\n\nTrân trọng,\n{chu_ky}",
  "version": 6
 },
 {
  "step": 3,
  "channel": "email",
  "segment": "agency",
  "title": "Theo dõi 2: thử nhạc miễn phí — production house / agency",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nĐể {anh_chi} dễ hình dung, em xin đề nghị một việc nhỏ, không phát sinh chi phí: {anh_chi} gửi em link TVC hoặc video doanh nghiệp gần đây của {cong_ty}, em sẽ chọn 3 phương án nhạc nền phù hợp từ kho Epidemic Sound và gửi lại trong 1–2 ngày làm việc.\n\nChỉ cần trả lời email này kèm đường link là được ạ.\n\nTrân trọng,\n{chu_ky}",
  "version": 6
 },
 {
  "step": 4,
  "channel": "email",
  "segment": "agency",
  "title": "Theo dõi 3: quyền biểu diễn trước công chúng — production house / agency",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nMột điểm pháp lý nhiều production house / agency tại Việt Nam quan tâm: khi phát TVC trên truyền hình hoặc trình chiếu video tại sự kiện, ngoài giấy phép sử dụng bản nhạc còn có quyền biểu diễn trước công chúng, thường phải trả phí riêng cho Trung tâm/Hiệp hội tác quyền.\n\nVới mô hình Direct Licensing, Epidemic Sound sở hữu toàn bộ quyền đối với kho nhạc và đã thanh toán cho nhạc sĩ từ trước, nên quyền này đã nằm trong giấy phép.\n\nEm gửi {anh_chi} bản tóm tắt pháp lý một trang để bộ phận pháp chế của {cong_ty} tham khảo nhé?\n\nTrân trọng,\n{chu_ky}",
  "version": 6
 },
 {
  "step": 5,
  "channel": "email",
  "segment": "agency",
  "title": "Theo dõi 4: đơn vị cùng ngành dùng thế nào — production house / agency",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nEm xin chia sẻ cách các production house / agency đang dùng Epidemic Sound: editor tải stems để phối lại theo nhịp dựng và cắt bản 15s/30s/60s bằng Adapt khi khách đổi thời lượng. Epidemic Sound (Thuỵ Điển, từ 2009) hiện có khách hàng ở gần 200 quốc gia.\n\nNếu {anh_chi} muốn, em gửi 2–3 ví dụ TVC, video doanh nghiệp dùng nhạc Epidemic Sound để {anh_chi} nghe thử chất lượng nhạc.\n\nTrân trọng,\n{chu_ky}",
  "version": 6
 },
 {
  "step": 6,
  "channel": "email",
  "segment": "agency",
  "title": "Chia tay lịch sự — production house / agency",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nEm đã gửi vài email về nhạc bản quyền cho {cong_ty} nhưng chưa nhận được phản hồi, có lẽ thời điểm này chưa phù hợp. Em xin phép tạm dừng để không làm phiền {anh_chi}.\n\nTrước khi dừng, cho em hỏi một câu: việc chọn nhạc cho các dự án của {cong_ty} do ai phụ trách ạ? Nếu {anh_chi} giới thiệu giúp đúng người, em rất cảm ơn.\n\nKhi {cong_ty} cần nhạc cho dự án mới, em luôn sẵn sàng hỗ trợ.\n\nTrân trọng,\n{chu_ky}",
  "version": 6
 },
 {
  "step": 1,
  "channel": "email",
  "segment": "film",
  "title": "Email mở lời — hãng phim / hậu kỳ",
  "subject": "Nhạc và hiệu ứng âm thanh cho dự án của {cong_ty}",
  "body": "Kính gửi {xung_ho},\n\n{cau_rieng}\n\nEm là {nguoi_gui}, {chuc_danh} của Epidemic Sound tại Việt Nam — nhà cung cấp nhạc thư viện lớn nhất cho các đài truyền hình lớn tại Bắc Âu. Hai điểm có thể hữu ích với {cong_ty}:\n• Nhạc chuẩn điện ảnh, có stems, WAV 24-bit/48 kHz; kèm 250.000 hiệu ứng âm thanh cho hậu kỳ.\n• Quyền dùng rõ ràng cho phim, trailer, teaser trên mọi nền tảng, đã gồm quyền biểu diễn trước công chúng.\n\nNhạc tham khảo cho trailer và phim: {playlist}\n\nCho em hỏi hiện {cong_ty} xử lý nhạc nền cho trailer và nội dung quảng bá như thế nào ạ? Nếu không phải {anh_chi} phụ trách, mong {anh_chi} chỉ giúp em.\n\nTrân trọng,\n{chu_ky}",
  "version": 6
 },
 {
  "step": 2,
  "channel": "email",
  "segment": "film",
  "title": "Theo dõi 1: rủi ro bản quyền — hãng phim / hậu kỳ",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nEm xin phép nhắc lại email hôm trước, kèm một điểm nhiều hãng phim / hậu kỳ đang gặp: khi phát hành trên nền tảng trực tuyến, nhạc nền không rõ nguồn dễ bị claim hoặc phải thay nhạc vào phút chót.\n\nEpidemic Sound sở hữu 100% quyền với toàn bộ kho nhạc, gồm cả quyền biểu diễn trước công chúng, nên quyền dùng cho phim, trailer, teaser trên mọi nền tảng được xác định ngay từ đầu.\n\nNếu hữu ích, em gửi {anh_chi} bản tóm tắt một trang về quyền sử dụng nhạc cho phim, trailer và nội dung quảng bá nhé?\n\nTrân trọng,\n{chu_ky}",
  "version": 6
 },
 {
  "step": 3,
  "channel": "email",
  "segment": "film",
  "title": "Theo dõi 2: thử nhạc miễn phí — hãng phim / hậu kỳ",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nĐể {anh_chi} dễ hình dung, em xin đề nghị một việc nhỏ, không phát sinh chi phí: {anh_chi} gửi em link trailer hoặc một cảnh phim gần đây của {cong_ty}, em sẽ chọn 3 phương án nhạc nền phù hợp từ kho Epidemic Sound và gửi lại trong 1–2 ngày làm việc.\n\nChỉ cần trả lời email này kèm đường link là được ạ.\n\nTrân trọng,\n{chu_ky}",
  "version": 6
 },
 {
  "step": 4,
  "channel": "email",
  "segment": "film",
  "title": "Theo dõi 3: quyền biểu diễn trước công chúng — hãng phim / hậu kỳ",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nMột điểm pháp lý nhiều hãng phim / hậu kỳ tại Việt Nam quan tâm: khi chiếu phim, phát trailer tại sự kiện hoặc trên truyền hình, ngoài giấy phép sử dụng bản nhạc còn có quyền biểu diễn trước công chúng, thường phải trả phí riêng cho Trung tâm/Hiệp hội tác quyền.\n\nVới mô hình Direct Licensing, Epidemic Sound sở hữu toàn bộ quyền đối với kho nhạc và đã thanh toán cho nhạc sĩ từ trước, nên quyền này đã nằm trong giấy phép.\n\nEm gửi {anh_chi} bản tóm tắt pháp lý một trang để bộ phận pháp chế của {cong_ty} tham khảo nhé?\n\nTrân trọng,\n{chu_ky}",
  "version": 6
 },
 {
  "step": 5,
  "channel": "email",
  "segment": "film",
  "title": "Theo dõi 4: đơn vị cùng ngành dùng thế nào — hãng phim / hậu kỳ",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nEm xin chia sẻ cách các hãng phim / hậu kỳ đang dùng Epidemic Sound: đội hậu kỳ dùng stems và hiệu ứng âm thanh trong cùng một kho, xuất bản WAV 24-bit/48 kHz cho bản chiếu. Epidemic Sound (Thuỵ Điển, từ 2009) hiện có khách hàng ở gần 200 quốc gia.\n\nNếu {anh_chi} muốn, em gửi 2–3 ví dụ trailer, phim ngắn dùng nhạc Epidemic Sound để {anh_chi} nghe thử chất lượng nhạc.\n\nTrân trọng,\n{chu_ky}",
  "version": 6
 },
 {
  "step": 6,
  "channel": "email",
  "segment": "film",
  "title": "Chia tay lịch sự — hãng phim / hậu kỳ",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nEm đã gửi vài email về nhạc bản quyền cho {cong_ty} nhưng chưa nhận được phản hồi, có lẽ thời điểm này chưa phù hợp. Em xin phép tạm dừng để không làm phiền {anh_chi}.\n\nTrước khi dừng, cho em hỏi một câu: việc chọn nhạc cho phim và trailer của {cong_ty} do ai phụ trách ạ? Nếu {anh_chi} giới thiệu giúp đúng người, em rất cảm ơn.\n\nKhi {cong_ty} cần nhạc cho dự án mới, em luôn sẵn sàng hỗ trợ.\n\nTrân trọng,\n{chu_ky}",
  "version": 6
 },
 {
  "step": 1,
  "channel": "email",
  "segment": "brand",
  "title": "Email mở lời — nhãn hàng",
  "subject": "Nhạc bản quyền cho video thương hiệu {cong_ty}",
  "body": "Kính gửi {xung_ho},\n\n{cau_rieng}\n\nEm là {nguoi_gui}, {chuc_danh} của Epidemic Sound tại Việt Nam — nhà cung cấp nhạc thư viện lớn nhất cho các đài truyền hình lớn tại Bắc Âu. Hai điểm có thể hữu ích với {cong_ty}:\n• Một giấy phép cho mạng xã hội, quảng cáo trực tuyến, sự kiện — dùng chung cho đội marketing và agency đối tác.\n• Đã gồm quyền biểu diễn trước công chúng, không phát sinh phí với Trung tâm/Hiệp hội tác quyền.\n\nNhạc tham khảo cho video thương hiệu: {playlist}\n\nCho em hỏi hiện video của {cong_ty} do đội nội bộ làm hay agency làm, và nhạc nền lấy từ đâu ạ? Nếu không phải {anh_chi} phụ trách, mong {anh_chi} chỉ giúp em.\n\nTrân trọng,\n{chu_ky}",
  "version": 6
 },
 {
  "step": 2,
  "channel": "email",
  "segment": "brand",
  "title": "Theo dõi 1: rủi ro bản quyền — nhãn hàng",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nEm xin phép nhắc lại email hôm trước, kèm một điểm nhiều nhãn hàng đang gặp: video quảng cáo, livestream bị tắt tiếng hoặc gỡ vì nhạc nền, nhất là khi nhiều agency cùng làm nội dung cho một thương hiệu.\n\nMột giấy phép Epidemic Sound dùng chung cho đội marketing và các agency đối tác giúp mọi video của {cong_ty} có nguồn nhạc rõ ràng.\n\nNếu hữu ích, em gửi {anh_chi} bản tóm tắt một trang về cách dùng chung giấy phép với các agency đối tác nhé?\n\nTrân trọng,\n{chu_ky}",
  "version": 6
 },
 {
  "step": 3,
  "channel": "email",
  "segment": "brand",
  "title": "Theo dõi 2: thử nhạc miễn phí — nhãn hàng",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nĐể {anh_chi} dễ hình dung, em xin đề nghị một việc nhỏ, không phát sinh chi phí: {anh_chi} gửi em link video quảng cáo hoặc clip mạng xã hội gần đây của {cong_ty}, em sẽ chọn 3 phương án nhạc nền phù hợp từ kho Epidemic Sound và gửi lại trong 1–2 ngày làm việc.\n\nChỉ cần trả lời email này kèm đường link là được ạ.\n\nTrân trọng,\n{chu_ky}",
  "version": 6
 },
 {
  "step": 4,
  "channel": "email",
  "segment": "brand",
  "title": "Theo dõi 3: quyền biểu diễn trước công chúng — nhãn hàng",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nMột điểm pháp lý nhiều nhãn hàng tại Việt Nam quan tâm: khi phát video quảng cáo, livestream hoặc trình chiếu tại sự kiện, ngoài giấy phép sử dụng bản nhạc còn có quyền biểu diễn trước công chúng, thường phải trả phí riêng cho Trung tâm/Hiệp hội tác quyền.\n\nVới mô hình Direct Licensing, Epidemic Sound sở hữu toàn bộ quyền đối với kho nhạc và đã thanh toán cho nhạc sĩ từ trước, nên quyền này đã nằm trong giấy phép.\n\nEm gửi {anh_chi} bản tóm tắt pháp lý một trang để bộ phận pháp chế của {cong_ty} tham khảo nhé?\n\nTrân trọng,\n{chu_ky}",
  "version": 6
 },
 {
  "step": 5,
  "channel": "email",
  "segment": "brand",
  "title": "Theo dõi 4: đơn vị cùng ngành dùng thế nào — nhãn hàng",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nEm xin chia sẻ cách các nhãn hàng đang dùng Epidemic Sound: đội marketing và agency dùng chung một kho nhạc nên âm thanh của thương hiệu nhất quán trên mọi kênh. Epidemic Sound (Thuỵ Điển, từ 2009) hiện có khách hàng ở gần 200 quốc gia.\n\nNếu {anh_chi} muốn, em gửi 2–3 ví dụ video thương hiệu dùng nhạc Epidemic Sound để {anh_chi} nghe thử chất lượng nhạc.\n\nTrân trọng,\n{chu_ky}",
  "version": 6
 },
 {
  "step": 6,
  "channel": "email",
  "segment": "brand",
  "title": "Chia tay lịch sự — nhãn hàng",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nEm đã gửi vài email về nhạc bản quyền cho {cong_ty} nhưng chưa nhận được phản hồi, có lẽ thời điểm này chưa phù hợp. Em xin phép tạm dừng để không làm phiền {anh_chi}.\n\nTrước khi dừng, cho em hỏi một câu: việc chọn nhạc cho video thương hiệu của {cong_ty} do ai phụ trách ạ? Nếu {anh_chi} giới thiệu giúp đúng người, em rất cảm ơn.\n\nKhi {cong_ty} cần nhạc cho dự án mới, em luôn sẵn sàng hỗ trợ.\n\nTrân trọng,\n{chu_ky}",
  "version": 6
 },
 {
  "step": 13,
  "channel": "email",
  "segment": "all",
  "title": "Hỏi nhu cầu (3 câu hỏi)",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nEm cảm ơn {anh_chi} đã phản hồi. Để đề xuất đúng gói, em xin hỏi nhanh 3 điều — trả lời ngắn qua email là đủ ạ:\n1. {cong_ty} làm loại nội dung nào là chính, khoảng bao nhiêu video mỗi tháng?\n2. Nội dung phát hành trên những nền tảng nào (YouTube, Facebook, TikTok, truyền hình, sự kiện…)?\n3. Bao nhiêu người trong nhóm cần tải nhạc?\n\nNếu {anh_chi} muốn trao đổi trực tiếp, em xin đề xuất một cuộc gọi online 20 phút: [Thứ …, …h] hoặc [Thứ …, …h].\n\nTrân trọng,\n{chu_ky}",
  "version": 6
 },
 {
  "step": 14,
  "channel": "email",
  "segment": "all",
  "title": "Gửi minh hoạ nhạc trên nội dung của khách",
  "subject": "Phương án nhạc cho {cong_ty}",
  "body": "Kính gửi {xung_ho},\n\nNhư đã trao đổi, em gửi {anh_chi} phương án nhạc cho {cong_ty}:\n• 3 lựa chọn nhạc nền cho [tên video / dự án]: [link 1], [link 2], [link 3]\n• Video ngắn hướng dẫn tìm nhạc, tải stems và rút gọn bằng Adapt: [link]\n\nNếu {anh_chi} thấy phù hợp, em sẽ gửi báo giá theo số người dùng và nền tảng {anh_chi} đã chia sẻ.\n\nTrân trọng,\n{chu_ky}",
  "version": 6
 },
 {
  "step": 15,
  "channel": "email",
  "segment": "all",
  "title": "Gửi đề xuất & báo giá",
  "subject": "Đề xuất Epidemic Sound cho {cong_ty}",
  "body": "Kính gửi {xung_ho},\n\nEm gửi {anh_chi} đề xuất cho {cong_ty} (đính kèm), tóm tắt:\n• Phạm vi sử dụng: [số người dùng / kênh / nền tảng]\n• Phí giấy phép: [… /năm]\n• Thời gian bắt đầu: [ngày]\n\nKính mong {anh_chi} xem và cho em biết điểm nào cần làm rõ hoặc điều chỉnh.\n\nTrân trọng,\n{chu_ky}",
  "version": 6
 },
 {
  "step": 16,
  "channel": "email",
  "segment": "all",
  "title": "Email theo dõi đề xuất",
  "subject": "Re: Đề xuất Epidemic Sound cho {cong_ty}",
  "body": "Kính gửi {xung_ho},\n\nEm xin phép hỏi {anh_chi} đã có dịp xem đề xuất em gửi chưa ạ? Nếu cần, em có thể:\n• điều chỉnh phạm vi (số người dùng, nền tảng) cho vừa ngân sách,\n• gửi bản tóm tắt một trang để {anh_chi} trình duyệt nội bộ.\n\nCho em hỏi thêm: ngoài {anh_chi}, ai sẽ tham gia phê duyệt và dự kiến khi nào có quyết định ạ?\n\nTrân trọng,\n{chu_ky}",
  "version": 6
 },
 {
  "step": 17,
  "channel": "email",
  "segment": "all",
  "title": "Email tóm tắt cho người phê duyệt",
  "subject": "Tóm tắt đề xuất Epidemic Sound cho {cong_ty}",
  "body": "Kính gửi {xung_ho},\n\nĐể {anh_chi} thuận tiện trình duyệt, em gửi bản tóm tắt ngắn có thể chuyển tiếp cho người phê duyệt:\n• Vấn đề: nhạc nền chưa có giấy phép rõ ràng → rủi ro bị claim, tắt tiếng, phát sinh phí tác quyền.\n• Giải pháp: một giấy phép Epidemic Sound cho [số người dùng], dùng trên [nền tảng], đã gồm quyền biểu diễn trước công chúng.\n• Chi phí: [… /năm] — chi tiết trong báo giá đính kèm.\n\nNếu người phê duyệt có câu hỏi, em sẵn sàng trả lời qua email hoặc một cuộc gọi online ngắn.\n\nTrân trọng,\n{chu_ky}",
  "version": 6
 },
 {
  "step": 18,
  "channel": "email",
  "segment": "all",
  "title": "Trả lời băn khoăn",
  "subject": "Re: Đề xuất Epidemic Sound cho {cong_ty}",
  "body": "Kính gửi {xung_ho},\n\nEm cảm ơn {anh_chi} đã chia sẻ băn khoăn về [giá / điều khoản / kỹ thuật]. Em xin trả lời như sau:\n\n[Dán câu trả lời phù hợp từ Kho nội dung → Xử lý từ chối]\n\nNếu còn điểm nào chưa rõ, {anh_chi} cứ trả lời email này, em phản hồi trong ngày.\n\nTrân trọng,\n{chu_ky}",
  "version": 6
 },
 {
  "step": 19,
  "channel": "email",
  "segment": "all",
  "title": "Gửi hợp đồng",
  "subject": "Hợp đồng Epidemic Sound – {cong_ty}",
  "body": "Kính gửi {xung_ho},\n\nEm cảm ơn {anh_chi} đã đồng ý hợp tác. Em gửi hợp đồng (đính kèm) để {anh_chi} xem và ký. Các bước tiếp theo:\n1. Ký và gửi lại hợp đồng (bản scan hoặc ký điện tử).\n2. Em gửi hoá đơn và hướng dẫn thanh toán.\n3. Em kích hoạt tài khoản cho {cong_ty} ngay khi hoàn tất thủ tục.\n\nNếu cần chỉnh điều khoản nào, {anh_chi} cứ trả lời email này.\n\nTrân trọng,\n{chu_ky}",
  "version": 6
 },
 {
  "step": 90,
  "channel": "email",
  "segment": "all",
  "title": "Điểm chạm nuôi dưỡng (cập nhật, không chào bán)",
  "subject": "Nhạc mới tháng này cho {cong_ty}",
  "body": "Kính gửi {xung_ho},\n\nEm gửi {anh_chi} danh sách nhạc mới được tuyển chọn trong tháng, phù hợp với nội dung của {cong_ty}: {playlist}\n\nKhi {cong_ty} có dự án mới cần âm nhạc, em luôn sẵn sàng hỗ trợ.\n\nTrân trọng,\n{chu_ky}",
  "version": 6
 }
]$json$::jsonb
$fn$;

-- Sao lưu bản đang dùng (chỉ lần đầu), rồi thay.
insert into public.settings (key, value)
select 'cadence_backup_v4', value from public.settings where key = 'cadence'
on conflict (key) do nothing;
insert into public.settings (key, value)
select 'message_templates_backup_v4', value from public.settings where key = 'message_templates'
on conflict (key) do nothing;

insert into public.settings (key, value) values ('cadence', public.default_cadence_v5())
on conflict (key) do update set value = excluded.value, updated_at = now();
insert into public.settings (key, value) values ('message_templates', public.default_message_templates_v6())
on conflict (key) do update set value = excluded.value, updated_at = now();

-- Nút “Dùng bộ mới” ở Kho nội dung: lịch v5 + mẫu v6.
create or replace function public.apply_sales_defaults() returns void
language plpgsql security definer set search_path = '' as $fn$
begin
  if not public.is_admin() then
    raise exception 'Chỉ admin được thay lịch và nội dung soạn sẵn' using errcode = '42501';
  end if;
  update public.settings set value = public.default_cadence_v5() where key = 'cadence';
  update public.settings set value = public.default_message_templates_v6() where key = 'message_templates';
end $fn$;
revoke execute on function public.apply_sales_defaults() from public, anon;
grant execute on function public.apply_sales_defaults() to authenticated;

-- Số email đã gửi ở chặng tiếp cận (bước < 13 hoặc ghi tay): quyết định email kế tiếp.
drop view public.deal_board;
create view public.deal_board with (security_invoker = true) as
  select d.*,
         c.name as company_name, c.domain, c.website_url, c.segment, c.city, c.score,
         public.is_domain_dnc(c.domain) as is_dnc,
         coalesce(a.touches, 0) as touches,
         a.last_touch_at,
         coalesce(a.outreach_emails, 0) as outreach_emails
  from public.deals d
  join public.companies c on c.id = d.company_id
  left join lateral (
    select count(*)::int as touches, max(x.happened_at) as last_touch_at,
           (count(*) filter (where x.channel = 'email' and (x.step is null or x.step < 13)))::int as outreach_emails
    from public.activities x where x.deal_id = d.id
  ) a on true;
revoke all on public.deal_board from anon, authenticated;
grant select on public.deal_board to authenticated;

-- Khách đang tiếp cận theo lịch cũ (có bước gọi / Zalo / LinkedIn): việc kế tiếp = email thứ (số email đã gửi + 1).
-- Chặng chốt: việc kế tiếp đang lưu theo tên bước cũ → tên bước mới (qua email). Trả về số deal đã đổi.
create or replace function public.replan_email_only() returns int
language plpgsql volatile security definer set search_path = '' as $fn$
declare n1 int; n2 int;
begin
with steps as (
  select (e->>'title') as title, (e->>'day')::int as day,
         row_number() over (order by (e->>'step')::int) as rn
  from jsonb_array_elements(public.default_cadence_v5()) e
  where (e->>'step')::int < 13
),
sent as (
  select d.id, d.cadence_started_at, d.next_action_at,
         (select count(*) from public.activities x
           where x.deal_id = d.id and x.channel = 'email' and (x.step is null or x.step < 13)) as n
  from public.deals d where d.stage = 'outreach'
)
update public.deals d
set next_action = coalesce(s.title, 'Đã gửi đủ chuỗi email — chuyển Nuôi dưỡng nếu khách chưa trả lời'),
    next_action_at = case
      when s.title is null then greatest(current_date, coalesce(q.next_action_at, current_date))
      else greatest(current_date, coalesce(q.cadence_started_at, current_date) + s.day)
    end
from sent q
left join steps s on s.rn = q.n + 1
where d.id = q.id;
get diagnostics n1 = row_count;

update public.deals d
set next_action = m.new_title
from (values
  ('Buổi tìm hiểu nhu cầu', 'Hỏi nhu cầu (3 câu hỏi)'),
  ('Hẹn buổi tìm hiểu nhu cầu', 'Hỏi nhu cầu (3 câu hỏi)'),
  ('Demo sản phẩm', 'Gửi minh hoạ nhạc trên nội dung của khách'),
  ('Gặp / demo cho khách', 'Gửi minh hoạ nhạc trên nội dung của khách'),
  ('Theo dõi đề xuất', 'Email theo dõi đề xuất'),
  ('Gặp người quyết định', 'Email tóm tắt cho người phê duyệt'),
  ('Xử lý băn khoăn', 'Trả lời băn khoăn'),
  ('Ký hợp đồng', 'Gửi hợp đồng')
) as m(old_title, new_title)
where d.next_action = m.old_title and d.stage not in ('won', 'lost');
get diagnostics n2 = row_count;
return n1 + n2;
end $fn$;
revoke execute on function public.replan_email_only() from public, anon, authenticated;

select public.replan_email_only();
