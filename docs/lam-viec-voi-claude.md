# Cách tiết kiệm token khi làm việc với Claude Code

- **Chọn model:** việc hằng ngày dùng Sonnet. Chỉ chuyển Opus (`/model opus`) cho việc khó hoặc rủi ro cao (cơ sở dữ liệu, bảo mật, thanh toán, lỗi khó tìm); xong thì đổi lại.
- **Agent phụ:** tra cứu đơn giản (tìm tệp, tìm chỗ gọi hàm) giao cho agent phụ Haiku chỉ đọc. Agent phụ chỉ trả kết luận nên hội thoại chính không phải chứa cả tệp. Việc chỉ mất vài lệnh thì tự làm.
- **Tìm trước, đọc sau:** grep trước, chỉ đọc đoạn cần của tệp lớn. Sửa xong không đọc lại để kiểm.
- **Gộp lệnh:** các lệnh không phụ thuộc nhau gửi chung một lượt.
- **Hội thoại ngắn:** mỗi lượt gửi lại toàn bộ hội thoại, kể cả ảnh đã xem. Hội thoại dài thì `/compact`. Mỗi phiên một việc hoặc một vai; việc mới thì mở phiên mới. Cần xem nhiều hình thì ghép thành một tấm.
- **Ghi luật vào tệp:** luật cần nhớ lâu ghi vào `CLAUDE.md` hoặc `docs/`. `CLAUDE.md` được nạp ở mọi lượt nên giữ thật ngắn; chi tiết để tệp riêng và dẫn đường tới đó.
- **Trả lời ngắn:** không nhắc lại điều đã chốt, không liệt kê phương án sẽ không làm.
- **Hỏi một lần:** gom mọi câu hỏi duyệt vào một lần. Chỉ hỏi giữa chừng khi việc tốn tiền hoặc đổi điều đã chốt.
- **Tác vụ tự động:** prompt cố định, ngắn, báo cáo tối đa khoảng 15 dòng.

## Tiết kiệm phút GitHub Actions

GitHub tính phút theo từng job và làm tròn lên phút. Cấu hình hiện tại:

- CI tách thành 3 workflow (`functions.yml`, `database.yml`, `web.yml`), mỗi cái chỉ chạy khi thư mục của nó thay đổi. Sửa README/tài liệu không chạy CI.
- Chỉ chạy khi push lên `main` hoặc PR vào `main`; push lên nhánh khác không chạy. Có thể chạy tay ở tab Actions (Run workflow).
- Lượt chạy cũ trên cùng nhánh bị huỷ khi có lượt mới; mỗi job tối đa 10 phút.
- Chạy test trên máy trước khi push (lệnh trong `CLAUDE.md`), không dùng CI để thử.

## Áp dụng từ microsoft/TokenEconomizer

- **Cắt bớt công cụ không dùng:** `.claude/settings.json` chặn các MCP không liên quan dự án (Canva, Epidemic Sound, Claude Docs, Gmail, Calendar, Drive), để Claude không nạp và gọi chúng. Cần lại thì xoá dòng tương ứng.
- **Ghi lại sự thật của repo:** lệnh test, cách cài deno, giới hạn mạng... nằm trong `CLAUDE.md` để phiên sau khỏi dò lại.
- **Chống lặp:** một cách làm thất bại 2 lần thì dừng, đổi hướng hoặc hỏi.
- Bản thân plugin TokenEconomizer học từ lịch sử phiên lưu trên máy. Phiên cloud mỗi lần là container mới nên plugin gần như không có gì để học; chỉ nên cài khi chạy Claude Code trên máy riêng.
