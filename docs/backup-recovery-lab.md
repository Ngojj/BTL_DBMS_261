# DBMS Lab — Backup & recovery (TV1)

## Chạy trên website

1. Bật PostgreSQL, Firestore Emulator (hoặc cấu hình Admin SDK cho cloud), backend và frontend.
2. Với PostgreSQL 16 trong Docker của dự án, đặt `PG_TOOLS_CONTAINER=ticketrush-postgres` trong `backend/.env` rồi khởi động lại backend. Backend dùng pg_dump/pg_restore 16 trong container, không phụ thuộc client Windows. Docker CLI phải có trên PATH và Docker Desktop phải chạy. DATABASE_URL phải trỏ tới database trong container này. Không đặt đường dẫn executable Windows khi dùng chế độ container.
   Nếu dùng PostgreSQL ở nơi khác, bỏ PG_TOOLS_CONTAINER và cài hai công cụ cùng major version với server (hoặc đặt PG_DUMP_PATH/PG_RESTORE_PATH). Client mới có thể dump server cũ nhưng bản dump không được bảo đảm restore lại trên server cũ: ví dụ client 18 tạo SET transaction_timeout mà server 16 không hiểu.
3. Đăng nhập ADMIN → DBMS LAB → Backup và recovery (`/admin/labs/backup-recovery`).
4. Chọn số ghế 1–200, mặc định 50. Bấm **Chạy thí nghiệm**.
5. Với 50 ghế, mỗi hệ phải khôi phục **52 bản ghi** (1 sự kiện + 1 khu vực + 50 ghế), **Mất dữ liệu: Không**. Trong **Bằng chứng và trạng thái dữ liệu**: `before.records = 52`, `afterDeletion.records = 0`, `afterRestore.records = 52`; checksum trước/sau giống nhau.
6. Ghi nhận xét, lưu/xuất CSV. Backend lưu cả kết quả và bằng chứng trong `backend/lab-results/backup-recovery/`.

## Phương pháp thực tế

- PostgreSQL: tạo schema UUID riêng gồm ba bảng rút gọn có khóa ngoại. `pg_dump --format=custom --data-only --schema ...` ghi tệp thật; DELETE sự kiện đã commit làm cascade khu vực/ghế; `pg_restore --data-only --single-transaction --exit-on-error` phục hồi từ tệp vào các bảng trống còn nguyên cấu trúc.
- Firestore: tạo dữ liệu riêng tại `backupLabRuns/{UUID}/{events,zones,seats}`. Đọc document ra JSON trên đĩa, xóa các document thử bằng batch, đọc lại tệp rồi ghi lại bằng batch. Không chỉ xóa document cha vì Firestore không cascade.
- Dữ liệu hai bên có cùng các trường nghiệp vụ, chỉ gồm chuỗi và số. Không có tác nhân khác ghi vào fixture. Kiểm chứng bằng số lượng và SHA-256 của toàn bộ trường, không chỉ đếm bản ghi.
- Đây là **sao lưu JSON cấp ứng dụng** của Firestore, KHÔNG phải Google Managed Export/Import, Scheduled Backup hoặc PITR. Không xử lý Timestamp, GeoPoint, Reference, Bytes, indexes, rules hoặc một cơ sở dữ liệu sản xuất đầy đủ. Báo cáo phải gọi đúng phương pháp này.
- Đây là **khôi phục dữ liệu đã xóa** của PostgreSQL, không phải phục hồi khi mất toàn bộ database/schema và không phải PITR. Không sửa bảng public hay sự kiện đang bán của ứng dụng.
- `backupMs`: đọc/xuất và ghi tệp; PostgreSQL gồm cả khởi động tiến trình pg_dump. `restoreMs`: đọc/nhập từ tệp đến khi ghi hoàn tất; PostgreSQL gồm khởi động pg_restore. Chế độ Docker còn gồm docker exec, docker cp và dọn tệp trung gian trong container; phải ghi rõ môi trường này khi báo cáo. Không gồm tạo fixture, xóa, kiểm chứng dữ liệu hoặc dọn schema/tệp host. `durationMs` của runner gồm toàn quy trình. Kích thước custom dump và JSON khác định dạng, không dùng để kết luận dung lượng lưu trữ DBMS.
- Dọn dữ liệu và tệp tạm trong finally cả khi có lỗi. Nếu tiến trình bị tắt đột ngột, có thể còn schema `backup_lab_*`, document thử hoặc thư mục tạm `ticketrush-backup-*`; không phải cơ chế sao lưu vận hành lâu dài.
- Lỗi công cụ/kết nối/kiểm chứng được hiển thị thành lỗi, không tạo số liệu thành công giả. Không nhận eventId hoặc đường dẫn từ request.

## Thu mẫu cho báo cáo

Chạy 5 lượt làm nóng, không đưa vào thống kê; sau đó ít nhất 30 lượt cho mỗi kích thước chọn, ví dụ 10, 50, 200 ghế. Một lượt website chạy lần lượt PostgreSQL rồi Firestore. Giữ nguyên môi trường và kích thước trong từng nhóm; thống kê riêng backup/restore (median, trung bình, min/max, P95), số lượt thành công/lỗi và độ chính xác dữ liệu. Chỉ ghi kết quả thực đo. Số ghế là kích thước dữ liệu, số lượt chạy mới là số mẫu đo.

Giới hạn: môi trường local/cloud, thứ tự chạy cố định, định dạng bản sao và phạm vi sao lưu khác nhau. Không suy ra hệ quản trị nào nhanh hơn trong mọi tình huống, và không dùng kết quả này để đánh giá dịch vụ Managed Backup của Google.

## Kiểm thử dành cho người phát triển

Từ thư mục backend: `npm test`. Integration test cần PostgreSQL có quyền CREATE SCHEMA và Firestore Emulator; không cần seed dữ liệu ứng dụng:

```powershell
$env:RUN_BACKUP_LAB_INTEGRATION = '1'
node --test tests/backup-recovery-lab.test.js
Remove-Item Env:RUN_BACKUP_LAB_INTEGRATION
```

Kiểm tra phân quyền, input, 1/50/200 ghế, khôi phục đúng toàn bộ trường, lịch sử kết quả, cleanup và lỗi thiếu pg_dump/pg_restore (trước và sau bước xóa). Test tự chạy API trên cổng ngẫu nhiên, không cần backend dev server.
