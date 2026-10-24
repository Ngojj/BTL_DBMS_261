# Data Storage | Mua vé, Hủy vé

> **Người phụ trách:** TV4 – Data storage | Chức năng #4 (mua vé), #5 (hủy vé)
> **Tuần hoàn thành:** 43

---

## 1. Mô hình dữ liệu

TicketRush lưu dữ liệu giao dịch chính bằng **PostgreSQL 16** – nguồn sự thật (source of truth).
**Firestore** là bản sao phục vụ realtime/offline (sơ đồ ghế, soát vé offline, thông báo).

### 1.1 PostgreSQL – 10 bảng chuẩn hóa (3NF)

| Bảng | Mục đích chính |
|---|---|
| `users` | Tài khoản; `phone` không UNIQUE (phát hiện gom vé) |
| `genres` | Thể loại nhạc |
| `venues` | Địa điểm tổ chức |
| `events` | Sự kiện; `max_tickets_per_user` giới hạn vé/người |
| `zones`  | Khu vực (VIP/CAT1/GA); lưu giá và sức chứa |
| `seats`  | Ghế; `status` AVAILABLE/HELD/SOLD; `version` cho khóa lạc quan |
| `orders` | Đơn hàng; `expires_at` cho giữ ghế 10 phút |
| `tickets`| Vé; `qr_code` UUID duy nhất; `price` chụp tại thời điểm mua |
| `payments`| Thanh toán; lưu cả lần thất bại |
| `reviews` | Đánh giá 1–5 sao sau sự kiện |

ERD đầy đủ: [docs/erd/ticketrush.md](erd/ticketrush.md).
DDL: [database/schema.sql](../database/schema.sql).

### 1.2 Firestore – Document Model

```
events/{eventId}            zonesSummary, title, status
  seats/{seatId}            status, heldBy, heldUntil, zone, row, number
  queue/{userId}            position, joinedAt, admitted
validTickets/{qrCode}       eventId, seatLabel, holderName, checkedIn
notifications/{userId}/items/{id}  message, read, createdAt
```

`eventId`, `seatId` dùng lại khóa từ PostgreSQL (string).
Security Rules: client chỉ đọc; STAFF được cập nhật `checkedIn` trong `validTickets`.

---

## 2. Luồng mua vé (#4)

1. Khách gửi `POST /api/orders` với `{ eventId, seatIds[] }`.
2. Backend chạy một **transaction PostgreSQL**:
   - Khóa hàng user (`FOR UPDATE`) trước khi đếm giới hạn vé.
   - Hết hạn các order stale có liên quan đến ghế đó.
   - Kiểm tra event `ON_SALE`, thời gian mở bán, giới hạn vé.
   - Khóa ghế theo thứ tự seat_id tăng dần (`FOR UPDATE OF s`) – tránh deadlock.
   - Tạo order `PENDING`, tickets `VALID`, cập nhật ghế → `HELD` (10 phút).
3. **Commit** → background sync Firestore (best-effort).
4. Khách `POST /api/orders/:orderId/pay` → transaction thứ hai:
   - Kiểm tra ghế còn `HELD` và chưa hết hạn.
   - Tạo payment `SUCCESS`, cập nhật order → `PAID`, ghế → `SOLD`.
5. Sync Firestore sau khi PAID.

---

## 3. Luồng hủy vé (#5)

- Hủy từ trang **Checkout** hoặc trang **Vé của tôi**.
- `POST /api/orders/:orderId/cancel`:
  - Khóa order + tickets.
  - Kiểm tra không có vé `CHECKED_IN` (đã soát không thể hủy).
  - Chuyển tickets → `CANCELLED`, ghế → `AVAILABLE`, order → `CANCELLED`.
  - Nếu order đã `PAID`: payment → `REFUNDED` (giả lập, không gọi cổng thanh toán).
- Sync Firestore sau khi hủy.

---

## 4. Ràng buộc nghiệp vụ trong schema

| Ràng buộc | Mục đích |
|---|---|
| Partial unique index `uq_active_ticket_per_seat` | Tối đa 1 vé chưa hủy / ghế |
| Trigger `ticket_rules` | Ghế thuộc đúng event; giới hạn `max_tickets_per_user` |
| `CHECK chk_hold` | Ghế HELD phải có `held_by` và `held_until` |
| Partial unique index `uq_success_payment_per_order` | 1 payment SUCCESS / order |
| `SELECT … FOR UPDATE` | An toàn concurrency – khóa user + ghế trước khi đếm |

---

## 5. DBMS Lab – Data Storage

Trang `/lab/data-storage` (chỉ Admin) có hai thí nghiệm:

| Thí nghiệm | Mô tả |
|---|---|
| Đọc "Vé của tôi" | So sánh 1 query JOIN 6 bảng (PG) vs document reads (FS): thời gian và số lần đọc |
| Dung lượng lưu trữ | `pg_total_relation_size` (PG) vs ước tính ~2 KB/document (FS) |

Backend: `backend/src/labs/data-storage/dataStorage.lab.js`
Frontend: `frontend/src/pages/lab/LabDataStoragePage.jsx`
API: `GET /api/labs/data-storage/my-tickets?userId=`, `GET /api/labs/data-storage/storage-size`

---

## 6. Dữ liệu mẫu

`scripts/seed.js` nạp:
- 10 users (1 ADMIN, 1 STAFF, 8 CUSTOMER – 2 cặp chung phone để test gom vé)
- 3 genres, 2 venues, 3 events (ON_SALE / ENDED / DRAFT)
- 9 zones x 15 ghế = 135 seats
- 1 order PAID (Alice, VIP x2) + 1 order PENDING (Bob, CAT1 x1)
- 2 reviews (sự kiện ENDED)
- Sync toàn bộ sang Firestore

Chạy: `node scripts/seed.js`
