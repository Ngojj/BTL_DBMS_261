# TicketRush – Mô tả dự án

> Tài liệu này mô tả dự án để trợ lý AI (Claude) hiểu bối cảnh và **tạo cấu trúc dự án**. Đọc toàn bộ trước khi sinh code. Khi có điểm chưa rõ, chọn phương án đơn giản nhất phù hợp với mô tả và ghi chú lại giả định.

## 1. Bối cảnh

- Bài tập lớn môn **Hệ quản trị cơ sở dữ liệu** (HK261), nhóm 5 sinh viên.
- Đề tài so sánh hai DBMS: **PostgreSQL** và **Firebase (Cloud Firestore, bản Standard)**.
- Yêu cầu đề bài:
  - So sánh hai DBMS trên các topic: Data storage & management, Indexing, Query processing, Transaction, Concurrency control, Backup & recovery.
  - Xây dựng một **ứng dụng web** chạy trên ít nhất một DBMS, kiến trúc client-server / n-tier / MVC.
  - Ứng dụng có tối thiểu **10 chức năng** (không tính đăng nhập, đăng xuất) và dùng đủ 8 loại thao tác: (a) insert, (b) delete, (c) update, (d) truy vấn một điều kiện, (e) điều kiện kết hợp, (f) join, (g) subquery, (h) hàm tổng hợp.
  - Điểm cộng tối đa khi các thí nghiệm so sánh được **tích hợp hoàn toàn vào ứng dụng** → dự án có module **DBMS Lab**.

## 2. Tổng quan sản phẩm

**TicketRush** là nền tảng bán vé concert chịu được "giờ G" mở bán: hàng nghìn người mua cùng lúc mà không bán trùng ghế, không trừ tiền sai, và vẫn soát vé được khi mạng ở cổng yếu.

### Người dùng

| Vai trò (`users.role`) | Làm gì |
| --- | --- |
| `CUSTOMER` | Tìm sự kiện, chọn ghế trên sơ đồ realtime, mua vé, hủy vé, xem vé và mã QR, đánh giá sự kiện |
| `ADMIN` | Quản lý sự kiện, khu vực, giá vé; xem thống kê; phát hiện tài khoản gom vé; dùng DBMS Lab |
| `STAFF` | Soát vé QR ở cổng (chạy được khi mất mạng) |

### Ngoài phạm vi

Cổng thanh toán thật (chỉ giả lập), bán lại vé, ứng dụng mobile native.

## 3. Công nghệ

| Thành phần | Công nghệ |
| --- | --- |
| Frontend | React + Vite, Tailwind CSS, React Router, Firebase Web SDK (lắng nghe realtime, offline), thư viện quét QR trên trình duyệt |
| Backend | Node.js (LTS) + Express, kiến trúc MVC nhiều tầng |
| Truy cập PostgreSQL | Thư viện `pg` (node-postgres), viết SQL thuần — **không dùng ORM**, vì môn học cần thấy rõ câu SQL, transaction và khóa |
| Truy cập Firestore | Firebase Admin SDK (backend), Firebase Web SDK (frontend) |
| Cơ sở dữ liệu | PostgreSQL 16, Cloud Firestore bản Standard |
| Môi trường dev | Docker Compose chạy PostgreSQL; Firebase Local Emulator Suite chạy Firestore |
| Xác thực | JWT do backend cấp, mật khẩu băm bằng bcrypt |
| Kiểm thử tải (DBMS Lab) | Script Node.js tự viết hoặc k6 |
| Ngôn ngữ | JavaScript (ES modules). Giao diện tiếng Việt |

## 4. Kiến trúc

Client-server 3 tầng, backend theo MVC: **Route → Controller → Service → Repository**.

```
[React app] --REST/JSON--> [Express API] --SQL--> [PostgreSQL]  (nguồn dữ liệu chính)
     |                           |
     |                           +--Admin SDK--> [Firestore]    (bản sao phục vụ realtime/offline)
     +--Web SDK (chỉ đọc/lắng nghe)--> [Firestore]
```

