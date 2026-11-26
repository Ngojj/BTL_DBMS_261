// Mục 3.5 – Concurrency control trên PostgreSQL. Chạy đồng thời thật bằng nhiều kết nối (pool), không qua trang DBMS Lab.
//   node pg.mjs setup            tạo database ticketrush_cc và các bảng thí nghiệm (chạy 1 lần)
//   node pg.mjs tn1 [--n=500 --seats=50 --think=5 --pool=50]   Giờ G: N người giành M ghế, 6 cách làm
//   node pg.mjs tn2 [--k=100 --trials=20]                       Dị thường theo mức cô lập: lost update, write skew (giới hạn 4 vé)
//   node pg.mjs tn3 [--trials=10]                               Deadlock khi khóa ghế ngược thứ tự
//   node pg.mjs tn4 [--n=200 --think=5]                         Điểm nóng: khóa dòng events / dòng tổng hợp chung
//   node pg.mjs all                                             chạy lần lượt tn1 → tn4
import pg from 'pg';
import { args, cmd, newPool, pgConfig, PG_DB, sleep, now, fmt, pct, median, barrier, table } from './common.mjs';

const THINK = args.think ?? 5; // ms "suy nghĩ" giữa lúc đọc và lúc ghi – mô phỏng logic ứng dụng / một vòng mạng

// ======================= setup =======================
const SCHEMA = `
DROP TABLE IF EXISTS cc_sales, cc_sales_u, cc_seats, cc_tickets, cc_users, cc_events, cc_counters CASCADE;
-- Bản rút gọn của seats / tickets / users / events trong database/schema.sql, đủ cột để thấy hành vi đồng thời
CREATE TABLE cc_events  (event_id INT PRIMARY KEY, title TEXT NOT NULL, max_tickets_per_user INT NOT NULL DEFAULT 4);
CREATE TABLE cc_users   (user_id INT PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE cc_seats   (seat_id INT PRIMARY KEY, event_id INT NOT NULL REFERENCES cc_events,
                         status TEXT NOT NULL DEFAULT 'AVAILABLE', holder INT, version INT NOT NULL DEFAULT 0);
-- cc_sales: KHÔNG có UNIQUE trên seat_id, để thấy bán trùng khi không kiểm soát đồng thời
CREATE TABLE cc_sales   (sale_id SERIAL PRIMARY KEY, seat_id INT NOT NULL, user_id INT NOT NULL);
-- cc_sales_u: có UNIQUE(seat_id) – tương đương chỉ mục uq_active_ticket_per_seat của ứng dụng
CREATE TABLE cc_sales_u (sale_id SERIAL PRIMARY KEY, seat_id INT NOT NULL UNIQUE, user_id INT NOT NULL);
CREATE TABLE cc_tickets (ticket_id SERIAL PRIMARY KEY, user_id INT NOT NULL REFERENCES cc_users, event_id INT NOT NULL REFERENCES cc_events,
                         status TEXT NOT NULL DEFAULT 'VALID');
CREATE INDEX ON cc_tickets (user_id, event_id);
CREATE TABLE cc_counters (id TEXT PRIMARY KEY, value INT NOT NULL);
INSERT INTO cc_events VALUES (1, 'Giờ G – sự kiện thử', 4);
INSERT INTO cc_users SELECT g, 'Khách ' || g FROM generate_series(1, 1000) g;
INSERT INTO cc_seats (seat_id, event_id) SELECT g, 1 FROM generate_series(1, 50) g;
`;

async function setup() {
  const admin = new pg.Client(pgConfig('postgres'));
  await admin.connect();
  const exists = (await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [PG_DB])).rowCount;
  if (!exists) await admin.query(`CREATE DATABASE ${PG_DB}`);
  await admin.end();
  const c = new pg.Client(pgConfig());
  await c.connect();
  await c.query(SCHEMA);
  const v = (await c.query('SHOW server_version')).rows[0].server_version;
  const dl = (await c.query('SHOW deadlock_timeout')).rows[0].deadlock_timeout;
  await c.end();
  console.log(`Đã tạo database ${PG_DB} (PostgreSQL ${v}, deadlock_timeout = ${dl}).`);
}

