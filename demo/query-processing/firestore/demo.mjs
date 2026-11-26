// Demo Query processing phía Firestore (mục 3.3), chạy trực tiếp trên Firestore Emulator và đối chiếu với PostgreSQL.
// Đếm theo cách Firestore tính phí: mỗi document trả về = 1 lượt đọc (truy vấn rỗng vẫn tính 1);
// truy vấn gộp count()/sum() tính 1 lượt đọc cho mỗi 1.000 mục chỉ mục khớp (tối thiểu 1).
// Thời gian đo trên emulator KHÔNG đại diện cho dịch vụ thật, chỉ để tham khảo.
//
//   node demo.mjs tn1            chọn theo điều kiện (mã QR, lọc khoảng nhiều dòng)
//   node demo.mjs tn2            "Vé của tôi": chuẩn hóa (ứng dụng tự kết) vs phi chuẩn hóa
//   node demo.mjs tn3 [sự kiện] [cách]   doanh thu theo khu, ví dụ: tn3 1 ABCD   |  tn3 5 BCD
//   node demo.mjs tn4            phát hiện gom vé (truy vấn lồng) ở sự kiện 5
//   node demo.mjs cap            những gì truy vấn Firestore làm được / không làm được
import { AggregateField, Filter } from 'firebase-admin/firestore';
import { db, C, pgClient } from './common.mjs';

const VALID = ['VALID', 'CHECKED_IN'];
const chunks = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
const fmt = (x) => (typeof x === 'number' ? x.toLocaleString('vi-VN') : x);

function meter() {
  const m = { reads: 0, calls: 0 };
  m.query = async (q) => { const s = await q.get(); m.calls++; m.reads += Math.max(1, s.size); return s; };
  m.getAll = async (refs) => { if (!refs.length) return []; const r = await db.getAll(...refs); m.calls++; m.reads += r.length; return r; };
  m.aggregate = async (q, spec, matched) => { const r = await q.aggregate(spec).get(); m.calls++; m.reads += Math.max(1, Math.ceil(matched / 1000)); return r.data(); };
  return m;
}
async function timed(fn) { const t0 = performance.now(); const r = await fn(); return { ...r, ms: +(performance.now() - t0).toFixed(1) }; }
const pgMs = async (pg, sql, params = []) => {
  const t = [];
  for (let i = 0; i < 4; i++) t.push((await pg.query('EXPLAIN (ANALYZE, TIMING OFF, FORMAT JSON) ' + sql, params)).rows[0]['QUERY PLAN'][0]['Execution Time']);
  t.shift(); t.sort((a, b) => a - b); return +t[1].toFixed(2);
};

const pg = await pgClient();
const loaded = (await C('events').get()).docs.map((d) => Number(d.id)).sort((a, b) => a - b);
if (!loaded.length) { console.error('Chưa có dữ liệu trên emulator. Chạy: node load.mjs'); process.exit(1); }
const [cmd = 'help', ...rest] = process.argv.slice(2);
console.log(`Sự kiện đã nạp vào emulator: ${loaded.join(', ')}\n`);

// ---------------- TN1 ----------------
async function tn1() {
  console.log('===== TN1a. Tra vé theo mã QR =====');
  const { qr } = (await pg.query(`SELECT t.qr_code AS qr FROM tickets t JOIN orders o USING (order_id)
     WHERE o.event_id = ANY($1) ORDER BY t.ticket_id OFFSET 100 LIMIT 1`, [loaded])).rows[0];
  const m = meter();
  const r = await timed(async () => ({ n: (await m.query(C('ticketsD').where('qrCode', '==', qr))).size }));
  console.table([
    { DBMS: 'PostgreSQL', 'Cách trả lời': 'Index Scan (tickets_qr_code_key)', 'Thời gian (ms)': await pgMs(pg, 'SELECT * FROM tickets WHERE qr_code = $1', [qr]) },
    { DBMS: 'Firestore', 'Cách trả lời': `chỉ mục đơn trường tự tạo, ${r.n} kết quả`, 'Lượt đọc': m.reads, 'Lượt gọi': m.calls, 'Thời gian (ms)': r.ms },
  ]);

  console.log('\n===== TN1b. Lọc đơn theo createdAt – tỉ lệ dòng thỏa tăng dần =====');
  const total = Number((await pg.query('SELECT count(*) FROM orders WHERE event_id = ANY($1)', [loaded])).rows[0].count);
  const rows = [];
  for (const pct of [1, 30, 100]) {
    const { cut } = (await pg.query(`SELECT percentile_disc($2::float) WITHIN GROUP (ORDER BY created_at) AS cut FROM orders WHERE event_id = ANY($1)`, [loaded, 1 - pct / 100])).rows[0];
    const m1 = meter();
    const r1 = await timed(async () => ({ n: (await m1.query(C('orders').where('createdAt', '>=', cut))).size }));
    const m2 = meter();
    await m2.aggregate(C('orders').where('createdAt', '>=', cut), { c: AggregateField.count() }, r1.n);
    rows.push({ 'Tỉ lệ': pct + '%', 'Số đơn': fmt(r1.n), 'Lấy document: lượt đọc': fmt(m1.reads), 'Chỉ count(): lượt đọc': m2.reads, 'Thời gian (ms)': r1.ms });
  }
  console.table(rows);
  console.log(`Tổng ${fmt(total)} đơn của các sự kiện đã nạp. Firestore luôn quét chỉ mục và tính phí theo số kết quả; so với PostgreSQL tự đổi Bitmap Heap Scan -> Seq Scan ở tn1_chon.sql.`);
  console.log('Lưu ý: emulator KHÔNG bắt buộc chỉ mục phức hợp, nên trường hợp "thiếu chỉ mục bị từ chối" chỉ thấy được trên Firestore thật.');
}

