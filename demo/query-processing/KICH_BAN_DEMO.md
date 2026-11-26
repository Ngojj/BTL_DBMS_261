# Kịch bản demo – Query processing (mục 3.3)

Thời lượng khoảng 12–15 phút. Màn hình chia hai cửa sổ PowerShell: **TRÁI là PostgreSQL** (psql), **PHẢI là Firestore** (node). Ngoài ra còn một cửa sổ thứ ba chạy emulator, thu nhỏ lại.

Mỗi thí nghiệm làm theo cùng một nhịp:

1. Nói câu hỏi nghiệp vụ.
2. Chạy bên TRÁI và chỉ vào kế hoạch thực thi.
3. Chạy bên PHẢI và chỉ vào số lượt đọc, số lượt gọi.
4. Đọc câu chốt.

Mỗi bảng in ra ở cửa sổ PHẢI đều có sẵn một dòng PostgreSQL, tính trên cùng dữ liệu đã nạp vào emulator. Vì vậy chỉ cần nhìn cửa sổ PHẢI là đã thấy được so sánh.

> Số trong kịch bản đo trên máy chuẩn bị. Số trên máy bạn sẽ lệch một chút, nhưng xu hướng thì giữ nguyên.

---

## 0. Chuẩn bị (làm trước giờ demo khoảng 10 phút)

**Cửa sổ 1, emulator** (để chạy suốt buổi, thu nhỏ lại):

```powershell
cd "$env:USERPROFILE\OneDrive\Desktop\BTL_DBMS"
npm run db:up
$env:JAVA_TOOL_OPTIONS = "-Xmx4g"
firebase emulators:start --config firebase/firebase.json --project ticketrush-5a616 --import demo\query-processing\emu-data
```

Nếu chưa có thư mục `emu-data` (chưa export lần nào), bỏ `--import ...` ở cuối rồi làm thêm bước nạp dưới đây.

**Chỉ khi chưa có `emu-data`:** nạp dữ liệu rồi lưu lại, chạy ở cửa sổ PHẢI.

```powershell
cd "$env:USERPROFILE\OneDrive\Desktop\BTL_DBMS\demo\query-processing\firestore"
node load.mjs --events=1,5
firebase emulators:export ..\emu-data --project ticketrush-5a616
```

**Cửa sổ TRÁI, PostgreSQL:**

```powershell
cd "$env:USERPROFILE\OneDrive\Desktop\BTL_DBMS\demo\query-processing"
.\psql.ps1 -Sync
```

Khi thấy dấu nhắc `ticketrush_qp=#` là đã sẵn sàng.

**Cửa sổ PHẢI, Firestore:**

```powershell
cd "$env:USERPROFILE\OneDrive\Desktop\BTL_DBMS\demo\query-processing\firestore"
node demo.mjs cap
```

Lệnh `cap` ở đây chỉ để chạy thử. Dòng đầu phải in ra `Sự kiện đã nạp vào emulator: 1, 5`.

---

## Mở đầu (30 giây)

> "Phần của em là xử lý truy vấn. Cùng một bộ dữ liệu TicketRush gồm 500 nghìn vé, em đặt năm câu hỏi giống nhau cho hai hệ. Bên trái là PostgreSQL: em xem bộ tối ưu chọn kế hoạch nào qua EXPLAIN ANALYZE. Bên phải là Firestore: không có bộ tối ưu và không có EXPLAIN, nên em đo bằng số lượt đọc và số lượt gọi, vì đó cũng là cách Firestore tính tiền. Thời gian bên Firestore đo trên emulator, nên chỉ để tham khảo."

---

## TN1. Chọn theo điều kiện (khoảng 3 phút)

> "Câu hỏi: nhân viên soát vé quét mã QR, và lọc đơn hàng theo thời gian."

**TRÁI**

```
\i /tmp/qp/tn1_chon.sql
```

| Bấm | Màn hình hiện | Chỉ vào |
|---|---|---|
| (tự chạy) | TN1a, tra mã QR | `Index Scan using tickets_qr_code_key`, Execution Time **khoảng 0,06 ms** |
| Enter | Bỏ chỉ mục, chạy lại | `Seq Scan on tickets`, **khoảng 37 ms**, buffers tăng vọt |
| Enter | TN1b, lọc 1%, 30%, 50%, 100% | 1% và 30% là `Bitmap Heap Scan`; **từ 50% chuyển sang `Seq Scan`** |
| Enter | Ép dùng chỉ mục ở 100% | Chậm hơn kế hoạch tự chọn (**khoảng 78 ms so với 29 ms**) |

> "PostgreSQL tự đổi đường truy cập theo độ chọn lọc. Khi lấy gần hết bảng, đọc tuần tự rẻ hơn tra chỉ mục, và nếu ép dùng chỉ mục thì chậm hơn thật."

**PHẢI**

```powershell
node demo.mjs tn1
```

