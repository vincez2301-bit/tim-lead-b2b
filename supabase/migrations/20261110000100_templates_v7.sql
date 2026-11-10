-- Bộ email mẫu v7 (spec 004): 6 email chặng tiếp cận × 5 nhóm khách, mỗi email một thông tin mới có số liệu và một việc
-- dễ làm cho khách; chặng chốt và nuôi dưỡng giữ nội dung v6. Lịch v6 = lịch v5, đổi tên email ngày 3 và ngày 18.
-- Không tự thay: chỉ áp dụng khi admin bấm “Dùng bộ mới (v7)” (apply_sales_defaults), bản đang dùng được sao lưu.

create or replace function public.default_message_templates_v7() returns jsonb
language sql immutable set search_path = '' as $fn$
  select $json$[
 {
  "step": 1,
  "channel": "email",
  "segment": "broadcaster",
  "title": "Email mở lời — đài truyền hình",
  "subject": "{cong_ty}: một giấy phép nhạc cho cả phát sóng và YouTube",
  "body": "Kính gửi {xung_ho},\n\n{cau_rieng}\n\nEm là {nguoi_gui}, phụ trách cấp phép âm nhạc của Epidemic Sound tại Việt Nam. Nhiều đài gặp cảnh chương trình đăng lại lên YouTube, Facebook bị claim hoặc tắt tiếng vì nhạc nền.\n\nMột giấy phép năm của Epidemic Sound gồm:\n• 55.000+ bản nhạc, 250.000+ hiệu ứng âm thanh cho bản tin, gameshow, phim truyền hình.\n• Dùng cho phát sóng, phát lại và kênh số; kênh của đài vào danh sách an toàn, không bị claim.\n• Không phát sinh phí tác quyền; có khiếu nại bản quyền thì Epidemic Sound xử lý.\n• Chương trình làm trong thời hạn giấy phép vẫn phát lại được sau khi hết hạn.\n\nNhạc gợi ý cho tin tức – giải trí: {playlist}\n\nCho em hỏi hiện các chương trình của {cong_ty} đang lấy nhạc nền từ nguồn nào ạ?\n\nP.S. Nếu {anh_chi} gửi em link một chương trình gần đây, em chọn 3 phương án nhạc nền gửi lại trong 1–2 ngày, miễn phí.\n\nTrân trọng,\n{chu_ky}",
  "version": 7
 },
 {
  "step": 2,
  "channel": "email",
  "segment": "broadcaster",
  "title": "Theo dõi 1: nếu video bị claim thì sao — đài truyền hình",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nNhiều đài hỏi em: nếu video dùng nhạc Epidemic Sound bị claim thì sao?\n\n• Các kênh YouTube, Facebook, Instagram của {cong_ty} được đưa vào danh sách an toàn (safelist) nên không bị claim tự động.\n• Nếu vẫn có claim, {anh_chi} báo em, bên em gỡ giúp.\n• Có khiếu nại vi phạm bản quyền thì Epidemic Sound chịu trách nhiệm xử lý.\n\nNhờ vậy, chương trình đăng lại lên kênh số giữ được tiếng và doanh thu như bản phát sóng.\n\nEm gửi {anh_chi} hướng dẫn một trang cách đưa kênh vào danh sách an toàn nhé?\n\nTrân trọng,\n{chu_ky}",
  "version": 7
 },
 {
  "step": 3,
  "channel": "email",
  "segment": "broadcaster",
  "title": "Theo dõi 2: thử nhạc miễn phí trên video thật — đài truyền hình",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nĐể {anh_chi} nghe thử trên chính nội dung của {cong_ty}, em xin đề nghị một việc nhỏ, không mất phí: {anh_chi} gửi em link một chương trình gần đây, trong 1–2 ngày làm việc em gửi lại:\n• 3 phương án nhạc nền từ kho Epidemic Sound, hợp nhịp dựng của video;\n• mỗi phương án kèm bản rút gọn 15s/30s làm bằng Adapt, để {anh_chi} thấy đổi thời lượng nhanh thế nào.\n\nChỉ cần trả lời email này kèm đường link là được ạ.\n\nTrân trọng,\n{chu_ky}",
  "version": 7
 },
 {
  "step": 4,
  "channel": "email",
  "segment": "broadcaster",
  "title": "Theo dõi 3: quyền biểu diễn trước công chúng — đài truyền hình",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nMột điểm pháp lý nhiều đài tại Việt Nam quan tâm: khi phát sóng hoặc phát lại chương trình, ngoài quyền dùng bản nhạc còn có quyền biểu diễn trước công chúng, thường phải trả phí riêng cho tổ chức tác quyền.\n\nEpidemic Sound sở hữu 100% quyền với kho nhạc và đã trả cho nhạc sĩ từ trước (Direct Licensing). Vì vậy, ngoài phí giấy phép, {cong_ty} không phải trả thêm cho tổ chức tác quyền.\n\nEm gửi {anh_chi} bản tóm tắt pháp lý một trang để bộ phận pháp chế của {cong_ty} tham khảo nhé?\n\nTrân trọng,\n{chu_ky}",
  "version": 7
 },
 {
  "step": 5,
  "channel": "email",
  "segment": "broadcaster",
  "title": "Theo dõi 4: chi phí tính thế nào — đài truyền hình",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nNhiều đài hỏi em chi phí tính thế nào, em xin tóm tắt:\n• Phí cố định theo năm, theo số người tải nhạc và nơi đăng (trực tuyến, OTT/truyền hình, quảng cáo trả phí).\n• Dùng bao nhiêu bài, làm bao nhiêu video trong phạm vi giấy phép cũng không tính thêm.\n• So với mua lẻ từng bài, giấy phép năm giúp đài chủ động ngân sách.\n\nNếu {anh_chi} cho em biết số người cần tải nhạc và các nền tảng {cong_ty} đăng nội dung, em gửi báo giá ước tính trong ngày ạ.\n\nTrân trọng,\n{chu_ky}",
  "version": 7
 },
 {
  "step": 6,
  "channel": "email",
  "segment": "broadcaster",
  "title": "Chia tay lịch sự — đài truyền hình",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nEm đã gửi vài email về nhạc bản quyền cho {cong_ty}; có lẽ thời điểm này chưa phù hợp, em xin phép dừng để không làm phiền {anh_chi}.\n\nCho em hỏi một câu cuối: việc chọn nhạc cho các chương trình của {cong_ty} do ai phụ trách ạ? Nếu {anh_chi} giới thiệu giúp, em rất cảm ơn.\n\nNếu {anh_chi} muốn, mỗi tháng em gửi một playlist nhạc mới hợp với nội dung của {cong_ty}, không chào bán.\n\nTrân trọng,\n{chu_ky}",
  "version": 7
 },
 {
  "step": 1,
  "channel": "email",
  "segment": "mcn",
  "title": "Email mở lời — MCN",
  "subject": "{cong_ty}: nhạc cho creator, không lo claim và mất doanh thu",
  "body": "Kính gửi {xung_ho},\n\n{cau_rieng}\n\nEm là {nguoi_gui}, phụ trách cấp phép âm nhạc của Epidemic Sound tại Việt Nam. Với MCN, mỗi video bị claim nhạc là doanh thu quảng cáo bị chia hoặc mất, và đội vận hành phải kháng nghị từng video.\n\nMột giấy phép năm của Epidemic Sound gồm:\n• 55.000+ bản nhạc, có cả phonk, K-pop, lo-fi, EDM đang thịnh hành để creator tự chọn.\n• Kênh trong mạng lưới vào danh sách an toàn, quản lý tập trung trên một cổng đối tác.\n• Vẫn có claim thì Epidemic Sound gỡ giúp; không phát sinh phí tác quyền.\n• Video đăng trong thời hạn giấy phép vẫn dùng tiếp sau khi hết hạn.\n\nNhạc gợi ý cho vlog, gaming, giải trí: {playlist}\n\nCho em hỏi hiện creator trong mạng lưới của {cong_ty} thường lấy nhạc nền từ đâu ạ?\n\nP.S. Nếu {anh_chi} gửi em link video của một kênh gần đây, em chọn 3 phương án nhạc nền gửi lại trong 1–2 ngày, miễn phí.\n\nTrân trọng,\n{chu_ky}",
  "version": 7
 },
 {
  "step": 2,
  "channel": "email",
  "segment": "mcn",
  "title": "Theo dõi 1: nếu video bị claim thì sao — MCN",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nNhiều MCN hỏi em: nếu video dùng nhạc Epidemic Sound bị claim thì sao?\n\n• Các kênh trong mạng lưới của {cong_ty} được đưa vào danh sách an toàn (safelist) nên không bị claim tự động.\n• Nếu vẫn có claim, {anh_chi} báo em, bên em gỡ giúp.\n• Có khiếu nại vi phạm bản quyền thì Epidemic Sound chịu trách nhiệm xử lý.\n\nKênh YouTube được quản lý tập trung trên một cổng đối tác, nên đội vận hành không phải kháng nghị từng video.\n\nEm gửi {anh_chi} hướng dẫn một trang cách đưa kênh vào danh sách an toàn nhé?\n\nTrân trọng,\n{chu_ky}",
  "version": 7
 },
 {
  "step": 3,
  "channel": "email",
  "segment": "mcn",
  "title": "Theo dõi 2: thử nhạc miễn phí trên video thật — MCN",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nĐể {anh_chi} nghe thử trên chính nội dung của {cong_ty}, em xin đề nghị một việc nhỏ, không mất phí: {anh_chi} gửi em link video của một kênh gần đây, trong 1–2 ngày làm việc em gửi lại:\n• 3 phương án nhạc nền từ kho Epidemic Sound, hợp nhịp dựng của video;\n• mỗi phương án kèm bản rút gọn 15s/30s làm bằng Adapt, để {anh_chi} thấy đổi thời lượng nhanh thế nào.\n\nChỉ cần trả lời email này kèm đường link là được ạ.\n\nTrân trọng,\n{chu_ky}",
  "version": 7
 },
 {
  "step": 4,
  "channel": "email",
  "segment": "mcn",
  "title": "Theo dõi 3: quyền biểu diễn trước công chúng — MCN",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nMột điểm pháp lý nhiều MCN tại Việt Nam quan tâm: khi creator livestream hoặc video được trình chiếu tại sự kiện, ngoài quyền dùng bản nhạc còn có quyền biểu diễn trước công chúng, thường phải trả phí riêng cho tổ chức tác quyền.\n\nEpidemic Sound sở hữu 100% quyền với kho nhạc và đã trả cho nhạc sĩ từ trước (Direct Licensing). Vì vậy, ngoài phí giấy phép, {cong_ty} không phải trả thêm cho tổ chức tác quyền.\n\nEm gửi {anh_chi} bản tóm tắt pháp lý một trang để bộ phận pháp chế của {cong_ty} tham khảo nhé?\n\nTrân trọng,\n{chu_ky}",
  "version": 7
 },
 {
  "step": 5,
  "channel": "email",
  "segment": "mcn",
  "title": "Theo dõi 4: chi phí tính thế nào — MCN",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nNhiều MCN hỏi em chi phí tính thế nào, em xin tóm tắt:\n• Phí cố định theo năm, theo số người tải nhạc và nơi đăng (trực tuyến, OTT/truyền hình, quảng cáo trả phí).\n• Dùng bao nhiêu bài, làm bao nhiêu video trong phạm vi giấy phép cũng không tính thêm.\n• Một giấy phép cho cả mạng lưới, thay vì từng creator tự mua nhạc lẻ.\n\nNếu {anh_chi} cho em biết số người cần tải nhạc và các nền tảng {cong_ty} đăng nội dung, em gửi báo giá ước tính trong ngày ạ.\n\nTrân trọng,\n{chu_ky}",
  "version": 7
 },
 {
  "step": 6,
  "channel": "email",
  "segment": "mcn",
  "title": "Chia tay lịch sự — MCN",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nEm đã gửi vài email về nhạc bản quyền cho {cong_ty}; có lẽ thời điểm này chưa phù hợp, em xin phép dừng để không làm phiền {anh_chi}.\n\nCho em hỏi một câu cuối: việc chọn nhạc cho các kênh trong mạng lưới của {cong_ty} do ai phụ trách ạ? Nếu {anh_chi} giới thiệu giúp, em rất cảm ơn.\n\nNếu {anh_chi} muốn, mỗi tháng em gửi một playlist nhạc mới hợp với nội dung của {cong_ty}, không chào bán.\n\nTrân trọng,\n{chu_ky}",
  "version": 7
 },
 {
  "step": 1,
  "channel": "email",
  "segment": "agency",
  "title": "Email mở lời — production house / agency",
  "subject": "{cong_ty}: nhạc cho TVC, khách đăng lên YouTube không lo bị claim",
  "body": "Kính gửi {xung_ho},\n\n{cau_rieng}\n\nEm là {nguoi_gui}, phụ trách cấp phép âm nhạc của Epidemic Sound tại Việt Nam. Nhiều production house gặp cảnh TVC bàn giao xong, khách đăng lên YouTube thì bị claim, và người bị phàn nàn là agency.\n\nMột giấy phép năm của Epidemic Sound gồm:\n• 55.000+ bản nhạc, 250.000+ hiệu ứng âm thanh, có stems; Adapt cắt bản 15s/30s/60s trong vài giây.\n• Khách hàng được đăng video {cong_ty} sản xuất lên YouTube, Facebook, TikTok, truyền hình.\n• Không phát sinh phí tác quyền; có khiếu nại bản quyền thì Epidemic Sound xử lý.\n• Video làm trong thời hạn giấy phép vẫn dùng tiếp sau khi hết hạn.\n\nNhạc gợi ý cho TVC và video doanh nghiệp: {playlist}\n\nCho em hỏi hiện các dự án của {cong_ty} đang mua nhạc theo từng bài hay dùng thư viện nào ạ?\n\nP.S. Nếu {anh_chi} gửi em link video gần đây, em chọn 3 phương án nhạc nền gửi lại trong 1–2 ngày, miễn phí.\n\nTrân trọng,\n{chu_ky}",
  "version": 7
 },
 {
  "step": 2,
  "channel": "email",
  "segment": "agency",
  "title": "Theo dõi 1: nếu video bị claim thì sao — production house / agency",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nNhiều production house hỏi em: nếu video dùng nhạc Epidemic Sound bị claim thì sao?\n\n• Các kênh YouTube, Facebook của {cong_ty} được đưa vào danh sách an toàn (safelist) nên không bị claim tự động.\n• Nếu vẫn có claim, {anh_chi} báo em, bên em gỡ giúp.\n• Có khiếu nại vi phạm bản quyền thì Epidemic Sound chịu trách nhiệm xử lý.\n\nKhi kênh của khách hàng đăng TVC do {cong_ty} làm bị claim, {cong_ty} chỉ cần gửi link, bên em xử lý.\n\nEm gửi {anh_chi} hướng dẫn một trang cách đưa kênh vào danh sách an toàn nhé?\n\nTrân trọng,\n{chu_ky}",
  "version": 7
 },
 {
  "step": 3,
  "channel": "email",
  "segment": "agency",
  "title": "Theo dõi 2: thử nhạc miễn phí trên video thật — production house / agency",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nĐể {anh_chi} nghe thử trên chính nội dung của {cong_ty}, em xin đề nghị một việc nhỏ, không mất phí: {anh_chi} gửi em link video gần đây, trong 1–2 ngày làm việc em gửi lại:\n• 3 phương án nhạc nền từ kho Epidemic Sound, hợp nhịp dựng của video;\n• mỗi phương án kèm bản rút gọn 15s/30s làm bằng Adapt, để {anh_chi} thấy đổi thời lượng nhanh thế nào.\n\nChỉ cần trả lời email này kèm đường link là được ạ.\n\nTrân trọng,\n{chu_ky}",
  "version": 7
 },
 {
  "step": 4,
  "channel": "email",
  "segment": "agency",
  "title": "Theo dõi 3: quyền biểu diễn trước công chúng — production house / agency",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nMột điểm pháp lý nhiều production house tại Việt Nam quan tâm: khi phát TVC trên truyền hình hoặc trình chiếu video tại sự kiện, ngoài quyền dùng bản nhạc còn có quyền biểu diễn trước công chúng, thường phải trả phí riêng cho tổ chức tác quyền.\n\nEpidemic Sound sở hữu 100% quyền với kho nhạc và đã trả cho nhạc sĩ từ trước (Direct Licensing). Vì vậy, ngoài phí giấy phép, {cong_ty} không phải trả thêm cho tổ chức tác quyền.\n\nEm gửi {anh_chi} bản tóm tắt pháp lý một trang để bộ phận pháp chế của {cong_ty} tham khảo nhé?\n\nTrân trọng,\n{chu_ky}",
  "version": 7
 },
 {
  "step": 5,
  "channel": "email",
  "segment": "agency",
  "title": "Theo dõi 4: chi phí tính thế nào — production house / agency",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nNhiều production house hỏi em chi phí tính thế nào, em xin tóm tắt:\n• Phí cố định theo năm, theo số người tải nhạc và nơi đăng (trực tuyến, OTT/truyền hình, quảng cáo trả phí).\n• Dùng bao nhiêu bài, làm bao nhiêu video trong phạm vi giấy phép cũng không tính thêm.\n• Chi phí chia cho mọi dự án trong năm, thường thấp hơn mua lẻ từng bài.\n\nNếu {anh_chi} cho em biết số người cần tải nhạc và các nền tảng {cong_ty} đăng nội dung, em gửi báo giá ước tính trong ngày ạ.\n\nTrân trọng,\n{chu_ky}",
  "version": 7
 },
 {
  "step": 6,
  "channel": "email",
  "segment": "agency",
  "title": "Chia tay lịch sự — production house / agency",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nEm đã gửi vài email về nhạc bản quyền cho {cong_ty}; có lẽ thời điểm này chưa phù hợp, em xin phép dừng để không làm phiền {anh_chi}.\n\nCho em hỏi một câu cuối: việc chọn nhạc cho các dự án của {cong_ty} do ai phụ trách ạ? Nếu {anh_chi} giới thiệu giúp, em rất cảm ơn.\n\nNếu {anh_chi} muốn, mỗi tháng em gửi một playlist nhạc mới hợp với nội dung của {cong_ty}, không chào bán.\n\nTrân trọng,\n{chu_ky}",
  "version": 7
 },
 {
  "step": 1,
  "channel": "email",
  "segment": "film",
  "title": "Email mở lời — hãng phim / hậu kỳ",
  "subject": "{cong_ty}: nhạc và hiệu ứng âm thanh có stems cho phim, trailer",
  "body": "Kính gửi {xung_ho},\n\n{cau_rieng}\n\nEm là {nguoi_gui}, phụ trách cấp phép âm nhạc của Epidemic Sound tại Việt Nam. Với phim và trailer, nhạc không rõ quyền hay lộ ra đúng lúc phát hành: bị claim hoặc phải thay nhạc phút chót.\n\nMột giấy phép năm của Epidemic Sound gồm:\n• 55.000+ bản nhạc có stems, WAV 24-bit/48 kHz; kèm 250.000+ hiệu ứng âm thanh cho hậu kỳ.\n• Quyền dùng rõ cho phim, trailer, teaser theo phạm vi giấy phép (trực tuyến, OTT, truyền hình).\n• Không phát sinh phí tác quyền; có khiếu nại bản quyền thì Epidemic Sound xử lý.\n• Phim làm trong thời hạn giấy phép vẫn phát hành tiếp sau khi hết hạn.\n\nNhạc gợi ý cho trailer và phim: {playlist}\n\nCho em hỏi hiện {cong_ty} xử lý nhạc nền cho trailer và nội dung quảng bá như thế nào ạ?\n\nP.S. Nếu {anh_chi} gửi em link trailer gần đây, em chọn 3 phương án nhạc nền gửi lại trong 1–2 ngày, miễn phí.\n\nTrân trọng,\n{chu_ky}",
  "version": 7
 },
 {
  "step": 2,
  "channel": "email",
  "segment": "film",
  "title": "Theo dõi 1: nếu video bị claim thì sao — hãng phim / hậu kỳ",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nNhiều hãng phim hỏi em: nếu video dùng nhạc Epidemic Sound bị claim thì sao?\n\n• Các kênh YouTube, Facebook của {cong_ty} và của từng phim được đưa vào danh sách an toàn (safelist) nên không bị claim tự động.\n• Nếu vẫn có claim, {anh_chi} báo em, bên em gỡ giúp.\n• Có khiếu nại vi phạm bản quyền thì Epidemic Sound chịu trách nhiệm xử lý.\n\nNhờ vậy, trailer không bị claim đúng tuần ra mắt.\n\nEm gửi {anh_chi} hướng dẫn một trang cách đưa kênh vào danh sách an toàn nhé?\n\nTrân trọng,\n{chu_ky}",
  "version": 7
 },
 {
  "step": 3,
  "channel": "email",
  "segment": "film",
  "title": "Theo dõi 2: thử nhạc miễn phí trên video thật — hãng phim / hậu kỳ",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nĐể {anh_chi} nghe thử trên chính nội dung của {cong_ty}, em xin đề nghị một việc nhỏ, không mất phí: {anh_chi} gửi em link trailer gần đây, trong 1–2 ngày làm việc em gửi lại:\n• 3 phương án nhạc nền từ kho Epidemic Sound, hợp nhịp dựng của video;\n• mỗi phương án kèm bản rút gọn 15s/30s làm bằng Adapt, để {anh_chi} thấy đổi thời lượng nhanh thế nào.\n\nChỉ cần trả lời email này kèm đường link là được ạ.\n\nTrân trọng,\n{chu_ky}",
  "version": 7
 },
 {
  "step": 4,
  "channel": "email",
  "segment": "film",
  "title": "Theo dõi 3: quyền biểu diễn trước công chúng — hãng phim / hậu kỳ",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nMột điểm pháp lý nhiều hãng phim tại Việt Nam quan tâm: khi chiếu phim, phát trailer tại sự kiện hoặc trên truyền hình, ngoài quyền dùng bản nhạc còn có quyền biểu diễn trước công chúng, thường phải trả phí riêng cho tổ chức tác quyền.\n\nEpidemic Sound sở hữu 100% quyền với kho nhạc và đã trả cho nhạc sĩ từ trước (Direct Licensing). Vì vậy, ngoài phí giấy phép, {cong_ty} không phải trả thêm cho tổ chức tác quyền.\n\nEm gửi {anh_chi} bản tóm tắt pháp lý một trang để bộ phận pháp chế của {cong_ty} tham khảo nhé?\n\nTrân trọng,\n{chu_ky}",
  "version": 7
 },
 {
  "step": 5,
  "channel": "email",
  "segment": "film",
  "title": "Theo dõi 4: chi phí tính thế nào — hãng phim / hậu kỳ",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nNhiều hãng phim hỏi em chi phí tính thế nào, em xin tóm tắt:\n• Phí cố định theo năm, theo số người tải nhạc và nơi đăng (trực tuyến, OTT/truyền hình, quảng cáo trả phí).\n• Dùng bao nhiêu bài, làm bao nhiêu video trong phạm vi giấy phép cũng không tính thêm.\n• Gồm cả nhạc và hiệu ứng âm thanh, không phải mua riêng cho từng phim.\n\nNếu {anh_chi} cho em biết số người cần tải nhạc và các nền tảng {cong_ty} đăng nội dung, em gửi báo giá ước tính trong ngày ạ.\n\nTrân trọng,\n{chu_ky}",
  "version": 7
 },
 {
  "step": 6,
  "channel": "email",
  "segment": "film",
  "title": "Chia tay lịch sự — hãng phim / hậu kỳ",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nEm đã gửi vài email về nhạc bản quyền cho {cong_ty}; có lẽ thời điểm này chưa phù hợp, em xin phép dừng để không làm phiền {anh_chi}.\n\nCho em hỏi một câu cuối: việc chọn nhạc cho phim và trailer của {cong_ty} do ai phụ trách ạ? Nếu {anh_chi} giới thiệu giúp, em rất cảm ơn.\n\nNếu {anh_chi} muốn, mỗi tháng em gửi một playlist nhạc mới hợp với nội dung của {cong_ty}, không chào bán.\n\nTrân trọng,\n{chu_ky}",
  "version": 7
 },
 {
  "step": 1,
  "channel": "email",
  "segment": "brand",
  "title": "Email mở lời — nhãn hàng",
  "subject": "{cong_ty}: một giấy phép nhạc cho mọi video thương hiệu",
  "body": "Kính gửi {xung_ho},\n\n{cau_rieng}\n\nEm là {nguoi_gui}, phụ trách cấp phép âm nhạc của Epidemic Sound tại Việt Nam. Khi nhiều agency cùng làm nội dung, chỉ một video dùng nhạc không rõ quyền cũng đủ bị tắt tiếng hoặc gỡ quảng cáo.\n\nMột giấy phép năm của Epidemic Sound gồm:\n• 55.000+ bản nhạc, 250.000+ hiệu ứng âm thanh cho mạng xã hội, quảng cáo, livestream, sự kiện.\n• Agency đối tác dùng chung giấy phép khi làm nội dung cho {cong_ty}.\n• Kênh của {cong_ty} vào danh sách an toàn; không phát sinh phí tác quyền.\n• Video đăng trong thời hạn giấy phép vẫn dùng tiếp sau khi hết hạn.\n\nNhạc gợi ý cho video thương hiệu: {playlist}\n\nCho em hỏi hiện video của {cong_ty} do đội nội bộ làm hay agency làm, và nhạc nền lấy từ đâu ạ?\n\nP.S. Nếu {anh_chi} gửi em link video quảng cáo gần đây, em chọn 3 phương án nhạc nền gửi lại trong 1–2 ngày, miễn phí.\n\nTrân trọng,\n{chu_ky}",
  "version": 7
 },
 {
  "step": 2,
  "channel": "email",
  "segment": "brand",
  "title": "Theo dõi 1: nếu video bị claim thì sao — nhãn hàng",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nNhiều nhãn hàng hỏi em: nếu video dùng nhạc Epidemic Sound bị claim thì sao?\n\n• Các kênh YouTube, Facebook, Instagram của {cong_ty} được đưa vào danh sách an toàn (safelist) nên không bị claim tự động.\n• Nếu vẫn có claim, {anh_chi} báo em, bên em gỡ giúp.\n• Có khiếu nại vi phạm bản quyền thì Epidemic Sound chịu trách nhiệm xử lý.\n\nAgency đối tác dùng chung giấy phép, nên mọi video trên kênh của {cong_ty} đều có nguồn nhạc rõ ràng.\n\nEm gửi {anh_chi} hướng dẫn một trang cách đưa kênh vào danh sách an toàn nhé?\n\nTrân trọng,\n{chu_ky}",
  "version": 7
 },
 {
  "step": 3,
  "channel": "email",
  "segment": "brand",
  "title": "Theo dõi 2: thử nhạc miễn phí trên video thật — nhãn hàng",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nĐể {anh_chi} nghe thử trên chính nội dung của {cong_ty}, em xin đề nghị một việc nhỏ, không mất phí: {anh_chi} gửi em link video quảng cáo gần đây, trong 1–2 ngày làm việc em gửi lại:\n• 3 phương án nhạc nền từ kho Epidemic Sound, hợp nhịp dựng của video;\n• mỗi phương án kèm bản rút gọn 15s/30s làm bằng Adapt, để {anh_chi} thấy đổi thời lượng nhanh thế nào.\n\nChỉ cần trả lời email này kèm đường link là được ạ.\n\nTrân trọng,\n{chu_ky}",
  "version": 7
 },
 {
  "step": 4,
  "channel": "email",
  "segment": "brand",
  "title": "Theo dõi 3: quyền biểu diễn trước công chúng — nhãn hàng",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nMột điểm pháp lý nhiều nhãn hàng tại Việt Nam quan tâm: khi phát video quảng cáo, livestream hoặc trình chiếu tại sự kiện, ngoài quyền dùng bản nhạc còn có quyền biểu diễn trước công chúng, thường phải trả phí riêng cho tổ chức tác quyền.\n\nEpidemic Sound sở hữu 100% quyền với kho nhạc và đã trả cho nhạc sĩ từ trước (Direct Licensing). Vì vậy, ngoài phí giấy phép, {cong_ty} không phải trả thêm cho tổ chức tác quyền.\n\nEm gửi {anh_chi} bản tóm tắt pháp lý một trang để bộ phận pháp chế của {cong_ty} tham khảo nhé?\n\nTrân trọng,\n{chu_ky}",
  "version": 7
 },
 {
  "step": 5,
  "channel": "email",
  "segment": "brand",
  "title": "Theo dõi 4: chi phí tính thế nào — nhãn hàng",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nNhiều nhãn hàng hỏi em chi phí tính thế nào, em xin tóm tắt:\n• Phí cố định theo năm, theo số người tải nhạc và nơi đăng (trực tuyến, OTT/truyền hình, quảng cáo trả phí).\n• Dùng bao nhiêu bài, làm bao nhiêu video trong phạm vi giấy phép cũng không tính thêm.\n• Dùng chung cho đội marketing và agency, không mua nhạc riêng từng chiến dịch.\n\nNếu {anh_chi} cho em biết số người cần tải nhạc và các nền tảng {cong_ty} đăng nội dung, em gửi báo giá ước tính trong ngày ạ.\n\nTrân trọng,\n{chu_ky}",
  "version": 7
 },
 {
  "step": 6,
  "channel": "email",
  "segment": "brand",
  "title": "Chia tay lịch sự — nhãn hàng",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nEm đã gửi vài email về nhạc bản quyền cho {cong_ty}; có lẽ thời điểm này chưa phù hợp, em xin phép dừng để không làm phiền {anh_chi}.\n\nCho em hỏi một câu cuối: việc chọn nhạc cho video thương hiệu của {cong_ty} do ai phụ trách ạ? Nếu {anh_chi} giới thiệu giúp, em rất cảm ơn.\n\nNếu {anh_chi} muốn, mỗi tháng em gửi một playlist nhạc mới hợp với nội dung của {cong_ty}, không chào bán.\n\nTrân trọng,\n{chu_ky}",
  "version": 7
 }
]$json$::jsonb
      || (select coalesce(jsonb_agg(e || '{"version": 7}'::jsonb order by ord), '[]'::jsonb)
          from jsonb_array_elements(public.default_message_templates_v6()) with ordinality as x(e, ord)
          where (e->>'step')::int >= 13)
