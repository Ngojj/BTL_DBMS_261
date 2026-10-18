# Kiến trúc mốc tuần 42

```text
[React + Vite] --REST/JSON--> [Express API] --SQL + transaction--> [PostgreSQL]
```

Frontend dùng API client để đăng ký/đăng nhập, xem event/zone/seat và tạo đơn. Backend theo cấu trúc **Route → Controller → Service → Repository**; SQL viết bằng `pg`, không dùng ORM. PostgreSQL là nguồn dữ liệu duy nhất của luồng mua/hủy tại mốc này.

Mua vé khóa user trước khi kiểm tra giới hạn, khóa ghế theo thứ tự ID và tạo order/ticket/hold trong một transaction. Thanh toán giả lập và hủy/ghi nhận refund cũng dùng transaction riêng. Firestore client realtime/offline chưa được nối vào UI trong mốc tuần 42.

Các route hiện tại gồm health, auth, đọc events/zones/seats và booking. Xem [docs/api.md](api.md).