Nguyên tắc bắt buộc:

1. **PostgreSQL là nguồn dữ liệu chính (source of truth).** Mọi quyết định bán ghế, thu tiền đều chốt trên PostgreSQL trong transaction.
2. **Firestore chỉ là bản sao** phục vụ: sơ đồ ghế realtime, phòng chờ ảo, danh sách vé hợp lệ cho cổng soát vé (offline), thông báo.
3. Frontend **không ghi trực tiếp** dữ liệu nghiệp vụ vào Firestore; mọi thao tác ghi đi qua API. Ngoại lệ duy nhất: trang soát vé ghi `checkedIn` vào `validTickets` (để chạy offline), backend đồng bộ ngược về PostgreSQL.
4. Sau khi transaction PostgreSQL commit, backend đồng bộ sang Firestore (service `sync`). Ghi Firestore lỗi thì thử lại; có endpoint admin để đồng bộ lại toàn bộ trạng thái ghế.
5. Tầng Repository tách riêng cho từng DBMS để DBMS Lab gọi **cùng một nghiệp vụ trên hai DBMS** và so sánh.

## 5. Dữ liệu

### 5.1 PostgreSQL

Schema đầy đủ nằm ở `database/schema.sql` (đã chạy thử trên PostgreSQL 16). Tóm tắt 10 bảng:

| Bảng | Cột chính | Ghi chú |
| --- | --- | --- |
| `users` | user_id, email (UNIQUE), phone, full_name, password_hash, role | `phone` không UNIQUE (để phát hiện gom vé) |
| `genres` | genre_id, name | Thể loại nhạc |
| `venues` | venue_id, name, city, address | Địa điểm |
| `events` | event_id, title, genre_id, venue_id, event_date, sale_open_at, max_tickets_per_user (mặc định 4), status | status: DRAFT, ON_SALE, SOLD_OUT, CANCELLED, ENDED |
| `zones` | zone_id, event_id, name, price, capacity | Khu VIP, CAT1, GA… |
| `seats` | seat_id, zone_id, row_label, seat_no, status, held_by, held_until, version | status: AVAILABLE → HELD → SOLD; `version` cho khóa lạc quan |
| `orders` | order_id, user_id, event_id, total, status, created_at, expires_at | status: PENDING, PAID, CANCELLED, EXPIRED; giữ ghế 10 phút |
| `tickets` | ticket_id, order_id, seat_id, price, qr_code (UUID), status, checked_in_at | status: VALID, CHECKED_IN, CANCELLED |
| `payments` | payment_id, order_id, amount, method, status, paid_at | Ghi cả lần thất bại |
| `reviews` | review_id, user_id, event_id, rating (1–5), comment | Mỗi người một đánh giá cho một sự kiện |

Ràng buộc nghiệp vụ đã có trong schema:

- Partial unique index `uq_active_ticket_per_seat`: một ghế chỉ có tối đa một vé chưa hủy.
- Trigger `ticket_rules`: ghế phải thuộc đúng sự kiện của đơn; mỗi người không quá `max_tickets_per_user` vé còn hiệu lực cho một sự kiện.
- `CHECK chk_hold`: ghế HELD phải có `held_by` và `held_until`.
- Partial unique index `uq_success_payment_per_order`: mỗi đơn một lần thanh toán thành công.

**Lưu ý concurrency:** trigger đếm 4 vé không an toàn khi hai transaction của cùng một người chạy song song. Service mua vé phải khóa trước khi đếm (`SELECT … FROM users WHERE user_id = $1 FOR UPDATE`) và khóa ghế bằng `SELECT … FOR UPDATE` (hoặc `SKIP LOCKED`).

### 5.2 Firestore

