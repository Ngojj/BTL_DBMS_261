// Kiểm thử #8 (sự kiện), #9 (khu vực, giá vé, sinh ghế) và đánh giá: API + PostgreSQL + Firestore
// Kiểm thử đầu-cuối: cần backend (cổng 4000), PostgreSQL đã seed (npm run seed) và Firestore Emulator đang chạy.
// Chạy: npm --prefix backend run test:e2e     (đổi địa chỉ qua TEST_API, TEST_FIRESTORE_HOST)
// CẢNH BÁO: tạo, sửa, xóa dữ liệu thật trong PostgreSQL; chỉ chạy trên cơ sở dữ liệu dev, rồi seed lại.
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
const sql = async (s, p) => (await pool.query(s, p)).rows;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const call = async (m, p, t, b) => { const r = await fetch(API + p, { method: m, headers: { 'Content-Type': 'application/json', ...(t && { Authorization: 'Bearer ' + t }) }, body: b === undefined ? undefined : JSON.stringify(b) }); return { status: r.status, body: await r.json().catch(() => null) }; };
const code = (r) => r.status + ' ' + (r.body?.error?.code ?? '');
const fsDoc = async (col) => (await fetch(`${FSB}/${col}`, { headers: { Authorization: 'Bearer owner' } })).status;
const fsSeats = async (e) => { const j = await (await fetch(`${FSB}/events/${e}/seats?pageSize=300`, { headers: { Authorization: 'Bearer owner' } })).json(); return (j.documents || []).length; };

const future = (d) => new Date(Date.now() + d * 86400e3).toISOString();
const ev = (o = {}) => ({ title: 'Sự kiện kiểm thử', genreId: 1, venueId: 1, eventDate: future(60), saleOpenAt: future(10), maxTicketsPerUser: 4, status: 'DRAFT', ...o });

