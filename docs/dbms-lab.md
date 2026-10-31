# DBMS Lab – Module Thí Nghiệm So Sánh PostgreSQL & Cloud Firestore

> **Nội dung hoàn thành:** Hết tuần 44 (26/10 – 1/11/2026)  
> **Mục tiêu:** Xây dựng hoàn chỉnh 6 trang thực nghiệm DBMS Lab (5 topic bắt buộc + 1 topic điểm cộng Backup & Recovery). Cả 6 thí nghiệm chạy trực tiếp trên nền tảng TicketRush.

---

## 1. Tổng quan 6 Thí nghiệm

Module **DBMS Lab** được tích hợp trực tiếp vào ứng dụng TicketRush (khu vực Admin, đường dẫn `/lab`), cho phép đối chiếu trực quan bằng bảng 2 cột **🐘 PostgreSQL | 🔥 Cloud Firestore** cùng kịch bản dữ liệu và số đo thực tế.

| # | Topic | Kịch bản thí nghiệm | Tiêu chí đo đạc & So sánh | Đường dẫn API | Đường dẫn UI |
|---|---|---|---|---|---|
| **1** | **Data Storage & Management** | Hiển thị trang "Vé của tôi" và đo dung lượng các bảng/collections | Số lần đọc (1 SQL JOIN 6 bảng vs. N document reads), tổng dung lượng byte (3NF vs. Denormalized) | `GET /api/labs/data-storage/my-tickets`<br>`GET /api/labs/data-storage/storage-size` | `/lab/data-storage` |
| **2** | **Indexing** | Tìm kiếm đơn hàng theo `user_id`, `event_id`, `status` | So sánh Index Scan (`idx_orders_user_event`) vs. Sequential Scan (`EXPLAIN ANALYZE`, buffer hits). Phân tích Single-field vs. Composite Index của Firestore | `GET /api/labs/indexing/explain-compare` | `/lab/indexing` |
| **3** | **Query Processing** | Báo cáo doanh thu & tỷ lệ lấp đầy theo khu vực (`SUM`, `COUNT`, `GROUP BY`, `HAVING`) | Xử lý tại Database Engine (Hash Join + HashAggregate) vs. App-level In-Memory Aggregation trên Node.js | `GET /api/labs/query-processing/revenue-report` | `/lab/query-processing` |
| **4** | **Transaction** | Luồng giữ ghế → tạo đơn → thanh toán giả lập | Kiểm chứng tính chất ACID: Commit thành công vs. Giả lập lỗi thanh toán để quan sát `ROLLBACK` (ghế quay về `AVAILABLE`, không có rác) | `POST /api/labs/transaction/simulate` | `/lab/transaction` |
| **5** | **Concurrency Control** | Giả lập "Giờ G": N khách hàng tranh mua M ghế giới hạn | So sánh 3 chế độ: **No Lock** (xảy ra Overbooking/bán trùng ghế) vs. **PostgreSQL Pessimistic Lock** (`FOR UPDATE SKIP LOCKED`) vs. **Firestore OCC** (`runTransaction` snapshot & retry) | `POST /api/labs/concurrency-control/simulate-rush-hour` | `/lab/concurrency-control` |
| **6** | **Backup & Recovery** | Sao lưu Snapshot → Giả lập xóa nhầm sự kiện → Phục hồi nguyên trạng | Đo thời gian Backup, thời gian khôi phục (RTO), mức mất mát dữ liệu (RPO). So sánh `pg_dump`/PITR và Firestore export/PITR | `POST /api/labs/backup-recovery/simulate` | `/lab/backup-recovery` |

---

## 2. Chi tiết từng Thí nghiệm

### 2.1 Topic 1: Data Storage & Management
- **Mục đích:** Khảo sát sự đánh đổi giữa mô hình quan hệ chuẩn hóa 3NF và mô hình document NoSQL.
- **Kết quả:**
  - PostgreSQL: Dùng 1 câu lệnh SQL duy nhất `JOIN 6 bảng` (tickets, orders, events, venues, seats, zones), thời gian cực nhanh nhờ Foreign Key Index.
  - Firestore: Cần đọc tài liệu `validTickets` trước, sau đó phát sinh thêm các lần đọc tài liệu `events` tương ứng. Gây tốn chi phí đọc (Document Reads) khi số lượng vé lớn.

