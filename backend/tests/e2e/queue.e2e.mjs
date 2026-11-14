// E2E phòng chờ ảo (#3). Cần: backend đang chạy (API_URL, mặc định http://localhost:4000/api), Firestore Emulator, CSDL đã seed.
// Chạy: node backend/tests/e2e/queue.e2e.mjs
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const API = process.env.API_URL ?? 'http://localhost:4000/api';
const dir = fileURLToPath(new URL('../../', import.meta.url));
process.loadEnvFile(dir + '.env');
const { Pool } = createRequire(dir + 'package.json')('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

let fail = 0;
const ok = (cond, name) => { console.log((cond ? 'PASS ' : 'FAIL ') + name); if (!cond) fail++; };
const call = async (path, token, method = 'GET', body) => {
  const r = await fetch(API + path, { method, headers: { 'content-type': 'application/json', ...(token && { authorization: 'Bearer ' + token }) }, body: body && JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const login = async (email, password) => (await call('/auth/login', null, 'POST', { email, password })).body.token;

// Hai khách mới mỗi lần chạy (tài khoản demo có thể đã chạm giới hạn vé)
const stamp = Date.now();
const signup = async (n) => (await call('/auth/register', null, 'POST', { email: `queue.${n}.${stamp}@example.com`, phone: '09' + String(stamp).slice(-8), fullName: 'Khách phòng chờ ' + n, password: '123456' })).body.token;
const admin = await login('admin@ticketrush.vn', 'Admin@123');
const a = await signup('a');
const b = await signup('b');
const { rows: [{ event_id: EV }] } = await pool.query("SELECT event_id FROM events WHERE status='ON_SALE' AND sale_open_at <= now() ORDER BY event_id LIMIT 1");
const { rows: seats } = await pool.query("SELECT s.seat_id FROM seats s JOIN zones z USING (zone_id) WHERE z.event_id=$1 AND s.status='AVAILABLE' ORDER BY seat_id LIMIT 2", [EV]);
const q = (p = '') => `/events/${EV}/queue${p}`;
const order = (t, seatId) => call('/orders', t, 'POST', { eventId: Number(EV), seatIds: [Number(seatId)] });

// dọn trạng thái cũ
await call(q(), admin, 'DELETE');
await call(q(), admin, 'PUT', { enabled: false });

ok((await call(q('/status'), null)).status === 401, 'chưa đăng nhập → 401');
ok((await call(q(), a, 'PUT', { enabled: true })).status === 403, 'khách không được bật phòng chờ → 403');
ok((await call(q(), admin, 'PUT', { enabled: 'yes' })).status === 400, 'enabled sai kiểu → 400');
ok((await call('/events/999999/queue/join', a, 'POST')).status === 404, 'sự kiện không tồn tại → 404');

ok((await call(q(), admin, 'PUT', { enabled: true })).body.enabled === true, 'admin bật phòng chờ');
const blocked = await order(a, seats[0].seat_id);
ok(blocked.status === 403 && blocked.body.error?.code === 'QUEUE_REQUIRED', 'chưa xếp hàng mà mua → 403 QUEUE_REQUIRED');

const [ja, jb] = [await call(q('/join'), a, 'POST'), await call(q('/join'), b, 'POST')];
ok(ja.status === 200 && ja.body.inQueue && !ja.body.admitted, 'khách A vào hàng, chưa được vào');
ok(jb.body.position === ja.body.position + 1 && jb.body.peopleAhead === 1, 'khách B đứng sau A (còn 1 người phía trước)');
ok((await call(q('/join'), a, 'POST')).body.position === ja.body.position, 'vào lại giữ nguyên số thứ tự');

const both = await Promise.all([call(q('/join'), admin, 'POST'), call(q('/join'), b, 'POST')]);
ok(both[0].status === 403, 'ADMIN không vào hàng đợi như khách → 403');

const ad = await call(q('/admit'), admin, 'POST', { count: 1 });
ok(ad.status === 200 && ad.body.admitted === 1, 'admin cho 1 người vào');
ok((await call(q('/status'), a)).body.admitted === true, 'A đã được vào');
const sb = (await call(q('/status'), b)).body;
ok(sb.admitted === false && sb.peopleAhead === 0, 'B vẫn chờ, không còn ai phía trước');
ok((await call(q('/admit'), admin, 'POST', { count: 0 })).status === 400, 'count = 0 → 400');

ok((await order(b, seats[1].seat_id)).status === 403, 'B chưa được vào mà mua → 403');
const good = await order(a, seats[0].seat_id);
ok(good.status === 201 || good.status === 200, 'A được vào nên mua được (' + good.status + ')');
if (good.body.orderId) await call('/orders/' + good.body.orderId + '/cancel', a, 'POST');

ok((await call(q(), admin, 'PUT', { enabled: false })).body.enabled === false, 'admin tắt phòng chờ');
const free = await order(b, seats[1].seat_id);
ok(free.status < 300, 'tắt phòng chờ thì ai cũng mua được (' + free.status + ')');
if (free.body.orderId) await call('/orders/' + free.body.orderId + '/cancel', b, 'POST');

await call(q('/leave'), a, 'POST'); await call(q('/leave'), b, 'POST');
ok((await call(q('/status'), a)).body.inQueue === false, 'rời hàng → không còn trong hàng');
await call(q(), admin, 'DELETE');
await pool.query("DELETE FROM users WHERE email LIKE $1", [`queue.%.${stamp}@example.com`]).catch(() => {});
await pool.end();
console.log(fail ? `\n${fail} lỗi` : '\nTất cả đạt');
process.exit(fail ? 1 : 0);
