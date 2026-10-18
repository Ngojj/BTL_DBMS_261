# DBMS Lab: Transaction (TV1)

Mở `/admin/labs/transaction` bằng tài khoản ADMIN. Chọn lỗi thanh toán hoặc commit và bấm **Chạy thí nghiệm**. Mở **Bằng chứng và trạng thái dữ liệu** để xem snapshot trước/sau. Backend lưu JSON trong `backend/lab-results/transaction/`; API lịch sử là `GET /api/admin/labs/transaction/runs`.

## Kịch bản

Mỗi DBMS tạo khách hàng, sự kiện, khu vực và một ghế riêng cho lần chạy. Giao dịch giữ ghế, tạo đơn, vé và thanh toán PENDING. Nếu giả lập lỗi, lỗi được ném sau khi các thao tác ghi đã được thực hiện/xếp hàng; nếu không, đơn chuyển PAID, thanh toán SUCCESS và ghế SOLD.

| Lựa chọn | committed | rolledBack | Trạng thái sau |
| --- | --- | --- | --- |
| Không lỗi | true | false | 1 đơn PAID, 1 vé VALID, 1 thanh toán SUCCESS, ghế SOLD |
| Có lỗi | false | true | 0 đơn/vé/thanh toán, ghế AVAILABLE; snapshot bằng trạng thái ban đầu |

`leftoverRecords` là số bản ghi mua vé còn sót sau lỗi; các bản ghi hợp lệ sau commit không tính là dữ liệu còn sót. Hai DBMS kiểm tra dữ liệu thật trước khi cleanup. Lỗi không mong đợi không được tính là rollback thành công; runner trả `ok: false`.

## Phạm vi và cách diễn giải

- PostgreSQL dùng schema của ứng dụng và UUID để phân biệt dữ liệu thử. Dữ liệu này có thể xuất hiện tạm thời trong danh sách admin; sự kiện giữ trạng thái DRAFT. Không dùng booking service, không phát dữ liệu qua sync sang Firestore.
- Firestore dùng `transactionLabRuns/{runId}/records/*`, tách khỏi dữ liệu ứng dụng. Một transaction đọc khách hàng/ghế trước mọi lệnh ghi. Theo [tài liệu Firestore](https://firebase.google.com/docs/firestore/manage-data/transactions), ghi được áp dụng khi transaction thành công; callback lỗi hủy các lệnh ghi chưa commit. `rolledBack` dùng chung tên để thể hiện không có thay đổi tồn tại sau lỗi, không phải lệnh SQL ROLLBACK.
- Đây là thí nghiệm tính nguyên tử của một giao dịch mua vé giả lập, không kiểm thử cổng thanh toán thật hay mọi quy tắc của booking service. Không kết luận về độ bền khi máy chủ hỏng từ thí nghiệm này.
- `durationMs` do runner đo bao gồm setup, giao dịch, đọc kiểm chứng và cleanup. Không dùng nó như phép đo công bằng về tốc độ transaction thuần, đặc biệt khi dùng Emulator.
- Cleanup chỉ xóa dữ liệu theo ID của lần chạy, gồm cả document con Firestore. Nếu tiến trình bị dừng đột ngột, `finally` có thể không chạy; UUID trong tên/snapshot giúp nhận biết dữ liệu thử còn lại. Sequence PostgreSQL vẫn tăng sau rollback và cleanup.

## Kiểm thử

Kiểm thử tham số (không cần kết nối DB):

```powershell
npm --prefix backend test
```

Kiểm thử tích hợp: cần PostgreSQL đã nạp schema, Firestore Emulator và `backend/.env`. Chạy từ thư mục `backend`:

```powershell
$env:RUN_TRANSACTION_LAB_INTEGRATION = '1'
node --test tests/transaction-lab.test.js
Remove-Item Env:RUN_TRANSACTION_LAB_INTEGRATION
```

Test chạy qua Express trên cổng tạm, kiểm tra quyền, tham số, hai kịch bản trên cả hai DBMS, dữ liệu sau cleanup và JSON lịch sử. Kết quả test được lưu trong thư mục tạm riêng, không ghi vào lịch sử lab của người dùng.
