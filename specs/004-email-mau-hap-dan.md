# 004 — Email mẫu hấp dẫn hơn, đủ thông tin để khách hiểu Epidemic Sound

- **Trạng thái:** Nháp <!-- Nháp → Đã duyệt (ngày) → Đã xong (commit) -->
- **Người duyệt:** Việt

## Vấn đề / mục tiêu
Bộ email hiện tại (v6) ngắn nhưng thiếu ý:
- Lời giới thiệu chung chung.
- Mỗi email chỉ nêu 2 lợi ích; khách đọc xong vẫn chưa biết Epidemic Sound là gì, mình được gì, chi phí tính thế nào, ai chịu trách nhiệm khi video bị claim.
- Tiêu đề nhạt; email theo dõi mở đầu bằng “xin phép nhắc lại”.
- Câu riêng về khách chỉ có khi app tìm được kênh YouTube, còn lại để trống.

Mục tiêu: mỗi email đem đến **một thông tin mới, cụ thể**, có số liệu, và kết thúc bằng một việc rất dễ làm cho khách.
Đo bằng: tỷ lệ khách trả lời (trang Kết quả), so với bộ v6.

## Người dùng làm gì
1. Vào Kho nội dung → Email mẫu, bấm **Dùng bộ mới (v7)**. Bộ đang dùng được sao lưu; trước khi bấm, app không thay gì.
2. Chọn một khách thật ở ô **Xem trước với khách** để đọc thử email đã điền sẵn. Ô này đã làm, không cần duyệt.
3. Nên lưu mỗi nhóm khách 1 playlist ở trang **Nhạc mẫu**; nhóm nào chưa có playlist thì email hiện chỗ trống để bạn điền.
4. Gửi như hiện nay: Hôm nay → Mở email → Đã gửi.

### Chuỗi 6 email mới (giữ lịch ngày 0 / 3 / 7 / 12 / 18 / 26)
| Ngày | Email | Thông tin mới | Việc dễ làm cho khách |
|---|---|---|---|
| 0 | Mở lời | Câu riêng về khách → vấn đề nhóm khách hay gặp → “Epidemic Sound trong 30 giây” (4 ý đúng nhóm) → nhạc gợi ý | Trả lời 1 câu hỏi; P.S. gửi link video để nhận 3 phương án nhạc miễn phí |
| 3 | Nếu video bị claim thì sao | Kênh của khách được đưa vào danh sách an toàn (safelist) nên không bị claim tự động; có claim thì Epidemic Sound gỡ giúp; có khiếu nại bản quyền thì Epidemic Sound chịu trách nhiệm xử lý | Nhận hướng dẫn 1 trang |
| 7 | Thử nhạc trên video thật | 3 phương án nhạc nền cho video của khách, mỗi phương án kèm bản rút gọn 15s/30s (Adapt) | Trả lời kèm 1 đường link |
| 12 | Pháp lý tại Việt Nam | Quyền biểu diễn trước công chúng; không trả thêm phí cho nhạc sĩ, người biểu diễn hay tổ chức tác quyền ngoài phí giấy phép | Nhận bản tóm tắt pháp lý 1 trang |
| 18 | Chi phí tính thế nào *(thay email “đơn vị cùng ngành”)* | Phí cố định theo năm, theo số người dùng và nơi đăng; không tính thêm theo số bài hay số video; video làm trong thời hạn vẫn dùng tiếp sau khi hết hạn | Trả lời 2 con số → nhận báo giá ước tính trong ngày |
| 26 | Chia tay lịch sự | Ngắn hơn: hỏi đúng người phụ trách, đề nghị gửi playlist mỗi tháng thay vì email chào bán | Trả lời tên người phụ trách |

### Ví dụ email mở lời — production house / agency (bản nháp)
> **Tiêu đề:** {cong_ty}: nhạc cho TVC, khách đăng lên YouTube không lo bị claim
>
> Kính gửi {xung_ho},
>
> {cau_rieng}
>
> Em là {nguoi_gui}, phụ trách cấp phép âm nhạc của Epidemic Sound tại Việt Nam. Nhiều production house gặp cảnh TVC bàn giao xong, khách đăng lên YouTube thì bị claim hoặc tắt tiếng — và người bị phàn nàn là agency.
>
> Epidemic Sound giải quyết việc này bằng một giấy phép năm:
> • 55.000+ bản nhạc, 250.000+ hiệu ứng âm thanh, có stems; công cụ Adapt cắt bản 15s/30s/60s trong vài giây.
> • Khách hàng của {cong_ty} được đăng nội dung {cong_ty} sản xuất lên YouTube, Facebook, TikTok, truyền hình.
> • Không phát sinh thêm phí cho nhạc sĩ hay tổ chức tác quyền; nếu có khiếu nại bản quyền, Epidemic Sound đứng ra xử lý.
> • Video hoàn thành trong thời hạn giấy phép vẫn dùng tiếp được sau khi hết hạn.
>
> Nhạc gợi ý cho TVC và video doanh nghiệp: {playlist}
>
> Cho em hỏi hiện các dự án của {cong_ty} đang mua nhạc theo từng bài hay dùng thư viện nào ạ?
>
> P.S. Nếu {anh_chi} gửi em link một video gần đây, em sẽ chọn 3 phương án nhạc nền và gửi lại trong 1–2 ngày, không mất phí.