// ======================= tiện ích giao dịch =======================
const RETRYABLE = new Set(['40001', '40P01']);
// Chạy fn trong một giao dịch ở mức cô lập iso; thử lại khi gặp lỗi tuần tự hóa / deadlock (tối đa maxAttempts lần)
async function inTx(pool, iso, fn, { maxAttempts = 1, stats } = {}) {
  for (let attempt = 1; ; attempt++) {
    const c = await pool.connect();
    try {
      await c.query(`BEGIN ISOLATION LEVEL ${iso}`);
      const r = await fn(c);
      await c.query('COMMIT');
      return r;
    } catch (e) {
      await c.query('ROLLBACK').catch(() => {});
      if (stats && e.code) stats.errors[e.code] = (stats.errors[e.code] ?? 0) + 1;
      if (RETRYABLE.has(e.code) && attempt < maxAttempts) { if (stats) stats.retries++; continue; }
      throw e;
    } finally { c.release(); }
  }
}
const newStats = () => ({ retries: 0, conflicts: 0, errors: {} });
const errText = (errors) => Object.entries(errors).map(([k, v]) => `${k}×${v}`).join(', ') || '–';

// ======================= TN1. Giờ G =======================
// Mỗi người mua "ghế tốt nhất còn trống" (seat_id nhỏ nhất) – mọi người cùng nhắm một ghế, tranh chấp cao nhất.
const TN1 = {
  V0: ['Không khóa: đọc ghế trống rồi ghi', 'READ COMMITTED', async (c, uid) => {
    const r = await c.query("SELECT seat_id FROM cc_seats WHERE status = 'AVAILABLE' ORDER BY seat_id LIMIT 1");
    if (!r.rowCount) return 'soldout';
    await sleep(THINK);
    await c.query("UPDATE cc_seats SET status = 'SOLD', holder = $2, version = version + 1 WHERE seat_id = $1", [r.rows[0].seat_id, uid]);
    await c.query('INSERT INTO cc_sales (seat_id, user_id) VALUES ($1, $2)', [r.rows[0].seat_id, uid]);
    return 'ok';
  }],
  V1: ['Không khóa + UNIQUE(seat_id) như uq_active_ticket_per_seat', 'READ COMMITTED', async (c, uid) => {
    const r = await c.query("SELECT seat_id FROM cc_seats WHERE status = 'AVAILABLE' ORDER BY seat_id LIMIT 1");
    if (!r.rowCount) return 'soldout';
    await sleep(THINK);
    await c.query("UPDATE cc_seats SET status = 'SOLD', holder = $2, version = version + 1 WHERE seat_id = $1", [r.rows[0].seat_id, uid]);
    await c.query('INSERT INTO cc_sales_u (seat_id, user_id) VALUES ($1, $2)', [r.rows[0].seat_id, uid]);
    return 'ok';
  }],
  V2: ['Khóa bi quan: SELECT … FOR UPDATE', 'READ COMMITTED', async (c, uid) => {
    const r = await c.query("SELECT seat_id FROM cc_seats WHERE status = 'AVAILABLE' ORDER BY seat_id LIMIT 1 FOR UPDATE");
    if (!r.rowCount) return 'soldout';
    await sleep(THINK);
    await c.query("UPDATE cc_seats SET status = 'SOLD', holder = $2, version = version + 1 WHERE seat_id = $1", [r.rows[0].seat_id, uid]);
    await c.query('INSERT INTO cc_sales (seat_id, user_id) VALUES ($1, $2)', [r.rows[0].seat_id, uid]);
    return 'ok';
  }],
  V3: ['Khóa bi quan, bỏ qua ghế đang bị khóa: FOR UPDATE SKIP LOCKED', 'READ COMMITTED', async (c, uid) => {
    const r = await c.query("SELECT seat_id FROM cc_seats WHERE status = 'AVAILABLE' ORDER BY seat_id LIMIT 1 FOR UPDATE SKIP LOCKED");
    if (!r.rowCount) return 'soldout';
    await sleep(THINK);
    await c.query("UPDATE cc_seats SET status = 'SOLD', holder = $2, version = version + 1 WHERE seat_id = $1", [r.rows[0].seat_id, uid]);
    await c.query('INSERT INTO cc_sales (seat_id, user_id) VALUES ($1, $2)', [r.rows[0].seat_id, uid]);
    return 'ok';
  }],
  V4: ['Khóa lạc quan: cột version, UPDATE … WHERE version = v, thử lại', 'READ COMMITTED', null],
  V5: ['SERIALIZABLE (SSI), không khóa, thử lại khi lỗi 40001', 'SERIALIZABLE', null],
};

