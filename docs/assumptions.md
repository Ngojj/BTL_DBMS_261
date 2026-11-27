# Giả định khi dựng khung

1. `schema.sql` được chuyển vào `database/schema.sql` (đúng vị trí brief nêu).
2. Chức năng đánh giá (`reviews`) chưa có người phụ trách trong brief → tạm giao TV1.
3. Firestore Security Rules cần `request.auth.token.role` → backend cấp Firebase custom token (claim `role`) qua `POST /api/auth/firebase-token`; uid = `String(user_id)`.
4. Kết quả DBMS Lab lưu dưới dạng file JSON trong `backend/lab-results/<topic>/` (không tạo bảng `lab_runs`).
5. `auth` được hiện thực sẵn (đăng ký/đăng nhập/JWT) vì mọi module khác phụ thuộc; các module còn lại là placeholder trả 501 `NOT_IMPLEMENTED`.
6. Cổng: backend 4000, frontend 5173, PostgreSQL 5433 (Docker; 5432 hay bị PostgreSQL cài sẵn trên máy chiếm), Firestore Emulator 8085, Auth Emulator 9099, Emulator UI 4001.