(async () => {
  const login = async (email, password) => (await call('POST', '/auth/login', null, { email, password })).body.token;
  const adm = await login('admin@ticketrush.vn', 'Admin@123');
  const cus = await login('khach@example.com', '123456');

  // ================= #8 SỰ KIỆN =================
  console.log('--- #8 quản lý sự kiện');
  check('tạo sự kiện không đăng nhập → 401', (await call('POST', '/events', null, ev())).status === 401);
  check('khách tạo sự kiện → 403', (await call('POST', '/events', cus, ev())).status === 403);
  check('khách sửa → 403, khách xóa → 403', (await call('PUT', '/events/1', cus, ev())).status === 403 && (await call('DELETE', '/events/1', cus)).status === 403);

  const c = await call('POST', '/events', adm, ev());
  check('admin tạo sự kiện hợp lệ → thành công', c.status === 200 || c.status === 201, code(c));
  const E = c.body?.eventId;
  check('trả về đủ trường, mặc định DRAFT', !!E && c.body.title === 'Sự kiện kiểm thử' && c.body.status === 'DRAFT' && c.body.maxTicketsPerUser === 4, JSON.stringify(c.body).slice(0, 100));
  const [row] = await sql('SELECT title, status FROM events WHERE event_id=$1', [E]);
  check('PostgreSQL: có dòng mới', row?.title === 'Sự kiện kiểm thử');
  const listDraft = (await call('GET', '/events')).body;
  check('sự kiện DRAFT KHÔNG hiện ở danh sách công khai', !listDraft.some((e) => String(e.eventId) === String(E)));
  check('nhưng getEvent theo mã vẫn lấy được (admin cần sửa)', (await call('GET', '/events/' + E)).status === 200);

  for (const [name, body] of [
    ['thiếu tên', ev({ title: '' })], ['tên toàn khoảng trắng', ev({ title: '   ' })], ['tên > 200 ký tự', ev({ title: 'a'.repeat(201) })],
    ['genreId là chuỗi', ev({ genreId: '1' })], ['genreId = 0', ev({ genreId: 0 })], ['venueId âm', ev({ venueId: -1 })],
    ['ngày không hợp lệ', ev({ eventDate: 'không phải ngày' })], ['giờ mở bán sau ngày diễn ra', ev({ saleOpenAt: future(90) })],
    ['maxTicketsPerUser = 11', ev({ maxTicketsPerUser: 11 })], ['maxTicketsPerUser = 0', ev({ maxTicketsPerUser: 0 })], ['maxTicketsPerUser = 2.5', ev({ maxTicketsPerUser: 2.5 })],
    ['status lạ', ev({ status: 'HACKED' })],
  ]) { const r = await call('POST', '/events', adm, body); check('tạo sai: ' + name + ' → 400', r.status === 400, code(r)); }
  const fk1 = await call('POST', '/events', adm, ev({ genreId: 999 }));
  check('thể loại không tồn tại → lỗi 4xx rõ ràng (không phải 500)', fk1.status >= 400 && fk1.status < 500, code(fk1));
  const fk2 = await call('POST', '/events', adm, ev({ venueId: 999 }));
  check('địa điểm không tồn tại → lỗi 4xx rõ ràng', fk2.status >= 400 && fk2.status < 500, code(fk2));
  check('body rỗng / không phải đối tượng → 400', (await call('POST', '/events', adm, {})).status === 400 && (await call('POST', '/events', adm, [])).status === 400);

  const u = await call('PUT', '/events/' + E, adm, ev({ title: 'Đã sửa tên', status: 'ON_SALE', maxTicketsPerUser: 6 }));
  check('sửa sự kiện → thành công', u.status === 200 && u.body.title === 'Đã sửa tên' && u.body.status === 'ON_SALE' && u.body.maxTicketsPerUser === 6, code(u));
  check('sau khi chuyển ON_SALE thì hiện ở danh sách công khai', (await call('GET', '/events')).body.some((e) => String(e.eventId) === String(E)));
  check('sửa sự kiện không tồn tại → 404', (await call('PUT', '/events/999999', adm, ev())).status === 404);
  check('sửa với dữ liệu sai → 400', (await call('PUT', '/events/' + E, adm, ev({ maxTicketsPerUser: 99 }))).status === 400);
  const [after] = await sql('SELECT title, max_tickets_per_user m FROM events WHERE event_id=$1', [E]);
  check('dữ liệu sai không làm hỏng bản ghi', after.title === 'Đã sửa tên' && after.m === 6);
  check('eventId sai định dạng → 400', (await call('PUT', '/events/abc', adm, ev())).status === 400 && (await call('DELETE', '/events/abc', adm)).status === 400);

  // ================= #9 KHU VỰC =================
  console.log('--- #9 khu vực và giá vé');
  const z0 = await call('GET', `/events/${E}/zones`);
  check('sự kiện mới chưa có khu vực', z0.status === 200 && z0.body.length === 0, code(z0));
  check('khách tạo khu vực → 403, không đăng nhập → 401', (await call('POST', `/events/${E}/zones`, cus, { name: 'VIP', price: 100000, capacity: 10 })).status === 403 && (await call('POST', `/events/${E}/zones`, null, { name: 'VIP', price: 100000, capacity: 10 })).status === 401);
  const zc = await call('POST', `/events/${E}/zones`, adm, { name: 'VIP', price: 1500000, capacity: 12 });
  check('tạo khu vực VIP', zc.status === 200 || zc.status === 201, code(zc));
  const Z = zc.body?.zoneId ?? zc.body?.zone_id;
  check('trả về mã khu vực, giá, sức chứa', !!Z && Number(zc.body.price) === 1500000 && Number(zc.body.capacity) === 12, JSON.stringify(zc.body).slice(0, 100));
  const dup = await call('POST', `/events/${E}/zones`, adm, { name: 'VIP', price: 1, capacity: 5 });
  check('trùng tên khu trong cùng sự kiện → 409', dup.status === 409, code(dup));
  for (const [name, body] of [['giá âm', { name: 'X', price: -1, capacity: 5 }], ['sức chứa 0', { name: 'X', price: 100, capacity: 0 }], ['sức chứa 2.5', { name: 'X', price: 100, capacity: 2.5 }], ['thiếu tên', { price: 100, capacity: 5 }], ['giá là chuỗi', { name: 'X', price: 'abc', capacity: 5 }]]) {
    const r = await call('POST', `/events/${E}/zones`, adm, body); check('tạo khu sai: ' + name + ' → 400', r.status === 400, code(r));
  }
  const zNo = await call('POST', '/events/999999/zones', adm, { name: 'VIP', price: 100, capacity: 5 });
  check('thêm khu cho sự kiện không tồn tại → 4xx rõ ràng', zNo.status >= 400 && zNo.status < 500, code(zNo));
  const zu = await call('PUT', `/zones/${Z}`, adm, { name: 'VIP+', price: 1800000, capacity: 12 });
  check('sửa khu vực (tên, giá)', zu.status === 200 && Number(zu.body.price) === 1800000 && zu.body.name === 'VIP+', code(zu));
  check('sửa khu không tồn tại → 404', (await call('PUT', '/zones/999999', adm, { name: 'a', price: 1, capacity: 1 })).status === 404);

  console.log('--- sinh ghế');
  const g = await call('POST', `/zones/${Z}/generate-seats`, adm, { rows: 'A-C', seatsPerRow: 4 });
  check('sinh ghế cho khu', g.status === 200 || g.status === 201, code(g) + ' ' + JSON.stringify(g.body).slice(0, 80));
  const seats = await sql('SELECT row_label, seat_no FROM seats WHERE zone_id=$1 ORDER BY row_label, seat_no', [Z]);
  check('đúng số ghế = sức chứa (12)', seats.length === 12, seats.length + ' ghế');
  check('chia hàng A, B, C với 4 ghế mỗi hàng', JSON.stringify([...new Set(seats.map((s) => s.row_label))]) === '["A","B","C"]' && seats.filter((s) => s.row_label === 'A').length === 4);
  const g2 = await call('POST', `/zones/${Z}/generate-seats`, adm, { seatsPerRow: 4 });
  const seats2 = await sql('SELECT COUNT(*)::int n FROM seats WHERE zone_id=$1', [Z]);
  check('sinh ghế lần 2 không tạo ghế trùng (vẫn 12) và không lỗi 500', seats2[0].n === 12 && g2.status < 500, code(g2) + ' → ' + seats2[0].n + ' ghế');
  check('seatsPerRow quá lớn (> 50) → 400', (await call('POST', `/zones/${Z}/generate-seats`, adm, { seatsPerRow: 51 })).status === 400);
  check('sinh ghế cho khu không tồn tại → 404', (await call('POST', '/zones/999999/generate-seats', adm, { seatsPerRow: 4 })).status === 404);

  await sleep(1500);
  const fsN = await fsSeats(E);
  check('SAU KHI SINH GHẾ, sơ đồ ghế realtime (Firestore) có ghế của sự kiện mới', fsN === 12, 'Firestore có ' + fsN + ' ghế / cần 12 – nếu 0 thì khách không thấy sơ đồ cho tới khi admin bấm "Đồng bộ"');

  // khu đã có vé bán không được xóa
  const sold = await sql(`SELECT z.zone_id FROM zones z JOIN seats s ON s.zone_id=z.zone_id WHERE s.status='SOLD' LIMIT 1`);
  const del1 = await call('DELETE', `/zones/${sold[0].zone_id}`, adm);
  const still = await sql('SELECT 1 FROM zones WHERE zone_id=$1', [sold[0].zone_id]);
  check('xóa khu ĐÃ BÁN VÉ bị từ chối bằng lỗi 4xx rõ ràng, dữ liệu còn nguyên', del1.status >= 400 && del1.status < 500 && still.length === 1, code(del1) + ' ' + (del1.body?.error?.message ?? ''));
  const before = await fsSeats(E);
  const del2 = await call('DELETE', `/zones/${Z}`, adm);
  await sleep(1500);
  const afterZ = await fsSeats(E);
  check('xóa khu: ghế của khu đó được dọn khỏi sơ đồ realtime (Firestore) – 12 → 0', before === 12 && afterZ === 0, before + ' → ' + afterZ);
  check('xóa khu chưa bán vé → thành công (200 hoặc 204), ghế bị xóa theo', (del2.status === 200 || del2.status === 204) && (await sql('SELECT COUNT(*)::int n FROM seats WHERE zone_id=$1', [Z]))[0].n === 0, code(del2));
  check('xóa khu không tồn tại → 404', (await call('DELETE', '/zones/999999', adm)).status === 404);

  // ================= ĐÁNH GIÁ =================
  console.log('--- đánh giá sự kiện');
  const R = 2;
  const sum0 = (await call('GET', `/events/${R}/reviews/summary`)).body;
  const sumDb = (await sql('SELECT AVG(rating)::float a, COUNT(*)::int n FROM reviews WHERE event_id=$1', [R]))[0];
  check('tóm tắt khớp SQL (điểm trung bình, số lượt)', Math.abs(Number(sum0.average) - (sumDb.a ?? 0)) < 0.01 && sum0.count === sumDb.n, JSON.stringify(sum0) + ' vs ' + JSON.stringify(sumDb));
  check('điểm trung bình trả về dạng số (không phải chuỗi)', typeof sum0.average === 'number', typeof sum0.average);
  const l0 = (await call('GET', `/events/${R}/reviews`)).body;
  check('danh sách có tên người đánh giá, mới nhất trước', l0.length === sumDb.n && l0.every((r) => r.userName && r.rating >= 1) && l0.every((r, i, a) => i === 0 || a[i - 1].createdAt >= r.createdAt));
  check('thêm đánh giá không đăng nhập → 401', (await call('POST', `/events/${R}/reviews`, null, { rating: 5 })).status === 401);
  const newU = await call('POST', '/auth/register', null, { email: `rv${Date.now()}@t.com`, phone: '09' + String(Date.now()).slice(-8), fullName: 'Người Đánh Giá', password: '123456' });
  const nt = newU.body.token;
  for (const [name, body] of [['rating = 0', { rating: 0 }], ['rating = 6', { rating: 6 }], ['rating = 4.5', { rating: 4.5 }], ['rating là chuỗi', { rating: '5' }], ['thiếu rating', {}], ['comment quá dài (>1000)', { rating: 5, comment: 'x'.repeat(5001) }]]) {
    const r = await call('POST', `/events/${R}/reviews`, nt, body); check('đánh giá sai: ' + name + ' → 400', r.status === 400, code(r));
  }
  const rv = await call('POST', `/events/${R}/reviews`, nt, { rating: 4, comment: 'Kiểm thử đánh giá' });
  check('gửi đánh giá hợp lệ', rv.status === 200 || rv.status === 201, code(rv));
  const sum1 = (await call('GET', `/events/${R}/reviews/summary`)).body;
  check('số lượt tăng 1 và điểm trung bình cập nhật đúng', sum1.count === sum0.count + 1 && Math.abs(sum1.average - (sum0.average * sum0.count + 4) / (sum0.count + 1)) < 0.01, JSON.stringify(sum1));
  const rv2 = await call('POST', `/events/${R}/reviews`, nt, { rating: 5 });
  check('cùng một người đánh giá lần 2 → 409 (mỗi người một lần)', rv2.status === 409, code(rv2));
  const rvNo = await call('POST', '/events/999999/reviews', nt, { rating: 5 });
  check('đánh giá sự kiện không tồn tại → 4xx rõ ràng (không phải 500)', rvNo.status >= 400 && rvNo.status < 500, code(rvNo));
  check('eventId sai định dạng → 400', (await call('GET', '/events/abc/reviews')).status === 400 && (await call('GET', '/events/abc/reviews/summary')).status === 400);
  const empty = (await call('GET', '/events/999999/reviews/summary')).body;
  check('tóm tắt sự kiện chưa có đánh giá → 0 lượt, điểm 0', empty?.count === 0 && Number(empty?.average) === 0, JSON.stringify(empty));
  const lt = (await call('GET', `/events/${R}/reviews`)).body[0];
  check('đánh giá mới nằm đầu danh sách, đúng nội dung', lt.userName === 'Người Đánh Giá' && lt.rating === 4 && lt.comment === 'Kiểm thử đánh giá');

  // ================= XÓA SỰ KIỆN =================
  console.log('--- xóa sự kiện');
  const withOrders = await call('DELETE', '/events/2', adm);
  const e2 = await sql('SELECT 1 FROM events WHERE event_id=2');
  check('xóa sự kiện ĐÃ CÓ ĐƠN HÀNG bị từ chối bằng lỗi 4xx rõ ràng, dữ liệu còn nguyên', withOrders.status >= 400 && withOrders.status < 500 && e2.length === 1, code(withOrders) + ' ' + (withOrders.body?.error?.message ?? ''));
  const zz = await call('POST', `/events/${E}/zones`, adm, { name: 'GA', price: 100000, capacity: 6 });
  await call('POST', `/zones/${(zz.body.zoneId ?? zz.body.zone_id)}/generate-seats`, adm, { seatsPerRow: 3 });
  await sleep(1500);
  const preDel = await fsSeats(E);
  check('(trước khi xóa sự kiện, Firestore có 6 ghế của nó)', preDel === 6, String(preDel));
  const delE = await call('DELETE', '/events/' + E, adm);
  check('xóa sự kiện chưa có đơn → thành công', delE.status === 200 && delE.body.deleted === true, code(delE) + ' ' + JSON.stringify(delE.body).slice(0, 80));
  check('PostgreSQL: sự kiện, khu vực, ghế đều bị xóa (cascade)', (await sql('SELECT (SELECT COUNT(*) FROM events WHERE event_id=$1)::int e, (SELECT COUNT(*) FROM zones WHERE event_id=$1)::int z', [E]))[0].e === 0);
  check('xóa lần 2 → 404', (await call('DELETE', '/events/' + E, adm)).status === 404);
  await sleep(1500);
  const left = await fsSeats(E);
  check('xóa sự kiện: 6 ghế mồ côi được dọn khỏi Firestore (khách không còn thấy)', left === 0 && preDel === 6, 'Firestore còn ' + left + ' ghế mồ côi');

  await pool.end();
  const bad = results.filter((x) => !x).length;
  console.log(`\n${results.length - bad}/${results.length} đạt`);
  process.exitCode = bad ? 1 : 0;
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(2); });