async function optimisticBuy(pool, uid, stats) {
  for (let attempt = 1; attempt <= 30; attempt++) {
    const r = await pool.query("SELECT seat_id, version FROM cc_seats WHERE status = 'AVAILABLE' ORDER BY seat_id LIMIT 1");
    if (!r.rowCount) return 'soldout';
    await sleep(THINK);
    const ok = await inTx(pool, 'READ COMMITTED', async (c) => {
      const u = await c.query("UPDATE cc_seats SET status = 'SOLD', holder = $2, version = version + 1 WHERE seat_id = $1 AND version = $3",
        [r.rows[0].seat_id, uid, r.rows[0].version]);
      if (!u.rowCount) return false; // có người ghi trước → xung đột
      await c.query('INSERT INTO cc_sales (seat_id, user_id) VALUES ($1, $2)', [r.rows[0].seat_id, uid]);
      return true;
    });
    if (ok) return 'ok';
    stats.conflicts++; if (attempt > 1) stats.retries++;
  }
  return 'gave_up';
}

async function resetSeats(pool, m) {
  await pool.query('TRUNCATE cc_sales, cc_sales_u RESTART IDENTITY; DELETE FROM cc_seats;');
  await pool.query('INSERT INTO cc_seats (seat_id, event_id) SELECT g, 1 FROM generate_series(1, $1) g', [m]);
}

async function tn1() {
  const N = args.n ?? 500, M = args.seats ?? 50, P = args.pool ?? 50;
  const pool = newPool(P);
  console.log(`===== TN1. Giờ G: ${N} người cùng mua, ${M} ghế, pool ${P} kết nối, "suy nghĩ" ${THINK} ms giữa đọc và ghi =====`);
  const rows = [];
  for (const [key, [label, iso, fn]] of Object.entries(TN1)) {
    if (args.only && !String(args.only).includes(key)) continue;
    await resetSeats(pool, M);
    const stats = newStats(); const lat = []; const out = { ok: 0, soldout: 0, error: 0, gave_up: 0 };
    const t0 = now();
    await Promise.all(Array.from({ length: N }, async (_, i) => {
      const uid = i + 1; const s = now();
      try {
        let r;
        if (key === 'V4') r = await optimisticBuy(pool, uid, stats);
        else r = await inTx(pool, iso, (c) => fn ? fn(c, uid) : TN1.V0[2](c, uid), { maxAttempts: key === 'V5' ? 30 : 1, stats });
        out[r]++;
      } catch (e) { out.error++; if (e.code) stats.errors[e.code] ??= 0; }
      lat.push(now() - s);
    }));
    const ms = now() - t0;
    const f = (await pool.query(`SELECT
        (SELECT count(*) FROM cc_sales) + (SELECT count(*) FROM cc_sales_u) AS sales,
        (SELECT count(DISTINCT seat_id) FROM cc_sales) + (SELECT count(DISTINCT seat_id) FROM cc_sales_u) AS seats_sold,
        (SELECT count(*) FROM cc_seats WHERE status = 'AVAILABLE') AS left,
        (SELECT count(*) FROM cc_sales s JOIN cc_seats t USING (seat_id) WHERE s.user_id <> t.holder) AS lost`)).rows[0];
    rows.push({
      'Cách làm': `${key}. ${label}`,
      'Người mua được': out.ok, 'Vé bán ra': Number(f.sales), 'Ghế đã bán': Number(f.seats_sold),
      'Bán trùng': Number(f.sales) - Number(f.seats_sold), 'Mất cập nhật': Number(f.lost),
      'Báo hết vé': out.soldout, 'Ghế còn trống': Number(f.left), 'Lỗi': out.error + out.gave_up,
      'Xung đột / thử lại': key === 'V4' ? `${stats.conflicts} / ${stats.retries}` : `${stats.retries}`,
      'Mã lỗi PG': errText(stats.errors),
      'Tổng (ms)': Math.round(ms), 'P95 1 người (ms)': Math.round(pct(lat, 95)),
    });
    console.log(`  xong ${key}`);
  }
  table('Kết quả TN1 (đúng: Vé bán ra = Ghế đã bán = số ghế; Bán trùng = Mất cập nhật = 0; Ghế còn trống = 0)', rows);
  await pool.end();
  return rows;
}

