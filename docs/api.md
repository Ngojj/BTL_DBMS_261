# API (tiền tố /api)

Lỗi: `{ "error": { "code", "message" } }`. Xác thực: `Authorization: Bearer <jwt>`.

| Module | Endpoint | Quyền |
| --- | --- | --- |
| health | GET /health | – |
| auth | POST /auth/register, /auth/login, /auth/google, /auth/firebase-token; GET /auth/me | – / đăng nhập |
| events | GET /events, /events/genres, /events/:id; POST, PUT, DELETE (admin) | – / ADMIN |
| zones | GET,POST /events/:id/zones; PUT,DELETE /zones/:id; POST /zones/:id/generate-seats | – / ADMIN |
| booking | POST /orders; POST /orders/:id/pay, /orders/:id/cancel; GET /orders | CUSTOMER |
| tickets | GET /tickets/mine | CUSTOMER |
| checkin | GET /checkin/events/:id/valid-tickets; POST /checkin/sync | STAFF |
| reports | GET /admin/reports/overview, /revenue, /revenue/daily, /occupancy, /suspicious-accounts | ADMIN |
| reviews | GET,POST /events/:id/reviews; GET /events/:id/reviews/summary | – / CUSTOMER |
| sync | POST /admin/sync/events/:id, /admin/sync/all | ADMIN |
| labs | POST /admin/labs/<topic>/run; GET /admin/labs/<topic>/runs | ADMIN |

Topic: data-storage, indexing, query-processing, transaction, concurrency-control, backup-recovery.

## Hình dạng dữ liệu trả về (frontend đang dùng)

Tên trường dạng camelCase, id là chuỗi/số, tiền là số nguyên VND, thời gian là chuỗi ISO 8601. Ví dụ đầy đủ ở `frontend/src/api/mock.js`.

| Endpoint | Trả về |
| --- | --- |
| `GET /events` (query `genreId, city, dateFrom, dateTo, priceMax`) | `[{ eventId, title, genre, genreId, venueName, city, eventDate, saleOpenAt, status, minPrice }]` |
| `GET /events/genres` | `[{ genreId, name }]` |
| `GET /events/:id` | như một phần tử ở trên + `maxTicketsPerUser` + `zones: [{ zoneId, name, price, capacity }]` |
| `POST /orders` body `{ eventId, seatIds }` | order (bên dưới); khóa ghế và trả 409 nếu ghế đã có người giữ |
| `GET /orders/:orderId` | `{ orderId, eventId, eventTitle, eventDate, venueName, city, status, total, expiresAt, items: [{ seatId, seatLabel, zone, price }] }` |
| `POST /orders/:orderId/pay` body `{ method, buyer: { fullName, phone, email } }` | `{ orderId, status }` |
| `GET /tickets/mine` | `[{ ticketId, orderId, qrCode, status, eventId, eventTitle, eventDate, venueName, city, zone, seatLabel, holderName, gate }]` |
| `GET /admin/reports/revenue` | `[{ eventTitle, zone, ticketsSold, revenue }]` |
| `GET /admin/reports/occupancy` | `[{ eventTitle, zone, capacity, sold }]` |
| `GET /admin/reports/suspicious-accounts` | `[{ userId, email, phone, reason, ticketCount }]` |
| `POST /events/:id/zones/…/generate-seats` body `{ rows: "A-C", seatsPerRow }` | tuỳ TV2, frontend chỉ cần 2xx |

Firestore `events/{eventId}/seats/{seatId}`: `{ zone, row, number, status: AVAILABLE|HELD|SOLD, heldBy, heldUntil }`.
Firestore `validTickets/{qrCode}`: `{ eventId, seatLabel: "VIP · Ghế B7", holderName, checkedIn, checkedInAt }`.

`POST /auth/google` body `{ idToken, phone? }` (idToken là Firebase ID token của tài khoản Google) → `{ token, user }`.
Lỗi: `400 VALIDATION` (phone sai định dạng), `401 INVALID_GOOGLE_TOKEN` (token sai/hết hạn hoặc email chưa xác minh), `409 PHONE_REQUIRED` (email mới, cần gửi lại kèm `phone`).

`GET /events/:id/reviews` trả `[{ reviewId, userName, rating, comment, createdAt }]`; `GET /events/:id/reviews/summary` trả `{ average, count }` (AVG, COUNT);
`POST /events/:id/reviews` body `{ rating: 1–5, comment }`; trùng (user, event) trả `409`.
`GET /events/:id` cần có thêm `venueId` (form sửa sự kiện dùng). `POST /admin/sync/events/:id` và `/admin/sync/all`: frontend chỉ cần 2xx.
Firestore `notifications/{userId}/items/{id}`: `{ message, read, createdAt }`.

## Thống kê kinh doanh (reports) – loại truy vấn h

Tham số lọc chung (đều tùy chọn): `eventId` (số nguyên dương), `from`, `to` (`YYYY-MM-DD`, theo giờ Việt Nam). Sai định dạng, ngày không tồn tại, `from` > `to` → `400 VALIDATION`. Chỉ ADMIN.

**Doanh thu** = tổng giá các vé còn hiệu lực (`tickets.status <> 'CANCELLED'`) của đơn có một payment `SUCCESS`; ngày tính theo `payments.paid_at`. Đơn hủy đã hoàn tiền không tính. Con số khớp `SUM(payments.amount)` với status SUCCESS.

| Endpoint | Trả về | Truy vấn |
| --- | --- | --- |
| `GET /admin/reports/overview` | `{ revenue, ticketsSold, paidOrders, avgOrderValue, avgTicketPrice, orders: { paid, cancelled, expired, pending }, cancelRate, seatCapacity, seatsSold, occupancyRate, checkedIn, checkInRate, topEvents: [{ eventId, title, revenue, tickets, share, aboveAverage }] }` | SUM, COUNT, FILTER; subquery AVG cho `aboveAverage` [g] |
| `GET /admin/reports/revenue` | `[{ eventId, eventTitle, zone, ticketsSold, revenue }]` | JOIN 6 bảng + GROUP BY sự kiện × khu vực |
| `GET /admin/reports/revenue/daily` | `[{ day, orders, tickets, revenue }]`, đủ mọi ngày trong khoảng (ngày trống = 0); mặc định 30 ngày gần nhất, tối đa 366 ngày | `generate_series` LEFT JOIN, GROUP BY ngày |
| `GET /admin/reports/occupancy` | `[{ eventId, eventTitle, zone, capacity, sold, held, rate }]` (chỉ lọc theo `eventId`) | LEFT JOIN seats + COUNT FILTER |

`cancelRate` = đơn hủy / (đơn đã thanh toán + đơn hủy); `share` và các tỷ lệ là phần trăm làm tròn 1 chữ số; `held` chỉ đếm ghế đang giữ chỗ còn hạn.
