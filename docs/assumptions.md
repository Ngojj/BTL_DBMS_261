# Giả định mốc tuần 42

- PostgreSQL là nguồn dữ liệu cho toàn bộ giao dịch mua/hủy.
- Thanh toán chỉ giả lập; hủy order đã PAID ghi `payments.status = REFUNDED`, không kết nối cổng thanh toán thật.
- Một thao tác hủy áp dụng cho toàn bộ order, không hủy riêng từng ghế trong order nhiều vé.
- `database/schema.sql` là DDL chuẩn của project nhưng có lệnh DROP; chỉ dùng trên database mới hoặc nơi có thể xóa dữ liệu.
- Firestore realtime/offline, custom Firebase Auth, vé QR/check-in, báo cáo, reviews, waiting room và DBMS Lab chưa thuộc mốc này.
