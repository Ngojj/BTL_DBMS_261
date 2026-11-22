// Kiểm thử mua vé (#4, #5), vé của tôi (#6), đồng bộ Firestore: gồm 20 người giành 1 ghế, đơn song song vượt giới hạn, hết hạn giữ chỗ, hoàn tiền
// Kiểm thử đầu-cuối: cần backend (cổng 4000), PostgreSQL đã seed (npm run seed) và Firestore Emulator đang chạy.
// Chạy: npm --prefix backend run test:e2e     (đổi địa chỉ qua TEST_API, TEST_FIRESTORE_HOST)
// CẢNH BÁO: tạo, sửa, xóa dữ liệu trong PostgreSQL; chỉ chạy trên cơ sở dữ liệu dev, rồi seed lại.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const backendDir = fileURLToPath(new URL('../../', import.meta.url));
process.loadEnvFile(backendDir + '.env');
const pg = createRequire(backendDir + 'package.json')('pg');
const API = process.env.TEST_API ?? 'http://localhost:4000/api';
const FS_HOST = process.env.TEST_FIRESTORE_HOST ?? '127.0.0.1:8085';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const results = [];
const check = (n, ok, x = '') => { results.push(ok); console.log((ok ? 'PASS' : 'FAIL') + '  ' + n + (x ? '  — ' + x : '')); };
const sql = async (s, p) => (await pool.query(s, p)).rows;
const call = async (method, p, token, body) => {
  const r = await fetch(API + p, { method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: 'Bearer ' + token }) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => null) };
};
const stamp = Date.now();
let counter = 0;
async function newUser() {
  const i = ++counter;
  const email = `bk${stamp}_${i}@test.com`;
  const phone = '09' + String(stamp).slice(-6) + String(i).padStart(2, '0');
  const r = await call('POST', '/auth/register', null, { email, phone, fullName: 'BK ' + i, password: '123456' });
  return { token: r.body.token, id: r.body.user.userId, email };
}
const freeSeats = (eventId, n, offset = 0) => sql(`SELECT s.seat_id FROM seats s JOIN zones z ON z.zone_id=s.zone_id WHERE z.event_id=$1 AND s.status='AVAILABLE' ORDER BY s.seat_id LIMIT $2 OFFSET $3`, [eventId, n, offset]).then((r) => r.map((x) => x.seat_id));
const EVENT = 2; // Đêm nhạc Rock: đang mở bán, giới hạn 4 vé/người
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Firestore Emulator REST (đọc không cần xác thực)
const fsSeat = async (eventId, seatId) => {
  const r = await fetch(`http://${FS_HOST}/v1/projects/${process.env.FIREBASE_PROJECT_ID}/databases/(default)/documents/events/${eventId}/seats/${seatId}`, { headers: { Authorization: 'Bearer owner' } });
  const j = await r.json();
  return j.fields?.status?.stringValue;
};