// ---------------- TN2 ----------------
async function tn2() {
  console.log('===== TN2. "Vé của tôi" =====');
  const { uid } = (await pg.query(`SELECT o.user_id AS uid FROM orders o JOIN tickets t USING (order_id)
     WHERE o.event_id = ANY($1) AND o.status = 'PAID' GROUP BY o.user_id ORDER BY count(*) DESC, o.user_id LIMIT 1`, [loaded])).rows[0];
  const sql = `SELECT e.title, z.name, s.row_label || s.seat_no AS seat, t.qr_code FROM orders o JOIN tickets t ON t.order_id = o.order_id
     JOIN seats s ON s.seat_id = t.seat_id JOIN zones z ON z.zone_id = s.zone_id JOIN events e ON e.event_id = z.event_id
     WHERE o.user_id = $1 AND o.status = 'PAID' AND e.event_id = ANY($2)`;
  const sqlRows = (await pg.query(sql, [uid, loaded])).rowCount;

  const mN = meter();
  const norm = await timed(async () => {
    const os = await mN.query(C('orders').where('userId', '==', String(uid)).where('status', '==', 'PAID'));
    const tickets = [];
    for (const c of chunks(os.docs.map((d) => d.id), 30)) (await mN.query(C('tickets').where('orderId', 'in', c))).forEach((t) => tickets.push(t));
    const seats = await mN.getAll(tickets.map((t) => C('seats').doc(t.get('seatId'))));
    const zones = await mN.getAll([...new Set(seats.map((s) => s.get('zoneId')))].map((id) => C('zones').doc(id)));
    await mN.getAll([...new Set(zones.map((z) => z.get('eventId')))].map((id) => C('events').doc(id)));
    return { n: tickets.length };
  });
  const mD = meter();
  const den = await timed(async () => ({ n: (await mD.query(C('ticketsD').where('userId', '==', String(uid)).where('status', 'in', VALID))).size }));
  console.log(`user_id = ${uid}`);
  console.table([
    { 'Cách làm': 'PostgreSQL: 1 câu SQL kết 5 bảng', 'Số vé': sqlRows, 'Lượt gọi': 1, 'Thời gian (ms)': await pgMs(pg, sql, [uid, loaded]) },
    { 'Cách làm': 'Firestore chuẩn hóa: ứng dụng tự kết 5 bước', 'Số vé': norm.n, 'Lượt đọc': mN.reads, 'Lượt gọi': mN.calls, 'Thời gian (ms)': norm.ms },
    { 'Cách làm': 'Firestore phi chuẩn hóa: 1 truy vấn', 'Số vé': den.n, 'Lượt đọc': mD.reads, 'Lượt gọi': mD.calls, 'Thời gian (ms)': den.ms },
  ]);
}

