# 003 — Tìm đúng người phụ trách và email cá nhân, không chỉ email chung

- **Trạng thái:** Nháp <!-- Nháp → Đã duyệt (ngày) → Đã xong (commit) -->
- **Người duyệt:** Việt

## Vấn đề / mục tiêu
Hiện app chỉ đọc tối đa 4 trang trên website công ty (Liên hệ, Giới thiệu, Đội ngũ). Website công ty Việt Nam hiếm khi ghi tên nhân sự, nên phần lớn kết quả là `info@`, `contact@`, thậm chí `tuyendung@` — email ít ai đọc, không tới được người quyết định mua nhạc.
Mục tiêu: với mỗi lead, tìm **người phụ trách đúng vai trò** (producer, marketing, nội dung, hậu kỳ…) và **email cá nhân** của họ nếu có trên Internet; luôn ghi nguồn để bạn kiểm tra.
Đo bằng: tỷ lệ lead có người đúng vai trò + email cá nhân, trước/sau (thử trên 20 lead đang có).

## Người dùng làm gì
1. Lead mới vào pipeline: app tự tìm như hiện nay, thêm các bước mới bên dưới. Lead cũ: nút **Tìm người phụ trách** trong khung khách (và chọn nhiều ở trang Công ty).
2. Tab Liên hệ của khách hiện danh sách đã xếp hạng: **người đúng vai trò có email** lên đầu → email phòng ban liên quan (`marketing@`, `production@`) → email chung. Mỗi dòng có nhãn nguồn (Website / Google / LinkedIn / YouTube) và link để kiểm tra.
3. Nút **Mở email** dùng sẵn email tốt nhất; câu chào gọi đúng tên người (vd. “Kính gửi chị Lan”).
4. Email tuyển dụng / CSKH (`tuyendung@`, `hr@`, `cskh@`…) bị ẩn, không bao giờ được chọn để gửi.

### App tìm thêm ở đâu
- **Hồ sơ LinkedIn công khai qua Google** (1 lượt Google/công ty): tìm người có tên công ty + chức danh đúng vai trò theo nhóm khách; chỉ nhận người mà kết quả có ghi đúng tên công ty. App không đăng nhập hay đọc trực tiếp LinkedIn.
- **Email của công ty xuất hiện trên Internet** (1 lượt Google/công ty): tìm `"@tencongty.vn"` trong thông cáo báo chí, sự kiện, tài liệu PDF… → lấy email cá nhân thật và **mẫu email của công ty** (vd. `lannt@`, `lan.nguyen@`).
- **Email đoán theo mẫu:** chỉ đoán khi đã thấy ít nhất một email thật của công ty theo mẫu đó; ghi rõ “dự đoán theo mẫu …, nguồn …”. Không đoán mò.
- **Kênh YouTube:** email hợp tác ghi trong phần mô tả kênh (hay gặp ở MCN, creator). Không tốn thêm lượt.

### Vai trò cần tìm theo nhóm khách (sửa được ở Cài đặt)
| Nhóm | Vai trò |
|---|---|
| Đài truyền hình | Giám đốc nội dung, Trưởng ban sản xuất, Producer, Head of Content |
| MCN | CEO / Founder, Head of Partnerships, Content Manager |
| Production house / agency | Producer, Executive Producer, Head of Production, Creative Director, Post-production |
| Hãng phim / hậu kỳ | Producer, Post-production Supervisor, Music Supervisor, Editor |
| Nhãn hàng | Marketing Manager, Brand Manager, Head of Content, Digital Marketing Manager |

## Tiêu chí nghiệm thu
- [ ] Người tìm qua Google/LinkedIn có tên, chức danh, link nguồn; chỉ nhận khi kết quả ghi đúng tên công ty.
- [ ] Email đoán chỉ xuất hiện khi có email thật của công ty làm bằng chứng, có ghi mẫu và nguồn.
- [ ] Danh sách liên hệ xếp đúng thứ tự: người đúng vai trò có email → email phòng ban → email chung; email tuyển dụng / CSKH bị ẩn.
- [ ] Nút Mở email chọn sẵn email tốt nhất và chào đúng tên người.
- [ ] Hết hạn mức Google trong ngày thì dừng, báo rõ, hôm sau chạy tiếp; không lặp lại công ty đã tìm trong 30 ngày.
- [ ] Thử trên 20 lead đang có: báo số lead có người đúng vai trò + email cá nhân trước/sau (chỉ báo con số, không ghi tên khách vào repo).
- [ ] Trên điện thoại vẫn dùng được.

## Không làm (lần này)
- Đăng nhập hay đọc trực tiếp LinkedIn, Facebook.
- Gửi thư thử để xác minh email (máy chủ không cho phép, dễ bị chặn).
- Mua danh sách email.

## Ảnh hưởng & chi phí
- **Dữ liệu:** thêm cột nguồn cho liên hệ (website / google / linkedin / youtube). Tên, chức danh, email cá nhân là dữ liệu cá nhân (NĐ 13/2023) như hiện nay; vẫn chỉ người đăng nhập đọc được, vẫn tôn trọng danh sách DNC.
- **Hạn mức / tiền:** thêm tối đa **2 lượt Google (Serper) mỗi công ty**, chỉ chạy cho lead trong pipeline. Hạn mức ngày hiện tại 200 lượt; giá Serper khoảng 1 USD / 1.000 lượt.
- **Triển khai:** đẩy `main` = chạy thật; không cần bật gì thêm.

## Câu hỏi còn mở
1. Có chạy một lượt cho **toàn bộ lead đang có** trong pipeline không (tốn ~2 lượt × số công ty; mình báo con số trước khi chạy)? Hay chỉ lead mới + bấm tay?
2. Danh sách vai trò theo nhóm khách ở trên đúng chưa — thêm / bớt vai trò nào?
3. Có muốn thêm dịch vụ tìm & xác minh email trả phí (vd. Hunter.io, khoảng 34–49 USD/tháng cho ~500 lượt) để email chắc chắn hơn không? Mặc định: không dùng.

## Kế hoạch (Claude điền sau khi duyệt)
- **Tệp sửa:** …
- **Thứ tự làm:** …
- **Kiểm tra:** test SQL / deno / build web / thử giao diện.
