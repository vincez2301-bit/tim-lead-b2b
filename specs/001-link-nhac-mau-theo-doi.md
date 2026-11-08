# 001 — Link nhạc mẫu báo “khách đang xem” để gọi ngay

- **Trạng thái:** Nháp <!-- Nháp → Đã duyệt (ngày) → Đã xong (commit) -->
- **Người duyệt:** Việt

## Vấn đề / mục tiêu
Hiện playlist gửi khách là link thường: không biết khách có mở hay không, nên gọi theo lịch chứ không theo lúc khách đang quan tâm.
Gọi trong vài giờ sau khi khách vừa nghe nhạc mẫu dễ được nghe máy và dễ hẹn demo hơn hẳn gọi nguội.
Mục tiêu: khách bấm link nhạc mẫu → app báo ngay ở Hôm nay kèm việc “Gọi ngay”.
Đo bằng: tỷ lệ khách mở link, và tỷ lệ hẹn được buổi tìm hiểu nhu cầu khi gọi trong ngày khách mở so với gọi theo lịch.

## Người dùng làm gì
1. Ở khung khách → Playlist gợi ý, nút **Chép** chép link riêng của khách đó (thay cho link playlist gốc); email/tin Zalo mẫu có nhạc mẫu cũng dùng link riêng.
2. Gửi cho khách như bình thường (email, Zalo, LinkedIn).
3. Khách bấm link → mở thẳng playlist (khách không thấy gì khác lạ).
4. Hôm nay hiện mục **Khách vừa xem nhạc mẫu** ở trên cùng: tên khách, playlist nào, mấy lần, lúc nào; nút **Gọi ngay** (số điện thoại) và **Chép tin Zalo** soạn sẵn.
5. Tab Điểm chạm của khách ghi “Mở link nhạc mẫu: <playlist>” (không tính là một điểm chạm, không đẩy lịch).

## Tiêu chí nghiệm thu
- [ ] Mỗi khách × mỗi playlist có một link riêng, cố định (chép lại vẫn ra link cũ); link không chứa tên khách.
- [ ] Bấm link mở đúng playlist trong khoảng 1 giây; link sai hoặc playlist đã xoá → mở trang nhạc mẫu chung (đặt ở Cài đặt), không báo lỗi.
- [ ] Trong vòng 1 phút sau khi khách bấm, Hôm nay hiện khách ở mục “Khách vừa xem nhạc mẫu” và có việc “Gọi ngay” hạn hôm nay (khách đang ở chặng chốt thì giữ việc chốt, chỉ thêm ghi chú).
- [ ] Máy quét link của email công ty (mở link mà không phải người bấm) không được tính; người bấm nhiều lần trong 30 phút tính là 1 lần.
- [ ] Email nhắc việc mỗi sáng có danh sách khách đã mở link hôm qua.
- [ ] Không ai ngoài người đăng nhập app xem được ai đã mở link; không lưu địa chỉ IP.
- [ ] Trên điện thoại vẫn dùng được (Hôm nay, nút Gọi ngay).

## Không làm (lần này)
- Theo dõi mở email (ảnh ẩn trong email): dễ sai, dễ vào thư rác.
- Link riêng cho báo giá, website hay tài liệu khác ngoài playlist.
- Thông báo đẩy trên điện thoại.

## Ảnh hưởng & chi phí
- **Dữ liệu:** bảng mới `share_links` (mã ngẫu nhiên, khách, playlist) và `link_opens` (thời điểm, loại thiết bị). Ai mở link là dữ liệu hành vi của người liên hệ → thuộc phạm vi NĐ 13/2023 như dữ liệu liên hệ hiện có; RLS chỉ cho người đăng nhập đọc.
- **Hạn mức / tiền:** không tốn lượt Google/YouTube. Mỗi lượt bấm là 1 lần gọi Edge Function (gói Free có 500.000 lần/tháng).
- **Triển khai:** đẩy `main` = chạy thật. Link mở qua một Edge Function công khai (không cần đăng nhập), chỉ chuyển tới playlist đã lưu trong app, không chuyển tới địa chỉ tuỳ ý.

## Câu hỏi còn mở
1. **Tên miền của link** (khách nhìn thấy):
   - Mặc định: `gitckdkcjvmnzfiazkxk.supabase.co/functions/v1/n/ab12cd` — dài, trông lạ, dễ bị nghi là spam.
   - Khuyên dùng: thêm tên miền phụ miễn phí trên Vercel, ví dụ `nhacmau-bigfish.vercel.app/n/ab12cd` (bạn bấm thêm trong Vercel → Domains, mình hướng dẫn). Không dùng `tim-lead-b2b-web.vercel.app` vì lộ chữ “tìm lead”.
   - Hoặc tên miền riêng của công ty nếu có (cần IT trỏ DNS).
2. Khi khách mở link, có gửi thêm **email báo ngay** cho bạn không (tối đa 1 email/khách/ngày, dùng Resend như email nhắc việc)? Hay chỉ hiện ở Hôm nay + email sáng hôm sau là đủ?
3. Có cần pháp chế duyệt riêng việc ghi nhận khách mở link không, hay xem như đã nằm trong lần duyệt dữ liệu liên hệ?

## Kế hoạch (Claude điền sau khi duyệt)
- **Tệp sửa:** …
- **Thứ tự làm:** …
- **Kiểm tra:** test SQL / deno / build web / thử giao diện.