// ======================= TN2. Dị thường theo mức cô lập =======================
async function tn2() {
  const K = args.k ?? 100, T = args.trials ?? 20;
  const pool = newPool(50);
  console.log(`===== TN2a. Lost update: ${K} giao dịch cùng trừ 1 vào "số ghế còn lại" (bắt đầu 1.000, đúng phải còn ${1000 - K}) =====`);
  const variants = [
    ['Đọc rồi ghi – READ COMMITTED', 'READ COMMITTED', 'rw'],
    ['Đọc rồi ghi – REPEATABLE READ', 'REPEATABLE READ', 'rw'],
    ['Đọc rồi ghi – SERIALIZABLE', 'SERIALIZABLE', 'rw'],
    ['Đọc FOR UPDATE rồi ghi – READ COMMITTED', 'READ COMMITTED', 'lock'],
    ['Ghi nguyên tử value = value - 1 – READ COMMITTED', 'READ COMMITTED', 'atomic'],
  ];
  const a = [];
  for (const [label, iso, mode] of variants) {
    await pool.query("INSERT INTO cc_counters VALUES ('left', 1000) ON CONFLICT (id) DO UPDATE SET value = 1000");
    const stats = newStats(); let failed = 0; const t0 = now();
    await Promise.all(Array.from({ length: K }, () => inTx(pool, iso, async (c) => {
      if (mode === 'atomic') return c.query("UPDATE cc_counters SET value = value - 1 WHERE id = 'left'");
      const r = await c.query(`SELECT value FROM cc_counters WHERE id = 'left'${mode === 'lock' ? ' FOR UPDATE' : ''}`);
      await sleep(THINK);
      await c.query("UPDATE cc_counters SET value = $1 WHERE id = 'left'", [r.rows[0].value - 1]);
    }, { maxAttempts: 1, stats }).catch(() => { failed++; })));
    const v = (await pool.query("SELECT value FROM cc_counters WHERE id = 'left'")).rows[0].value;
    a.push({ 'Cách làm': label, 'Giá trị cuối': v, 'Đúng': 1000 - K, 'Giao dịch bị hủy': failed,
      'Mã lỗi PG': errText(stats.errors), 'Tổng (ms)': Math.round(now() - t0) });
  }
  // "Cập nhật bị mất" = số giao dịch đã COMMIT nhưng không để lại dấu vết trên giá trị cuối
  a.forEach((r, i) => { a[i] = { 'Cách làm': r['Cách làm'], 'Giá trị cuối': r['Giá trị cuối'], 'Đúng': r['Đúng'], 'Giao dịch bị hủy': r['Giao dịch bị hủy'],
    'Cập nhật bị mất': (K - r['Giao dịch bị hủy']) - (1000 - r['Giá trị cuối']), 'Mã lỗi PG': r['Mã lỗi PG'], 'Tổng (ms)': r['Tổng (ms)'] }; });
  table(`Kết quả TN2a (giao dịch bị hủy là đúng hành vi: ứng dụng phải thử lại)`, a);

  console.log(`\n===== TN2b. Write skew – giới hạn 4 vé/người: khách đã có 3 vé, mở 2 giao dịch cùng lúc, mỗi giao dịch đếm rồi mua thêm 1 (lặp ${T} lần) =====`);
  const vb = [
    ['Đếm rồi thêm – READ COMMITTED', 'READ COMMITTED', false],
    ['Đếm rồi thêm – REPEATABLE READ (snapshot)', 'REPEATABLE READ', false],
    ['Đếm rồi thêm – SERIALIZABLE', 'SERIALIZABLE', false],
    ['Khóa users FOR UPDATE rồi đếm – READ COMMITTED (cách ứng dụng làm)', 'READ COMMITTED', true],
  ];
  const b = [];
  for (const [label, iso, lockUser] of vb) {
    let violated = 0, aborted = 0, blockedMs = []; const stats = newStats();
    for (let t = 0; t < T; t++) {
      await pool.query('TRUNCATE cc_tickets RESTART IDENTITY');
      await pool.query('INSERT INTO cc_tickets (user_id, event_id) SELECT 1, 1 FROM generate_series(1, 3)');
      const meet = barrier(2, 100);
      const buy = () => inTx(pool, iso, async (c) => {
        const s = now();
        if (lockUser) await c.query('SELECT user_id FROM cc_users WHERE user_id = 1 FOR UPDATE');
        const n = Number((await c.query("SELECT count(*) FROM cc_tickets WHERE user_id = 1 AND event_id = 1 AND status <> 'CANCELLED'")).rows[0].count);
        blockedMs.push(now() - s);
        await meet(); // cả hai cùng đã đếm xong rồi mới ghi
        if (n + 1 > 4) return 'refused';
        await c.query('INSERT INTO cc_tickets (user_id, event_id) VALUES (1, 1)');
        return 'bought';
      }, { stats });
      const res = await Promise.allSettled([buy(), buy()]);
      aborted += res.filter((r) => r.status === 'rejected').length;
      const cnt = Number((await pool.query("SELECT count(*) FROM cc_tickets WHERE user_id = 1 AND status <> 'CANCELLED'")).rows[0].count);
      if (cnt > 4) violated++;
    }
    b.push({ 'Cách làm': label, 'Số lần thử': T, 'Lần vượt 4 vé': violated, 'Giao dịch bị hủy': aborted,
      'Mã lỗi PG': errText(stats.errors), 'Chờ khóa lâu nhất (ms)': Math.round(Math.max(...blockedMs)) });
  }
  table('Kết quả TN2b (đúng: Lần vượt 4 vé = 0)', b);
  await pool.end();
  return { a, b };
}