$fn$;

create or replace function public.default_cadence_v6() returns jsonb
language sql immutable set search_path = '' as $fn$
  select jsonb_agg(
           case (e->>'step')::int
             when 1 then e || '{"hint": "Câu riêng về khách + vấn đề nhóm khách + 4 ý về Epidemic Sound + playlist; hỏi một câu; P.S. thử nhạc miễn phí."}'::jsonb
             when 2 then e || '{"title": "Email theo dõi 1: nếu video bị claim thì sao", "hint": "Trả lời trong luồng email mở lời (tiêu đề Re:). Danh sách an toàn, gỡ claim, ai chịu trách nhiệm."}'::jsonb
             when 3 then e || '{"hint": "Khách gửi link video → gửi lại 3 phương án nhạc + bản rút gọn 15s/30s trong 1–2 ngày."}'::jsonb
             when 5 then e || '{"title": "Email theo dõi 4: chi phí tính thế nào", "hint": "Khách trả lời số người dùng + nền tảng → gửi báo giá ước tính trong ngày."}'::jsonb
             else e
           end order by ord)
  from jsonb_array_elements(public.default_cadence_v5()) with ordinality as x(e, ord)
$fn$;

-- Kho nội dung gọi hai hàm này để xem trước bộ mới trước khi áp dụng.
revoke execute on function public.default_message_templates_v7() from public, anon;
revoke execute on function public.default_cadence_v6() from public, anon;
grant execute on function public.default_message_templates_v7() to authenticated;
grant execute on function public.default_cadence_v6() to authenticated;