```
events/{eventId}
    title, date, zonesSummary: { VIP: { left: 12 }, GA: { left: 340 } }
    seats/{seatId}          status, heldBy, heldUntil, zone, row, number
    queue/{userId}          position, joinedAt, admitted
validTickets/{qrCode}       eventId, seatLabel, holderName, checkedIn, checkedInAt
notifications/{userId}/items/{id}   message, read, createdAt
```

- `eventId`, `seatId` dùng lại id của PostgreSQL (dạng chuỗi).
- `qrCode` = `tickets.qr_code` (UUID).
- Security Rules: client chỉ được đọc; riêng tài khoản STAFF được cập nhật `checkedIn`, `checkedInAt` trong `validTickets`.

## 6. Chức năng

| # | Chức năng | Người dùng | DBMS | Loại truy vấn |
| --- | --- | --- | --- | --- |
| 1 | Xem sự kiện theo thể loại | Khách | PostgreSQL | d |
| 2 | Lọc sự kiện theo thành phố, khoảng ngày, khoảng giá | Khách | PostgreSQL | e |
| 3 | Phòng chờ ảo trước giờ mở bán *(làm thêm, ưu tiên thấp)* | Khách | Firestore | realtime |
| 4 | Chọn ghế trên sơ đồ realtime và mua vé (giữ ghế → tạo đơn → tạo vé → thanh toán giả lập) | Khách | PostgreSQL (transaction) + Firestore (sơ đồ ghế) | a |
| 5 | Hủy đơn, hoàn vé | Khách | PostgreSQL | c |
| 6 | Vé của tôi (sự kiện, khu vực, ghế, mã QR) | Khách | PostgreSQL | f |
| 7 | Soát vé QR ở cổng, chạy được khi mất mạng | Staff | Firestore (offline) → đồng bộ PostgreSQL | c |
| 8 | Quản lý sự kiện (thêm, sửa, xóa) | Admin | PostgreSQL | a, b, c |
| 9 | Quản lý khu vực và giá vé; sinh ghế cho khu vực | Admin | PostgreSQL | a, b, c |
| 10 | Thống kê doanh thu, tỷ lệ lấp đầy theo khu vực | Admin | PostgreSQL | h |
| 11 | Phát hiện tài khoản gom vé (vượt giới hạn, nhiều tài khoản chung số điện thoại) | Admin | PostgreSQL | g |
| 12 | DBMS Lab: chạy thí nghiệm so sánh hai DBMS | Admin | Cả hai | tất cả |

Thêm: đánh giá sự kiện (insert review, xem điểm trung bình – loại h), đăng ký, đăng nhập, đăng xuất.

## 7. DBMS Lab

Khu vực trong trang Admin, mỗi topic một trang. Mỗi trang có: mô tả kịch bản, nút chạy thí nghiệm, **bảng kết quả hai cột (PostgreSQL | Firestore)**, và phần ghi chú kết luận. Kết quả mỗi lần chạy được lưu lại (bảng `lab_runs` riêng hoặc file JSON) để đưa vào báo cáo.

| Trang | Thí nghiệm |
| --- | --- |
| Data storage | Cùng dữ liệu vé lưu theo hai mô hình; so sánh dung lượng, số lần đọc để hiện trang "vé của tôi", ước tính chi phí Firestore |
| Indexing | Tìm đơn theo email, sự kiện, trạng thái; bật/tắt index; hiện `EXPLAIN ANALYZE` (Postgres) và Query Explain (Firestore) |
| Query processing | Cùng một báo cáo doanh thu theo khu vực: một câu SQL có join + GROUP BY so với cách làm trên Firestore |
| Transaction | Luồng mua vé; nút giả lập lỗi thanh toán để thấy rollback ở hai bên |
| Concurrency control | Nút "Giả lập giờ G": N người (mặc định 500) giành M vé (mặc định 50); đo số vé bán ra, có bán trùng không, số lần xung đột/thử lại, thời gian. Có biến thể "không khóa" để thấy lỗi |
| Backup & recovery | Xóa nhầm một sự kiện rồi khôi phục (pg_dump/restore; Firestore export/import hoặc PITR) |

