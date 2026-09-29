// TODO [seed] Phụ trách: TV2 (dữ liệu mẫu) – nạp CẢ PostgreSQL và Firestore
// Chạy: node scripts/seed.js   (cần backend/.env, PostgreSQL và Firestore Emulator đang chạy)
//
// Gợi ý các bước:
//  1. PostgreSQL: users (1 ADMIN, 1 STAFF, N CUSTOMER – vài tài khoản chung phone để test #11),
//     genres, venues, events, zones, seats (bulk insert), vài orders/tickets/payments/reviews.
//  2. Firestore (sau khi PostgreSQL xong, dùng lại id): events/{id}, events/{id}/seats/*,
//     validTickets/{qrCode} – có thể gọi lại hàm trong backend/src/modules/sync.
//  3. Thông số qua tham số dòng lệnh: --events 5 --seats-per-zone 100 --users 1000
import { pool } from '../backend/src/config/pg.js';
import { firestore } from '../backend/src/config/firebase.js';

async function main() {
  void pool; void firestore;
  throw new Error('TODO: chưa hiện thực seed');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
