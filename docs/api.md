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

## Phát hiện gom vé (reports) – loại truy vấn g

`GET /admin/reports/suspicious-accounts` (chỉ ADMIN, không có tham số) trả mảng tài khoản bị gắn cờ, mức cao xếp trước:
`[{ userId, email, fullName, phone, ticketCount, sharedPhoneAccounts, atLimitEvents, level: 'HIGH'|'MEDIUM', signals: [{ type, text }], reason }]`

Chỉ tính vé còn hiệu lực (`status <> 'CANCELLED'`) của đơn `PAID`. Dấu hiệu (`signals[].type`):
| type | Điều kiện | Mức |
| --- | --- | --- |
| `OVER_LIMIT` | một tài khoản mua nhiều hơn `events.max_tickets_per_user` của một sự kiện | HIGH |
| `GROUP_OVER_LIMIT` | từ 2 tài khoản khách hàng chung số điện thoại, tổng vé cho một sự kiện vượt giới hạn của một người | HIGH |
| `SHARED_PHONE` | từ 2 tài khoản khách hàng chung số điện thoại, chưa có bằng chứng mua vượt | MEDIUM |
| `REPEAT_AT_LIMIT` | mua đủ giới hạn ở từ 3 sự kiện trở lên (2 sự kiện gắn cờ nhầm nhiều người mua bình thường) | MEDIUM |

Trigger `ticket_rules` đã chặn việc một tài khoản vượt giới hạn, nên `OVER_LIMIT` chỉ xảy ra nếu dữ liệu bị sửa trực tiếp; đây là dấu hiệu kiểm tra chéo. Đây là dấu hiệu để admin xem xét, không phải kết luận gian lận.

## Mua vé, vé của tôi, đồng bộ Firestore (đã hiện thực)

Logic mua/hủy vé lấy từ nhánh `Data-Storage` (TV4), điều chỉnh theo hợp đồng của frontend. Chỉ tài khoản CUSTOMER mua/hủy được (ADMIN, STAFF nhận 403).

| Endpoint | Body / trả về |
| --- | --- |
| `POST /orders` | body `{ eventId, seatIds: [] }` → `{ orderId, eventId, total, status: 'PENDING', expiresAt, ticketCount, tickets }`. Giữ ghế 10 phút |
| `GET /orders/:orderId` | `{ orderId, eventId, eventTitle, eventDate, venueName, city, status, total, expiresAt, items: [{ seatId, seatLabel, zone, price }] }`; chỉ chủ đơn xem được (403 nếu khác) |
| `POST /orders/:orderId/pay` | body `{ method: 'CARD'\|'E_WALLET'\|'BANK_TRANSFER', buyer? }` → `{ orderId, eventId, status: 'PAID', paid: true, amount }`. Gọi lần hai vẫn an toàn |
| `POST /orders/:orderId/cancel` | → `{ cancelled, orderId, eventId, status: 'CANCELLED' }`. Đơn đã thanh toán: payment chuyển `REFUNDED`, ghế trả về `AVAILABLE` |
| `GET /orders` | đơn của tôi |
| `GET /tickets/mine` | `[{ ticketId, orderId, qrCode, status, price, checkedInAt, eventId, eventTitle, eventDate, venueName, city, zone, seatLabel, holderName }]`; chỉ vé của đơn đã thanh toán, vé của đơn đã hủy hiện `CANCELLED` |
| `POST /admin/sync/events/:id` | đồng bộ lại ghế và vé hợp lệ của một sự kiện → `{ eventId, seats, tickets }` |
| `POST /admin/sync/all` | đồng bộ lại tất cả → `{ events, seats, tickets }` |

Mã lỗi thường gặp của `POST /orders`: `SEAT_UNAVAILABLE` (ghế đã có người giữ/mua), `TICKET_LIMIT_EXCEEDED` (vượt `max_tickets_per_user`), `SALE_NOT_OPEN`, `EVENT_NOT_ON_SALE`, `EVENT_ENDED`, `SEAT_NOT_FOUND`, `SEAT_EVENT_MISMATCH` (đều 409/404).

**Chống tranh chấp:** transaction khóa theo thứ tự `users` → `events` → `seats` (sắp theo `seat_id` để tránh deadlock) bằng `SELECT … FOR UPDATE`, đếm giới hạn vé sau khi đã khóa người dùng; đơn PENDING quá hạn được dọn ngay khi có người mua đúng ghế đó. Sau khi COMMIT, `modules/sync` ghi trạng thái ghế sang Firestore (`bulkWriter`, lỗi chỉ ghi log, không làm hỏng đơn đã commit).
