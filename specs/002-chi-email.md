# 002 — Chỉ tiếp cận bằng email: chuỗi email thuyết phục dùng nhạc Epidemic Sound

- **Trạng thái:** Nháp <!-- Nháp → Đã duyệt (ngày) → Đã xong (commit) -->
- **Người duyệt:** Việt

## Vấn đề / mục tiêu
Lịch hiện tại có 19 điểm chạm trộn gọi điện, Zalo, LinkedIn. Khách Việt Nam không thích telesale, nên các bước gọi/nhắn làm mất thiện cảm và tốn công.
Mục tiêu: chỉ dùng email. Mỗi email đưa một lý do rõ ràng để dùng nhạc Epidemic Sound, ngắn, lịch sự, kết thúc bằng một câu hỏi dễ trả lời.
Đo bằng: tỷ lệ khách trả lời email (trang Kết quả đã có).

## Người dùng làm gì
1. Hôm nay chỉ còn việc gửi email. Mỗi việc có sẵn tiêu đề + nội dung đã điền tên khách và **một câu riêng về khách** (lấy từ kênh YouTube / website / nhóm khách app đã thu thập; thiếu dữ liệu thì app đánh dấu chỗ cần tự viết).
2. Email đầu tiên: bấm **Mở email** (như hiện nay). Email theo dõi: app nhắc **trả lời trong luồng email trước** (để khách thấy cả câu chuyện), có nút chép nội dung.
3. Gửi xong bấm **Đã gửi**, app tự hẹn email kế tiếp. Khách trả lời → bấm **Khách đã trả lời** như hiện nay.
4. Khách đã trả lời: các bước chốt cũng qua email — gửi playlist / minh hoạ nhạc trên video của khách, báo giá, theo dõi báo giá, trả lời băn khoăn, gửi hợp đồng. Họp online chỉ khi khách đề nghị.

### Chuỗi email chặng tiếp cận (khách chưa trả lời) — 6 email trong ~4 tuần
| Ngày | Email | Lý do để khách dùng Epidemic Sound |
|---|---|---|
| 0 | Mở lời | Một câu riêng về video của khách + một playlist đúng nhóm khách; hỏi “Anh/chị đang lấy nhạc nền từ đâu?” |
| 3 | Theo dõi 1 (cùng luồng) | Rủi ro thật: video bị đánh bản quyền, tắt tiếng, mất doanh thu; một giấy phép dùng cho mọi nền tảng |
| 7 | Theo dõi 2 | Đề nghị miễn phí: gửi link 1 video của khách, nhận lại 3 lựa chọn nhạc nền trong 1–2 ngày |
| 12 | Theo dõi 3 | Pháp lý quyền biểu diễn tại Việt Nam, kèm bản tóm tắt một trang |
| 18 | Theo dõi 4 | Ví dụ khách cùng ngành đã dùng (chỉ ví dụ công khai, bạn duyệt) |
| 26 | Chia tay lịch sự | Hỏi có nên dừng liên hệ không, nhờ giới thiệu đúng người → không trả lời thì chuyển Nuôi dưỡng |

Nuôi dưỡng: mỗi tháng một email ngắn (playlist theo mùa / dịp, tin bản quyền). Gia hạn: email trước 90 ngày thay cho cuộc gọi.

## Tiêu chí nghiệm thu
- [ ] Lịch mặc định chỉ còn bước email (và họp online khi khách đề nghị); Hôm nay, Pipeline, email nhắc việc mỗi sáng không còn việc gọi điện / Zalo / LinkedIn.
- [ ] Có 6 email mẫu mới cho chặng tiếp cận × 5 nhóm khách (đài truyền hình, MCN, production house, hãng phim, nhãn hàng) và email mẫu cho các bước chốt; mỗi email dưới ~120 chữ, một lời đề nghị duy nhất.
- [ ] Câu riêng về khách tự điền khi có dữ liệu; thiếu dữ liệu thì hiện chỗ trống được đánh dấu, không gửi câu chung chung.
- [ ] Email theo dõi giữ tiêu đề “Re: …” của email mở lời và có nhắc trả lời trong luồng cũ.
- [ ] Khách đang ở giữa lịch cũ (đang chờ bước gọi / Zalo / LinkedIn) chuyển sang email kế tiếp phù hợp, không mất lịch sử điểm chạm.
- [ ] Mọi thông tin về Epidemic Sound trong email (số bài nhạc, Content ID, quyền biểu diễn, giá) lấy từ tài liệu bạn đã đưa; chỗ nào chưa chắc thì đánh dấu “cần kiểm tra” để bạn duyệt trước.
- [ ] Bạn vẫn sửa được lịch và email mẫu trong Cài đặt / Kho nội dung như hiện nay.
- [ ] Trên điện thoại vẫn dùng được.

## Không làm (lần này)
- App tự gửi email thay bạn (vẫn gửi từ hộp thư của bạn).
- Theo dõi khách mở email hay bấm link.
- Xoá số điện thoại đã lưu (vẫn giữ, chỉ không tạo việc gọi).

## Ảnh hưởng & chi phí
- **Dữ liệu:** không thêm bảng; thay lịch mặc định (`settings.cadence`) và email mẫu (`settings.message_templates`) bằng bản mới. Lịch / mẫu bạn đã tự sửa thì giữ nguyên, có nút “Dùng lịch & mẫu mặc định mới” ở Cài đặt.
- **Hạn mức / tiền:** không tốn thêm lượt Google/YouTube hay tiền.
- **Triển khai:** đẩy `main` = chạy thật; không cần bật gì thêm.

## Câu hỏi còn mở
1. 6 email trong ~4 tuần như bảng trên có ổn không, hay bạn muốn ít hơn (vd. 4 email)?
2. Bạn có ví dụ khách cùng ngành (công khai, được phép nhắc tên) cho email ngày 18 không? Chưa có thì mình viết dạng “các đài / MCN / agency trong khu vực” không nêu tên.
3. Email gửi bằng tiếng Việt cho mọi khách, hay cần thêm bản tiếng Anh cho công ty nước ngoài / khách quốc tế?

## Kế hoạch (Claude điền sau khi duyệt)
- **Tệp sửa:** …
- **Thứ tự làm:** …
- **Kiểm tra:** test SQL / deno / build web / thử giao diện.
