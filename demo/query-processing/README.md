# Demo trực tiếp – Query processing (mục 3.3)

Chạy lại các thí nghiệm của mục 3.3 **trực tiếp trên hai DBMS**: `psql` cho PostgreSQL và script Node gọi Firestore Emulator. Không đi qua trang DBMS Lab.

Dữ liệu là đúng bộ đã dùng cho báo cáo: 30.000 người dùng, 305 sự kiện, 653.977 ghế, 252.338 đơn, 499.589 vé. Bộ này được nạp vào database riêng `ticketrush_qp`, không đụng tới database `ticketrush` của ứng dụng.

```
demo/query-processing/
├── setup.ps1          nạp dữ liệu vào ticketrush_qp (chạy 1 lần)
├── psql.ps1           mở psql vào ticketrush_qp
├── pg/                schema, dữ liệu (.csv.gz), các file thí nghiệm tn1…tn5
└── firestore/         load.mjs (chép 5 sự kiện mẫu sang emulator), demo.mjs (chạy thí nghiệm)
```

## 1. Chuẩn bị (làm trước buổi demo)

```powershell
# ở thư mục gốc BTL_DBMS
npm run db:up                      # PostgreSQL (container ticketrush-postgres)
npm run emulator                   # Firestore Emulator, cổng 8085 – để cửa sổ này chạy suốt buổi demo

# ở thư mục demo\query-processing
powershell -ExecutionPolicy Bypass -File .\setup.ps1   # khoảng 1 phút
cd firestore
npm install
node load.mjs                      # chép 5 sự kiện mẫu (~350.000 document) sang emulator, mất vài phút
```

- `node load.mjs --events=1,5` nạp ít hơn cho nhanh: sự kiện 1 khoảng 1.000 vé, sự kiện 5 khoảng 50.000 vé.
- `node load.mjs --clean` xóa dữ liệu demo khỏi emulator.
- Mọi collection của demo đều có tiền tố `qp_`, xem được ở Emulator UI (http://127.0.0.1:4001/firestore).
- Dữ liệu emulator **mất khi tắt emulator**, nên nạp xong thì để emulator chạy tới hết buổi demo.

## 2. Chạy demo

Mở hai cửa sổ cạnh nhau. Bên trái là PostgreSQL (`.\psql.ps1`, rồi gõ `\i /tmp/qp/tnX.sql`); bên phải là Firestore (`cd firestore`, rồi `node demo.mjs tnX`). Mỗi file SQL dừng lại ở từng bước (`>> Enter`) để bạn giải thích trước khi chạy tiếp.

| Thí nghiệm | PostgreSQL (trong psql) | Firestore | Kết quả cần chỉ ra (số trên máy bạn sẽ hơi khác) |
| --- | --- | --- | --- |
| TN1 Chọn theo điều kiện | `\i /tmp/qp/tn1_chon.sql` | `node demo.mjs tn1` | Mã QR: Index Scan khoảng 0,05 ms; bỏ chỉ mục thì thành Seq Scan khoảng 30 ms. Lọc theo `created_at`: Bitmap Heap Scan ở 1–30%, Seq Scan từ 50%; ép đi chỉ mục ở 100% thì chậm hơn. Firestore: 1 lượt đọc cho mã QR; lọc nhiều dòng thì lượt đọc bằng số kết quả. |
| TN2 Phép kết | `\i /tmp/qp/tn2_ket.sql` | `node demo.mjs tn2` | "Vé của tôi" (15 vé): 1 câu SQL khoảng 0,2 ms. Firestore chuẩn hóa: 51 lượt đọc, 5 lượt gọi; phi chuẩn hóa: 15 lượt đọc, 1 lượt gọi. Bốn thuật toán kết: Nested Loop không chỉ mục mất khoảng 3 giây, tra chỉ mục khoảng 0,15 ms. Kết toàn bộ đơn: bộ tối ưu chọn Hash Join dù Merge Join nhanh hơn. |
| TN3 Gom nhóm (doanh thu) | `\i /tmp/qp/tn3_doanh_thu.sql` | `node demo.mjs tn3 1 ABCD` rồi `node demo.mjs tn3 5 BCD` | Sự kiện 1: A 2.104 lượt đọc / 42 lượt gọi; B 934; C 4; D 1, tất cả "Đúng". Sự kiện 5: B 46.068, C 47, D 1; PostgreSQL vẫn 1 câu SQL. |
| TN4 Truy vấn lồng | `\i /tmp/qp/tn4_gom_ve.sql` | `node demo.mjs tn4` | 41 số điện thoại ở cả hai bên. PostgreSQL: 1 câu SQL; Firestore: khoảng 63.867 lượt đọc, 179 lượt gọi. |
| TN5 Bộ tối ưu | `\i /tmp/qp/tn5_toi_uu.sql` | `node demo.mjs cap` | Ba cách viết cho cùng một kế hoạch; ép thứ tự kết viết tay chậm hơn khoảng 250 lần; bỏ LEFT JOIN thừa; CHECK làm `rating > 5` trả rỗng ngay (One-Time Filter: false); dừng sớm với LIMIT 10. Firestore không có GROUP BY, JOIN, truy vấn lồng; `in` tối đa 30 giá trị. |

## 3. Lưu ý khi trình bày

- **Firestore so bằng lượt đọc và lượt gọi.** Emulator chạy trên máy cục bộ, không đại diện cho tốc độ dịch vụ thật, nên cột thời gian chỉ để tham khảo. Firestore tính tiền theo lượt đọc.
- **Cách A trên sự kiện lớn rất chậm.** Trên emulator, cách A với sự kiện trên 5.000 vé mất nhiều phút nên script tự bỏ qua; thêm `--force` nếu muốn chạy. Số liệu sự kiện 2–5 xem Bảng 3.3.2.
- **Emulator không bắt buộc chỉ mục phức hợp.** Vì vậy tình huống "truy vấn thiếu chỉ mục bị từ chối" chỉ thấy được trên Firestore thật.
- **Không ảnh hưởng dữ liệu.** Các bước bỏ chỉ mục hay ép kế hoạch đều nằm trong `BEGIN … ROLLBACK`, nên database không thay đổi.
- **Muốn bỏ dữ liệu demo:** `docker exec ticketrush-postgres psql -U ticketrush -d postgres -c "DROP DATABASE ticketrush_qp"` và `node load.mjs --clean`.
