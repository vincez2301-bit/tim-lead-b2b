-- Bộ email v2 theo giọng của Licensing Manager Epidemic Sound tại Việt Nam:
-- email chính theo nhóm khách (ngắn, cá nhân hoá, một lời mời duy nhất) + 4 email follow-up, mỗi email một góc mới.
-- Chỉ ghi đè khi người dùng CHƯA sửa (updated_by is null).

update public.settings
   set value = $json${"name": "Việt", "title": "Licensing Manager", "company": "Epidemic Sound tại Việt Nam", "phone": ""}$json$::jsonb
 where key = 'sender' and updated_by is null;

update public.settings
   set value = $json$[
    {"step": 1, "channel": "linkedin", "segment": "all", "title": "Lời mời kết nối LinkedIn (≤ 300 ký tự)",
     "body": "Chào {ten}, em là {nguoi_gui} – {chuc_danh} của Epidemic Sound tại Việt Nam. Em đang làm việc với các đài, MCN và production house về nhạc bản quyền cho nội dung số. Rất mong được kết nối với anh/chị!"},

    {"step": 2, "channel": "email", "segment": "broadcaster", "title": "Email chính — đài truyền hình",
     "subject": "{cong_ty}: nhạc bản quyền cho chương trình, không phát sinh phí tác quyền",
     "body": "Chào anh/chị {ten},\n\nEm là {nguoi_gui} – {chuc_danh} của Epidemic Sound tại Việt Nam. {cong_ty} sản xuất nhiều chương trình phát cả trên sóng lẫn YouTube/Facebook, nên em xin gửi anh/chị một cách dùng nhạc nền gọn và an toàn hơn:\n\n• Hơn 55.000 bài nhạc và 250.000 SFX cho bản tin, gameshow, phim truyền hình, TVC và nội dung digital.\n• Direct Licensing: đã bao gồm quyền biểu diễn trước công chúng — không phát sinh phí với Trung tâm/Hiệp hội tác quyền, chỉ một chủ sở hữu duy nhất cấp phép.\n• Adapt (AI): cắt một bài thành bản 15s/30s/60s, bỏ vocal để chừa chỗ voice-over chỉ trong vài giây.\n\nPlaylist mẫu cho mảng tin tức – giải trí: {playlist}\n\nAnh/chị có tiện 15 phút trong tuần này để em hiểu cách {cong_ty} đang dùng nhạc không ạ?\n\nTrân trọng,\n{chu_ky}"},
    {"step": 2, "channel": "email", "segment": "mcn", "title": "Email chính — MCN / mạng creator",
     "subject": "{cong_ty}: một giấy phép nhạc cho cả mạng lưới creator",
     "body": "Chào anh/chị {ten},\n\nEm là {nguoi_gui} – {chuc_danh} của Epidemic Sound tại Việt Nam. Với một MCN như {cong_ty}, nhạc nền vừa phải đủ nhiều cho hàng trăm video mỗi tuần, vừa không được để kênh bị claim.\n\n• Hơn 55.000 bài nhạc, 250.000 SFX dùng cho YouTube, TikTok, Facebook, livestream.\n• Direct Licensing từ một chủ sở hữu duy nhất — creator không phải tự xin quyền từng bài.\n• Adapt và Studio (AI): đổi độ dài, mood, bỏ vocal, hoặc upload video để nhận nhạc khớp cảnh trong vài giây.\n\nPlaylist mẫu cho nội dung creator: {playlist}\n\nAnh/chị có 15 phút trong tuần này để em trình bày cách triển khai cho cả mạng lưới không ạ?\n\nTrân trọng,\n{chu_ky}"},
    {"step": 2, "channel": "email", "segment": "agency", "title": "Email chính — production house / agency",
     "subject": "{cong_ty}: dựng nhạc cho TVC nhanh hơn, pháp lý gọn cho khách hàng",
     "body": "Chào anh/chị {ten},\n\nEm là {nguoi_gui} – {chuc_danh} của Epidemic Sound tại Việt Nam. Production house thường mất nhiều thời gian tìm nhạc, cắt bản 15s/30s và giải thích pháp lý cho nhãn hàng — Epidemic Sound gom cả ba vào một:\n\n• Hơn 55.000 bài nhạc kèm stems, 250.000 SFX, dùng cho TVC, social ads, livestream, nội dung nhãn hàng.\n• Adapt (AI): một bài gốc thành bản 15s/30s/60s, đổi mood, bỏ vocal cho voice-over; Studio: upload video, nhận nhạc khớp cảnh trong vài giây.\n• Direct Licensing, đã gồm quyền biểu diễn trước công chúng — khách hàng của {cong_ty} không phát sinh phí tác quyền riêng.\n\nPlaylist mẫu cho TVC / corporate: {playlist}\n\nAnh/chị có tiện 15 phút trong tuần này không ạ?\n\nTrân trọng,\n{chu_ky}"},
    {"step": 2, "channel": "email", "segment": "film", "title": "Email chính — hãng phim / hậu kỳ",
     "subject": "{cong_ty}: nhạc và SFX bản quyền cho trailer, teaser, phim",
     "body": "Chào anh/chị {ten},\n\nEm là {nguoi_gui} – {chuc_danh} của Epidemic Sound tại Việt Nam. Với các dự án phim và hậu kỳ của {cong_ty}, em nghĩ ba điểm này sẽ hữu ích:\n\n• Hơn 55.000 bài nhạc (có stems và Versions) cùng 250.000 SFX cho trailer, teaser, phim tài liệu và phim dài tập.\n• Soundmatch: tìm bài tương tự bản nhạc tạm (temp track) đang dùng trong bản dựng.\n• Direct Licensing từ một chủ sở hữu duy nhất, đã gồm quyền biểu diễn trước công chúng.\n\nPlaylist mẫu trailer / điện ảnh: {playlist}\n\nAnh/chị có 15 phút trong tuần này để trao đổi về các dự án sắp tới không ạ?\n\nTrân trọng,\n{chu_ky}"},
    {"step": 2, "channel": "email", "segment": "brand", "title": "Email chính — nhãn hàng",
     "subject": "{cong_ty}: một nguồn nhạc bản quyền cho social, quảng cáo và livestream",
     "body": "Chào anh/chị {ten},\n\nEm là {nguoi_gui} – {chuc_danh} của Epidemic Sound tại Việt Nam. Đội marketing của {cong_ty} và các agency đối tác có thể dùng chung một nguồn nhạc bản quyền:\n\n• Hơn 55.000 bài nhạc, 250.000 SFX cho social ads, TVC, livestream và nội dung thương hiệu.\n• Direct Licensing, đã gồm quyền biểu diễn trước công chúng — không phát sinh phí tác quyền riêng.\n• Adapt (AI): một bài thành nhiều bản 15s/30s/60s, đổi mood cho từng chiến dịch, giữ âm thanh thương hiệu nhất quán.\n\nPlaylist mẫu: {playlist}\n\nAnh/chị có 15 phút trong tuần này để em giới thiệu nhanh không ạ?\n\nTrân trọng,\n{chu_ky}"},

    {"step": 3, "channel": "call", "segment": "all", "title": "Kịch bản gọi lần 1",
     "body": "• Mở lời (10 giây): \"Chào anh/chị {ten}, em {nguoi_gui} bên Epidemic Sound, em vừa gửi email về nhạc bản quyền cho {cong_ty}. Anh/chị cho em xin 2 phút được không ạ?\"\n• Hỏi 1 câu: \"Hiện bên mình chọn nhạc cho chương trình / video thế nào ạ? Có hay gặp claim hoặc phải trả phí tác quyền riêng không?\"\n• Chốt: hẹn 15 phút, đưa 2 khung giờ cụ thể.\n• Không nghe máy → gửi Zalo ngay trong ngày (bước 4)."},
    {"step": 4, "channel": "zalo", "segment": "all", "title": "Zalo: vài bài nhạc mẫu",
     "body": "Chào anh/chị {ten}, em là {nguoi_gui} – Epidemic Sound tại Việt Nam ạ. Em vừa gửi email cho anh/chị, em gửi nhanh vài bài hợp với nội dung của {cong_ty} để anh/chị nghe thử: {playlist}\nNếu thấy hợp, em chọn thêm theo dự án cụ thể của bên mình nhé!"},
    {"step": 5, "channel": "email", "segment": "all", "title": "Follow-up 1 (ngày 4): playlist chọn riêng",
     "subject": "Re: {cong_ty} — vài bài em chọn riêng",
     "body": "Chào anh/chị {ten},\n\nEm gửi tiếp email trước. Để dễ hình dung, em chọn riêng vài bài hợp với nội dung của {cong_ty}: {playlist}\n\nNếu anh/chị cho em biết dự án sắp tới (chương trình, TVC hay series), em sẽ chọn sát hơn và cắt sẵn bản 15s/30s bằng Adapt để anh/chị nghe thử.\n\nTrân trọng,\n{chu_ky}"},
    {"step": 6, "channel": "call", "segment": "all", "title": "Kịch bản gọi lần 2 (đổi khung giờ)",
     "body": "• Gọi khác giờ lần 1 (8:30–9:30 hoặc 16:30–17:30).\n• \"Em gọi lại về playlist em gửi hôm trước, anh/chị đã nghe thử chưa ạ?\"\n• Bận: \"Khi nào em gọi lại tiện nhất ạ?\" → ghi giờ vào Việc tiếp theo."},
    {"step": 7, "channel": "linkedin", "segment": "all", "title": "Tin nhắn LinkedIn",
     "body": "Cảm ơn {ten} đã kết nối! Em có gửi email về nhạc bản quyền cho {cong_ty}. Em để playlist mẫu ở đây cho tiện: {playlist} — rất mong nghe góp ý của anh/chị."},
    {"step": 8, "channel": "email", "segment": "all", "title": "Follow-up 2 (ngày 10): pháp lý — quyền biểu diễn trước công chúng",
     "subject": "Re: {cong_ty} — phí tác quyền khi phát sóng và biểu diễn",
     "body": "Chào anh/chị {ten},\n\nMột điểm nhiều đơn vị chưa để ý: khi phát sóng, livestream hay phát nhạc tại sự kiện, ngoài giấy phép bài nhạc còn có quyền biểu diễn trước công chúng — thường phải trả phí riêng cho Trung tâm/Hiệp hội tác quyền.\n\nVới mô hình Direct Licensing của Epidemic Sound, quyền này đã bao gồm sẵn: nghệ sĩ được trả thù lao từ đầu, Epidemic Sound sở hữu 100% quyền thương mại, nên {cong_ty} chỉ làm việc với một chủ sở hữu duy nhất.\n\nAnh/chị có muốn em gửi bản tóm tắt pháp lý 1 trang để đội pháp chế xem trước không ạ?\n\nTrân trọng,\n{chu_ky}"},
    {"step": 9, "channel": "zalo", "segment": "all", "title": "Zalo: playlist theo dự án",
     "body": "Anh/chị {ten} ơi, em thấy {cong_ty} vừa có [tên dự án / chương trình] — em chọn thử playlist hợp không khí dự án này: {playlist}\nAnh/chị nghe thử 1–2 bài xem có hợp không nhé!"},
    {"step": 10, "channel": "call", "segment": "all", "title": "Kịch bản gọi lần 3",
     "body": "• \"Em hỏi thẳng để không làm mất thời gian của anh/chị: quý tới bên mình có dự án nào cần nhạc không ạ?\"\n• Có → hẹn demo 15 phút. Chưa → hỏi tháng lên ngân sách, ghi vào Việc tiếp theo."},
    {"step": 11, "channel": "email", "segment": "all", "title": "Follow-up 3 (ngày 20): demo AI trên video của khách",
     "subject": "15 phút: thử Adapt và Studio trên video của {cong_ty}",
     "body": "Chào anh/chị {ten},\n\nEm xin 15 phút để demo trực tiếp trên một video thật của {cong_ty}:\n• Studio: upload video, nhận nhạc khớp cảnh trong vài giây.\n• Adapt: cắt bản 15s/30s/60s, bỏ vocal để chừa voice-over.\n• Soundmatch và kho 250.000 SFX ngay trong phần mềm dựng quen thuộc.\n\nAnh/chị chọn giúp em một khung giờ:\n• [Thứ …, …h]\n• [Thứ …, …h]\n\nTrân trọng,\n{chu_ky}"},
    {"step": 12, "channel": "email", "segment": "all", "title": "Follow-up 4 (ngày 27): tạm dừng + nhờ giới thiệu",
     "subject": "Re: {cong_ty} — em có nên tiếp tục không ạ?",
     "body": "Chào anh/chị {ten},\n\nEm đã liên hệ vài lần mà có lẽ chưa đúng thời điểm, nên em xin phép tạm dừng để không làm phiền anh/chị.\n\nNếu nhu cầu nhạc của {cong_ty} do người khác phụ trách (producer, post-production hay pháp chế), anh/chị giới thiệu giúp em được không ạ? Còn nếu để sau, em sẽ quay lại vào dịp khác.\n\nCảm ơn anh/chị nhiều!\n{chu_ky}"},
    {"step": 13, "channel": "email", "segment": "all", "title": "Email hẹn buổi tìm hiểu nhu cầu",
     "subject": "Hẹn 20 phút trao đổi nhu cầu nhạc của {cong_ty}",
     "body": "Chào anh/chị {ten},\n\nCảm ơn anh/chị đã phản hồi! Em xin 20 phút để hiểu cách {cong_ty} đang dùng nhạc (loại nội dung, số lượng video, nền tảng phát) và đề xuất gói phù hợp.\n\nAnh/chị tiện khung nào ạ:\n• [Thứ …, …h]\n• [Thứ …, …h]\n\nTrân trọng,\n{chu_ky}"},
    {"step": 15, "channel": "email", "segment": "all", "title": "Email gửi đề xuất",
     "subject": "Đề xuất Epidemic Sound cho {cong_ty}",
     "body": "Chào anh/chị {ten},\n\nEm gửi anh/chị đề xuất theo buổi trao đổi vừa rồi (đính kèm). Tóm tắt:\n• Phạm vi: [số người dùng / kênh / nền tảng]\n• Chi phí: [… USD/năm]\n• Bắt đầu: [ngày]\n\nAnh/chị xem giúp em và cho em biết cần làm rõ điểm nào nhé. Em sẽ gọi lại vào [ngày] để trao đổi tiếp.\n\nTrân trọng,\n{chu_ky}"},
    {"step": 16, "channel": "call", "segment": "all", "title": "Gọi theo dõi đề xuất",
     "body": "• \"Anh/chị đã xem đề xuất em gửi chưa ạ? Có điểm nào cần điều chỉnh không?\"\n• Hỏi: ai cần duyệt, khi nào duyệt, có vướng ngân sách không.\n• Ghi rõ ngày duyệt vào Việc tiếp theo."},
    {"step": 90, "channel": "email", "segment": "all", "title": "Điểm chạm nuôi dưỡng (giá trị, không chào bán)",
     "subject": "Playlist mới cho {cong_ty} tháng này",
     "body": "Chào anh/chị {ten},\n\nEm gửi anh/chị playlist mới tuyển chọn tháng này, hợp với nội dung bên mình: {playlist}\n\nKhông cần trả lời đâu ạ — khi nào {cong_ty} cần nhạc cho dự án mới, anh/chị nhắn em nhé.\n\nTrân trọng,\n{chu_ky}"}
  ]$json$::jsonb
 where key = 'message_templates' and updated_by is null;