// ---------------- TN3 ----------------
const ZONES = ['VIP', 'CAT1', 'CAT2', 'GA'];
const approaches = {
  A: ['A. Chuẩn hóa, ứng dụng tự kết khu → ghế → vé', async (eventId) => {
    const m = meter(); const res = {};
    const zs = await m.query(C('zones').where('eventId', '==', String(eventId)));
    for (const z of zs.docs) {
      const seats = await m.query(C('seats').where('zoneId', '==', z.id));
      let count = 0, revenue = 0;
      for (const c of chunks(seats.docs.map((d) => d.id), 30)) {
        (await m.query(C('tickets').where('seatId', 'in', c))).forEach((t) => { if (VALID.includes(t.get('status'))) { count++; revenue += t.get('price'); } });
      }
      res[z.get('name')] = { count, revenue };
    }
    return { res, m };
  }],
  B: ['B. Phi chuẩn hóa, đọc hết vé rồi cộng ở ứng dụng', async (eventId) => {
    const m = meter(); const res = {};
    (await m.query(C('ticketsD').where('eventId', '==', String(eventId)).where('status', 'in', VALID))).forEach((t) => {
      const z = (res[t.get('zone')] ??= { count: 0, revenue: 0 }); z.count++; z.revenue += t.get('price');
    });
    return { res, m };
  }],
  C: ['C. Phi chuẩn hóa, mỗi khu một truy vấn count() + sum()', async (eventId, truth) => {
    const m = meter(); const res = {};
    for (const zone of ZONES) {
      const q = C('ticketsD').where('eventId', '==', String(eventId)).where('zone', '==', zone).where('status', 'in', VALID);
      const d = await m.aggregate(q, { count: AggregateField.count(), revenue: AggregateField.sum('price') }, truth[zone]?.count ?? 0);
      res[zone] = { count: d.count, revenue: d.revenue };
    }
    return { res, m };
  }],
  D: ['D. Đọc document tổng hợp duy trì sẵn', async (eventId) => {
    const m = meter();
    const [d] = await m.getAll([C('eventStats').doc(String(eventId))]);
    return { res: d.get('zones'), m };
  }],
};
async function tn3() {
  const events = rest[0] ? rest[0].split(',').map(Number) : loaded;
  const want = (rest[1] ?? 'ABCD').toUpperCase().split('');
  const sql = `SELECT z.name, count(*)::int AS count, sum(t.price)::bigint AS revenue FROM zones z JOIN seats s ON s.zone_id = z.zone_id
    JOIN tickets t ON t.seat_id = s.seat_id WHERE z.event_id = $1 AND t.status <> 'CANCELLED' GROUP BY z.name`;
  for (const eventId of events) {
    if (!loaded.includes(eventId)) { console.log(`Sự kiện ${eventId} chưa nạp vào emulator, bỏ qua.`); continue; }
    const truth = Object.fromEntries((await pg.query(sql, [eventId])).rows.map((r) => [r.name, { count: r.count, revenue: Number(r.revenue) }]));
    const sold = Object.values(truth).reduce((s, z) => s + z.count, 0);
    console.log(`===== TN3. Doanh thu theo khu – sự kiện ${eventId} (${fmt(sold)} vé còn hiệu lực) =====`);
    console.table(Object.fromEntries(Object.entries(truth).map(([k, v]) => [k, { 'Số vé': v.count, 'Doanh thu': fmt(v.revenue) }])));
    const rows = [{ 'Cách làm': 'PostgreSQL: 1 câu SQL JOIN + GROUP BY', 'Lượt gọi': 1, 'Khớp': 'đáp án', 'Thời gian (ms)': await pgMs(pg, sql, [eventId]) }];
    for (const k of want) {
      if (k === 'A' && sold > 5000 && !process.argv.includes('--force')) {
        rows.push({ 'Cách làm': approaches.A[0], 'Lượt đọc': 'bỏ qua', 'Khớp': 'quá chậm trên emulator (thêm --force để chạy)' });
        continue;
      }
      const r = await timed(() => approaches[k][1](eventId, truth));
      const same = ZONES.every((z) => r.res[z]?.count === truth[z]?.count && r.res[z]?.revenue === truth[z]?.revenue);
      rows.push({ 'Cách làm': approaches[k][0], 'Lượt đọc': fmt(r.m.reads), 'Lượt gọi': r.m.calls, 'Khớp': same ? 'Đúng' : 'SAI', 'Thời gian (ms)': r.ms });
    }
    console.table(rows);
  }
  console.log('Cách D rẻ nhất khi đọc nhưng mọi giao dịch bán/hủy vé phải cập nhật thêm document tổng hợp (điểm nóng khi mở bán).');
}

