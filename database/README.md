# database/

- `schema.sql` – schema PostgreSQL 16 (10 bảng). Docker Compose tự nạp khi khởi tạo volume.
- Cảnh báo: `schema.sql` có `DROP TABLE ... CASCADE` và `DROP TYPE`; chỉ chạy trên database mới hoặc nơi có thể xóa dữ liệu.
- `migrations/` – (tùy chọn) các thay đổi schema về sau, đặt tên `YYYYMMDD_mota.sql`.
- Nạp lại từ đầu: `docker compose down -v && docker compose up -d`.
- ERD đặt ở `docs/erd/`.
- Tài liệu data model và giao dịch vé: `docs/data-storage.md`.
