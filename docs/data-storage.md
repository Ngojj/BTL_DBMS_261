# Data Storage, Mua vé và Hủy vé

## Mô hình dữ liệu

TicketRush lưu dữ liệu giao dịch chính bằng PostgreSQL. Schema gồm 10 bảng: `users`, `genres`, `venues`, `events`, `zones`, `seats`, `orders`, `tickets`, `payments`, `reviews`. Mối quan hệ được giữ bằng khóa ngoại; giá tại thời điểm mua được chụp vào `tickets.price`, còn order/ticket đã hủy vẫn giữ để truy vết.

Firestore là mô hình document bổ sung trong đề tài. Collection/document có thể denormalize các trường cần đọc chung, đổi lại việc sửa dữ liệu lặp cần đồng bộ. Mốc tuần 42 chưa có frontend realtime/offline hoặc đồng bộ nghiệp vụ sang Firestore.

## Luồng mua vé

1. Khách gửi `eventId` và danh sách `seatIds`.
2. Một transaction PostgreSQL khóa hàng người dùng trước khi đếm giới hạn và khóa ghế theo thứ tự ID.
3. Kiểm tra sự kiện đang mở bán, giờ bán, giới hạn vé mỗi khách, ghế thuộc đúng sự kiện và còn trống.
4. Tạo order `PENDING`, ticket cho các ghế, chuyển ghế sang `HELD` trong 10 phút.
5. Thanh toán giả lập tạo payment `SUCCESS`, chuyển order `PAID` và ghế `SOLD`. Lỗi trong transaction rollback toàn bộ.

## Luồng hủy

Hủy order khóa order và các ticket, chuyển ticket sang `CANCELLED`, order sang `CANCELLED`, đồng thời giải phóng các ghế thuộc đúng order. Nếu order đã `PAID`, payment thành công chuyển sang `REFUNDED`; đây là trạng thái mô phỏng, không gọi cổng thanh toán.

Các order hết hạn không được phép thanh toán/hủy để giải phóng lại ghế đã được giao dịch khác mua. Vé đã check-in không thuộc mốc tuần 42.

## ERD và DDL

- ERD: [docs/erd/ticketrush.md](erd/ticketrush.md).
- PostgreSQL 16 DDL: [database/schema.sql](../database/schema.sql).
- Script DDL có lệnh `DROP`; chỉ dùng cho database mới hoặc môi trường có thể xóa.
