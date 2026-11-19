# DBMS Lab: Query processing

Mở `/admin/labs/query-processing` bằng tài khoản ADMIN, chọn số vé và cách làm trên Firestore rồi bấm **Chạy thí nghiệm**. Thí nghiệm này là TN3 trong mục 3.3 của báo cáo, chạy được ngay trong ứng dụng.

## Câu hỏi được đem ra so sánh (Q_DT)

"Doanh thu và số vé còn hiệu lực của từng khu vực trong một sự kiện." Đây là truy vấn của trang thống kê doanh thu (#10), nên kết quả có ý nghĩa với chính ứng dụng.

**PostgreSQL** trả lời bằng một câu SQL, bộ tối ưu tự chọn thuật toán kết:

```sql
SELECT z.name, COUNT(*), SUM(t.price)
FROM zones z JOIN seats s ON s.zone_id = z.zone_id
             JOIN tickets t ON t.seat_id = s.seat_id
WHERE z.event_id = 1 AND t.status <> 'CANCELLED'
GROUP BY z.name;
```

**Firestore** không có JOIN và GROUP BY nên phải chọn một trong bốn cách:

| Cách | Mô hình dữ liệu | Truy vấn | Chi phí dồn vào |
| --- | --- | --- | --- |
| A | chuẩn hóa (zones, seats, tickets riêng) | đọc khu → ghế của khu → vé theo nhóm 30 ghế (`in`), ứng dụng tự cộng | lúc đọc, nhiều nhất |
| B | phi chuẩn hóa (vé mang sẵn khu, giá) | đọc hết vé còn hiệu lực rồi cộng ở ứng dụng | lúc đọc, theo số vé |
| C | phi chuẩn hóa | mỗi khu một truy vấn `count()` + `sum()` chạy trên máy chủ | lúc đọc, rất ít |
| D | một document tổng hợp | đọc 1 document | lúc ghi: mỗi lần bán hoặc hủy vé phải cập nhật lại document này |

## Cách chạy

- Dữ liệu thử là bộ xác định (không ngẫu nhiên): 4 khu VIP / CAT 1 / CAT 2 / CAT 3 chiếm 10% / 20% / 30% / 40% số ghế, mỗi ghế một vé, khoảng 8% vé đã hủy để điều kiện loại vé hủy có tác dụng. Tham số `tickets` là 500, 1.000 hoặc 2.000.
- Đáp án đúng được tính bằng JavaScript từ chính bộ dữ liệu đó. Cả hai DBMS phải khớp đáp án (`Kết quả đúng đáp án`), nếu không ô số liệu hiện **SAI**.
- PostgreSQL: tạo lược đồ tạm `lab_qp_<id>` **trong một transaction rồi ROLLBACK**, nên không để lại gì kể cả khi lỗi và không chạm bảng thật. Tắt truy vấn song song (như báo cáo), chạy nóng 1 lần rồi lấy **trung vị của 3 lần** `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`.
- Firestore: ghi vào `queryLabRuns/{runId}`, tách khỏi `events` và `validTickets` của ứng dụng, và xóa sạch bằng `recursiveDelete` khi xong. Cả bốn cách luôn được chạy; ô số liệu hiển thị cách đang chọn, phần chi tiết liệt kê đủ bốn cách.

## Cách đọc số liệu

| Ô | PostgreSQL | Firestore |
| --- | --- | --- |
| Số truy vấn đã chạy | 1 câu SQL | số lời gọi `get()` hoặc truy vấn gộp |
| Số document / dòng đọc | tổng số dòng ở các nút quét (kể cả dòng bị lọc bỏ) × số vòng lặp | số document trả về = số lượt đọc tính phí; truy vấn gộp tính 1 lượt cho mỗi 1.000 mục chỉ mục khớp (tối thiểu 1) |
| Thời gian truy vấn | `Execution Time` trung vị của EXPLAIN | đo ở máy chủ ứng dụng, **chỉ tham khảo** (kể cả khi chạy trên trình giả lập) |
| Kế hoạch / cách làm | thuật toán kết bộ tối ưu chọn | cách A/B/C/D đang chọn |

Số lượt đọc và số lượt gọi là số liệu so sánh chính, vì Firestore tính tiền theo lượt đọc. Với 1.000 vé: A đọc khoảng 2.004 document trong 40 truy vấn, B đọc 917, C đọc 4 trong 4 truy vấn, D đọc 1; PostgreSQL chỉ cần 1 câu SQL.

## Giới hạn cần nói rõ khi trình bày

- Bảng thử chỉ có tới 2.000 vé nên PostgreSQL thường chọn Seq Scan + Hash Join; các kế hoạch Nested Loop tra chỉ mục và hiện tượng ước lượng lệch trong báo cáo xuất hiện ở quy mô 50.000 vé, ngoài phạm vi của nút chạy này.
- Trần 2.000 vé vì mỗi lần chạy ghi khoảng 2N document vào Firestore (gói miễn phí 20.000 lượt ghi/ngày) và cách A cần hàng trăm truy vấn nối tiếp.
- Cách D chỉ đo chi phí đọc. Chi phí ghi (cập nhật document tổng hợp trong transaction, dễ thành điểm nóng khi mở bán) không nằm trong thí nghiệm này.
- Kết quả mỗi lần chạy được lưu thành file JSON trong thư mục kết quả lab (`labResultsDir`), dùng để đưa số liệu vào báo cáo; nút **Xuất CSV** trên trang cũng lấy từ lần chạy hiện tại.

## Kiểm thử

```powershell
npm --prefix backend test          # tham số, bộ dữ liệu, đáp án (không cần CSDL)
node backend/tests/e2e/query-lab.e2e.mjs   # cần backend, Firestore Emulator và CSDL đã seed (API_URL nếu backend không ở cổng 4000)
```

File e2e kiểm tra phân quyền (401/403), tham số sai (400), cả bốn cách cho đúng đáp án và trùng doanh thu với PostgreSQL, thứ tự số lượt đọc A > B > C > D, và Firestore không còn dữ liệu thử sau khi chạy.