// ======================= TN3. Deadlock =======================
async function tn3() {
  const T = args.trials ?? 10;
  const pool = newPool(10);
  await resetSeats(pool, 10);
  console.log(`===== TN3. Hai khách cùng mua ghế 1 và 2; khách A khóa 1 → 2, khách B khóa 2 → 1 (lặp ${T} lần) =====`);
  const rows = [];
  for (const [label, sorted] of [['Khóa theo thứ tự khách chọn (ngược nhau)', false], ['Sắp xếp seat_id trước khi khóa (cách ứng dụng làm)', true]]) {
    let deadlocks = 0, ok = 0; const times = []; const stats = newStats();
    for (let t = 0; t < T; t++) {
      const meet = barrier(2, 100);
      const buyer = (order) => inTx(pool, 'READ COMMITTED', async (c) => {
        const seq = sorted ? [...order].sort((x, y) => x - y) : order;
        await c.query('SELECT 1 FROM cc_seats WHERE seat_id = $1 FOR UPDATE', [seq[0]]);
        await meet();
        await c.query('SELECT 1 FROM cc_seats WHERE seat_id = $1 FOR UPDATE', [seq[1]]);
        await sleep(THINK);
      }, { stats });
      const s = now();
      const res = await Promise.allSettled([buyer([1, 2]), buyer([2, 1])]);
      times.push(now() - s);
      ok += res.filter((r) => r.status === 'fulfilled').length;
      deadlocks += res.filter((r) => r.status === 'rejected' && r.reason.code === '40P01').length;
    }
    rows.push({ 'Cách làm': label, 'Số lần thử': T, 'Giao dịch thành công': ok, 'Bị hủy vì deadlock': deadlocks,
      'Mã lỗi PG': errText(stats.errors), 'Thời gian 1 lượt – trung vị (ms)': Math.round(median(times)) });
  }
  table('Kết quả TN3 (lượt có deadlock ≈ deadlock_timeout = 1 s vì PostgreSQL chờ 1 s rồi mới dò chu trình; lượt không deadlock gồm ~100 ms rào chắn của script)', rows);
  await pool.end();
  return rows;
}

