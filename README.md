# TicketRush

Nền tảng bán vé concert chịu tải "giờ G" mở bán: hàng nghìn người mua cùng lúc mà không bán trùng ghế, không trừ tiền sai, vẫn soát vé được khi mạng yếu.

Đây là **Bài tập lớn môn Hệ quản trị cơ sở dữ liệu (HK261)** – nhóm 5 sinh viên. Đề tài so sánh **PostgreSQL** và **Cloud Firestore (Standard)** trên 6 topic: Data storage, Indexing, Query processing, Transaction, Concurrency control, Backup & recovery. Ứng dụng web có module **DBMS Lab** để chạy thí nghiệm so sánh ngay trong giao diện.

> Đọc [brief.md](brief.md) để hiểu đầy đủ đề bài, chức năng, phân công. README này hướng dẫn **cài đặt, chạy và làm việc trong repo**.

## Mục lục

1. [Kiến trúc trong 1 phút](#1-kiến-trúc-trong-1-phút)
2. [Cấu trúc thư mục](#2-cấu-trúc-thư-mục)
3. [Yêu cầu cài đặt](#3-yêu-cầu-cài-đặt)
4. [Chạy dự án từng bước](#4-chạy-dự-án-từng-bước)
5. [Các cổng dịch vụ](#5-các-cổng-dịch-vụ)
6. [Tình trạng hiện tại](#6-tình-trạng-hiện-tại)
7. [Phân công và file của từng người](#7-phân-công-và-file-của-từng-người)
8. [Cách thêm một chức năng](#8-cách-thêm-một-chức-năng)
9. [Backend chi tiết](#9-backend-chi-tiết)
10. [Frontend chi tiết](#10-frontend-chi-tiết)
11. [Dữ liệu: PostgreSQL và Firestore](#11-dữ-liệu-postgresql-và-firestore)
12. [DBMS Lab](#12-dbms-lab)
13. [Quy ước làm việc](#13-quy-ước-làm-việc)
14. [Xử lý sự cố thường gặp](#14-xử-lý-sự-cố-thường-gặp)

---

## 1. Kiến trúc trong 1 phút

```
[React app] --REST/JSON--> [Express API] --SQL--> [PostgreSQL]  (nguồn dữ liệu chính)
     |                           |
     |                           +--Admin SDK--> [Firestore]    (bản sao phục vụ realtime/offline)
     +--Web SDK (chỉ đọc/lắng nghe)--> [Firestore]
```

Năm nguyên tắc **bắt buộc** (chi tiết ở brief mục 4):

1. **PostgreSQL là source of truth.** Mọi quyết định bán ghế, thu tiền chốt trong transaction PostgreSQL.
2. **Firestore chỉ là bản sao** cho: sơ đồ ghế realtime, phòng chờ ảo, danh sách vé hợp lệ cho cổng soát vé (offline), thông báo.
3. **Frontend không ghi nghiệp vụ vào Firestore.** Mọi thao tác ghi đi qua API. Ngoại lệ duy nhất: trang soát vé ghi `checkedIn` vào `validTickets` (để chạy offline), backend đồng bộ ngược về PostgreSQL.
4. Sau khi transaction PostgreSQL **COMMIT**, backend đồng bộ sang Firestore (`sync`). Ghi Firestore lỗi thì retry; admin có endpoint đồng bộ lại toàn bộ.
5. Repository tách riêng từng DBMS để DBMS Lab chạy **cùng một nghiệp vụ trên hai DBMS**.

Ba vai trò người dùng: `CUSTOMER` (mua vé), `ADMIN` (quản lý, thống kê, DBMS Lab), `STAFF` (soát vé QR).

## 2. Cấu trúc thư mục

```
BTL_DBMS/
├── brief.md                 Đề bài + yêu cầu (đọc trước)
├── docker-compose.yml       PostgreSQL 16 (cổng 5433), tự nạp schema
├── package.json             Script tiện dụng ở gốc
├── backend/                 Express API
│   ├── .env.example
│   ├── tests/
│   └── src/
│       ├── server.js, app.js
│       ├── config/          env.js, pg.js (pool + withTransaction), firebase.js (Admin SDK)
│       ├── middleware/      auth.js (authenticate, authorize), errorHandler.js
│       ├── utils/           AppError.js, asyncHandler.js
│       ├── routes/          index.js (gắn mọi module), health.js
│       ├── modules/         Mỗi module: route → controller → service → repository
│       │   ├── auth/        (đã hiện thực)
│       │   ├── events/  zones/  booking/  tickets/
│       │   └── checkin/  reports/  reviews/  sync/
│       └── labs/            DBMS Lab: 6 topic + labRunner.js
├── frontend/                React + Vite + Tailwind
│   └── src/
│       ├── main.jsx, App.jsx        Router + danh sách trang
│       ├── layouts/                 MainLayout, AdminLayout, LabLayout
│       ├── pages/                   Mỗi trang một file; pages/lab/ cho 6 trang Lab
│       ├── components/              ProtectedRoute, lab/LabPage, lab/LabResultTable
│       ├── context/AuthContext.jsx  Đăng nhập/đăng xuất, lưu user
│       ├── api/                     client.js + authApi, eventsApi, bookingApi, adminApi, labsApi
│       └── lib/firebase.js          Firebase Web SDK (+ Emulator, cache offline)
├── database/
│   ├── schema.sql           Schema PostgreSQL (10 bảng) – nguồn duy nhất của schema
│   └── migrations/          Thay đổi schema về sau (YYYYMMDD_mota.sql)
├── firebase/                firebase.json, firestore.rules, firestore.indexes.json
├── scripts/                 seed.js (dữ liệu mẫu), load-test.js (giả lập tải), backup/
└── docs/                    architecture.md, api.md, assumptions.md, erd/
```

## 3. Yêu cầu cài đặt

| Công cụ | Phiên bản | Ghi chú |
| --- | --- | --- |
| Node.js | ≥ 20 (LTS) | `node -v` |
| PostgreSQL | 16 | Chọn **một** trong hai: Docker (khuyến nghị) hoặc PostgreSQL cài sẵn (pgAdmin) |
| Docker Desktop | mới | Chỉ cần nếu chạy PostgreSQL bằng Docker |
| Java | ≥ 11 | Firestore Emulator cần Java. Kiểm tra: `java -version` |
| Firebase CLI | mới | `npm i -g firebase-tools`, kiểm tra `firebase --version` |

## 4. Chạy dự án từng bước

Cần **4 thứ chạy song song**: PostgreSQL, Firestore Emulator, backend, frontend. Mỗi thứ (trừ PostgreSQL Docker) dùng một terminal riêng.

### Bước 1 – Cài thư viện

```bash
npm --prefix backend install
npm --prefix frontend install
```

### Bước 2 – Tạo file môi trường

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Mở `backend/.env`, **đổi `JWT_SECRET`** thành chuỗi bí mật dài bất kỳ. **Không commit `.env`** (đã có trong `.gitignore`).

### Bước 3 – PostgreSQL (chọn một cách)

**Cách A – Docker (khuyến nghị, mọi người dùng cùng cấu hình):**

```bash
docker compose up -d
```

Container `ticketrush-postgres`, cổng **5433**, user/mật khẩu/database đều là `ticketrush`. File `database/schema.sql` tự nạp ở lần khởi tạo đầu. `backend/.env.example` đã khớp cấu hình này nên không cần sửa `DATABASE_URL`.

Nạp lại schema từ đầu (xóa hết dữ liệu):

```bash
docker compose down -v && docker compose up -d
```

**Cách B – PostgreSQL cài sẵn trên máy (pgAdmin):**

1. Trong pgAdmin tạo database (ví dụ `btldbms`).
2. Mở Query Tool của database đó, chạy toàn bộ `database/schema.sql`.
3. Sửa `DATABASE_URL` trong `backend/.env` của **riêng bạn**:
   ```
   DATABASE_URL=postgres://postgres:MAT_KHAU@localhost:5432/btldbms
   ```

> Lưu ý: `schema.sql` bắt đầu bằng `DROP TABLE ... CASCADE`, chạy lại sẽ **xóa sạch dữ liệu**.

### Bước 4 – Firestore Emulator

```bash
firebase emulators:start --config firebase/firebase.json --project ticketrush-dev
```

Lần đầu Firebase tải file emulator (~60 MB). UI quản lý: http://127.0.0.1:4001. Dữ liệu trong Emulator **mất khi tắt** (dùng script seed để nạp lại).

### Bước 5 – Backend

```bash
npm --prefix backend run dev
```

Kiểm tra http://localhost:4000/api/health, kết quả đúng:

```json
{ "ok": true, "postgres": "up", "firestore": "up" }
```

Lần gọi đầu có thể chậm vài giây (Firestore khởi động nguội).

### Bước 6 – Frontend

```bash
npm --prefix frontend run dev
```

Mở http://localhost:5173. Vite tự chuyển tiếp `/api` sang backend cổng 4000.

### Bước 7 – Dữ liệu mẫu

```bash
node scripts/seed.js
```

Script cần PostgreSQL và Firestore Emulator đang chạy, và **xóa sạch** dữ liệu cũ (TRUNCATE 10 bảng, xóa `events/`, `validTickets/`, `notifications/` trong Emulator) rồi sinh lại trong vài giây. Chạy lại bất cứ lúc nào, nhất là sau khi tắt Emulator (dữ liệu Emulator mất khi tắt).

| Tùy chọn | Ý nghĩa |
| --- | --- |
| `--users 500` | Số khách hàng (mặc định 300) |
| `--seed 7` | Hạt giống ngẫu nhiên; cùng seed cho cùng dữ liệu |
| `--pg-only` | Chỉ PostgreSQL |
| `--fs-only` | Chỉ dựng lại Firestore từ dữ liệu PostgreSQL hiện có (dùng khi vừa bật lại Emulator) |

Dữ liệu sinh ra: 7 sự kiện (6 sắp diễn ra như mockup và 1 đã kết thúc), mỗi sự kiện 2 khu VIP/CAT 1 với 148 ghế, khoảng 380 vé đã bán, một số đơn hủy/hết hạn, vé đã soát và đánh giá cho sự kiện đã kết thúc. Sự kiện chưa đến giờ mở bán thì chưa có vé bán.

| Vai trò | Email | Mật khẩu |
| --- | --- | --- |
| ADMIN | `admin@ticketrush.vn` | `Admin@123` |
| STAFF | `staff1@ticketrush.vn`, `staff2@ticketrush.vn` | `Staff@123` |
| CUSTOMER (demo, có 2 vé Rock B7 và B8 như mockup) | `khach@example.com` | `123456` |
| CUSTOMER khác | email trong bảng `users` | `123456` |

Dữ liệu để thử chức năng #11 (gom vé): `acc.a`, `acc.b`, `acc.c` `@example.com` (3 tài khoản chung số điện thoại `0977123456`, tổng 12 vé cho một sự kiện có giới hạn 4/người) sẽ hiện mức **Cao**; `scalper@example.com` (đủ 4 vé ở 4 sự kiện, tổng 16 vé) hiện mức **Theo dõi**.

## 5. Các cổng dịch vụ

| Dịch vụ | Cổng |
| --- | --- |
| Frontend (Vite) | 5173 |
| Backend (Express) | 4000 |
| PostgreSQL Docker | 5433 (cổng 5432 hay bị PostgreSQL cài sẵn trên Windows chiếm) |
| Firestore Emulator | 8085 (8080 hay bị chương trình khác chiếm) |
| Auth Emulator | 9099 |
| Emulator UI | 4001 |

Muốn đổi cổng nào thì sửa đồng bộ: `docker-compose.yml`, `firebase/firebase.json`, `backend/.env`, `frontend/src/lib/firebase.js`.

## 6. Tình trạng hiện tại

Đây là **khung dự án**: cấu trúc và dây nối đã xong, nghiệp vụ còn để trống.

| Phần | Trạng thái |
| --- | --- |
| Kết nối PostgreSQL, Firestore, `GET /api/health` | Xong, đã kiểm tra chạy |
| Đăng ký, đăng nhập, JWT, phân quyền role, Firebase custom token | Xong (`modules/auth`) |
| Xử lý lỗi tập trung `{ error: { code, message } }` | Xong |
| Routing frontend, layout, `ProtectedRoute`, `AuthContext`, API client | Xong |
| Firestore rules, cấu hình Emulator | Có bản đầu, TV5 hoàn thiện |
| Module nghiệp vụ (events, zones, booking, tickets, checkin, reports, reviews, sync) | **Placeholder**: gọi vào trả `501 NOT_IMPLEMENTED` |
| 6 thí nghiệm DBMS Lab | **Placeholder** (khung `labRunner` + bảng kết quả hai cột đã có) |
| Trang giao diện | Chỉ có tiêu đề, chờ hiện thực |
| `seed.js`, `load-test.js` | TODO |

Tìm mọi việc cần làm:

```bash
grep -rn "TODO \[" backend frontend scripts firebase
```

Mỗi `TODO` ghi rõ chức năng, người phụ trách và loại truy vấn a–h.

## 7. Phân công và file của từng người

| TV | Topic | Chức năng | Việc khác |
| --- | --- | --- | --- |
| 1 (nhóm trưởng) | Transaction + Backup & recovery | #1 xem sự kiện theo thể loại, #8 quản lý sự kiện | `reviews` (tạm giao) |
| 2 | Indexing | #2 lọc sự kiện, #9 quản lý khu vực/giá | Khung backend, dữ liệu mẫu, kiểm thử |
| 3 | Query processing | #10 thống kê, #11 phát hiện gom vé | Khung frontend, khung DBMS Lab |
| 4 | Data storage | #4 chọn ghế và mua vé, #5 hủy đơn | ERD, schema |
| 5 | Concurrency control | #3 phòng chờ ảo, #6 vé của tôi, #7 soát vé | Cấu hình Firebase, đồng bộ, sơ đồ ghế realtime |

File chính của từng người:

| TV | Backend | Frontend |
| --- | --- | --- |
| 1 | `modules/events`, `modules/reviews`, `labs/transaction`, `labs/backup-recovery` | `pages/EventListPage`, `pages/AdminEventsPage`, `pages/lab/Transaction…`, `pages/lab/BackupRecovery…` |
| 2 | `modules/zones`, `labs/indexing`, `scripts/seed.js`, `tests/` | `pages/AdminZonesPage`, `pages/lab/IndexingLabPage` |
| 3 | `modules/reports`, `labs/query-processing` | `pages/AdminReportsPage`, `pages/AdminSuspiciousPage`, `components/lab/*` |
| 4 | `modules/booking`, `labs/data-storage`, `database/schema.sql` | `pages/EventDetailPage` (chọn ghế/mua), `pages/CheckoutPage` |
| 5 | `modules/tickets`, `modules/checkin`, `modules/sync`, `labs/concurrency-control`, `firebase/`, `scripts/load-test.js` | `pages/MyTicketsPage`, `pages/CheckinPage`, `pages/WaitingRoomPage`, `lib/firebase.js`, sơ đồ ghế trong `EventDetailPage` |

`EventListPage` dùng chung giữa TV1 (#1) và TV2 (#2), nên thống nhất trước ai sửa phần nào để tránh xung đột Git.

## 8. Cách thêm một chức năng

Ví dụ làm `GET /api/tickets/mine` (#6, loại **f** join). Mỗi module có 4 file trong `backend/src/modules/tickets/`:

1. **`tickets.route.js`** – đã khai báo sẵn endpoint và middleware quyền. Chỉ sửa khi thêm endpoint mới.
2. **`tickets.controller.js`** – chỉ đọc request và trả JSON, không có SQL, không có nghiệp vụ.
3. **`tickets.service.js`** – nghiệp vụ, kiểm tra điều kiện, điều phối transaction, gọi `sync` sau COMMIT.
4. **`tickets.repository.js`** – **SQL thuần** ở đây. Thay dòng `throw notImplemented(...)` bằng truy vấn thật:

```js
import { pool } from '../../config/pg.js';

// [f] join: vé của tôi
export async function listMyTickets({ user }) {
  const { rows } = await pool.query(
    `SELECT t.ticket_id, t.qr_code, t.status, e.title, z.name AS zone, s.row_label, s.seat_no
       FROM tickets t
       JOIN orders o ON o.order_id = t.order_id
       JOIN seats s  ON s.seat_id  = t.seat_id
       JOIN zones z  ON z.zone_id  = s.zone_id
       JOIN events e ON e.event_id = o.event_id
      WHERE o.user_id = $1
      ORDER BY e.event_date`,
    [user.userId],
  );
  return rows;
}
```

Phía frontend: thêm hàm gọi vào `src/api/*.js`, rồi dùng trong trang tương ứng ở `src/pages/`. Route và quyền đã khai báo sẵn trong `App.jsx`.

Nhớ **ghi loại truy vấn a–h trong comment** phía trên mỗi truy vấn: brief yêu cầu đủ 8 loại (a insert, b delete, c update, d một điều kiện, e điều kiện kết hợp, f join, g subquery, h hàm tổng hợp).

## 9. Backend chi tiết

**Luồng một request:** `Route → Controller → Service → Repository`.

- `authenticate` đọc `Authorization: Bearer <jwt>` rồi gán `req.user = { userId, role }`.
- `authorize('ADMIN')` hoặc `authorize('STAFF', 'ADMIN')` kiểm tra role.
- Mọi lỗi đi vào `errorHandler`, trả `{ "error": { "code", "message" } }`. Ném lỗi nghiệp vụ bằng `throw new AppError(409, 'SEAT_TAKEN', 'Ghế đã có người giữ')`. Lỗi PostgreSQL phổ biến (`23505` trùng, `23503` khóa ngoại, `23514` CHECK, `P0001` trigger) được đổi sang mã HTTP 409/400 tương ứng.
- `notImplemented('tên')` trả `501` cho hàm chưa làm.

**Kết nối PostgreSQL** (`config/pg.js`): thư viện `pg` viết SQL thuần, **không dùng ORM**. Cột `NUMERIC` (tiền VND) trả về `number`, cột `BIGINT` (id) trả về `string`.

**Transaction phải dùng một client duy nhất**. Dùng helper `withTransaction`:

```js
import { withTransaction } from '../../config/pg.js';

await withTransaction(async (client) => {
  await client.query('SELECT ... FROM users WHERE user_id = $1 FOR UPDATE', [uid]); // khóa trước khi đếm
  const { rows } = await client.query(
    'SELECT * FROM seats WHERE seat_id = ANY($1) FOR UPDATE', [seatIds]);            // khóa ghế
  // ... kiểm tra, insert orders/tickets ...
});   // tự COMMIT, lỗi thì tự ROLLBACK
```

**Lưu ý concurrency** (quan trọng cho #4): trigger `ticket_rules` đếm số vé không an toàn khi hai transaction của cùng một người chạy song song. Service mua vé **phải** `SELECT … FROM users WHERE user_id = $1 FOR UPDATE` trước khi đếm, và khóa ghế bằng `SELECT … FOR UPDATE` (hoặc `SKIP LOCKED`).

**Đồng bộ sang Firestore:** sau khi transaction COMMIT, gọi các hàm trong `modules/sync/sync.publisher.js` (`publishSeatChanged`, `publishZonesSummary`, `publishValidTicket`, `publishNotification`). Không đồng bộ trong lúc transaction chưa commit.

**Danh sách API** (tiền tố `/api`, chi tiết ở [docs/api.md](docs/api.md)):

| Module | Endpoint | Quyền |
| --- | --- | --- |
| health | `GET /health` | – |
| auth | `POST /auth/register`, `/auth/login`, `/auth/google`, `/auth/firebase-token`; `GET /auth/me` | – / đăng nhập |
| events | `GET /events`, `/events/genres`, `/events/:id`; `POST`, `PUT`, `DELETE` | – / ADMIN |
| zones | `GET`, `POST /events/:id/zones`; `PUT`, `DELETE /zones/:id`; `POST /zones/:id/generate-seats` | – / ADMIN |
| booking | `POST /orders`, `/orders/:id/pay`, `/orders/:id/cancel`; `GET /orders` | đăng nhập |
| tickets | `GET /tickets/mine` | đăng nhập |
| checkin | `GET /checkin/events/:id/valid-tickets`, `POST /checkin/sync` | STAFF, ADMIN |
| reports | `GET /admin/reports/revenue`, `/occupancy`, `/suspicious-accounts` | ADMIN |
| reviews | `GET`, `POST /events/:id/reviews`; `GET /events/:id/reviews/summary` | – / đăng nhập |
| sync | `POST /admin/sync/events/:id`, `/admin/sync/all` | ADMIN |
| labs | `POST /admin/labs/<topic>/run`, `GET /admin/labs/<topic>/runs` | ADMIN |

## 10. Frontend chi tiết

Giao diện dựng theo file mockup `TicketRush – Mockup giao diện.pdf` (6 màn hình). Bảng màu và font khai báo trong `tailwind.config.js`; class dùng chung (`card`, `btn-brand`, `input`…) trong `src/index.css`.

| Đường dẫn | File | Mockup |
| --- | --- | --- |
| `/` | `pages/EventListPage.jsx` | Sự kiện sắp diễn ra (chip thể loại, bộ lọc, thẻ sự kiện) |
| `/events/:id` | `pages/EventDetailPage.jsx`, `lib/seats.js` | Sơ đồ ghế realtime + giỏ ghế |
| `/checkout/:orderId` | `pages/CheckoutPage.jsx` | Thanh toán + đếm ngược giữ ghế 10 phút |
| `/my-tickets` | `pages/MyTicketsPage.jsx` | Vé của tôi + mã QR (giao diện điện thoại, lưu offline) |
| `/staff/checkin` | `pages/CheckinPage.jsx`, `components/QrScanner.jsx`, `lib/checkin.js` | Soát vé QR (giao diện tối, ngoại tuyến) |
| `/admin/labs/<topic>` | `components/LabPage.jsx`, `pages/lab/labConfigs.js` | DBMS Lab (Concurrency control là bản mockup, 5 topic còn lại dùng chung khung) |
| `/admin/events`, `zones` | `pages/AdminEventsPage.jsx`, `AdminZonesPage.jsx` | Chưa có mockup. Thêm, sửa, xóa; sinh ghế; nút **Đồng bộ** từng sự kiện và **Đồng bộ tất cả** sang Firestore (module `sync`) |
| `/admin/reports` | `pages/AdminReportsPage.jsx`, `components/RevenueChart.jsx` | Thống kê kinh doanh (#10): 6 chỉ số, biểu đồ doanh thu theo ngày, top sự kiện, lấp đầy, bảng theo khu vực; lọc theo sự kiện và khoảng ngày. Backend `modules/reports` đã hiện thực |
| `/admin/suspicious` | `pages/AdminSuspiciousPage.jsx` | Phát hiện gom vé (#11): mức Cao / Theo dõi, danh sách dấu hiệu, nhóm tài khoản chung số điện thoại, lọc theo mức. Backend `modules/reports` đã hiện thực |
| Khối đánh giá (cuối trang `/events/:id`) | `components/Reviews.jsx` | Điểm trung bình, danh sách, gửi đánh giá (mỗi người một lần) |
| Chuông thông báo (header) | `components/NotificationBell.jsx`, `lib/notifications.js` | Đọc Firestore `notifications/{userId}/items`; trạng thái "đã xem" lưu cục bộ |
| `/login`, `/register` | `pages/LoginPage.jsx`, `RegisterPage.jsx` | Chưa có mockup |

**Đã có backend thật cho mua vé:** `modules/booking` (#4, #5), `modules/tickets` (#6) và `modules/sync`. Với các API này frontend dùng dữ liệu thật; chỉ khi backend tắt hoặc trả 501 mới rơi về dữ liệu mẫu. Kiểm thử tự động nên đặt `VITE_USE_MOCK=false` để không vô tình dùng dữ liệu mẫu, và `VITE_FIRESTORE_CACHE=memory` (xem mục dưới).

**Lưu ý cache offline của Firestore:** mặc định frontend dùng cache IndexedDB để trang soát vé chạy được khi mất mạng. Khi kiểm thử bằng Chrome headless và chuyển trang rất nhanh, cache này từng gây lỗi `FIRESTORE INTERNAL ASSERTION FAILED: Unexpected state` và sơ đồ ghế rơi về dữ liệu mẫu; đặt `VITE_FIRESTORE_CACHE=memory` thì hết lỗi (đổi lại mất khả năng soát vé offline). Chưa rõ trình duyệt thường có gặp không, TV5 cần kiểm tra.

**Dữ liệu mẫu (mock).** Khi backend chưa làm một API (trả `501 NOT_IMPLEMENTED`) hoặc backend không chạy, và `VITE_USE_MOCK=true` trong `frontend/.env`, frontend tự dùng dữ liệu mẫu trong `src/api/mock.js` để xem được giao diện và chạy thử luồng mua vé. Backend làm xong API nào thì trang đó **tự chuyển sang dữ liệu thật**, không cần sửa frontend. Hình dạng dữ liệu trong `mock.js` chính là hợp đồng mà API thật cần trả về (chi tiết ở [docs/api.md](docs/api.md)). DBMS Lab **không có** dữ liệu mẫu để số liệu giả không lọt vào báo cáo. Khi backend đã đủ, đặt `VITE_USE_MOCK=false`.

**Chuông thông báo** cần đăng nhập Firebase bằng custom token (`AuthContext.connectFirebase`), mà backend chỉ cấp được token này khi có `serviceAccount.json` hoặc Auth Emulator. Khi chưa có thì chuông hiện dữ liệu mẫu (nếu bật `VITE_USE_MOCK`) hoặc trống; các phần khác không bị ảnh hưởng.

**Kiểm thử giao diện bằng trình duyệt tự động:** nếu viết kịch bản (Puppeteer…) thì chạy trong một ngữ cảnh trình duyệt riêng (`browser.createBrowserContext()`). Trong ngữ cảnh mặc định, khung "Lưu mật khẩu?" của Chrome sau khi nhập email và mật khẩu sẽ giành focus nên chuột không tới được trang.

**Xem thử các màn hình:** đăng ký tài khoản khách rồi chọn sự kiện để đi luồng mua vé. Muốn xem trang soát vé hoặc admin thì đổi cột `role` của tài khoản trong bảng `users` thành `STAFF` hoặc `ADMIN`.

- **Router** trong `App.jsx`. Trang công khai dùng `MainLayout`, thanh toán và soát vé có giao diện riêng, trang admin dùng `AdminLayout` (thanh bên có sẵn 6 topic DBMS Lab).
- **`ProtectedRoute`**: `<ProtectedRoute>` chỉ cần đăng nhập, `<ProtectedRoute roles={['ADMIN']}>` cần đúng role.
- **`useAuth()`** trả về `{ user, loading, login, register, logout }`. JWT lưu trong `localStorage`.
- **Gọi API**: dùng `api/client.js` (tự gắn JWT, ném `Error` có `message`, `code`, `status`). Đặt hàm gọi API theo module trong `src/api/`.
- **Firestore realtime**: dùng `db` từ `lib/firebase.js`, ví dụ `onSnapshot(collection(db, 'events', eventId, 'seats'), …)`. Để đọc Firestore đúng quyền, đăng nhập Firebase bằng custom token từ `POST /api/auth/firebase-token` (TV5 làm trong `AuthContext`).
- **Giao diện tiếng Việt**, Tailwind CSS v3. Tiền tệ VND hiển thị theo `Intl.NumberFormat('vi-VN')`, thời gian hiển thị giờ Việt Nam.
- Quét QR dùng thư viện `html5-qrcode`.

### Đăng nhập / đăng ký bằng Google

Nút "Tiếp tục với Google" nằm ở trang đăng nhập và đăng ký (`components/GoogleAuth.jsx`), hai trang dùng chung một luồng: có tài khoản thì đăng nhập, chưa có thì tạo.

1. Frontend mở popup Google bằng **Firebase Auth** (`lib/firebase.js` → `pickGoogleAccount`) và lấy Firebase ID token.
2. Gửi `POST /api/auth/google { idToken, phone? }`. Backend (`auth.service.js` → `googleLogin`) xác minh token bằng Admin SDK, chỉ nhận nhà cung cấp `google.com` và email đã xác minh.
3. Email đã có trong `users`: đăng nhập vào tài khoản đó, giữ nguyên role. Email mới: tạo `CUSTOMER`. Bảng `users` bắt buộc có `phone` nên lần đầu backend trả `409 PHONE_REQUIRED`, frontend hỏi số điện thoại rồi gọi lại kèm `phone`.
4. Backend cấp JWT của TicketRush như đăng nhập thường; mọi phần còn lại của ứng dụng không đổi. Tài khoản tạo bằng Google có mật khẩu ngẫu nhiên nên chỉ vào được bằng Google.

**Khi dev (Auth Emulator):** popup là trang giả lập của Emulator, không phải Google thật. Bấm **Add new account**, chọn **Auto-generate user information**, rồi **Sign in with Google.com**. Cần Emulator đang chạy (`firebase emulators:start`).

**Khi dùng tài khoản Google thật** (cần một dự án Firebase của riêng bạn, miễn phí, không cần thẻ):

1. Vào [Firebase Console](https://console.firebase.google.com) → **Add project** → đặt tên, tắt Google Analytics. Ghi lại **Project ID**.
2. **Build → Authentication → Get started → Sign-in method → Google → Enable**, chọn email hỗ trợ, **Save**. (`localhost` đã nằm sẵn trong Authorized domains; khi deploy thì thêm tên miền thật vào đó.)
3. **Project settings (bánh răng) → General → Your apps → biểu tượng Web `</>`**, đăng ký ứng dụng và chép `apiKey`, `authDomain`, `projectId` trong `firebaseConfig`. (`apiKey` của web không phải bí mật.)
4. `frontend/.env`: đặt `VITE_USE_AUTH_EMULATOR=false` và điền `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`. Giữ `VITE_USE_EMULATOR=true` nếu muốn Firestore vẫn chạy Emulator với dữ liệu seed.
5. `backend/.env`: đặt `FIREBASE_PROJECT_ID` cùng ID trên và **xóa hoặc comment dòng `FIREBASE_AUTH_EMULATOR_HOST`**. Xác minh đăng nhập Google chỉ cần Project ID, không cần khóa bí mật.
6. Emulator Firestore chạy ở chế độ một dự án, nên khởi động lại với cùng ID: `firebase emulators:start --config firebase/firebase.json --project <PROJECT_ID>`, rồi nạp lại Firestore: `node scripts/seed.js --fs-only`.
7. Khởi động lại backend và frontend (Vite chỉ đọc `.env` lúc khởi động).

Chỉ cần thêm `serviceAccount.json` (Project settings → Service accounts → Generate new private key, **không commit**, đặt `GOOGLE_APPLICATION_CREDENTIALS` trỏ tới nó) nếu dùng tính năng cần cấp Firebase custom token, tức là trang **soát vé của STAFF** đọc/ghi Firestore theo Security Rules. Đăng nhập Google và mua vé không cần.

Lưu ý bảo mật: email Google trùng với tài khoản có sẵn (kể cả ADMIN/STAFF) sẽ đăng nhập được vào tài khoản đó, vì Google đã xác minh chủ sở hữu email.

## 11. Dữ liệu: PostgreSQL và Firestore

### PostgreSQL – 10 bảng (`database/schema.sql`)

`users`, `genres`, `venues`, `events`, `zones`, `seats`, `orders`, `tickets`, `payments`, `reviews`.

Vòng đời trạng thái:

| Đối tượng | Trạng thái |
| --- | --- |
| `events.status` | DRAFT, ON_SALE, SOLD_OUT, CANCELLED, ENDED |
| `seats.status` | AVAILABLE → HELD → SOLD |
| `orders.status` | PENDING, PAID, CANCELLED, EXPIRED (giữ ghế 10 phút) |
| `tickets.status` | VALID, CHECKED_IN, CANCELLED |
| `payments.status` | PENDING, SUCCESS, FAILED, REFUNDED |

Ràng buộc nghiệp vụ đã có sẵn trong schema (đừng tự viết lại ở code):

- `uq_active_ticket_per_seat`: một ghế có tối đa một vé chưa hủy.
- Trigger `ticket_rules`: ghế thuộc đúng sự kiện của đơn; mỗi người không quá `max_tickets_per_user` vé còn hiệu lực cho một sự kiện.
- `chk_hold`: ghế HELD phải có `held_by` và `held_until`.
- `uq_success_payment_per_order`: mỗi đơn một lần thanh toán thành công.
- `users.phone` **không UNIQUE** (cố ý, để phát hiện gom vé, #11).

Tiền lưu số nguyên VND; thời gian lưu `timestamptz`.

**Sửa schema:** thảo luận với TV4 (phụ trách schema/ERD). Thay đổi đặt trong `database/migrations/YYYYMMDD_mota.sql` **và** cập nhật `schema.sql` cho khớp, rồi báo cả nhóm nạp lại.

### Firestore

```
events/{eventId}
    title, date, zonesSummary: { VIP: { left: 12 }, GA: { left: 340 } }
    seats/{seatId}          status, heldBy, heldUntil, zone, row, number
    queue/{userId}          position, joinedAt, admitted
validTickets/{qrCode}       eventId, seatLabel, holderName, checkedIn, checkedInAt
notifications/{userId}/items/{id}   message, read, createdAt
```

- `eventId`, `seatId` dùng lại id PostgreSQL (dạng chuỗi); `qrCode` = `tickets.qr_code`.
- Firebase uid = `String(users.user_id)`, custom claim `role`.
- Security Rules (`firebase/firestore.rules`): client chỉ được **đọc**; STAFF được cập nhật đúng hai trường `checkedIn`, `checkedInAt` của `validTickets`. Backend dùng Admin SDK nên không bị rules chặn.

## 12. DBMS Lab

Khu vực trong trang Admin (`/admin/labs/<topic>`), mỗi topic một trang gồm: mô tả kịch bản, nút chạy, **bảng kết quả hai cột PostgreSQL | Firestore**, ghi chú kết luận.

| Topic (slug) | Thí nghiệm | Phụ trách |
| --- | --- | --- |
| `data-storage` | Cùng dữ liệu vé lưu hai mô hình; so sánh dung lượng, số lần đọc, chi phí Firestore | TV4 |
| `indexing` | Tìm đơn theo email/sự kiện/trạng thái; bật/tắt index; `EXPLAIN ANALYZE` và Query Explain | TV2 |
| `query-processing` | Báo cáo doanh thu theo khu vực: SQL JOIN + GROUP BY so với cách làm trên Firestore | TV3 |
| `transaction` | Luồng mua vé; giả lập lỗi thanh toán để thấy rollback ở hai bên | TV1 |
| `concurrency-control` | "Giả lập giờ G": N người (mặc định 500) giành M vé (mặc định 50); đo bán trùng, xung đột, thời gian; có biến thể không khóa | TV5 |
| `backup-recovery` | Xóa nhầm một sự kiện rồi khôi phục (pg_dump/restore; Firestore export/import hoặc PITR) | TV1 |

**Cách viết một thí nghiệm** – mỗi topic có 3 file trong `backend/src/labs/<topic>/`:

- `postgres.js` và `firestore.js`: mỗi file export `run(params)`, trả về `{ metrics: { <tên>: <giá trị> }, details? }`. **Hai file phải dùng cùng khóa `metrics`** để bảng hai cột so sánh được.
- `index.js`: đã nối sẵn với `labRunner`, thường không cần sửa.

Ví dụ kết quả chạy xong (do `labRunner` gom lại):

```json
{
  "topic": "concurrency-control",
  "params": { "users": 500, "seats": 50 },
  "results": {
    "postgres":  { "ok": true, "durationMs": 1200, "metrics": { "sold": 50, "duplicates": 0 } },
    "firestore": { "ok": true, "durationMs": 3400, "metrics": { "sold": 50, "duplicates": 0 } }
  }
}
```

Mỗi lần chạy tự lưu thành file JSON ở `backend/lab-results/<topic>/` (đã `.gitignore`) để đưa vào báo cáo. Copy các file cần thiết vào `docs/` nếu muốn commit làm bằng chứng.

## 13. Quy ước làm việc

**Git**

- `main` luôn chạy được. Làm trên nhánh `feature/<tên-việc>`, gộp bằng pull request.
- Commit dạng `feat(booking): giữ ghế bằng SELECT FOR UPDATE`, `fix(lab): sửa đo thời gian`.
- Làm trong thư mục module của mình để ít xung đột. Cần sửa file chung (`routes/index.js`, `App.jsx`, `schema.sql`, `firestore.rules`) thì báo nhóm trước.
- **Không commit** `.env`, `serviceAccount.json`, `node_modules`, `*.log`.

**Code**

- API REST, tiền tố `/api`, JSON; lỗi trả `{ error: { code, message } }`.
- SQL thuần, tham số `$1, $2…`, **không nối chuỗi** (tránh SQL injection).
- Transaction dùng một client từ pool (`withTransaction`).
- Mỗi truy vấn ghi loại a–h trong comment, ví dụ `// [f] join: vé của tôi`.
- JavaScript ES modules (`import`/`export`), giao diện tiếng Việt.
- Không dùng ORM.

**Cấu hình**

- Biến môi trường qua `.env`; thêm biến mới thì cập nhật cả `.env.example`.
- Mỗi người dùng `.env` riêng, đặc biệt `DATABASE_URL`.

## 14. Xử lý sự cố thường gặp

| Triệu chứng | Nguyên nhân và cách xử lý |
| --- | --- |
| `password authentication failed for user ...` | Sai `DATABASE_URL`, hoặc cổng 5432 đang thuộc PostgreSQL cài sẵn còn Docker ở 5433. Kiểm tra user, mật khẩu, cổng trong `backend/.env` |
| `Thiếu biến môi trường DATABASE_URL` | Chưa tạo `backend/.env`. Chạy `cp backend/.env.example backend/.env` |
| `/api/health` báo `firestore: down` | Chưa chạy Firestore Emulator, hoặc `FIRESTORE_EMULATOR_HOST` trong `.env` sai cổng |
| Emulator báo `Port 8080 is not open` / `port taken` | Cổng bị chương trình khác chiếm. Dự án đã dùng 8085; nếu vẫn kẹt, đổi cổng đồng bộ ở 4 nơi (mục 5) |
| Vite báo `Port 5173 is in use` | Đã có Vite chạy sẵn. Tắt bản cũ hoặc dùng cổng vừa được báo |
| `501 NOT_IMPLEMENTED` | Chức năng chưa hiện thực, thay `throw notImplemented(...)` bằng code thật |
| `409`/`RULE_VIOLATION` khi mua vé | Trigger `ticket_rules` chặn (sai sự kiện hoặc vượt giới hạn vé) – đúng thiết kế |
| Frontend gọi API bị lỗi CORS | Đảm bảo gọi qua `/api` (proxy Vite) và `CORS_ORIGIN` trong `backend/.env` khớp địa chỉ frontend |
| Sau `docker compose down -v` mất hết dữ liệu | Đúng như dự kiến (xóa volume). Nạp lại bằng `scripts/seed.js` |

Thắc mắc khác: xem [docs/assumptions.md](docs/assumptions.md) (các giả định khi dựng khung) và [docs/architecture.md](docs/architecture.md).
