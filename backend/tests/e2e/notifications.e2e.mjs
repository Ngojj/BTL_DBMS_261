// Kiểm thử thông báo (chuông): backend ghi notifications/{userId}/items vào Firestore khi thanh toán và hủy đơn.
// Kiểm thử đầu-cuối: cần backend (cổng 4000), PostgreSQL đã seed (npm run seed) và Firestore Emulator đang chạy.
// CẢNH BÁO: tạo người dùng và đơn hàng trong PostgreSQL; chỉ chạy trên cơ sở dữ liệu dev, rồi seed lại.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const backendDir = fileURLToPath(new URL('../../', import.meta.url));
process.loadEnvFile(backendDir + '.env');
const pg = createRequire(backendDir + 'package.json')('pg');
const API = process.env.TEST_API ?? 'http://localhost:4000/api';
const FS_HOST = process.env.TEST_FIRESTORE_HOST ?? '127.0.0.1:8085';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const FSB = `http://${FS_HOST}/v1/projects/${process.env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
const results = [];
const check = (n, ok, x = '') => { results.push(ok); console.log((ok ? 'PASS' : 'FAIL') + '  ' + n + (x ? '  — ' + x : '')); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const call = async (m, p, t, b) => { const r = await fetch(API + p, { method: m, headers: { 'Content-Type': 'application/json', ...(t && { Authorization: 'Bearer ' + t }) }, body: b ? JSON.stringify(b) : undefined }); return { status: r.status, body: await r.json().catch(() => null) }; };
const notifs = async (uid) => { const r = await fetch(`${FSB}/notifications/${uid}/items?pageSize=50`, { headers: { Authorization: 'Bearer owner' } }); const j = await r.json(); return (j.documents || []).map((d) => ({ id: d.name.split('/').pop(), message: d.fields.message?.stringValue, read: d.fields.read?.booleanValue, createdAt: d.fields.createdAt?.timestampValue })); };
let n = 0; const stamp = Date.now();
const newUser = async () => { const i = ++n; const r = await call('POST', '/auth/register', null, { email: `nt${stamp}_${i}@t.com`, phone: '09' + String(stamp).slice(-6) + String(i).padStart(2, '0'), fullName: 'NT ' + i, password: '123456' }); return { token: r.body.token, id: r.body.user.userId, email: `nt${stamp}_${i}@t.com` }; };
const seats = (e, k, off = 0) => pool.query(`SELECT s.seat_id FROM seats s JOIN zones z ON z.zone_id=s.zone_id WHERE z.event_id=$1 AND s.status='AVAILABLE' ORDER BY s.seat_id LIMIT $2 OFFSET $3`, [e, k, off]).then((r) => r.rows.map((x) => x.seat_id));
const E = 2;

(async () => {
  const title = (await pool.query('SELECT title FROM events WHERE event_id=$1', [E])).rows[0].title;
  // ---------- A. backend ghi thông báo ----------
  const u = await newUser();
  check('người dùng mới chưa có thông báo', (await notifs(u.id)).length === 0);
  const o = await call('POST', '/orders', u.token, { eventId: E, seatIds: await seats(E, 2) });
  await sleep(1200);
  check('giữ ghế (chưa thanh toán) KHÔNG tạo thông báo', (await notifs(u.id)).length === 0);
  const total = Number(o.body.total);
  await call('POST', `/orders/${o.body.orderId}/pay`, u.token, { method: 'CARD' });
  await sleep(2000);
  let list = await notifs(u.id);
  const paid = list.find((x) => x.id === 'paid-' + o.body.orderId);
  check('thanh toán → có đúng 1 thông báo', list.length === 1 && !!paid, list.map((x) => x.id).join(','));
  check('nội dung: số vé, tên sự kiện, số tiền', /2 vé/.test(paid?.message) && paid.message.includes(title) && paid.message.includes(total.toLocaleString('vi-VN')), paid?.message);
  check('chưa đọc (read=false) và có thời gian tạo', paid?.read === false && !!paid?.createdAt);
  await call('POST', `/orders/${o.body.orderId}/pay`, u.token, { method: 'CARD' });
  await sleep(1500);
  check('thanh toán lần 2 (gọi lại) KHÔNG tạo thông báo thứ hai', (await notifs(u.id)).length === 1);
  await call('POST', `/orders/${o.body.orderId}/cancel`, u.token);
  await sleep(2000);
  list = await notifs(u.id);
  const canc = list.find((x) => x.id === 'cancelled-' + o.body.orderId);
  check('hủy đơn đã thanh toán → thông báo hủy có nội dung hoàn tiền', !!canc && /hoàn lại/.test(canc.message) && canc.message.includes(total.toLocaleString('vi-VN')), canc?.message);
  await call('POST', `/orders/${o.body.orderId}/cancel`, u.token);
  await sleep(1500);
  check('hủy lần 2 KHÔNG tạo thêm thông báo (tổng vẫn 2)', (await notifs(u.id)).length === 2);

  const u2 = await newUser();
  const o2 = await call('POST', '/orders', u2.token, { eventId: E, seatIds: await seats(E, 1) });
  await call('POST', `/orders/${o2.body.orderId}/cancel`, u2.token);
  await sleep(2000);
  const c2 = (await notifs(u2.id)).find((x) => x.id === 'cancelled-' + o2.body.orderId);
  check('hủy đơn CHƯA thanh toán → thông báo "Ghế đã được trả về", không nhắc hoàn tiền', !!c2 && /Ghế đã được trả về/.test(c2.message) && !/hoàn/.test(c2.message), c2?.message);

  const u3 = await newUser();
  const o3 = await call('POST', '/orders', u3.token, { eventId: E, seatIds: await seats(E, 1) });
  await pool.query(`UPDATE orders SET expires_at = now() - interval '1 minute' WHERE order_id=$1`, [o3.body.orderId]);
  await pool.query(`UPDATE seats SET held_until = now() - interval '1 minute' WHERE seat_id IN (SELECT seat_id FROM tickets WHERE order_id=$1)`, [o3.body.orderId]);
  const late = await call('POST', `/orders/${o3.body.orderId}/pay`, u3.token, { method: 'CARD' });
  await sleep(1500);
  check('thanh toán đơn đã HẾT HẠN → không có thông báo "thành công"', (await notifs(u3.id)).every((x) => !/Thanh toán thành công/.test(x.message)), 'phản hồi ' + late.status);

  const u4 = await newUser();
  const o4 = await call('POST', '/orders', u4.token, { eventId: E, seatIds: await seats(E, 1) });
  const wrong = await call('POST', `/orders/${o4.body.orderId}/pay`, (await newUser()).token, { method: 'CARD' });
  await sleep(1200);
  check('người khác thanh toán đơn (403) → không có thông báo nào cho chủ đơn', wrong.status === 403 && (await notifs(u4.id)).length === 0);


  await pool.end();
  const bad = results.filter((x) => !x).length;
  console.log(`\n${results.length - bad}/${results.length} đạt`);
  process.exitCode = bad ? 1 : 0;
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(2); });