// ---------------- TN4 ----------------
async function tn4() {
  const eventId = loaded.includes(5) ? 5 : loaded.at(-1);
  console.log(`===== TN4. Phát hiện gom vé – sự kiện ${eventId} =====`);
  const sql = `SELECT u.phone, count(DISTINCT u.user_id) acc, count(t.ticket_id) n FROM users u JOIN orders o ON o.user_id = u.user_id AND o.status = 'PAID'
     JOIN tickets t ON t.order_id = o.order_id WHERE o.event_id = $1 AND u.phone IN (SELECT phone FROM users GROUP BY phone HAVING count(*) > 1)
     GROUP BY u.phone HAVING count(t.ticket_id) > 4 ORDER BY n DESC`;
  const sqlRows = (await pg.query(sql, [eventId])).rows;
  const m = meter();
  const r = await timed(async () => {
    const perUser = {};
    (await m.query(C('ticketsD').where('eventId', '==', String(eventId)).where('status', 'in', VALID))).forEach((t) => { perUser[t.get('userId')] = (perUser[t.get('userId')] || 0) + 1; });
    const users = [];
    for (const c of chunks(Object.keys(perUser), 100)) users.push(...(await m.getAll(c.map((id) => C('users').doc(id)))));
    const byPhone = {};
    users.forEach((u) => { const p = (byPhone[u.get('phone')] ??= { accounts: 0, tickets: 0 }); p.accounts++; p.tickets += perUser[u.id]; });
    return { flagged: Object.entries(byPhone).filter(([, v]) => v.accounts > 1 && v.tickets > 4) };
  });
  // Ghi chú: "nhiều tài khoản" ở Firestore chỉ xét người đã mua vé sự kiện này; SQL xét trên toàn bộ users nhưng kết quả trùng nhau.
  console.table([
    { 'Cách làm': 'PostgreSQL: 1 câu SQL có truy vấn con', 'Số điện thoại bị gắn cờ': sqlRows.length, 'Lượt gọi': 1, 'Thời gian (ms)': await pgMs(pg, sql, [eventId]) },
    { 'Cách làm': 'Firestore: đọc hết vé + hồ sơ người mua, tự gom nhóm', 'Số điện thoại bị gắn cờ': r.flagged.length, 'Lượt đọc': fmt(m.reads), 'Lượt gọi': m.calls, 'Thời gian (ms)': r.ms },
  ]);
}

// ---------------- Khả năng diễn đạt ----------------
async function cap() {
  const T = C('ticketsD'); const e = String(loaded.at(-1)); const out = [];
  const tryq = async (name, fn) => { try { out.push({ 'Truy vấn': name, 'Kết quả': 'Chạy được', 'Chi tiết': JSON.stringify(await fn()) }); }
    catch (err) { out.push({ 'Truy vấn': name, 'Kết quả': 'KHÔNG', 'Chi tiết': String(err.message).split('\n')[0].slice(0, 90) }); } };
  await tryq('Lọc == trên 2 trường', async () => (await T.where('eventId', '==', e).where('zone', '==', 'VIP').limit(5).get()).size);
  await tryq('OR (Filter.or)', async () => (await T.where(Filter.or(Filter.where('zone', '==', 'VIP'), Filter.where('price', '<', 600000))).limit(5).get()).size);
  await tryq('in với 30 giá trị', async () => (await T.where('userId', 'in', Array.from({ length: 30 }, (_, i) => String(i + 1))).limit(5).get()).size);
  await tryq('in với 31 giá trị', async () => (await T.where('userId', 'in', Array.from({ length: 31 }, (_, i) => String(i + 1))).limit(5).get()).size);
  await tryq('Sắp xếp + giới hạn', async () => (await T.where('eventId', '==', e).orderBy('price', 'desc').limit(5).get()).size);
  await tryq('count() + sum() + average() trên server', async () => (await T.where('eventId', '==', e).aggregate({ c: AggregateField.count(), s: AggregateField.sum('price'), a: AggregateField.average('price') }).get()).data());
  for (const x of ['GROUP BY', 'JOIN giữa 2 collection', 'Truy vấn lồng (subquery)']) out.push({ 'Truy vấn': x, 'Kết quả': 'KHÔNG', 'Chi tiết': 'Không có trong API truy vấn của Firestore Standard' });
  console.table(out);
}

const cmds = { tn1, tn2, tn3, tn4, cap };
if (!cmds[cmd]) console.log('Dùng: node demo.mjs tn1 | tn2 | tn3 [sự kiện] [ABCD] | tn4 | cap');
else await cmds[cmd]();
await pg.end();
process.exit(0);
