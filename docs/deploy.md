# Deploy TicketRush lên mạng (miễn phí, không cần thẻ)

Kiến trúc khi deploy:

```
Điện thoại / trình duyệt ──HTTPS──> Firebase Hosting (frontend)
        │                                   │
        │                                   └──> Render (backend Express) ──SSL──> Neon (PostgreSQL)
        └────────────────────────────────────────────────┬──> Firestore thật (cùng dự án Firebase)
```

| Phần | Dịch vụ | Ghi chú |
| --- | --- | --- |
| Frontend | Firebase Hosting | HTTPS sẵn nên **camera quét QR chạy trên điện thoại** |
| Backend | Render (Web Service, gói Free) | Tự "ngủ" sau một lúc không dùng, lần gọi đầu chậm khoảng nửa phút |
| PostgreSQL | Neon (gói Free) | Cần SSL |
| Firestore, đăng nhập Google | Firebase, gói Spark | Có hạn mức miễn phí mỗi ngày |

> Hạn mức và giá của các dịch vụ này thay đổi theo thời gian. Kiểm tra lại trang giá của từng dịch vụ trước khi làm. Các bước dưới đây dùng dự án Firebase `ticketrush-5a616`; nếu dùng dự án khác thì thay tên cho đúng.

**Thứ tự làm:** 1 Neon → 2 Firebase → 3 nạp dữ liệu → 4 Render → 5 Frontend → 6 kiểm tra.

---

## 1. PostgreSQL trên Neon

1. Vào https://neon.tech, tạo tài khoản, **Create project**, chọn vùng gần nhất (Singapore).
2. Copy **connection string** (dạng `postgresql://user:pass@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`).
3. Tạo bảng: mở **SQL Editor** trên Neon, dán toàn bộ nội dung [database/schema.sql](../database/schema.sql) rồi chạy.

## 2. Firebase (Firestore + khóa dịch vụ)

1. https://console.firebase.google.com → dự án `ticketrush-5a616`.
2. **Build → Firestore Database → Create database** → chọn chế độ **Production**, vị trí **`asia-southeast1`**. **Vị trí không đổi lại được.**
3. **Project settings → Service accounts → Generate new private key** → tải file JSON. Đây là khóa bí mật: **không commit, không gửi qua chat**. Cất ở ngoài thư mục dự án.
4. Authentication đã bật Google từ trước; tên miền `ticketrush-5a616.web.app` và `.firebaseapp.com` tự nằm trong danh sách được phép.
5. Triển khai Security Rules và chỉ mục (cần `npm i -g firebase-tools`, rồi `firebase login`):
   ```powershell
   cd C:\Users\nk\OneDrive\Desktop\BTL_DBMS
   firebase deploy --only firestore:rules,firestore:indexes --config firebase/firebase.json --project ticketrush-5a616
   ```

## 3. Nạp dữ liệu mẫu lên mạng

Tạo file **`backend/.env.cloud`** (đã được `.gitignore`, tuyệt đối không commit) với nội dung:

```
DATABASE_URL=<connection string của Neon>
DATABASE_SSL=true
JWT_SECRET=<chuỗi bí mật bất kỳ>
FIREBASE_PROJECT_ID=ticketrush-5a616
GOOGLE_APPLICATION_CREDENTIALS=C:\duong-dan\toi\file-khoa-dich-vu.json
```

Không đặt `FIRESTORE_EMULATOR_HOST` trong file này, nếu không script sẽ ghi vào emulator.

Chạy seed. **Đặt mật khẩu riêng**, vì mật khẩu mặc định (`Admin@123`…) đang nằm công khai trong README:

```powershell
cd C:\Users\nk\OneDrive\Desktop\BTL_DBMS
$env:SEED_ENV_FILE = "backend/.env.cloud"
$env:SEED_ADMIN_PASSWORD = "mat-khau-admin-cua-ban"
$env:SEED_STAFF_PASSWORD = "mat-khau-staff-cua-ban"
$env:SEED_CUSTOMER_PASSWORD = "mat-khau-khach-cua-ban"
node scripts/seed.js --yes-cloud
```