// ======================= TN4. Điểm nóng =======================
async function tn4() {
  const N = args.n ?? 200;
  const pool = newPool(50);
  console.log(`===== TN4. ${N} người mua ${N} ghế KHÁC NHAU cùng lúc (không tranh ghế), mỗi giao dịch giữ khóa ~${THINK} ms =====`);
  const variants = [
    ['Chỉ khóa ghế của mình', false, false],
    ['Khóa dòng events FOR UPDATE trước (như createOrder hiện tại)', 'UPDATE', false],
    ['Khóa dòng events FOR SHARE trước (đề xuất)', 'SHARE', false],
    ['Chỉ khóa ghế + cập nhật dòng tổng hợp "số ghế còn lại" ở CUỐI giao dịch', false, 'end'],
    ['Chỉ khóa ghế + cập nhật dòng tổng hợp ở ĐẦU giao dịch', false, 'start'],
  ];
  const rows = [];
  for (const [label, lockEvent, counter] of variants) {
    await resetSeats(pool, N);
    await pool.query("INSERT INTO cc_counters VALUES ('left', $1) ON CONFLICT (id) DO UPDATE SET value = $1", [N]);
    const lat = []; const t0 = now();
    await Promise.all(Array.from({ length: N }, (_, i) => (async () => {
      const s = now();
      await inTx(pool, 'READ COMMITTED', async (c) => {
        if (lockEvent) await c.query(`SELECT 1 FROM cc_events WHERE event_id = 1 FOR ${lockEvent}`);
        if (counter === 'start') await c.query("UPDATE cc_counters SET value = value - 1 WHERE id = 'left'");
        await c.query('SELECT 1 FROM cc_seats WHERE seat_id = $1 FOR UPDATE', [i + 1]);
        await sleep(THINK);
        await c.query("UPDATE cc_seats SET status = 'SOLD', holder = $1 WHERE seat_id = $1", [i + 1]);
        if (counter === 'end') await c.query("UPDATE cc_counters SET value = value - 1 WHERE id = 'left'");
      });
      lat.push(now() - s);
    })()));
    const ms = now() - t0;
    rows.push({ 'Cách làm': label, 'Tổng (ms)': Math.round(ms), 'Giao dịch/giây': Math.round(N / (ms / 1000)),
      'Trung vị 1 người (ms)': Math.round(median(lat)), 'P95 1 người (ms)': Math.round(pct(lat, 95)) });
  }
  table('Kết quả TN4 (pool 50 kết nối: nếu không có điểm nóng, tổng ≈ N/50 × thời gian 1 giao dịch)', rows);
  await pool.end();
  return rows;
}

const cmds = { setup, tn1, tn2, tn3, tn4, all: async () => { await tn1(); await tn2(); await tn3(); await tn4(); } };
if (!cmds[cmd]) console.log('Dùng: node pg.mjs setup | tn1 | tn2 | tn3 | tn4 | all   (tham số: --n= --seats= --think= --pool= --k= --trials=)');
else {
  try { await cmds[cmd](); }
  catch (e) {
    if (e.code === '3D000') console.error(`Chưa có database ${PG_DB}. Chạy: node pg.mjs setup`);
    else if (e.code === 'ECONNREFUSED') console.error('Không kết nối được PostgreSQL ở localhost:5433. Bật container: npm run db:up (ở thư mục gốc)');
    else throw e;
    process.exitCode = 1;
  }
}