Chỉ vào hai chỗ. Tra QR tốn **1 lượt đọc**. Ở bảng lọc theo `createdAt`, số lượt đọc **bằng đúng số đơn trả về**, nên lấy 100% thì đọc 100%.

> "Firestore luôn đi qua chỉ mục, không có lựa chọn Seq Scan. Điều đó tốt cho truy vấn hẹp, nhưng chi phí tăng tuyến tính theo số kết quả. Firestore cũng từ chối truy vấn nếu thiếu chỉ mục phức hợp; emulator không bắt buộc điều này nên ở đây em không minh họa được."

---

## TN2. Phép kết: màn hình "Vé của tôi" (khoảng 3 phút)

> "Câu hỏi: hiển thị các vé của một người dùng, kèm tên sự kiện, khu và ghế. Dữ liệu nằm ở 5 bảng."

**TRÁI**

```
\i /tmp/qp/tn2_ket.sql
```

| Bấm | Màn hình hiện | Chỉ vào |
|---|---|---|
| (tự chạy) | TN2a, một câu SQL kết 5 bảng | 15 vé, **khoảng 0,2 ms**, toàn bộ là Nested Loop tra chỉ mục |
| Enter | TN2b, ép 4 thuật toán trên sự kiện nhỏ | Nested Loop **không** chỉ mục mất **khoảng 3 giây**; tra chỉ mục chỉ **khoảng 0,15 ms**; Merge và Hash ở giữa |
| Enter | TN2c, kết toàn bộ đơn đã thanh toán | Tự chọn **Hash Join khoảng 252 ms**, ép **Merge Join khoảng 222 ms** |

> "Bộ tối ưu chọn thuật toán kết theo ước lượng chi phí. Thường nó chọn đúng, nhưng TN2c cho thấy mô hình chi phí không hoàn hảo: Merge Join nhanh hơn một chút mà không được chọn."

**PHẢI**

```powershell
node demo.mjs tn2
```

Bên PHẢI chọn người có nhiều vé nhất **trong các sự kiện đã nạp** (1 và 5). Vì vậy `user_id` và số vé có thể khác bên TRÁI, nhưng ba dòng trong bảng đều tính trên cùng một người. Bảng có 3 dòng: PostgreSQL 1 lượt gọi, Firestore chuẩn hóa, Firestore phi chuẩn hóa. Chỉ vào chỗ **chuẩn hóa phải gọi 5 lượt, đọc nhiều document**, còn **phi chuẩn hóa chỉ 1 lượt gọi, đọc đúng bằng số vé**.

> "Firestore không có JOIN. Nếu giữ dữ liệu chuẩn hóa như PostgreSQL thì ứng dụng phải tự kết qua 5 lần gọi mạng. Cách làm thực tế là phi chuẩn hóa: chép sẵn tên sự kiện và ghế vào từng vé. Đổi lại, khi đổi tên sự kiện thì phải cập nhật mọi vé."

---

## TN3. Gom nhóm: doanh thu theo khu (khoảng 3 phút), thí nghiệm chính

> "Câu hỏi của ban tổ chức: mỗi khu bán được bao nhiêu vé, doanh thu bao nhiêu? Em chạy trên sự kiện nhỏ (1.000 vé) và sự kiện lớn (50.000 vé)."

**TRÁI**

```
\i /tmp/qp/tn3_doanh_thu.sql
```

| Bấm | Chỉ vào |
|---|---|
| (tự chạy) | Sự kiện 1: bảng kết quả 4 khu, và kế hoạch `HashAggregate` trên `Hash Join` |
| Enter | Sự kiện 5: **cùng một câu SQL**, khoảng 94 ms |

**PHẢI**

```powershell
node demo.mjs tn3 1 ABCD
node demo.mjs tn3 5 BCD
```

Cách A trên sự kiện 5 bị bỏ qua vì chạy nhiều phút. Số cần chỉ:

| Cách | Sự kiện 1: lượt đọc / gọi | Sự kiện 5: lượt đọc / gọi |
|---|---|---|
| PostgreSQL, 1 câu SQL | – / 1 | – / 1 |
| A. chuẩn hóa, ứng dụng tự kết | **2.104 / 42** | (bỏ qua) |
| B. phi chuẩn hóa, đọc hết rồi cộng | **934 / 1** | **46.068 / 1** |
| C. `count()` + `sum()` trên server | **4 / 4** | **47 / 4** |
| D. document tổng hợp duy trì sẵn | **1 / 1** | **1 / 1** |

Cột "Khớp" ở mọi dòng đều là **Đúng**, tức là bốn cách cho cùng một đáp án với SQL.

> "PostgreSQL chỉ cần một câu SQL cho mọi quy mô. Firestore phải chọn mô hình dữ liệu theo câu hỏi. Cách C dùng aggregate trên server, rẻ gấp khoảng 1.000 lần cách B. Cách D rẻ nhất khi đọc, nhưng mỗi lần bán hay hủy vé phải cập nhật thêm document tổng hợp, và lúc mở bán, document đó trở thành điểm nóng ghi."

