# API TV4

Prefix `/api`; lỗi có dạng `{ "error": { "code", "message" } }`. JWT truyền qua `Authorization: Bearer <token>`.

| Method | Endpoint | Quyền | Mục đích |
| --- | --- | --- | --- |
| GET | `/health` | Công khai | PostgreSQL/Firestore health |
| POST | `/auth/register` | Công khai | Tạo CUSTOMER |
| POST | `/auth/login` | Công khai | Đăng nhập, cấp JWT |
| GET | `/auth/me` | Đăng nhập | Profile hiện tại |
| GET | `/events` | Công khai | Sự kiện `ON_SALE`/`SOLD_OUT` |
| GET | `/events/:eventId` | Công khai | Chi tiết sự kiện và khu vực |
| GET | `/events/:eventId/zones` | Công khai | Giá/sức chứa khu vực |
| GET | `/zones/:zoneId/seats` | Công khai | Ghế, trạng thái và giá |
| POST | `/orders` | CUSTOMER | Tạo order, ticket và giữ ghế |
| GET | `/orders` | CUSTOMER | Đơn của khách hiện tại |
| POST | `/orders/:orderId/pay` | CUSTOMER | Thanh toán giả lập |
| POST | `/orders/:orderId/cancel` | CUSTOMER | Hủy order/ghi nhận hoàn tiền |

`POST /orders` body: `{ "eventId": "1", "seatIds": ["12", "13"] }`. Hủy vé được thực hiện ở cấp order; mọi vé của order sẽ bị hủy.