### 2.2 Topic 2: Indexing & Query Optimization
- **Mục đích:** Chứng minh vai trò của B-Tree Index và chi phí duy trì index.
- **Kết quả:**
  - PostgreSQL `EXPLAIN (ANALYZE, BUFFERS)`: Khi có index, `Bitmap Index Scan` hoặc `Index Scan` chỉ truy cập đúng vài Shared Hit Blocks, thời gian `< 1ms`. Khi ép `Seq Scan`, planner phải duyệt qua toàn bộ table blocks.
  - Firestore: Tự động đánh index cho mọi trường đơn (Single-field index). Tuy nhiên, khi truy vấn lọc kết hợp nhiều trường hoặc lọc kết hợp sắp xếp, bắt buộc phải có **Composite Index** trong `firestore.indexes.json`, nếu không truy vấn sẽ bị từ chối ngay lập tức.

### 2.3 Topic 3: Query Processing
- **Mục đích:** So sánh khả năng tính toán tổng hợp (Aggregation) phức tạp.
- **Kết quả:**
  - PostgreSQL: Tối ưu hóa tại tầng Database Engine bằng thuật toán `HashAggregate` và `Hash Join`, tận dụng bộ nhớ `work_mem` và truyền kết quả tổng hợp qua mạng (Predicate Pushdown).
  - Firestore: Do không hỗ trợ cú pháp `GROUP BY` / `HAVING` qua nhiều collection, backend phải tải toàn bộ documents thô về bộ nhớ Node.js để chạy vòng lặp gom nhóm. Tốn băng thông truyền tải và RAM server.

### 2.4 Topic 4: Transaction Management (ACID)
- **Mục đích:** Kiểm chứng tính Nguyên tử (Atomicity) và Cô lập (Isolation).
- **Kết quả:**
  - Trường hợp Commit: Mọi thay đổi trên `seats`, `orders`, `tickets`, `payments` được áp dụng đồng thời.
  - Trường hợp Rollback (Giả lập lỗi thanh toán): Lệnh `ROLLBACK` trong PostgreSQL lập tức giải phóng ghế về `AVAILABLE`, không lưu lại bất kỳ bản ghi rác nào. Trong Firestore, exception trong callback `runTransaction` khiến toàn bộ mutations bị hủy nguyên vẹn.

### 2.5 Topic 5: Concurrency Control ("Giờ G")
- **Mục đích:** Giải quyết bài toán mở bán vé concert hàng nghìn người mua cùng lúc.
- **Kết quả:**
  - **No Lock (Ngây thơ):** Đọc ghế trống rồi mới cập nhật mà không khóa → xuất hiện hiện tượng **Overbooking** (nhiều khách hàng cùng mua được 1 ghế).
  - **PostgreSQL Pessimistic Lock (`FOR UPDATE SKIP LOCKED`):** Khóa hàng ghế ở mức row-lock. Đúng chính xác số ghế mở bán được bán ra, các request đến sau bị từ chối sạch sẽ, **0% bán trùng**.
  - **Firestore Optimistic Concurrency Control (OCC):** Kiểm tra phiên bản snapshot lúc commit, tự động thử lại khi phát hiện xung đột ghi. Không bao giờ bán trùng.

### 2.6 Topic 6: Backup & Recovery (Điểm cộng)
- **Mục đích:** Đánh giá phương án khôi phục sau sự cố mất mát dữ liệu.
- **Kết quả:**
  - PostgreSQL: Hỗ trợ linh hoạt từ Logical Backup (`pg_dump`) đến Continuous WAL Archiving (PITR - Point-in-Time Recovery) cho RPO đạt mức giây.
  - Firestore: Dịch vụ Managed Backup của Google Cloud hỗ trợ sao lưu bucket và khôi phục PITR 7 ngày gần nhất (trên gói Blaze).

---

## 3. Cấu trúc Source Code Hoàn thành

```
backend/src/labs/
├── data-storage/
│   ├── dataStorage.lab.js
│   └── dataStorage.route.js
├── indexing/
│   ├── indexing.lab.js
│   └── indexing.route.js
├── query-processing/
│   ├── queryProcessing.lab.js
│   └── queryProcessing.route.js
├── transaction/
│   ├── transaction.lab.js
│   └── transaction.route.js
├── concurrency-control/
│   ├── concurrencyControl.lab.js
│   └── concurrencyControl.route.js
└── backup-recovery/
    ├── backupRecovery.lab.js
    └── backupRecovery.route.js

frontend/src/pages/lab/
├── LabHubPage.jsx                 # Trang trung tâm giới thiệu 6 lab
├── LabDataStoragePage.jsx         # Lab 1: Data Storage
├── LabIndexingPage.jsx            # Lab 2: Indexing
├── LabQueryProcessingPage.jsx     # Lab 3: Query Processing
├── LabTransactionPage.jsx         # Lab 4: Transaction
├── LabConcurrencyControlPage.jsx  # Lab 5: Concurrency Control
└── LabBackupRecoveryPage.jsx      # Lab 6: Backup & Recovery
```

