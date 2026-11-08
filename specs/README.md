# Spec tính năng

Cách làm gọn theo tinh thần [Spec Kit](https://github.com/github/spec-kit): tính năng lớn có một spec ngắn bằng tiếng Việt,
người dùng duyệt xong mới code. Việc nhỏ vẫn làm thẳng.

## Khi nào cần spec
- Thêm bảng / migration mới, Edge Function mới, hoặc trang mới.
- Đổi luồng pipeline, chặng chốt sale, quyền truy cập.
- Tốn thêm tiền hoặc hạn mức (lượt Google/Serper, YouTube, email, gói Supabase…).
- Ước tính làm quá khoảng 1 giờ.

Không cần spec: sửa lỗi, đổi chữ / giao diện nhỏ, đổi cài đặt hoặc từ khoá, việc vài lệnh.

## Quy trình
1. Người dùng mô tả ý tưởng (1–2 câu là đủ).
2. Claude tạo `specs/NNN-ten-ngan.md` từ [`_mau.md`](_mau.md) (số tăng dần: 001, 002…), trạng thái **Nháp**,
   gom mọi câu hỏi vào mục “Câu hỏi còn mở”, rồi gửi người dùng đọc.
3. Người dùng trả lời / sửa / nói “duyệt”. Claude ghi **Đã duyệt** kèm ngày.
4. Claude điền “Kế hoạch”, code, kiểm tra từng tiêu chí nghiệm thu (đánh dấu ✓), rồi ghi **Đã xong** kèm commit.
5. Đổi ý giữa chừng: sửa spec trước, rồi mới sửa code.

## Lưu ý
Repo công khai: spec không ghi tên khách thật, email, số điện thoại, giá đã báo cho khách, nội dung hợp đồng / MLA.
Dùng ví dụ chung (“một MCN ở TP.HCM”).