Script **xóa sạch** các bảng và `events/`, `validTickets/`, `notifications/` trên mạng rồi sinh lại, nên nó từ chối chạy nếu thiếu cờ `--yes-cloud`. Chạy xong, đóng cửa sổ PowerShell hoặc xóa biến môi trường (`Remove-Item Env:SEED_*`).

## 4. Backend trên Render

1. Đưa code lên GitHub (nhánh `main` đã gộp đủ).
2. https://render.com → **New → Web Service** → chọn repository. (Hoặc **New → Blueprint** để Render đọc [render.yaml](../render.yaml).)
3. Cấu hình:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
   - **Health Check Path:** `/healthz`
4. **Environment Variables** (mục Environment):

   | Biến | Giá trị |
   | --- | --- |
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | connection string của Neon |
   | `DATABASE_SSL` | `true` |
   | `JWT_SECRET` | chuỗi bí mật dài, ngẫu nhiên (khác bản local) |
   | `FIREBASE_PROJECT_ID` | `ticketrush-5a616` |
   | `FIREBASE_SERVICE_ACCOUNT_JSON` | dán **toàn bộ nội dung** file khóa dịch vụ |
   | `CORS_ORIGIN` | `https://ticketrush-5a616.web.app,https://ticketrush-5a616.firebaseapp.com` |

   Không đặt `FIRESTORE_EMULATOR_HOST` hay `FIREBASE_AUTH_EMULATOR_HOST`.
5. Deploy xong có địa chỉ dạng `https://ten-dich-vu.onrender.com`. Mở `https://ten-dich-vu.onrender.com/healthz` thấy `{"ok":true}`, rồi `.../api/health` thấy cả `postgres` và `firestore` là `up`.

## 5. Frontend trên Firebase Hosting

1. Sao chép `frontend/.env.production.example` thành `frontend/.env.production` và điền: `VITE_API_URL` (địa chỉ Render, kết thúc bằng `/api`) và `VITE_FIREBASE_API_KEY`.
2. Build và triển khai:
   ```powershell
   cd C:\Users\nk\OneDrive\Desktop\BTL_DBMS
   npm --prefix frontend install
   npm --prefix frontend run build
   firebase deploy --only hosting --config firebase/firebase.json --project ticketrush-5a616
   ```
3. Địa chỉ: **https://ticketrush-5a616.web.app**

## 6. Kiểm tra sau khi deploy

- Mở web trên điện thoại, đăng nhập admin, xem danh sách sự kiện và thống kê.
- Mua một vé bằng tài khoản khách, mở trang **Vé của tôi** thấy mã QR.
- Đăng nhập STAFF, vào **Soát vé**: ô quét camera sẽ xin quyền camera (có HTTPS nên được phép). Quét mã QR của vé vừa mua.
- Đăng nhập Google bằng tài khoản thật.

---

## Lưu ý và hạn chế

- **Render Free tự ngủ:** lần mở đầu sau một lúc không dùng chậm khoảng nửa phút. Trước buổi demo, hãy mở trước `/healthz` để đánh thức.
- **Kết quả DBMS Lab** lưu thành tệp JSON trong `backend/lab-results/`, mà ổ đĩa của Render Free là tạm thời nên **mất khi máy khởi động lại**. Chạy lab xong hãy xuất CSV ngay trong giao diện, hoặc chạy lab ở máy local.
- **Thí nghiệm tải (Concurrency control)** nên chạy trên Emulator hoặc local; chạy nhiều lần trên Firestore thật có thể vượt hạn mức ghi mỗi ngày của gói Spark.
- **Soát vé offline** cần ứng dụng đã mở sẵn lúc mất mạng. Chưa có service worker nên mở lại trang khi không có mạng sẽ thất bại.
- **Bảo mật:** không commit `.env*`, `serviceAccount*.json`, `backend/.env.cloud`. Đổi `JWT_SECRET` khác với bản local. Nếu lỡ lộ khóa dịch vụ, vào Firebase Console xóa khóa đó và tạo khóa mới.
- **Cập nhật phiên bản:** đẩy code mới lên nhánh `main`, Render tự deploy lại backend; frontend thì chạy lại bước 5.