(async () => {
  // ---------- xác thực ----------
  check('không đăng nhập → 401', (await call('POST', '/orders', null, { eventId: EVENT, seatIds: [1] })).status === 401);
  const admin = (await call('POST', '/auth/login', null, { email: 'admin@ticketrush.vn', password: 'Admin@123' })).body.token;
  check('admin không được mua vé → 403', (await call('POST', '/orders', admin, { eventId: EVENT, seatIds: [1] })).status === 403);

  // ---------- tạo đơn ----------
  const u1 = await newUser();
  const [s1, s2, s3] = await freeSeats(EVENT, 3);
  const c = await call('POST', '/orders', u1.token, { eventId: EVENT, seatIds: [s1, s2] });
  check('tạo đơn 2 ghế → 200, PENDING', c.status === 200 && c.body.status === 'PENDING' && c.body.ticketCount === 2, c.status + ' ' + (c.body.error?.message ?? ''));
  const orderId = c.body.orderId;
  const ttl = (new Date(c.body.expiresAt) - Date.now()) / 60000;
  check('giữ ghế khoảng 10 phút', ttl > 9 && ttl <= 10.1, ttl.toFixed(1) + ' phút');
  const seatsDb = await sql(`SELECT status, held_by FROM seats WHERE seat_id = ANY($1)`, [[s1, s2]]);
  check('2 ghế chuyển sang HELD cho đúng người', seatsDb.every((s) => s.status === 'HELD' && String(s.held_by) === u1.id));
  check('tổng tiền = tổng giá khu vực', Number(c.body.total) === Number((await sql(`SELECT SUM(z.price) t FROM seats s JOIN zones z ON z.zone_id=s.zone_id WHERE s.seat_id = ANY($1)`, [[s1, s2]]))[0].t));

  // ---------- chi tiết đơn ----------
  const g = await call('GET', '/orders/' + orderId, u1.token);
  check('GET /orders/:id trả đủ trường cho trang thanh toán', g.status === 200 && g.body.eventTitle && g.body.venueName && g.body.items.length === 2 && g.body.items.every((i) => i.seatLabel && i.zone && i.price > 0) && g.body.expiresAt, JSON.stringify(g.body.items?.[0]));
  const u2 = await newUser();
  check('người khác xem đơn → 403', (await call('GET', '/orders/' + orderId, u2.token)).status === 403);
  check('đơn không tồn tại → 404', (await call('GET', '/orders/999999999', u1.token)).status === 404);
  check('orderId sai định dạng → 400', (await call('GET', '/orders/abc', u1.token)).status === 400);

  // ---------- đồng bộ Firestore ----------
  await sleep(1500);
  check('Firestore: ghế vừa giữ có trạng thái HELD', (await fsSeat(EVENT, s1)) === 'HELD', String(await fsSeat(EVENT, s1)));

  // ---------- chọn trùng ghế ----------
  const dup = await call('POST', '/orders', u2.token, { eventId: EVENT, seatIds: [s1] });
  check('ghế đang bị giữ → 409 SEAT_UNAVAILABLE', dup.status === 409 && dup.body.error.code === 'SEAT_UNAVAILABLE', dup.body.error?.code);
  check('ghế thuộc sự kiện khác → 409', (await call('POST', '/orders', u2.token, { eventId: 3, seatIds: [s3] })).status === 409);
  check('danh sách ghế rỗng → 400', (await call('POST', '/orders', u2.token, { eventId: EVENT, seatIds: [] })).status === 400);
  check('ghế trùng trong danh sách → 400', (await call('POST', '/orders', u2.token, { eventId: EVENT, seatIds: [s3, s3] })).status === 400);
  check('ghế không tồn tại → 404', (await call('POST', '/orders', u2.token, { eventId: EVENT, seatIds: [999999999] })).status === 404);
  // chưa mở bán: tạm đặt giờ mở bán ở tương lai cho sự kiện 4 rồi khôi phục
  const [ev4] = await sql('SELECT sale_open_at FROM events WHERE event_id=4');
  await pool.query("UPDATE events SET sale_open_at = now() + interval '1 day' WHERE event_id=4");
  const notOpen = await call('POST', '/orders', u2.token, { eventId: 4, seatIds: await freeSeats(4, 1) });
  await pool.query('UPDATE events SET sale_open_at = $1 WHERE event_id=4', [ev4.sale_open_at]);
  check('sự kiện chưa mở bán → 409 SALE_NOT_OPEN', notOpen.status === 409 && notOpen.body.error.code === 'SALE_NOT_OPEN', notOpen.body.error?.code);
  const ended = await call('POST', '/orders', u2.token, { eventId: 7, seatIds: await freeSeats(7, 1) });
  check('sự kiện đã kết thúc → 409', ended.status === 409, ended.body.error?.code);

  // ---------- giới hạn 4 vé ----------
  const u3 = await newUser();
  const five = await freeSeats(EVENT, 5, 10);
  const over = await call('POST', '/orders', u3.token, { eventId: EVENT, seatIds: five });
  check('mua 5 vé (giới hạn 4) → 409 TICKET_LIMIT_EXCEEDED', over.status === 409 && over.body.error.code === 'TICKET_LIMIT_EXCEEDED', over.body.error?.code);
  check('đơn bị từ chối không để lại dữ liệu (rollback)', Number((await sql(`SELECT COUNT(*) n FROM orders WHERE user_id=$1`, [u3.id]))[0].n) === 0 && (await sql(`SELECT 1 FROM seats WHERE seat_id = ANY($1) AND status<>'AVAILABLE'`, [five])).length === 0);

  // ---------- TRANH CHẤP: 20 người cùng giành 1 ghế ----------
  const target = (await freeSeats(EVENT, 1, 20))[0];
  const racers = await Promise.all(Array.from({ length: 20 }, newUser));
  const race = await Promise.all(racers.map((u) => call('POST', '/orders', u.token, { eventId: EVENT, seatIds: [target] })));
  const won = race.filter((r) => r.status === 200).length;
  const lost = race.filter((r) => r.status === 409 && r.body.error.code === 'SEAT_UNAVAILABLE').length;
  check('20 người giành 1 ghế: đúng 1 thắng, 19 thua 409', won === 1 && lost === 19, `thắng ${won}, thua ${lost}, khác ${20 - won - lost}`);
  const active = await sql(`SELECT COUNT(*) n FROM tickets WHERE seat_id=$1 AND status<>'CANCELLED'`, [target]);
  check('DB: đúng 1 vé còn hiệu lực cho ghế đó', Number(active[0].n) === 1);

  // ---------- TRANH CHẤP: cùng một người, 2 đơn song song vượt giới hạn ----------
  const u4 = await newUser();
  const a = await freeSeats(EVENT, 3, 30);
  const b = await freeSeats(EVENT, 3, 40);
  const par = await Promise.all([call('POST', '/orders', u4.token, { eventId: EVENT, seatIds: a }), call('POST', '/orders', u4.token, { eventId: EVENT, seatIds: b })]);
  const okCount = par.filter((r) => r.status === 200).length;
  const tix = await sql(`SELECT COUNT(*) n FROM tickets t JOIN orders o ON o.order_id=t.order_id WHERE o.user_id=$1 AND t.status<>'CANCELLED'`, [u4.id]);
  check('2 đơn song song 3+3 vé (giới hạn 4): chỉ 1 đơn thành công, tổng ≤ 4 vé', okCount === 1 && Number(tix[0].n) <= 4, `đơn thành công ${okCount}, tổng vé ${tix[0].n}`);

  // ---------- thanh toán ----------
  check('phương thức thanh toán sai → 400', (await call('POST', `/orders/${orderId}/pay`, u1.token, { method: 'BITCOIN' })).status === 400);
  check('người khác thanh toán đơn → 403', (await call('POST', `/orders/${orderId}/pay`, u2.token, { method: 'CARD' })).status === 403);
  const pay = await call('POST', `/orders/${orderId}/pay`, u1.token, { method: 'E_WALLET', buyer: { fullName: 'X', phone: '0900000000', email: 'x@x.com' } });
  check('thanh toán E_WALLET → PAID', pay.status === 200 && pay.body.status === 'PAID' && pay.body.paid === true, JSON.stringify(pay.body));
  const pr = await sql(`SELECT method, status, amount FROM payments WHERE order_id=$1`, [orderId]);
  check('payments: 1 dòng SUCCESS, đúng phương thức và số tiền', pr.length === 1 && pr[0].status === 'SUCCESS' && pr[0].method === 'E_WALLET' && Number(pr[0].amount) === Number(c.body.total));
  check('ghế chuyển SOLD, hết held_by', (await sql(`SELECT status, held_by FROM seats WHERE seat_id = ANY($1)`, [[s1, s2]])).every((s) => s.status === 'SOLD' && s.held_by === null));
  const pay2 = await call('POST', `/orders/${orderId}/pay`, u1.token, { method: 'CARD' });
  check('thanh toán lần 2 an toàn (không tạo payment thứ hai)', pay2.status === 200 && pay2.body.status === 'PAID' && Number((await sql(`SELECT COUNT(*) n FROM payments WHERE order_id=$1`, [orderId]))[0].n) === 1);
  await sleep(1500);
  check('Firestore: ghế đã bán có trạng thái SOLD', (await fsSeat(EVENT, s1)) === 'SOLD');

  // ---------- vé của tôi ----------
  const mine = await call('GET', '/tickets/mine', u1.token);
  const t0 = mine.body?.[0];
  check('GET /tickets/mine: 2 vé đúng dạng frontend cần', mine.status === 200 && mine.body.length === 2 && t0 && ['ticketId', 'orderId', 'qrCode', 'status', 'eventId', 'eventTitle', 'eventDate', 'venueName', 'city', 'zone', 'seatLabel', 'holderName'].every((k) => t0[k] != null), JSON.stringify(t0));
  check('seatLabel dạng "B7" (hàng + số), status VALID', /^[A-Z]+\d+$/.test(t0.seatLabel) && t0.status === 'VALID');
  check('chưa thanh toán thì chưa hiện vé (u2 không có)', (await call('GET', '/tickets/mine', u2.token)).body.length === 0);

  // ---------- hủy đơn ----------
  check('người khác hủy đơn → 403', (await call('POST', `/orders/${orderId}/cancel`, u2.token)).status === 403);
  const cancel = await call('POST', `/orders/${orderId}/cancel`, u1.token);
  check('hủy đơn đã thanh toán → CANCELLED', cancel.status === 200 && cancel.body.status === 'CANCELLED' && cancel.body.cancelled === true);
  check('payment chuyển REFUNDED, ghế về AVAILABLE, vé CANCELLED',
    (await sql(`SELECT status FROM payments WHERE order_id=$1`, [orderId]))[0].status === 'REFUNDED' &&
    (await sql(`SELECT status FROM seats WHERE seat_id = ANY($1)`, [[s1, s2]])).every((s) => s.status === 'AVAILABLE') &&
    (await sql(`SELECT status FROM tickets WHERE order_id=$1`, [orderId])).every((t) => t.status === 'CANCELLED'));
  check('hủy lần 2 an toàn', (await call('POST', `/orders/${orderId}/cancel`, u1.token)).body.status === 'CANCELLED');
  const mine2 = await call('GET', '/tickets/mine', u1.token);
  check('vé của đơn đã hủy hiện trạng thái CANCELLED', mine2.body.length === 2 && mine2.body.every((t) => t.status === 'CANCELLED'));
  const re = await call('POST', '/orders', u2.token, { eventId: EVENT, seatIds: [s1] });
  check('ghế đã hoàn có thể bán lại cho người khác', re.status === 200, re.body.error?.message ?? '');
  await sleep(1500);
  check('Firestore: ghế sau khi hoàn được cập nhật lại (HELD cho người mới)', (await fsSeat(EVENT, s1)) === 'HELD');

  // ---------- hết hạn giữ chỗ ----------
  const u5 = await newUser();
  const [e1] = await freeSeats(EVENT, 1, 0);
  const eo = await call('POST', '/orders', u5.token, { eventId: EVENT, seatIds: [e1] });
  await pool.query(`UPDATE orders SET expires_at = now() - interval '1 minute' WHERE order_id=$1`, [eo.body.orderId]);
  await pool.query(`UPDATE seats SET held_until = now() - interval '1 minute' WHERE seat_id=$1`, [e1]);
  const u6 = await newUser();
  const steal = await call('POST', '/orders', u6.token, { eventId: EVENT, seatIds: [e1] });
  check('ghế hết hạn giữ có thể được người khác mua ngay (tự dọn đơn cũ)', steal.status === 200, steal.body.error?.message ?? '');
  check('đơn hết hạn chuyển EXPIRED', (await sql(`SELECT status FROM orders WHERE order_id=$1`, [eo.body.orderId]))[0].status === 'EXPIRED');
  const lateP = await call('POST', `/orders/${eo.body.orderId}/pay`, u5.token, { method: 'CARD' });
  check('thanh toán đơn đã hết hạn → paid:false, không tạo payment', lateP.status === 409 || (lateP.body.paid === false && Number((await sql(`SELECT COUNT(*) n FROM payments WHERE order_id=$1`, [eo.body.orderId]))[0].n) === 0), lateP.status + ' ' + JSON.stringify(lateP.body).slice(0, 90));

  // ---------- danh sách đơn ----------
  const list = await call('GET', '/orders', u1.token);
  check('GET /orders liệt kê đơn của tôi', list.status === 200 && list.body.length === 1 && list.body[0].status === 'CANCELLED');

  // ---------- đồng bộ lại từ admin ----------
  check('khách gọi /admin/sync → 403', (await call('POST', '/admin/sync/all', u1.token)).status === 403);
  const rs = await call('POST', `/admin/sync/events/${EVENT}`, admin);
  check('admin đồng bộ lại một sự kiện → số ghế và vé', rs.status === 200 && rs.body.seats === 148 && rs.body.tickets >= 0, JSON.stringify(rs.body));
  check('sự kiện không tồn tại → 404', (await call('POST', '/admin/sync/events/999999', admin)).status === 404);
  const ra = await call('POST', '/admin/sync/all', admin);
  check('admin đồng bộ lại tất cả → 7 sự kiện', ra.status === 200 && ra.body.events === 7 && ra.body.seats === 1036, JSON.stringify(ra.body));

  await pool.end();
  const bad = results.filter((x) => !x).length;
  console.log(`\n${results.length - bad}/${results.length} đạt`);
  process.exitCode = bad ? 1 : 0;
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(2); });
