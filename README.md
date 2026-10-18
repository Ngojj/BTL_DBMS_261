# TicketRush · Phần TV4

Phạm vi trong nhánh này: **Data Storage, mua/hủy vé, ERD và script tạo bảng**. Triển khai dừng ở tuần 42; không gồm DBMS Lab, realtime/offline, QR/check-in, báo cáo, waiting room hay admin modules của thành viên khác.

## Công nghệ

- React + Vite frontend.
- Node.js/Express backend, JWT, SQL thuần qua `pg`.
- PostgreSQL 16 làm nguồn dữ liệu giao dịch; Firebase Admin/Firestore chỉ có trong hạ tầng đề tài, không tham gia quyết định mua/hủy ở mốc này.

## Chạy local

Cần Node.js 20+, Docker Desktop. Tạo file môi trường từ ví dụ:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Đổi `JWT_SECRET` trong `backend/.env`, rồi cài dependency và bật PostgreSQL:

```bash
npm --prefix backend install
npm --prefix frontend install
docker compose up -d postgres
```

Chạy backend và frontend ở hai terminal:

```bash
npm --prefix backend run dev
npm --prefix frontend run dev
```

Mở http://localhost:5173. API health: http://localhost:4000/api/health.

## Luồng TV4

Khách đăng ký/đăng nhập, xem sự kiện, chọn ghế trong khu vực, tạo order giữ ghế 10 phút, thanh toán giả lập hoặc hủy order. Hủy order đã thanh toán ghi payment `REFUNDED` trong database; không gọi cổng thanh toán thật.

ERD tại [docs/erd/ticketrush.md](docs/erd/ticketrush.md), phần lý thuyết tại [docs/data-storage.md](docs/data-storage.md), API tại [docs/api.md](docs/api.md), PostgreSQL DDL tại [database/schema.sql](database/schema.sql).

> Cảnh báo: `database/schema.sql` có `DROP TABLE ... CASCADE` và `DROP TYPE`; chỉ chạy trên database mới hoặc nơi có thể xóa toàn bộ dữ liệu.

## Kiểm tra

```bash
cd backend && npm test
cd frontend && npm run build
```