Mỗi thí nghiệm là một module độc lập trong backend (`labs/<topic>`), có hàm chạy cho từng DBMS trả về cùng một định dạng kết quả.

## 8. Phân công (để chia thư mục/module rõ ràng)

| Thành viên | Topic | Chức năng |
| --- | --- | --- |
| 1 (nhóm trưởng) | Transaction + Backup & recovery | #1, #8 |
| 2 | Indexing | #2, #9; khung backend, dữ liệu mẫu, kiểm thử |
| 3 | Query processing | #10, #11; khung frontend, khung DBMS Lab |
| 4 | Data storage | #4, #5; ERD, schema |
| 5 | Concurrency control | #3, #6, #7; cấu hình Firebase, đồng bộ, sơ đồ ghế realtime |

Cấu trúc thư mục nên tách theo module nghiệp vụ để mỗi người làm trên phần riêng, ít xung đột Git.

## 9. Quy ước

- Git: nhánh `main` luôn chạy được; nhánh tính năng `feature/<tên-việc>`; gộp bằng pull request. Commit dạng `feat(booking): ...`, `fix(lab): ...`.
- API REST, tiền tố `/api`, JSON; lỗi trả về `{ error: { code, message } }`.
- Cấu hình qua `.env` (có `.env.example`); không commit bí mật, không commit `serviceAccount.json`.
- SQL thuần, đặt tham số `$1, $2…`, không nối chuỗi. Transaction dùng một client lấy từ pool (`BEGIN … COMMIT/ROLLBACK`).
- Mỗi truy vấn phục vụ chức năng ghi chú loại a–h trong comment, ví dụ `// [f] join: vé của tôi`.
- Tiền tệ VND, kiểu số nguyên. Thời gian lưu `timestamptz`, hiển thị giờ Việt Nam.

## 10. Yêu cầu khi tạo cấu trúc dự án

Tạo **khung dự án** (chưa cần hiện thực đầy đủ nghiệp vụ), gồm:

1. Monorepo với `backend/`, `frontend/`, `database/`, `firebase/`, `docs/`, `scripts/`.
2. `docker-compose.yml` chạy PostgreSQL 16, tự nạp `database/schema.sql` khi khởi tạo.
3. `firebase/`: `firebase.json` cấu hình Firestore Emulator, `firestore.rules`, `firestore.indexes.json`.
4. Backend Express: cấu trúc Route → Controller → Service → Repository; module theo nghiệp vụ (`auth`, `events`, `zones`, `booking`, `tickets`, `checkin`, `reports`, `reviews`, `sync`, `labs/*`); kết nối `pg` pool và Firebase Admin SDK (trỏ Emulator khi dev); middleware xác thực JWT và phân quyền theo role; xử lý lỗi tập trung; endpoint `GET /api/health` kiểm tra kết nối cả hai DBMS.
5. Frontend React: routing cho các trang (danh sách sự kiện, chi tiết + sơ đồ ghế, thanh toán, vé của tôi, soát vé, admin: sự kiện/khu vực/thống kê/gom vé, DBMS Lab với 6 trang con); layout chung; client gọi API; cấu hình Firebase Web SDK.
6. `scripts/`: chỗ cho script sinh dữ liệu mẫu (nạp cả PostgreSQL và Firestore) và script giả lập tải cho DBMS Lab.
7. `.env.example` cho backend và frontend, `README.md` hướng dẫn cài đặt và chạy từng bước (Node.js, Docker, Firebase CLI).
8. Các file placeholder có comment `TODO` ghi rõ chức năng, người phụ trách và loại truy vấn a–h tương ứng.

Không cần: CI/CD, triển khai production, test tự động đầy đủ (chỉ cần cấu trúc thư mục `tests/`).