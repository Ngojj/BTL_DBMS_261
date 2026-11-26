// Chép 5 sự kiện mẫu (event_id 1..5, ~91.000 vé) từ PostgreSQL (ticketrush_qp) sang Firestore Emulator, theo hai mô hình:
//   chuẩn hóa:     qp_events, qp_zones, qp_seats, qp_orders, qp_users, qp_tickets (mỗi bảng một collection)
//   phi chuẩn hóa: qp_ticketsD (mỗi vé mang sẵn sự kiện, khu, giá, người mua, mã QR)
//   tổng hợp:      qp_eventStats/{eventId} (doanh thu từng khu, duy trì sẵn – cách D)
// Cách dùng:  node load.mjs                 (5 sự kiện, vài phút)
//             node load.mjs --events=1,2    (nạp ít hơn cho nhanh)
//             node load.mjs --clean         (xóa toàn bộ dữ liệu qp_ khỏi emulator)
import { db, C, COLLECTIONS, pgClient, PROJECT_ID } from './common.mjs';

const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}`));
if (arg('clean')) {
  for (const c of COLLECTIONS) await db.recursiveDelete(C(c));
  console.log('Đã xóa các collection qp_* khỏi emulator.');
  process.exit(0);
}
const events = (arg('events')?.split('=')[1] ?? '1,2,3,4,5').split(',').map(Number);
console.log(`Emulator ${process.env.FIRESTORE_EMULATOR_HOST}, project ${PROJECT_ID}; nạp sự kiện ${events.join(', ')}`);

const pg = await pgClient();
const q = async (sql) => (await pg.query(sql, [events])).rows;
const bw = db.bulkWriter();
// In lỗi ra màn hình thay vì âm thầm thử lại; bỏ qua document lỗi sau 3 lần để không treo
let failed = 0;
bw.onWriteError((err) => {
  console.error(`  LỖI ghi ${err.documentRef.path}: ${err.code} – ${err.message} (lần ${err.failedAttempts})`);
  if (err.failedAttempts >= 3) { failed++; return false; }
  return true;
});
let n = 0;
// Ghi theo đợt 5.000 document và CHỜ emulator ghi xong mỗi đợt, để emulator không bị dồn hàng trăm nghìn lệnh ghi một lúc
const put = async (col, id, data) => {
  bw.set(C(col).doc(String(id)), data);
  if (++n % 5000 === 0) { await bw.flush(); console.log(`  đã ghi ${n.toLocaleString('vi-VN')} / ~354.366 document`); }
};

for (const e of await q('SELECT event_id, title, event_date FROM events WHERE event_id = ANY($1)')) await put('events', e.event_id, { title: e.title, date: e.event_date });
const zoneById = {};
for (const z of await q('SELECT zone_id, event_id, name, price::int FROM zones WHERE event_id = ANY($1)')) {
  zoneById[z.zone_id] = z;
  await put('zones', z.zone_id, { eventId: String(z.event_id), name: z.name, price: z.price });
}
const seatById = {};
for (const s of await q('SELECT s.seat_id, s.zone_id, s.row_label, s.seat_no, s.status FROM seats s JOIN zones z USING (zone_id) WHERE z.event_id = ANY($1)')) {
  seatById[s.seat_id] = s;
  await put('seats', s.seat_id, { zoneId: String(s.zone_id), row: s.row_label, no: s.seat_no, status: s.status });
}
const orderById = {};
for (const o of await q('SELECT order_id, user_id, event_id, status, created_at FROM orders WHERE event_id = ANY($1)')) {
  orderById[o.order_id] = o;
  await put('orders', o.order_id, { userId: String(o.user_id), eventId: String(o.event_id), status: o.status, createdAt: o.created_at });
}
for (const u of await q('SELECT DISTINCT u.user_id, u.phone, u.full_name FROM users u JOIN orders o USING (user_id) WHERE o.event_id = ANY($1)')) {
  await put('users', u.user_id, { phone: u.phone, fullName: u.full_name });
}
const stats = {};
for (const t of await q('SELECT t.ticket_id, t.order_id, t.seat_id, t.price::int, t.status, t.qr_code FROM tickets t JOIN orders o USING (order_id) WHERE o.event_id = ANY($1)')) {
  await put('tickets', t.ticket_id, { orderId: String(t.order_id), seatId: String(t.seat_id), price: t.price, status: t.status });
  const s = seatById[t.seat_id], z = zoneById[s.zone_id], o = orderById[t.order_id];
  await put('ticketsD', t.ticket_id, { eventId: String(z.event_id), zone: z.name, price: t.price, status: t.status,
    userId: String(o.user_id), seatLabel: `${s.row_label}${s.seat_no}`, qrCode: t.qr_code });
  if (t.status !== 'CANCELLED') {
    const zz = ((stats[z.event_id] ??= {})[z.name] ??= { count: 0, revenue: 0 });
    zz.count++; zz.revenue += t.price;
  }
}
for (const [eid, zones] of Object.entries(stats)) await put('eventStats', eid, { zones });
await bw.close();
await pg.end();
console.log(`Xong: ${n - failed} document${failed ? ` (${failed} lỗi)` : ''}. Xem trong Emulator UI (http://127.0.0.1:4001/firestore), các collection qp_*.`);