-- Nút “Dùng bộ mới” ở Kho nội dung: sao lưu bản đang dùng, thay bằng lịch v6 + mẫu v7, đổi tên việc đang hẹn theo tên email mới.
create or replace function public.apply_sales_defaults() returns void
language plpgsql security definer set search_path = '' as $fn$
begin
  if not public.is_admin() then
    raise exception 'Chỉ admin được thay lịch và nội dung soạn sẵn' using errcode = '42501';
  end if;
  insert into public.settings (key, value)
  select 'message_templates_backup_v6', value from public.settings
   where key = 'message_templates' and coalesce(value->0->>'version', '') <> '7'
  on conflict (key) do update set value = excluded.value, updated_at = now();
  insert into public.settings (key, value)
  select 'cadence_backup_v5', value from public.settings
   where key = 'cadence' and value is distinct from public.default_cadence_v6()
  on conflict (key) do update set value = excluded.value, updated_at = now();
  update public.settings set value = public.default_cadence_v6(), updated_at = now() where key = 'cadence';
  update public.settings set value = public.default_message_templates_v7(), updated_at = now() where key = 'message_templates';
  update public.deals d set next_action = m.new_title
  from (values
    ('Email theo dõi 1: rủi ro bản quyền', 'Email theo dõi 1: nếu video bị claim thì sao'),
    ('Email theo dõi 4: đơn vị cùng ngành dùng thế nào', 'Email theo dõi 4: chi phí tính thế nào')
  ) as m(old_title, new_title)
  where d.next_action = m.old_title and d.stage not in ('won', 'lost');
end $fn$;
revoke execute on function public.apply_sales_defaults() from public, anon;
grant execute on function public.apply_sales_defaults() to authenticated;
