# Demo trực tiếp – Concurrency control (mục 3.5)

Thư mục này chạy các thí nghiệm của mục 3.5 **trực tiếp trên hai DBMS**: PostgreSQL trong container `ticketrush-postgres`, và **Cloud Firestore thật** (project `ticketrush-5a616`). Không đi qua trang DBMS Lab.

```
demo/concurrency-control/
├── pg.mjs            thí nghiệm PostgreSQL (database riêng ticketrush_cc)
├── fs.mjs            thí nghiệm Firestore thật (dữ liệu thử dưới ccLab/run, tự xóa sau mỗi lượt)
├── common.mjs        kết nối, đo thời gian, in bảng
```

## 1. Chuẩn bị (một lần)

```powershell
cd "$env:USERPROFILE\OneDrive\Desktop\BTL_DBMS"
npm run db:up                                   # PostgreSQL ở localhost:5433
cd demo\concurrency-control
npm install
node pg.mjs setup                               # tạo database ticketrush_cc
```

Phía Firestore dùng lại khóa dịch vụ mà backend đã cấu hình. Script đọc biến `GOOGLE_APPLICATION_CREDENTIALS` trong `backend\.env.cloud`, chỉ lấy đường dẫn tới file khóa, không in nội dung ra màn hình. Nếu muốn dùng một file khóa khác:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\đường\dẫn\serviceAccount.json"
```

## 2. Chạy

| Thí nghiệm | PostgreSQL | Firestore thật | Thời gian chạy |
|---|---|---|---|
| TN1 Giờ G: 500 người, 50 ghế | `node pg.mjs tn1` | `node fs.mjs tn1` | PG khoảng 5 giây; FS khoảng 1–3 phút |
| TN2 Lost update + write skew 4 vé | `node pg.mjs tn2` | `node fs.mjs tn2` | PG khoảng 5 giây; FS khoảng 1 phút |
| TN3 Deadlock | `node pg.mjs tn3` | `node fs.mjs tn3` | PG khoảng 12 giây; FS khoảng 30 giây |
| TN4 Điểm nóng | `node pg.mjs tn4` | `node fs.mjs tn4` | PG khoảng 5 giây; FS khoảng 1–2 phút |
| Tất cả | `node pg.mjs all` | `node fs.mjs all` | |

Các tham số đều đổi được, ví dụ `node pg.mjs tn1 --n=1000 --seats=100 --think=10`, hoặc `node fs.mjs tn1 --n=200`. Với `tn1`, thêm `--only=V3,V5` hay `--only=F1` để chỉ chạy một số cách.

**Chi phí Firestore:** chạy `node fs.mjs all` một lần tốn tối đa khoảng 20.000 lượt đọc và 5.000 lượt ghi hoặc xóa (phần lớn lượt đọc là của TN1-F2, vì mỗi lần chạy callback đọc 20 ghế). Con số này nằm trong hạn mức miễn phí mỗi ngày (50.000 lượt đọc, 20.000 lượt ghi, 20.000 lượt xóa). Mọi dữ liệu thử nằm dưới `ccLab/run` và bị xóa sau mỗi lượt, không đụng tới `events`, `queues` hay `validTickets` của ứng dụng. Nếu một lượt chạy bị ngắt giữa chừng, dọn bằng `node fs.mjs clean`.

**Chạy thử trên emulator:** thêm `--emulator` để chạy trên Firestore Emulator ở cổng 8085, ví dụ `node fs.mjs tn2 --emulator`. Emulator không mô phỏng đúng cơ chế khóa và giới hạn tốc độ ghi, nên số liệu đưa vào báo cáo phải lấy từ Firestore thật.

## 3. Demo hai cửa sổ psql (trình bày trực tiếp)

Mở hai cửa sổ PowerShell, cửa sổ nào cũng chạy:

```powershell
docker exec -it ticketrush-postgres psql -U ticketrush -d ticketrush_cc
```

### Lệch ghi với giới hạn 4 vé (TN2b)

Chuẩn bị, chạy ở một trong hai cửa sổ:

```sql
TRUNCATE cc_tickets; INSERT INTO cc_tickets (user_id, event_id) SELECT 1, 1 FROM generate_series(1, 3);
```

Chạy lần lượt theo thứ tự trong bảng. Cột "Cửa sổ" cho biết gõ lệnh ở bên nào:

| # | Cửa sổ | Lệnh |
|---|---|---|
| 1 | A | `BEGIN ISOLATION LEVEL REPEATABLE READ;` `SELECT count(*) FROM cc_tickets WHERE user_id = 1;` (ra 3) |
| 2 | B | `BEGIN ISOLATION LEVEL REPEATABLE READ;` `SELECT count(*) FROM cc_tickets WHERE user_id = 1;` (ra 3) |
| 3 | A | `INSERT INTO cc_tickets (user_id, event_id) VALUES (1, 1); COMMIT;` |
| 4 | B | `INSERT INTO cc_tickets (user_id, event_id) VALUES (1, 1); COMMIT;` (thành công) |
| 5 | A | `SELECT count(*) FROM cc_tickets WHERE user_id = 1;` (ra **5**: đã vượt giới hạn 4) |

Làm lại từ bước chuẩn bị với hai biến thể:
- Đổi `REPEATABLE READ` thành `SERIALIZABLE`: ở bước 4, lệnh `COMMIT` của B báo `ERROR: could not serialize access…`.
- Dùng `BEGIN;` và đặt `SELECT * FROM cc_users WHERE user_id = 1 FOR UPDATE;` trước lệnh đếm ở cả hai bên: B **đứng chờ** ở bước 2 cho tới khi A commit, sau đó đếm ra 4 và không mua thêm.

### Deadlock (TN3)

| # | Cửa sổ | Lệnh |
|---|---|---|
| 1 | A | `BEGIN; SELECT * FROM cc_seats WHERE seat_id = 1 FOR UPDATE;` |
| 2 | B | `BEGIN; SELECT * FROM cc_seats WHERE seat_id = 2 FOR UPDATE;` |
| 3 | A | `SELECT * FROM cc_seats WHERE seat_id = 2 FOR UPDATE;` (đứng chờ) |
| 4 | B | `SELECT * FROM cc_seats WHERE seat_id = 1 FOR UPDATE;` (sau khoảng 1 giây: `ERROR: deadlock detected`) |
| 5 | A | (tự chạy tiếp) `COMMIT;` |
| 6 | B | `ROLLBACK;` |