---

## TN4. Truy vấn lồng: phát hiện gom vé (khoảng 2 phút)

> "Câu hỏi: tìm các số điện thoại dùng cho nhiều tài khoản và mua hơn 4 vé ở sự kiện 5."

**TRÁI**

```
\i /tmp/qp/tn4_gom_ve.sql
```

Kết quả là **41 số điện thoại**. Bấm Enter để xem kế hoạch: truy vấn con `IN (... HAVING count(*) > 1)` được **chuyển thành phép kết**: trong kế hoạch có một `Hash Join` nối với `HashAggregate` của truy vấn con, và không có `SubPlan`.

**PHẢI**

```powershell
node demo.mjs tn4
```

Cũng ra **41**, nhưng phải **đọc khoảng 63.867 document qua 179 lượt gọi**, rồi ứng dụng tự gom nhóm.

> "Cùng đáp án. PostgreSQL làm bằng một câu SQL, và bộ tối ưu còn tự viết lại truy vấn con thành phép kết. Firestore không có truy vấn lồng, nên phải kéo dữ liệu về ứng dụng. Kiểu báo cáo này nên đặt ở hệ quan hệ hoặc kho dữ liệu."

---

## TN5. Bộ tối ưu tự động (khoảng 2 phút)

> "Cuối cùng: PostgreSQL có bộ tối ưu, còn Firestore thì không."

**TRÁI**

```
\i /tmp/qp/tn5_toi_uu.sql
```

| Bấm | Chỉ vào |
|---|---|
| (tự chạy) | TN5a: ba cách viết khác nhau, **cùng một kế hoạch** |
| Enter | TN5b: tự chọn thứ tự kết **khoảng 1,1 ms**; ép theo thứ tự viết tay (`join_collapse_limit = 1`) **khoảng 282 ms**, chậm gấp khoảng 250 lần |
| Enter | TN5c: LEFT JOIN thừa **bị bỏ khỏi kế hoạch** (0,23 ms so với 2,6 ms); `rating > 5` thành **`One-Time Filter: false`**, không đọc bảng; `LIMIT 10` dừng sớm |

**PHẢI**

```powershell
node demo.mjs cap
```

Chỉ vào các dòng **KHÔNG**: GROUP BY, JOIN, truy vấn lồng, và `in` với 31 giá trị (tối đa là 30).

> "Với PostgreSQL, người viết chỉ mô tả *cái cần lấy*, còn bộ tối ưu quyết định *cách lấy*. Firestore thì ngược lại: mỗi truy vấn chỉ có đúng một cách chạy, theo chỉ mục. Muốn truy vấn rẻ, người thiết kế phải định sẵn mô hình dữ liệu từ đầu, như cách D ở TN3."

---

## Chốt (30 giây)

| | PostgreSQL | Firestore |
|---|---|---|
| Chọn đường truy cập | Tự đổi Index, Bitmap, Seq theo độ chọn lọc | Luôn qua chỉ mục; phí bằng số kết quả |
| Phép kết | 4 thuật toán, tự chọn | Không có; ứng dụng tự kết hoặc phi chuẩn hóa |
| Gom nhóm | GROUP BY, 1 câu cho mọi quy mô | `count`/`sum`/`avg` từng nhóm, hoặc document tổng hợp |
| Truy vấn lồng | Có, tự viết lại thành phép kết | Không có |
| Tối ưu | Bộ tối ưu dựa trên chi phí | Không có; người thiết kế tự tối ưu bằng mô hình dữ liệu |

> "Tóm lại: PostgreSQL mạnh ở truy vấn tùy ý, vì câu hỏi mới chỉ cần câu SQL mới. Firestore rẻ và nhanh cho những truy vấn đã biết trước và được thiết kế sẵn. TicketRush dùng cả hai: giao dịch đặt vé và báo cáo chạy trên PostgreSQL, còn sơ đồ ghế realtime và soát vé offline chạy trên Firestore."

---

## Nếu có sự cố

| Lỗi | Cách xử lý |
|---|---|
| `ECONNREFUSED 127.0.0.1:8085` | Emulator chưa chạy: bật lại cửa sổ 1 |
| `Chưa có dữ liệu trên emulator` | Bật emulator thiếu `--import`: tắt đi, bật lại kèm `--import demo\query-processing\emu-data` |
| psql báo `/tmp/qp/...: No such file` | Thoát psql (`\q`), chạy `.\psql.ps1 -Sync` |
| psql báo `database "ticketrush_qp" does not exist` | Chạy lại `powershell -ExecutionPolicy Bypass -File .\setup.ps1` |
| Kết quả dài, bị cuộn mất | Kéo cửa sổ to ra, hoặc gõ `\! cls` trong psql và `cls` ở PowerShell trước mỗi thí nghiệm |
