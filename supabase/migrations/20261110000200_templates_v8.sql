-- Bộ email mẫu v8: v7 trau chuốt câu chữ (văn phong chuyên nghiệp, câu trọn vẹn, thuật ngữ tiếng Việt kèm tiếng Anh
-- trong ngoặc ở lần đầu: khiếu nại bản quyền (claim), danh sách được cấp phép (safelist), bản tách lớp (stems)).
-- Cùng cấu trúc, cùng thông tin với v7. Bộ đang dùng còn nguyên v7 (chưa sửa mẫu nào) thì tự thay; đã sửa thì chờ admin
-- bấm “Dùng bộ mới (v8)”. Bản cũ luôn được sao lưu vào message_templates_backup_v7.

create or replace function public.default_message_templates_v8() returns jsonb
language sql immutable set search_path = '' as $fn$
  select $json$[
 {
  "step": 1,
  "channel": "email",
  "segment": "broadcaster",
  "title": "Email mở lời — đài truyền hình",
  "subject": "Giải pháp nhạc bản quyền cho phát sóng và kênh số của {cong_ty}",
  "body": "Kính gửi {xung_ho},\n\n{cau_rieng}\n\nEm là {nguoi_gui}, phụ trách cấp phép âm nhạc của Epidemic Sound tại Việt Nam. Em xin phép liên hệ vì nhiều đài truyền hình đang gặp tình trạng chương trình đăng lại trên YouTube, Facebook bị khiếu nại bản quyền (claim) hoặc bị tắt tiếng do nhạc nền.\n\nGiấy phép năm của Epidemic Sound mang lại:\n• Hơn 55.000 bản nhạc và 250.000 hiệu ứng âm thanh cho bản tin, gameshow, phim truyền hình.\n• Một giấy phép cho phát sóng, phát lại và kênh số; kênh của đài được đăng ký vào danh sách được cấp phép (safelist), không bị khiếu nại tự động.\n• Không phát sinh thêm chi phí tác quyền; nếu có khiếu nại, Epidemic Sound chịu trách nhiệm xử lý.\n• Chương trình hoàn thành trong thời hạn giấy phép vẫn được phát lại sau khi hết hạn.\n\nEm gửi kèm danh sách nhạc gợi ý cho tin tức và giải trí: {playlist}\n\nCho em hỏi hiện nay các chương trình của {cong_ty} đang sử dụng nhạc nền từ nguồn nào ạ?\n\nP.S. Nếu {anh_chi} gửi em đường link một chương trình gần đây, em sẽ đề xuất ba phương án nhạc nền phù hợp trong 1–2 ngày làm việc, hoàn toàn miễn phí.\n\nTrân trọng,\n{chu_ky}",
  "version": 8
 },
 {
  "step": 2,
  "channel": "email",
  "segment": "broadcaster",
  "title": "Theo dõi 1: nếu video bị claim thì sao — đài truyền hình",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nTiếp nối email trước, em xin trả lời một câu hỏi nhiều đài truyền hình quan tâm: nếu video dùng nhạc Epidemic Sound vẫn bị khiếu nại bản quyền thì sao?\n\n• Các kênh YouTube, Facebook, Instagram của {cong_ty} được đăng ký vào danh sách được cấp phép (safelist), nên không bị khiếu nại tự động.\n• Nếu vẫn phát sinh khiếu nại, {anh_chi} chỉ cần gửi đường link, bên em sẽ xử lý gỡ bỏ.\n• Với khiếu nại vi phạm bản quyền, Epidemic Sound chịu trách nhiệm giải quyết.\n\nNhờ vậy, các chương trình đăng tải lại trên kênh số vẫn giữ nguyên âm thanh và doanh thu như bản phát sóng.\n\nEm xin phép gửi {anh_chi} bản hướng dẫn một trang về cách đăng ký kênh được không ạ?\n\nTrân trọng,\n{chu_ky}",
  "version": 8
 },
 {
  "step": 3,
  "channel": "email",
  "segment": "broadcaster",
  "title": "Theo dõi 2: thử nhạc miễn phí trên video thật — đài truyền hình",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nĐể {anh_chi} có thể đánh giá chất lượng âm nhạc trên chính nội dung của {cong_ty}, em xin đề xuất một thử nghiệm nhỏ, hoàn toàn miễn phí: {anh_chi} gửi em đường link một chương trình gần đây, trong vòng 1–2 ngày làm việc em sẽ gửi lại:\n• Ba phương án nhạc nền từ kho Epidemic Sound, phù hợp với nhịp dựng của video;\n• Mỗi phương án kèm phiên bản rút gọn 15 và 30 giây, thực hiện bằng công cụ Adapt.\n\nRất mong nhận được đường link từ {anh_chi}; chỉ cần trả lời email này là được ạ.\n\nTrân trọng,\n{chu_ky}",
  "version": 8
 },
 {
  "step": 4,
  "channel": "email",
  "segment": "broadcaster",
  "title": "Theo dõi 3: quyền biểu diễn trước công chúng — đài truyền hình",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nEm xin chia sẻ một vấn đề pháp lý mà nhiều đài truyền hình tại Việt Nam quan tâm: khi phát sóng hoặc phát lại chương trình, bên cạnh quyền sử dụng bản nhạc còn có quyền biểu diễn trước công chúng, thường phải trả phí riêng cho tổ chức quản lý tác quyền.\n\nEpidemic Sound sở hữu toàn bộ quyền đối với kho nhạc và đã thanh toán cho nhạc sĩ ngay từ đầu (mô hình cấp phép trực tiếp – Direct Licensing). Vì vậy, ngoài phí giấy phép, {cong_ty} không phải trả thêm khoản phí nào cho tổ chức quản lý tác quyền.\n\nEm xin phép gửi {anh_chi} bản tóm tắt pháp lý một trang để bộ phận pháp chế của {cong_ty} tham khảo được không ạ?\n\nTrân trọng,\n{chu_ky}",
  "version": 8
 },
 {
  "step": 5,
  "channel": "email",
  "segment": "broadcaster",
  "title": "Theo dõi 4: chi phí tính thế nào — đài truyền hình",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nNhiều đài truyền hình quan tâm đến cách tính chi phí, em xin tóm tắt như sau:\n• Phí giấy phép cố định theo năm, tính theo số người sử dụng và phạm vi phát hành (trực tuyến, OTT/truyền hình, quảng cáo trả phí).\n• Không tính thêm phí theo số bản nhạc hay số video, miễn là trong phạm vi giấy phép.\n• So với việc mua lẻ từng bản nhạc, giấy phép năm giúp đài chủ động hơn về ngân sách.\n\nNếu {anh_chi} cho em biết số người cần sử dụng và các nền tảng {cong_ty} đang phát hành nội dung, em sẽ gửi báo giá ước tính ngay trong ngày ạ.\n\nTrân trọng,\n{chu_ky}",
  "version": 8
 },
 {
  "step": 6,
  "channel": "email",
  "segment": "broadcaster",
  "title": "Chia tay lịch sự — đài truyền hình",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nEm đã gửi một vài email về giải pháp nhạc bản quyền cho {cong_ty}. Có lẽ thời điểm này chưa thật sự phù hợp, nên em xin phép tạm dừng để không làm phiền {anh_chi}.\n\nTrước khi dừng, em xin hỏi một câu: việc lựa chọn nhạc cho các chương trình của {cong_ty} hiện do bộ phận nào phụ trách ạ? Nếu {anh_chi} giới thiệu giúp, em xin chân thành cảm ơn.\n\nNếu {anh_chi} quan tâm, mỗi tháng em xin gửi một danh sách nhạc mới phù hợp với nội dung của {cong_ty}, hoàn toàn không nhằm mục đích chào bán.\n\nTrân trọng,\n{chu_ky}",
  "version": 8
 },
 {
  "step": 1,
  "channel": "email",
  "segment": "mcn",
  "title": "Email mở lời — MCN",
  "subject": "Nhạc bản quyền cho mạng lưới kênh của {cong_ty}: hạn chế khiếu nại, giữ doanh thu",
  "body": "Kính gửi {xung_ho},\n\n{cau_rieng}\n\nEm là {nguoi_gui}, phụ trách cấp phép âm nhạc của Epidemic Sound tại Việt Nam. Em xin phép liên hệ vì với các MCN, mỗi video bị khiếu nại bản quyền (claim) đồng nghĩa với doanh thu quảng cáo bị chia sẻ hoặc mất đi, trong khi đội vận hành phải kháng nghị từng video.\n\nGiấy phép năm của Epidemic Sound mang lại:\n• Hơn 55.000 bản nhạc, gồm cả các dòng đang thịnh hành như phonk, K-pop, lo-fi, EDM, để nhà sáng tạo nội dung chủ động lựa chọn.\n• Các kênh trong mạng lưới được đăng ký vào danh sách được cấp phép (safelist) và quản lý tập trung trên một cổng đối tác.\n• Không phát sinh thêm chi phí tác quyền; nếu có khiếu nại, Epidemic Sound chịu trách nhiệm xử lý.\n• Video đăng tải trong thời hạn giấy phép vẫn được sử dụng tiếp sau khi hết hạn.\n\nEm gửi kèm danh sách nhạc gợi ý cho vlog, gaming và giải trí: {playlist}\n\nCho em hỏi nhà sáng tạo nội dung trong mạng lưới của {cong_ty} hiện thường lấy nhạc nền từ đâu ạ?\n\nP.S. Nếu {anh_chi} gửi em đường link một video gần đây, em sẽ đề xuất ba phương án nhạc nền phù hợp trong 1–2 ngày làm việc, hoàn toàn miễn phí.\n\nTrân trọng,\n{chu_ky}",
  "version": 8
 },
 {
  "step": 2,
  "channel": "email",
  "segment": "mcn",
  "title": "Theo dõi 1: nếu video bị claim thì sao — MCN",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nTiếp nối email trước, em xin trả lời một câu hỏi nhiều MCN quan tâm: nếu video dùng nhạc Epidemic Sound vẫn bị khiếu nại bản quyền thì sao?\n\n• Các kênh trong mạng lưới của {cong_ty} được đăng ký vào danh sách được cấp phép (safelist), nên không bị khiếu nại tự động.\n• Nếu vẫn phát sinh khiếu nại, {anh_chi} chỉ cần gửi đường link, bên em sẽ xử lý gỡ bỏ.\n• Với khiếu nại vi phạm bản quyền, Epidemic Sound chịu trách nhiệm giải quyết.\n\nToàn bộ kênh YouTube trong mạng lưới được quản lý tập trung trên một cổng đối tác, giúp đội vận hành không phải kháng nghị cho từng video.\n\nEm xin phép gửi {anh_chi} bản hướng dẫn một trang về cách đăng ký kênh được không ạ?\n\nTrân trọng,\n{chu_ky}",
  "version": 8
 },
 {
  "step": 3,
  "channel": "email",
  "segment": "mcn",
  "title": "Theo dõi 2: thử nhạc miễn phí trên video thật — MCN",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nĐể {anh_chi} có thể đánh giá chất lượng âm nhạc trên chính nội dung của {cong_ty}, em xin đề xuất một thử nghiệm nhỏ, hoàn toàn miễn phí: {anh_chi} gửi em đường link một video gần đây, trong vòng 1–2 ngày làm việc em sẽ gửi lại:\n• Ba phương án nhạc nền từ kho Epidemic Sound, phù hợp với nhịp dựng của video;\n• Mỗi phương án kèm phiên bản rút gọn 15 và 30 giây, thực hiện bằng công cụ Adapt.\n\nRất mong nhận được đường link từ {anh_chi}; chỉ cần trả lời email này là được ạ.\n\nTrân trọng,\n{chu_ky}",
  "version": 8
 },
 {
  "step": 4,
  "channel": "email",
  "segment": "mcn",
  "title": "Theo dõi 3: quyền biểu diễn trước công chúng — MCN",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nEm xin chia sẻ một vấn đề pháp lý mà nhiều MCN tại Việt Nam quan tâm: khi nội dung được livestream hoặc trình chiếu tại sự kiện, bên cạnh quyền sử dụng bản nhạc còn có quyền biểu diễn trước công chúng, thường phải trả phí riêng cho tổ chức quản lý tác quyền.\n\nEpidemic Sound sở hữu toàn bộ quyền đối với kho nhạc và đã thanh toán cho nhạc sĩ ngay từ đầu (mô hình cấp phép trực tiếp – Direct Licensing). Vì vậy, ngoài phí giấy phép, {cong_ty} không phải trả thêm khoản phí nào cho tổ chức quản lý tác quyền.\n\nEm xin phép gửi {anh_chi} bản tóm tắt pháp lý một trang để bộ phận pháp chế của {cong_ty} tham khảo được không ạ?\n\nTrân trọng,\n{chu_ky}",
  "version": 8
 },
 {
  "step": 5,
  "channel": "email",
  "segment": "mcn",
  "title": "Theo dõi 4: chi phí tính thế nào — MCN",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nNhiều MCN quan tâm đến cách tính chi phí, em xin tóm tắt như sau:\n• Phí giấy phép cố định theo năm, tính theo số người sử dụng và phạm vi phát hành (trực tuyến, OTT/truyền hình, quảng cáo trả phí).\n• Không tính thêm phí theo số bản nhạc hay số video, miễn là trong phạm vi giấy phép.\n• Một giấy phép áp dụng cho toàn bộ mạng lưới, thay vì từng nhà sáng tạo nội dung tự mua nhạc riêng lẻ.\n\nNếu {anh_chi} cho em biết số người cần sử dụng và các nền tảng {cong_ty} đang phát hành nội dung, em sẽ gửi báo giá ước tính ngay trong ngày ạ.\n\nTrân trọng,\n{chu_ky}",
  "version": 8
 },
 {
  "step": 6,
  "channel": "email",
  "segment": "mcn",
  "title": "Chia tay lịch sự — MCN",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nEm đã gửi một vài email về giải pháp nhạc bản quyền cho {cong_ty}. Có lẽ thời điểm này chưa thật sự phù hợp, nên em xin phép tạm dừng để không làm phiền {anh_chi}.\n\nTrước khi dừng, em xin hỏi một câu: việc lựa chọn nhạc cho các kênh trong mạng lưới của {cong_ty} hiện do bộ phận nào phụ trách ạ? Nếu {anh_chi} giới thiệu giúp, em xin chân thành cảm ơn.\n\nNếu {anh_chi} quan tâm, mỗi tháng em xin gửi một danh sách nhạc mới phù hợp với nội dung của {cong_ty}, hoàn toàn không nhằm mục đích chào bán.\n\nTrân trọng,\n{chu_ky}",
  "version": 8
 },
 {
  "step": 1,
  "channel": "email",
  "segment": "agency",
  "title": "Email mở lời — production house / agency",
  "subject": "Nhạc bản quyền cho các dự án TVC của {cong_ty}",
  "body": "Kính gửi {xung_ho},\n\n{cau_rieng}\n\nEm là {nguoi_gui}, phụ trách cấp phép âm nhạc của Epidemic Sound tại Việt Nam. Em xin phép liên hệ vì nhiều đơn vị sản xuất gặp tình trạng TVC đã bàn giao bị khiếu nại bản quyền (claim) khi khách hàng đăng lên YouTube, và agency thường là bên phải giải trình.\n\nGiấy phép năm của Epidemic Sound mang lại:\n• Hơn 55.000 bản nhạc và 250.000 hiệu ứng âm thanh, kèm bản tách lớp (stems) và công cụ Adapt rút gọn bản nhạc thành 15, 30 hoặc 60 giây.\n• Khách hàng của {cong_ty} được quyền đăng tải sản phẩm do {cong_ty} thực hiện trên YouTube, Facebook, TikTok và truyền hình.\n• Không phát sinh thêm chi phí tác quyền; nếu có khiếu nại, Epidemic Sound chịu trách nhiệm xử lý.\n• Sản phẩm hoàn thành trong thời hạn giấy phép vẫn được sử dụng tiếp sau khi hết hạn.\n\nEm gửi kèm danh sách nhạc gợi ý cho TVC và video doanh nghiệp: {playlist}\n\nCho em hỏi hiện nay {cong_ty} đang mua nhạc theo từng dự án hay sử dụng thư viện nhạc nào ạ?\n\nP.S. Nếu {anh_chi} gửi em đường link một video gần đây, em sẽ đề xuất ba phương án nhạc nền phù hợp trong 1–2 ngày làm việc, hoàn toàn miễn phí.\n\nTrân trọng,\n{chu_ky}",
  "version": 8
 },
 {
  "step": 2,
  "channel": "email",
  "segment": "agency",
  "title": "Theo dõi 1: nếu video bị claim thì sao — production house / agency",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nTiếp nối email trước, em xin trả lời một câu hỏi nhiều đơn vị sản xuất quan tâm: nếu video dùng nhạc Epidemic Sound vẫn bị khiếu nại bản quyền thì sao?\n\n• Các kênh YouTube, Facebook của {cong_ty} được đăng ký vào danh sách được cấp phép (safelist), nên không bị khiếu nại tự động.\n• Nếu vẫn phát sinh khiếu nại, {anh_chi} chỉ cần gửi đường link, bên em sẽ xử lý gỡ bỏ.\n• Với khiếu nại vi phạm bản quyền, Epidemic Sound chịu trách nhiệm giải quyết.\n\nVới các TVC do {cong_ty} thực hiện, nếu kênh của khách hàng bị khiếu nại, {cong_ty} chỉ cần gửi đường link để bên em hỗ trợ xử lý.\n\nEm xin phép gửi {anh_chi} bản hướng dẫn một trang về cách đăng ký kênh được không ạ?\n\nTrân trọng,\n{chu_ky}",
  "version": 8
 },
 {
  "step": 3,
  "channel": "email",
  "segment": "agency",
  "title": "Theo dõi 2: thử nhạc miễn phí trên video thật — production house / agency",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nĐể {anh_chi} có thể đánh giá chất lượng âm nhạc trên chính nội dung của {cong_ty}, em xin đề xuất một thử nghiệm nhỏ, hoàn toàn miễn phí: {anh_chi} gửi em đường link một video gần đây, trong vòng 1–2 ngày làm việc em sẽ gửi lại:\n• Ba phương án nhạc nền từ kho Epidemic Sound, phù hợp với nhịp dựng của video;\n• Mỗi phương án kèm phiên bản rút gọn 15 và 30 giây, thực hiện bằng công cụ Adapt.\n\nRất mong nhận được đường link từ {anh_chi}; chỉ cần trả lời email này là được ạ.\n\nTrân trọng,\n{chu_ky}",
  "version": 8
 },
 {
  "step": 4,
  "channel": "email",
  "segment": "agency",
  "title": "Theo dõi 3: quyền biểu diễn trước công chúng — production house / agency",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nEm xin chia sẻ một vấn đề pháp lý mà nhiều đơn vị sản xuất tại Việt Nam quan tâm: khi phát sóng TVC trên truyền hình hoặc trình chiếu video tại sự kiện, bên cạnh quyền sử dụng bản nhạc còn có quyền biểu diễn trước công chúng, thường phải trả phí riêng cho tổ chức quản lý tác quyền.\n\nEpidemic Sound sở hữu toàn bộ quyền đối với kho nhạc và đã thanh toán cho nhạc sĩ ngay từ đầu (mô hình cấp phép trực tiếp – Direct Licensing). Vì vậy, ngoài phí giấy phép, {cong_ty} không phải trả thêm khoản phí nào cho tổ chức quản lý tác quyền.\n\nEm xin phép gửi {anh_chi} bản tóm tắt pháp lý một trang để bộ phận pháp chế của {cong_ty} tham khảo được không ạ?\n\nTrân trọng,\n{chu_ky}",
  "version": 8
 },
 {
  "step": 5,
  "channel": "email",
  "segment": "agency",
  "title": "Theo dõi 4: chi phí tính thế nào — production house / agency",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nNhiều đơn vị sản xuất quan tâm đến cách tính chi phí, em xin tóm tắt như sau:\n• Phí giấy phép cố định theo năm, tính theo số người sử dụng và phạm vi phát hành (trực tuyến, OTT/truyền hình, quảng cáo trả phí).\n• Không tính thêm phí theo số bản nhạc hay số video, miễn là trong phạm vi giấy phép.\n• Chi phí được phân bổ cho tất cả dự án trong năm, thường tiết kiệm hơn so với mua lẻ từng bản nhạc.\n\nNếu {anh_chi} cho em biết số người cần sử dụng và các nền tảng {cong_ty} đang phát hành nội dung, em sẽ gửi báo giá ước tính ngay trong ngày ạ.\n\nTrân trọng,\n{chu_ky}",
  "version": 8
 },
 {
  "step": 6,
  "channel": "email",
  "segment": "agency",
  "title": "Chia tay lịch sự — production house / agency",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nEm đã gửi một vài email về giải pháp nhạc bản quyền cho {cong_ty}. Có lẽ thời điểm này chưa thật sự phù hợp, nên em xin phép tạm dừng để không làm phiền {anh_chi}.\n\nTrước khi dừng, em xin hỏi một câu: việc lựa chọn nhạc cho các dự án của {cong_ty} hiện do bộ phận nào phụ trách ạ? Nếu {anh_chi} giới thiệu giúp, em xin chân thành cảm ơn.\n\nNếu {anh_chi} quan tâm, mỗi tháng em xin gửi một danh sách nhạc mới phù hợp với nội dung của {cong_ty}, hoàn toàn không nhằm mục đích chào bán.\n\nTrân trọng,\n{chu_ky}",
  "version": 8
 },
 {
  "step": 1,
  "channel": "email",
  "segment": "film",
  "title": "Email mở lời — hãng phim / hậu kỳ",
  "subject": "Âm nhạc và hiệu ứng âm thanh bản quyền cho phim, trailer của {cong_ty}",
  "body": "Kính gửi {xung_ho},\n\n{cau_rieng}\n\nEm là {nguoi_gui}, phụ trách cấp phép âm nhạc của Epidemic Sound tại Việt Nam. Em xin phép liên hệ vì với phim và trailer, nhạc nền chưa rõ quyền thường chỉ lộ ra đúng lúc phát hành: bị khiếu nại bản quyền (claim) hoặc phải thay nhạc vào phút chót.\n\nGiấy phép năm của Epidemic Sound mang lại:\n• Hơn 55.000 bản nhạc kèm bản tách lớp (stems), định dạng WAV 24-bit/48 kHz, cùng 250.000 hiệu ứng âm thanh cho hậu kỳ.\n• Quyền sử dụng rõ ràng cho phim, trailer và teaser theo phạm vi giấy phép (trực tuyến, OTT, truyền hình).\n• Không phát sinh thêm chi phí tác quyền; nếu có khiếu nại, Epidemic Sound chịu trách nhiệm xử lý.\n• Phim hoàn thành trong thời hạn giấy phép vẫn được phát hành tiếp sau khi hết hạn.\n\nEm gửi kèm danh sách nhạc gợi ý cho trailer và phim: {playlist}\n\nCho em hỏi hiện nay {cong_ty} đang xử lý phần nhạc nền cho trailer và nội dung quảng bá như thế nào ạ?\n\nP.S. Nếu {anh_chi} gửi em đường link một trailer hoặc một cảnh phim gần đây, em sẽ đề xuất ba phương án nhạc nền phù hợp trong 1–2 ngày làm việc, hoàn toàn miễn phí.\n\nTrân trọng,\n{chu_ky}",
  "version": 8
 },
 {
  "step": 2,
  "channel": "email",
  "segment": "film",
  "title": "Theo dõi 1: nếu video bị claim thì sao — hãng phim / hậu kỳ",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nTiếp nối email trước, em xin trả lời một câu hỏi nhiều hãng phim quan tâm: nếu video dùng nhạc Epidemic Sound vẫn bị khiếu nại bản quyền thì sao?\n\n• Các kênh YouTube, Facebook của {cong_ty} và của từng phim được đăng ký vào danh sách được cấp phép (safelist), nên không bị khiếu nại tự động.\n• Nếu vẫn phát sinh khiếu nại, {anh_chi} chỉ cần gửi đường link, bên em sẽ xử lý gỡ bỏ.\n• Với khiếu nại vi phạm bản quyền, Epidemic Sound chịu trách nhiệm giải quyết.\n\nNhờ vậy, trailer và phim phát hành trên nền tảng trực tuyến sẽ không bị khiếu nại vào thời điểm ra mắt.\n\nEm xin phép gửi {anh_chi} bản hướng dẫn một trang về cách đăng ký kênh được không ạ?\n\nTrân trọng,\n{chu_ky}",
  "version": 8
 },
 {
  "step": 3,
  "channel": "email",
  "segment": "film",
  "title": "Theo dõi 2: thử nhạc miễn phí trên video thật — hãng phim / hậu kỳ",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nĐể {anh_chi} có thể đánh giá chất lượng âm nhạc trên chính nội dung của {cong_ty}, em xin đề xuất một thử nghiệm nhỏ, hoàn toàn miễn phí: {anh_chi} gửi em đường link một trailer hoặc một cảnh phim gần đây, trong vòng 1–2 ngày làm việc em sẽ gửi lại:\n• Ba phương án nhạc nền từ kho Epidemic Sound, phù hợp với nhịp dựng của video;\n• Mỗi phương án kèm phiên bản rút gọn 15 và 30 giây, thực hiện bằng công cụ Adapt.\n\nRất mong nhận được đường link từ {anh_chi}; chỉ cần trả lời email này là được ạ.\n\nTrân trọng,\n{chu_ky}",
  "version": 8
 },
 {
  "step": 4,
  "channel": "email",
  "segment": "film",
  "title": "Theo dõi 3: quyền biểu diễn trước công chúng — hãng phim / hậu kỳ",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nEm xin chia sẻ một vấn đề pháp lý mà nhiều hãng phim tại Việt Nam quan tâm: khi chiếu phim, phát trailer tại sự kiện hoặc trên truyền hình, bên cạnh quyền sử dụng bản nhạc còn có quyền biểu diễn trước công chúng, thường phải trả phí riêng cho tổ chức quản lý tác quyền.\n\nEpidemic Sound sở hữu toàn bộ quyền đối với kho nhạc và đã thanh toán cho nhạc sĩ ngay từ đầu (mô hình cấp phép trực tiếp – Direct Licensing). Vì vậy, ngoài phí giấy phép, {cong_ty} không phải trả thêm khoản phí nào cho tổ chức quản lý tác quyền.\n\nEm xin phép gửi {anh_chi} bản tóm tắt pháp lý một trang để bộ phận pháp chế của {cong_ty} tham khảo được không ạ?\n\nTrân trọng,\n{chu_ky}",
  "version": 8
 },
 {
  "step": 5,
  "channel": "email",
  "segment": "film",
  "title": "Theo dõi 4: chi phí tính thế nào — hãng phim / hậu kỳ",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nNhiều hãng phim quan tâm đến cách tính chi phí, em xin tóm tắt như sau:\n• Phí giấy phép cố định theo năm, tính theo số người sử dụng và phạm vi phát hành (trực tuyến, OTT/truyền hình, quảng cáo trả phí).\n• Không tính thêm phí theo số bản nhạc hay số video, miễn là trong phạm vi giấy phép.\n• Bao gồm cả nhạc và hiệu ứng âm thanh, không cần mua riêng cho từng bộ phim.\n\nNếu {anh_chi} cho em biết số người cần sử dụng và các nền tảng {cong_ty} đang phát hành nội dung, em sẽ gửi báo giá ước tính ngay trong ngày ạ.\n\nTrân trọng,\n{chu_ky}",
  "version": 8
 },
 {
  "step": 6,
  "channel": "email",
  "segment": "film",
  "title": "Chia tay lịch sự — hãng phim / hậu kỳ",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nEm đã gửi một vài email về giải pháp nhạc bản quyền cho {cong_ty}. Có lẽ thời điểm này chưa thật sự phù hợp, nên em xin phép tạm dừng để không làm phiền {anh_chi}.\n\nTrước khi dừng, em xin hỏi một câu: việc lựa chọn nhạc cho phim và trailer của {cong_ty} hiện do bộ phận nào phụ trách ạ? Nếu {anh_chi} giới thiệu giúp, em xin chân thành cảm ơn.\n\nNếu {anh_chi} quan tâm, mỗi tháng em xin gửi một danh sách nhạc mới phù hợp với nội dung của {cong_ty}, hoàn toàn không nhằm mục đích chào bán.\n\nTrân trọng,\n{chu_ky}",
  "version": 8
 },
 {
  "step": 1,
  "channel": "email",
  "segment": "brand",
  "title": "Email mở lời — nhãn hàng",
  "subject": "Một giấy phép âm nhạc cho toàn bộ nội dung thương hiệu {cong_ty}",
  "body": "Kính gửi {xung_ho},\n\n{cau_rieng}\n\nEm là {nguoi_gui}, phụ trách cấp phép âm nhạc của Epidemic Sound tại Việt Nam. Em xin phép liên hệ vì khi nhiều agency cùng làm nội dung cho một thương hiệu, chỉ một video dùng nhạc chưa rõ quyền cũng có thể bị tắt tiếng hoặc gỡ quảng cáo.\n\nGiấy phép năm của Epidemic Sound mang lại:\n• Hơn 55.000 bản nhạc và 250.000 hiệu ứng âm thanh cho mạng xã hội, quảng cáo, livestream và sự kiện.\n• Các agency đối tác được sử dụng chung giấy phép khi thực hiện nội dung cho {cong_ty}; kênh của {cong_ty} được đăng ký vào danh sách được cấp phép (safelist).\n• Không phát sinh thêm chi phí tác quyền; nếu có khiếu nại, Epidemic Sound chịu trách nhiệm xử lý.\n• Video đăng tải trong thời hạn giấy phép vẫn được sử dụng tiếp sau khi hết hạn.\n\nEm gửi kèm danh sách nhạc gợi ý cho video thương hiệu: {playlist}\n\nCho em hỏi hiện nay video của {cong_ty} do đội ngũ nội bộ hay agency thực hiện, và nhạc nền đang được lấy từ nguồn nào ạ?\n\nP.S. Nếu {anh_chi} gửi em đường link một video quảng cáo gần đây, em sẽ đề xuất ba phương án nhạc nền phù hợp trong 1–2 ngày làm việc, hoàn toàn miễn phí.\n\nTrân trọng,\n{chu_ky}",
  "version": 8
 },
 {
  "step": 2,
  "channel": "email",
  "segment": "brand",
  "title": "Theo dõi 1: nếu video bị claim thì sao — nhãn hàng",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nTiếp nối email trước, em xin trả lời một câu hỏi nhiều nhãn hàng quan tâm: nếu video dùng nhạc Epidemic Sound vẫn bị khiếu nại bản quyền thì sao?\n\n• Các kênh YouTube, Facebook, Instagram của {cong_ty} được đăng ký vào danh sách được cấp phép (safelist), nên không bị khiếu nại tự động.\n• Nếu vẫn phát sinh khiếu nại, {anh_chi} chỉ cần gửi đường link, bên em sẽ xử lý gỡ bỏ.\n• Với khiếu nại vi phạm bản quyền, Epidemic Sound chịu trách nhiệm giải quyết.\n\nCác agency đối tác sử dụng chung giấy phép, nên mọi video trên kênh của {cong_ty} đều có nguồn nhạc rõ ràng.\n\nEm xin phép gửi {anh_chi} bản hướng dẫn một trang về cách đăng ký kênh được không ạ?\n\nTrân trọng,\n{chu_ky}",
  "version": 8
 },
 {
  "step": 3,
  "channel": "email",
  "segment": "brand",
  "title": "Theo dõi 2: thử nhạc miễn phí trên video thật — nhãn hàng",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nĐể {anh_chi} có thể đánh giá chất lượng âm nhạc trên chính nội dung của {cong_ty}, em xin đề xuất một thử nghiệm nhỏ, hoàn toàn miễn phí: {anh_chi} gửi em đường link một video quảng cáo gần đây, trong vòng 1–2 ngày làm việc em sẽ gửi lại:\n• Ba phương án nhạc nền từ kho Epidemic Sound, phù hợp với nhịp dựng của video;\n• Mỗi phương án kèm phiên bản rút gọn 15 và 30 giây, thực hiện bằng công cụ Adapt.\n\nRất mong nhận được đường link từ {anh_chi}; chỉ cần trả lời email này là được ạ.\n\nTrân trọng,\n{chu_ky}",
  "version": 8
 },
 {
  "step": 4,
  "channel": "email",
  "segment": "brand",
  "title": "Theo dõi 3: quyền biểu diễn trước công chúng — nhãn hàng",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nEm xin chia sẻ một vấn đề pháp lý mà nhiều nhãn hàng tại Việt Nam quan tâm: khi phát video quảng cáo, livestream hoặc trình chiếu tại sự kiện, bên cạnh quyền sử dụng bản nhạc còn có quyền biểu diễn trước công chúng, thường phải trả phí riêng cho tổ chức quản lý tác quyền.\n\nEpidemic Sound sở hữu toàn bộ quyền đối với kho nhạc và đã thanh toán cho nhạc sĩ ngay từ đầu (mô hình cấp phép trực tiếp – Direct Licensing). Vì vậy, ngoài phí giấy phép, {cong_ty} không phải trả thêm khoản phí nào cho tổ chức quản lý tác quyền.\n\nEm xin phép gửi {anh_chi} bản tóm tắt pháp lý một trang để bộ phận pháp chế của {cong_ty} tham khảo được không ạ?\n\nTrân trọng,\n{chu_ky}",
  "version": 8
 },
 {
  "step": 5,
  "channel": "email",
  "segment": "brand",
  "title": "Theo dõi 4: chi phí tính thế nào — nhãn hàng",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nNhiều nhãn hàng quan tâm đến cách tính chi phí, em xin tóm tắt như sau:\n• Phí giấy phép cố định theo năm, tính theo số người sử dụng và phạm vi phát hành (trực tuyến, OTT/truyền hình, quảng cáo trả phí).\n• Không tính thêm phí theo số bản nhạc hay số video, miễn là trong phạm vi giấy phép.\n• Dùng chung cho đội ngũ marketing và các agency đối tác, không cần mua nhạc riêng cho từng chiến dịch.\n\nNếu {anh_chi} cho em biết số người cần sử dụng và các nền tảng {cong_ty} đang phát hành nội dung, em sẽ gửi báo giá ước tính ngay trong ngày ạ.\n\nTrân trọng,\n{chu_ky}",
  "version": 8
 },
 {
  "step": 6,
  "channel": "email",
  "segment": "brand",
  "title": "Chia tay lịch sự — nhãn hàng",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nEm đã gửi một vài email về giải pháp nhạc bản quyền cho {cong_ty}. Có lẽ thời điểm này chưa thật sự phù hợp, nên em xin phép tạm dừng để không làm phiền {anh_chi}.\n\nTrước khi dừng, em xin hỏi một câu: việc lựa chọn nhạc cho video thương hiệu của {cong_ty} hiện do bộ phận nào phụ trách ạ? Nếu {anh_chi} giới thiệu giúp, em xin chân thành cảm ơn.\n\nNếu {anh_chi} quan tâm, mỗi tháng em xin gửi một danh sách nhạc mới phù hợp với nội dung của {cong_ty}, hoàn toàn không nhằm mục đích chào bán.\n\nTrân trọng,\n{chu_ky}",
  "version": 8
 },
 {
  "step": 13,
  "channel": "email",
  "segment": "all",
  "title": "Hỏi nhu cầu (3 câu hỏi)",
  "subject": "Re: {tieu_de_dau}",
  "body": "Kính gửi {xung_ho},\n\nEm cảm ơn {anh_chi} đã phản hồi. Để đề xuất gói giấy phép phù hợp nhất, em xin phép hỏi nhanh ba thông tin dưới đây; {anh_chi} chỉ cần trả lời ngắn qua email ạ:\n1. {cong_ty} chủ yếu sản xuất loại nội dung nào, khoảng bao nhiêu video mỗi tháng?\n2. Nội dung được phát hành trên những nền tảng nào (YouTube, Facebook, TikTok, truyền hình, sự kiện…)?\n3. Có bao nhiêu thành viên trong đội ngũ cần sử dụng nhạc?\n\nNếu thuận tiện trao đổi trực tiếp, em xin đề xuất một cuộc gọi trực tuyến 20 phút vào [Thứ …, … giờ] hoặc [Thứ …, … giờ].\n\nTrân trọng,\n{chu_ky}",
  "version": 8
 },
 {
  "step": 14,
  "channel": "email",
  "segment": "all",
  "title": "Gửi minh hoạ nhạc trên nội dung của khách",
  "subject": "Phương án âm nhạc cho {cong_ty}",
  "body": "Kính gửi {xung_ho},\n\nNhư đã trao đổi, em xin gửi {anh_chi} phương án âm nhạc dành cho {cong_ty}:\n• Ba lựa chọn nhạc nền cho [tên video / dự án]: [link 1], [link 2], [link 3]\n• Video hướng dẫn ngắn cách tìm nhạc, tải bản tách lớp (stems) và rút gọn bằng công cụ Adapt: [link]\n\nNếu {anh_chi} thấy phù hợp, em sẽ gửi báo giá dựa trên số người sử dụng và các nền tảng {anh_chi} đã chia sẻ.\n\nTrân trọng,\n{chu_ky}",
  "version": 8
 },
 {
  "step": 15,
  "channel": "email",
  "segment": "all",
  "title": "Gửi đề xuất & báo giá",
  "subject": "Đề xuất hợp tác Epidemic Sound – {cong_ty}",
  "body": "Kính gửi {xung_ho},\n\nEm xin gửi {anh_chi} đề xuất hợp tác dành cho {cong_ty} (tệp đính kèm), tóm tắt như sau:\n• Phạm vi sử dụng: [số người dùng / kênh / nền tảng]\n• Phí giấy phép: [… /năm]\n• Thời gian bắt đầu dự kiến: [ngày]\n\nKính mong {anh_chi} xem xét và cho em biết nếu có điểm nào cần làm rõ hoặc điều chỉnh.\n\nTrân trọng,\n{chu_ky}",
  "version": 8
 },
 {
  "step": 16,
  "channel": "email",
  "segment": "all",
  "title": "Email theo dõi đề xuất",
  "subject": "Re: Đề xuất hợp tác Epidemic Sound – {cong_ty}",
  "body": "Kính gửi {xung_ho},\n\nEm xin phép hỏi {anh_chi} đã có dịp xem qua đề xuất em gửi hôm trước chưa ạ? Nếu cần, em có thể:\n• Điều chỉnh phạm vi (số người dùng, nền tảng) cho phù hợp với ngân sách;\n• Gửi bản tóm tắt một trang để {anh_chi} thuận tiện trình duyệt nội bộ.\n\nNgoài {anh_chi}, cho em hỏi thêm còn ai tham gia phê duyệt và thời gian dự kiến có quyết định là khi nào ạ?\n\nTrân trọng,\n{chu_ky}",
  "version": 8
 },
 {
  "step": 17,
  "channel": "email",
  "segment": "all",
  "title": "Email tóm tắt cho người phê duyệt",
  "subject": "Tóm tắt đề xuất Epidemic Sound cho {cong_ty}",
  "body": "Kính gửi {xung_ho},\n\nĐể {anh_chi} thuận tiện trình duyệt, em xin gửi bản tóm tắt ngắn có thể chuyển tiếp trực tiếp cho người phê duyệt:\n• Vấn đề: nhạc nền chưa có giấy phép rõ ràng, dẫn đến rủi ro bị khiếu nại bản quyền, tắt tiếng video và phát sinh phí tác quyền.\n• Giải pháp: một giấy phép Epidemic Sound cho [số người dùng], sử dụng trên [nền tảng], đã bao gồm quyền biểu diễn trước công chúng.\n• Chi phí: [… /năm], chi tiết trong báo giá đính kèm.\n\nNếu người phê duyệt có câu hỏi, em sẵn sàng giải đáp qua email hoặc một cuộc gọi trực tuyến ngắn.\n\nTrân trọng,\n{chu_ky}",
  "version": 8
 },
 {
  "step": 18,
  "channel": "email",
  "segment": "all",
  "title": "Trả lời băn khoăn",
  "subject": "Re: Đề xuất hợp tác Epidemic Sound – {cong_ty}",
  "body": "Kính gửi {xung_ho},\n\nEm cảm ơn {anh_chi} đã chia sẻ băn khoăn về [giá / điều khoản / kỹ thuật]. Em xin phép giải đáp như sau:\n\n[Dán câu trả lời phù hợp từ Kho nội dung → Xử lý từ chối]\n\nNếu còn điểm nào chưa rõ, {anh_chi} cứ phản hồi qua email này, em sẽ trả lời trong ngày.\n\nTrân trọng,\n{chu_ky}",
  "version": 8
 },
 {
  "step": 19,
  "channel": "email",
  "segment": "all",
  "title": "Gửi hợp đồng",
  "subject": "Hợp đồng cấp phép Epidemic Sound – {cong_ty}",
  "body": "Kính gửi {xung_ho},\n\nEm xin chân thành cảm ơn {anh_chi} đã đồng ý hợp tác. Em gửi kèm hợp đồng để {anh_chi} xem xét và ký kết. Các bước tiếp theo như sau:\n1. {cong_ty} ký và gửi lại hợp đồng (bản scan hoặc chữ ký điện tử).\n2. Em gửi hoá đơn và hướng dẫn thanh toán.\n3. Em kích hoạt tài khoản cho {cong_ty} ngay khi hoàn tất thủ tục.\n\nNếu cần điều chỉnh điều khoản nào, {anh_chi} vui lòng phản hồi qua email này.\n\nTrân trọng,\n{chu_ky}",
  "version": 8
 },
 {
  "step": 90,
  "channel": "email",
  "segment": "all",
  "title": "Điểm chạm nuôi dưỡng (cập nhật, không chào bán)",
  "subject": "Nhạc mới tháng này dành cho {cong_ty}",
  "body": "Kính gửi {xung_ho},\n\nEm xin gửi {anh_chi} danh sách nhạc mới được tuyển chọn trong tháng, phù hợp với nội dung của {cong_ty}: {playlist}\n\nKhi {cong_ty} có dự án mới cần đến âm nhạc, em luôn sẵn sàng hỗ trợ.\n\nTrân trọng,\n{chu_ky}",
  "version": 8
 }
]$json$::jsonb
$fn$;
revoke execute on function public.default_message_templates_v8() from public, anon;
grant execute on function public.default_message_templates_v8() to authenticated;

