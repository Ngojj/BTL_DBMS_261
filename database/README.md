# database/

- `schema.sql` – schema PostgreSQL 16 (10 bảng). Docker Compose tự nạp khi khởi tạo volume.
- `migrations/` – (tùy chọn) các thay đổi schema về sau, đặt tên `YYYYMMDD_mota.sql`.
- Nạp lại từ đầu: `docker compose down -v && docker compose up -d`.
- ERD đặt ở `docs/erd/`.
