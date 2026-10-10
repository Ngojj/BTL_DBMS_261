# Query Processing — TV3

Trang có sẵn: `/admin/labs/query-processing`. Đăng nhập ADMIN, chọn mã sự kiện và bấm **Chạy thí nghiệm**. Với dữ liệu seed, sự kiện 2 có vé đã bán; sự kiện 1 minh họa trường hợp chưa bán vé. Không cần module booking hoàn tất.

## Thí nghiệm

1. Backend đọc sự kiện, khu và vé bằng transaction PostgreSQL `REPEATABLE READ READ ONLY`. Câu SQL báo cáo chạy trong cùng snapshot, dùng chung truy vấn với `modules/reports`.
2. Xuất các vé (chưa tổng hợp, gồm cả vé hủy/đơn chưa trả tiền) thành document trong Firestore Emulator: `labQueryProcessingRuns/{uuid}/tickets/{ticketId}`. Mỗi document có `zoneId`, giá vé lúc mua, trạng thái vé và trạng thái đơn. Danh mục khu nằm ở `zones/{zoneId}`; document cha chứa ID/tên sự kiện và thời điểm snapshot. Không sao chép thông tin cá nhân.
3. PostgreSQL chạy một SQL `JOIN + GROUP BY`. Firestore đọc document cha, danh mục khu, các vé thuộc đơn PAID, rồi ghép khu, lọc vé còn hiệu lực và cộng doanh thu tại **backend JavaScript**. Hai bên giữ cả khu không có vé.
4. So khớp từng dòng theo ID khu, số vé và doanh thu; lưu `MATCH`, `MISMATCH` hoặc `NOT_COMPARED`. Nhật ký của giao diện hiển thị trạng thái này cùng tổng vé/doanh thu. JSON đầy đủ có các dòng kết quả.
5. Xóa đúng snapshot Firestore của lần chạy. Nếu dọn thất bại, `details.cleanup` ghi đường dẫn còn lại để xử lý; không xóa dữ liệu ứng dụng. Kết quả được khung Lab lưu dưới `backend/lab-results/query-processing/` và đọc qua `GET /api/admin/labs/query-processing/runs`.

Chỉ chạy với Firestore Emulator đã cấu hình trong backend `.env`. Thiếu emulator thì PostgreSQL vẫn có kết quả, Firestore báo lỗi và không có số liệu giả. Mỗi lần chạy có UUID riêng để tránh lẫn dữ liệu. Lab giới hạn 10.000 vé và 1.000 khu/sự kiện; vượt giới hạn trả 422, không cắt bớt mẫu rồi báo thành công.

## Cách đọc số liệu

| Trường | Ý nghĩa |
| --- | --- |
| `queries` | Số thao tác đọc logic của báo cáo: PostgreSQL 1 SQL, Firestore 1 document read + 2 collection queries = 3. Không phải số RPC/thử lại nội bộ. |
| `rowsRead` | Số dòng/document **trả về backend**: PostgreSQL trả các nhóm; Firestore trả sự kiện, khu và vé PAID trước khi lọc trạng thái vé. Không phải số dòng/index quét hoặc số lượt đọc tính phí. |
| `groups` | Số khu trong kết quả, gồm khu doanh thu bằng 0. |
| `ticketsSold`, `revenue` | Tổng vé còn hiệu lực đã thanh toán và doanh thu VND theo `tickets.price`. |
| `durationMs` | Thời gian truy vấn từ backend và xử lý kết quả; không gồm xuất/nạp/xóa fixture, kiểm chứng hay ghi file lịch sử. |
| `details.preparation` | Thời gian chuẩn bị và số document nạp vào Firestore, tách khỏi thời gian truy vấn. |

Đây là phép đo một lần trên dữ liệu đã được đọc để chuẩn bị; PostgreSQL chạy trước và cache có thể đã nóng. Cần lặp lại nhiều lần và báo môi trường khi viết báo cáo. Kết quả Emulator không đại diện cho latency hoặc chi phí Cloud Firestore. Không kết luận DBMS nào nhanh hơn chỉ từ số truy vấn hoặc một mẫu thời gian.

Thiết kế Firestore dùng bản sao phi chuẩn hóa để tránh đọc từng đơn/ghế. Đây là lựa chọn mô hình của thí nghiệm, không có nghĩa Firestore không hỗ trợ aggregation: Standard có `count`, `sum`, `average`; lab này so sánh SQL gom nhiều khu với cách gom theo khu tại ứng dụng. [Firebase aggregation queries](https://firebase.google.com/docs/firestore/query-data/aggregation-queries).

Snapshot PostgreSQL bảo đảm các truy vấn nguồn nhìn cùng một trạng thái trong transaction. [PostgreSQL 16 — Repeatable Read](https://www.postgresql.org/docs/16/transaction-iso.html#XACT-REPEATABLE-READ).

## Kiểm tra (chạy trong `backend/`)

Không thay đổi `package.json`. Kiểm tra unit/HTTP:

```powershell
node --test src/modules/reports/reports.test.js src/labs/query-processing/query-processing.test.js
```

Kiểm tra SQL thật và Firestore Emulator (cần backend `.env`, PostgreSQL và Emulator):

```powershell
$env:RUN_TV3_DB_TESTS = 'true'
node --test src/modules/reports/reports.test.js src/labs/query-processing/query-processing.test.js
Remove-Item Env:RUN_TV3_DB_TESTS
```

Test chỉ dùng bảng PostgreSQL tạm và snapshot Firestore riêng, không thay đổi dữ liệu nghiệp vụ. Lịch sử test được ghi vào thư mục tạm rồi xóa, không lẫn với kết quả Lab của người dùng.