Bốn nhóm còn lại (đài truyền hình, MCN, hãng phim, nhãn hàng) viết cùng khung, với vấn đề và 4 ý riêng:
- **Đài:** phát sóng, phát lại và đăng YouTube trong cùng một giấy phép.
- **MCN:** kênh của creator vào danh sách an toàn, không mất doanh thu quảng cáo.
- **Hãng phim:** stems, WAV 24-bit/48 kHz, hiệu ứng âm thanh cho hậu kỳ.
- **Nhãn hàng:** agency đối tác dùng chung giấy phép của nhãn hàng.

### Câu riêng về khách: thêm nguồn ngoài YouTube
Khi không có kênh YouTube, app dùng dữ liệu đã thu thập từ website (có link nguồn để bạn kiểm tra):
- showreel hoặc mục dự án TVC trên website;
- tin tuyển dụng vị trí làm video.

Không có dữ liệu nào thì vẫn để chỗ trống đánh dấu như hiện nay.

## Tiêu chí nghiệm thu
- [x] Kho nội dung xem trước với khách thật trong pipeline (chọn được khách, đúng nhóm khách), không còn tên mẫu cố định; điền đủ câu riêng, tiêu đề “Re: …”, playlist, người nhận tốt nhất.
- [ ] Bộ v7: 6 email × 5 nhóm khách theo bảng trên, cùng mẫu chặng chốt và nuôi dưỡng.
  - Email mở lời dưới ~170 chữ, email theo dõi dưới ~110 chữ.
  - Mỗi email nêu đúng một thông tin mới và một việc cho khách.
- [ ] Tiêu đề email mở lời có tên công ty và một lợi ích cụ thể; email theo dõi vẫn là “Re: …” cùng luồng.
- [ ] Mọi thông tin về Epidemic Sound lấy từ hợp đồng mẫu và tài liệu bạn đã đưa; chỗ chưa chắc đánh dấu “cần kiểm tra” trong spec để bạn duyệt.
- [ ] Câu riêng về khách dùng thêm showreel / dự án TVC / tin tuyển dụng làm video khi không có YouTube.
- [ ] Bộ mới chỉ áp dụng khi bạn bấm “Dùng bộ mới (v7)”; bộ đang dùng được sao lưu; lịch và email bạn đang gửi dở không đổi.
- [ ] Trên điện thoại vẫn dùng được.

## Không làm (lần này)
- Nêu giá cụ thể trong email (chỉ nói cách tính, mời báo giá ước tính).
- Nêu tên khách hàng có thật của Epidemic Sound.
- Tự gửi email, theo dõi mở thư.

## Ảnh hưởng & chi phí
- **Dữ liệu:** không thêm bảng. Migration thêm `default_message_templates_v7()`; nút “Dùng bộ mới” thay `settings.message_templates`, sao lưu bản cũ vào `message_templates_backup_v6`. Lịch (cadence) giữ nguyên, chỉ đổi tên email ngày 18.
- **Hạn mức / tiền:** không tốn thêm.
- **Triển khai:** đẩy `main` = chạy thật; bạn bấm “Dùng bộ mới (v7)” khi đã đọc thử.

## Câu hỏi còn mở (mặc định đề xuất trong ngoặc)
1. Email ngày 18 đổi sang “Chi phí tính thế nào” thay cho “đơn vị cùng ngành dùng thế nào”? (Có.)
2. Thông tin **cần kiểm tra** trước khi gửi:
   - (a) “Không trả thêm phí cho tổ chức tác quyền” áp dụng ở Việt Nam. Hợp đồng mẫu có ngoại lệ khi luật địa phương bắt buộc thu qua tổ chức đó.
   - (b) “Gần 200 quốc gia”, “55.000+ bản nhạc, 250.000+ hiệu ứng” còn đúng.

   (Giữ như bộ v6; bạn sửa nếu sai.)
3. Thêm P.S. “gửi link video để nhận 3 phương án nhạc miễn phí” ngay ở email mở lời? (Có — email ngày 7 vẫn nhắc lại, chi tiết hơn.)