-- Nút “Dùng bộ mới” ở Kho nội dung: sao lưu bản đang dùng, thay bằng lịch v6 + mẫu v8.
create or replace function public.apply_sales_defaults() returns void
language plpgsql security definer set search_path = '' as $fn$
begin
  if not public.is_admin() then
    raise exception 'Chỉ admin được thay lịch và nội dung soạn sẵn' using errcode = '42501';
  end if;
  insert into public.settings (key, value)
  select 'message_templates_backup_v7', value from public.settings
   where key = 'message_templates' and coalesce(value->0->>'version', '') <> '8'
  on conflict (key) do update set value = excluded.value, updated_at = now();
  insert into public.settings (key, value)
  select 'cadence_backup_v5', value from public.settings
   where key = 'cadence' and value is distinct from public.default_cadence_v6()
  on conflict (key) do update set value = excluded.value, updated_at = now();
  update public.settings set value = public.default_cadence_v6(), updated_at = now() where key = 'cadence';
  update public.settings set value = public.default_message_templates_v8(), updated_at = now() where key = 'message_templates';
  update public.deals d set next_action = m.new_title
  from (values
    ('Email theo dõi 1: rủi ro bản quyền', 'Email theo dõi 1: nếu video bị claim thì sao'),
    ('Email theo dõi 4: đơn vị cùng ngành dùng thế nào', 'Email theo dõi 4: chi phí tính thế nào')
  ) as m(old_title, new_title)
  where d.next_action = m.old_title and d.stage not in ('won', 'lost');
end $fn$;
revoke execute on function public.apply_sales_defaults() from public, anon;
grant execute on function public.apply_sales_defaults() to authenticated;

-- Bộ đang dùng đúng nguyên bản v7 (chưa sửa) → thay bằng v8, có sao lưu. Trả về true nếu đã thay.
create or replace function public.upgrade_templates_v8() returns boolean
language plpgsql volatile security definer set search_path = '' as $fn$
begin
  if not exists (select 1 from public.settings where key = 'message_templates' and value = public.default_message_templates_v7()) then
    return false;
  end if;
  insert into public.settings (key, value)
  select 'message_templates_backup_v7', value from public.settings where key = 'message_templates'
  on conflict (key) do update set value = excluded.value, updated_at = now();
  update public.settings set value = public.default_message_templates_v8(), updated_at = now() where key = 'message_templates';
  return true;
end $fn$;
revoke execute on function public.upgrade_templates_v8() from public, anon, authenticated;

select public.upgrade_templates_v8();
