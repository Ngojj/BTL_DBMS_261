// [seed] Sinh dữ liệu mẫu cho CẢ PostgreSQL và Firestore. Phụ trách: TV2
//
//   node scripts/seed.js                 # xóa sạch rồi sinh lại PostgreSQL, sau đó đồng bộ Firestore
//   node scripts/seed.js --users 500     # số khách hàng (mặc định 300)
//   node scripts/seed.js --seed 7        # đổi hạt giống ngẫu nhiên (cùng seed → cùng dữ liệu)
//   node scripts/seed.js --pg-only       # chỉ PostgreSQL
//   node scripts/seed.js --fs-only       # chỉ dựng lại Firestore từ dữ liệu PostgreSQL hiện có
//
// Cần backend/.env, PostgreSQL và (nếu ghi Firestore) Firestore Emulator đang chạy.
// CẢNH BÁO: mặc định TRUNCATE toàn bộ 10 bảng và xóa events/, validTickets/, notifications/ trong Firestore.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// ---------- Nạp cấu hình từ backend (script không có node_modules riêng) ----------
const backendDir = fileURLToPath(new URL('../backend/', import.meta.url));
process.loadEnvFile(backendDir + '.env');
const requireBackend = createRequire(backendDir + 'package.json');
const bcrypt = requireBackend('bcrypt');
const { pool, withTransaction } = await import('../backend/src/config/pg.js');
const { firestore } = await import('../backend/src/config/firebase.js');

// ---------- Tham số ----------
const argv = process.argv.slice(2);
const arg = (name, def) => {
  const i = argv.indexOf('--' + name);
  return i === -1 ? def : argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true;
};
const N_CUSTOMERS = Number(arg('users', 300));
const SEED = Number(arg('seed', 42));
const PG_ONLY = argv.includes('--pg-only');
const FS_ONLY = argv.includes('--fs-only');

// ---------- Tiện ích ----------
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (a, b) => a + rand() * (b - a);
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');
const iso = (s) => new Date(s + '+07:00');
const NOW = new Date();

const HO = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý'];
const DEM = ['Văn', 'Minh', 'Quang', 'Hữu', 'Đức', 'Thanh', 'Ngọc', 'Thị', 'Thu', 'Hồng', 'Anh', 'Gia', 'Bảo', 'Khánh'];
const TEN = ['An', 'Bình', 'Cường', 'Dũng', 'Hà', 'Hải', 'Hiếu', 'Hoa', 'Hùng', 'Lan', 'Linh', 'Long', 'Mai', 'Nam', 'Nhung', 'Phúc', 'Phương', 'Quân', 'Sơn', 'Thảo', 'Trang', 'Tuấn', 'Vy', 'Yến'];
const COMMENTS = [
  'Âm thanh ánh sáng rất tốt, rất đáng tiền.', 'Tổ chức chuyên nghiệp, soát vé nhanh.', 'Ghế nhìn rõ sân khấu, sẽ đi tiếp.',
  'Hơi đông lúc vào cổng nhưng show tuyệt vời.', 'Nghệ sĩ nhiệt tình, khán giả cuồng nhiệt.', 'Giá hơi cao nhưng chất lượng xứng đáng.',
  'Đặt vé dễ, không bị trùng ghế.', 'Mã QR quét một lần là vào.',
];

// ---------- Dữ liệu tĩnh ----------
const GENRES = ['Pop', 'Rock', 'EDM', 'Indie', 'Acoustic'];
const VENUES = [
  ['Nhà thi đấu Phú Thọ', 'TP. HCM', '1 Lý Thường Kiệt, Q.11'],
  ['SVĐ Quân khu 7', 'TP. HCM', '202 Hoàng Văn Thụ, Q.Phú Nhuận'],
  ['Công viên bờ sông', 'Đà Nẵng', 'Đường Trần Hưng Đạo, Q.Sơn Trà'],
  ['Nhà hát Hòa Bình', 'TP. HCM', '240 Ba Tháng Hai, Q.10'],
  ['SVĐ Mỹ Đình', 'Hà Nội', 'Đường Lê Đức Thọ, Nam Từ Liêm'],
  ['Nhà hát Lớn', 'Hà Nội', '1 Tràng Tiền, Hoàn Kiếm'],
];
// [tiêu đề, thể loại, địa điểm, ngày diễn, mở bán, giá thấp nhất, trạng thái]
const EVENTS = [
  ['Concert Pop Mùa Thu', 'Pop', 0, '2026-11-15T19:30:00', '2026-11-01T10:00:00', 800000, 'ON_SALE'],
  ['Đêm nhạc Rock Quân khu 7', 'Rock', 1, '2026-11-22T19:00:00', '2026-09-15T10:00:00', 650000, 'ON_SALE'],
  ['Lễ hội EDM Bên Sông', 'EDM', 2, '2026-11-29T17:00:00', '2026-09-20T10:00:00', 1200000, 'ON_SALE'],
  ['Show Indie Hòa Bình', 'Indie', 3, '2026-12-06T20:00:00', '2026-11-01T10:00:00', 450000, 'ON_SALE'],
  ['Concert Cuối Năm', 'Pop', 4, '2026-12-20T19:00:00', '2026-11-01T10:00:00', 1500000, 'ON_SALE'],
  ['Đêm Acoustic Nhà Hát Lớn', 'Acoustic', 5, '2026-12-27T20:00:00', '2026-09-25T10:00:00', 500000, 'ON_SALE'],
  ['Đêm nhạc Tri Ân Mùa Hè', 'Indie', 3, '2026-08-15T19:00:00', '2026-07-20T10:00:00', 450000, 'ENDED'],
];
// Sơ đồ ghế giống mockup: VIP hàng A–C × 16 ghế, CAT 1 hàng D–H × 20 ghế
const ZONE_LAYOUT = [
  { name: 'VIP', rows: ['A', 'B', 'C'], perRow: 16, priceOf: (min) => Math.round((min * 2.3) / 50000) * 50000 },
  { name: 'CAT 1', rows: ['D', 'E', 'F', 'G', 'H'], perRow: 20, priceOf: (min) => min },
];
const METHODS = ['CARD', 'E_WALLET', 'BANK_TRANSFER'];

// =====================================================================
// PostgreSQL
// =====================================================================
async function seedPostgres() {
  console.log('▶ PostgreSQL: xóa dữ liệu cũ và sinh dữ liệu mới…');
  const [hAdmin, hStaff, hCustomer] = await Promise.all(['Admin@123', 'Staff@123', '123456'].map((p) => bcrypt.hash(p, 10)));

  await withTransaction(async (db) => {
    await db.query('TRUNCATE reviews, payments, tickets, orders, seats, zones, events, venues, genres, users RESTART IDENTITY CASCADE');

    // ---------- users ----------
    const users = []; // { email, phone, fullName, hash, role }
    const usedPhones = new Set();
    const newPhone = () => {
      let p;
      do p = '09' + String(Math.floor(rand() * 1e8)).padStart(8, '0');
      while (usedPhones.has(p));
      usedPhones.add(p);
      return p;
    };
    users.push({ email: 'admin@ticketrush.vn', phone: newPhone(), fullName: 'Quản Trị Viên', hash: hAdmin, role: 'ADMIN' });
    users.push({ email: 'staff1@ticketrush.vn', phone: newPhone(), fullName: 'Nhân Viên Soát Vé 1', hash: hStaff, role: 'STAFF' });
    users.push({ email: 'staff2@ticketrush.vn', phone: newPhone(), fullName: 'Nhân Viên Soát Vé 2', hash: hStaff, role: 'STAFF' });
    // Tài khoản demo khớp mockup
    users.push({ email: 'khach@example.com', phone: '0901234567', fullName: 'Nguyễn Văn A', hash: hCustomer, role: 'CUSTOMER' });
    usedPhones.add('0901234567');
    // Đối tượng gom vé (#11): một người mua nhiều sự kiện + ba tài khoản chung số điện thoại
    users.push({ email: 'scalper@example.com', phone: newPhone(), fullName: 'Lê Gom Vé', hash: hCustomer, role: 'CUSTOMER' });
    usedPhones.add('0977123456');
    for (const c of ['a', 'b', 'c'])
      users.push({ email: `acc.${c}@example.com`, phone: '0977123456', fullName: `Trần Tài Khoản ${c.toUpperCase()}`, hash: hCustomer, role: 'CUSTOMER' });
    for (let i = 1; users.length < 9 + N_CUSTOMERS; i++) {
      const fullName = `${pick(HO)} ${pick(DEM)} ${pick(TEN)}`;
      users.push({ email: `${slug(fullName)}.${i}@example.com`, phone: newPhone(), fullName, hash: hCustomer, role: 'CUSTOMER' });
    }
    const ur = await db.query(
      `INSERT INTO users (email, phone, full_name, password_hash, role)
       SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::user_role[])
       RETURNING user_id, email`,
      [users.map((u) => u.email), users.map((u) => u.phone), users.map((u) => u.fullName), users.map((u) => u.hash), users.map((u) => u.role)],
    );
    const idByEmail = Object.fromEntries(ur.rows.map((r) => [r.email, Number(r.user_id)]));
    users.forEach((u) => (u.userId = idByEmail[u.email]));
    const byEmail = (e) => users.find((u) => u.email === e);
    const special = ['scalper@example.com', 'acc.a@example.com', 'acc.b@example.com', 'acc.c@example.com', 'khach@example.com'].map(byEmail);
    const pool_ = users.filter((u) => u.role === 'CUSTOMER' && !special.includes(u));

    // ---------- genres, venues, events, zones, seats ----------
    const gr = await db.query('INSERT INTO genres (name) SELECT unnest($1::text[]) RETURNING genre_id, name', [GENRES]);
    const genreId = Object.fromEntries(gr.rows.map((r) => [r.name, r.genre_id]));
    const vr = await db.query(
      'INSERT INTO venues (name, city, address) SELECT * FROM unnest($1::text[], $2::text[], $3::text[]) RETURNING venue_id',
      [VENUES.map((v) => v[0]), VENUES.map((v) => v[1]), VENUES.map((v) => v[2])],
    );
    const venueIds = vr.rows.map((r) => r.venue_id);

    const events = [];
    for (const [title, genre, venueIdx, date, saleOpen, minPrice, status] of EVENTS) {
      const er = await db.query(
        `INSERT INTO events (title, genre_id, venue_id, event_date, sale_open_at, status)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING event_id`,
        [title, genreId[genre], venueIds[venueIdx], iso(date), iso(saleOpen), status],
      );
      const ev = { eventId: Number(er.rows[0].event_id), title, eventDate: iso(date), saleOpenAt: iso(saleOpen), status, seats: [] };
      for (const z of ZONE_LAYOUT) {
        const price = z.priceOf(minPrice);
        const zr = await db.query(
          'INSERT INTO zones (event_id, name, price, capacity) VALUES ($1, $2, $3, $4) RETURNING zone_id',
          [ev.eventId, z.name, price, z.rows.length * z.perRow],
        );
        const zoneId = Number(zr.rows[0].zone_id);
        const rows = [], nums = [];
        for (const row of z.rows) for (let n = 1; n <= z.perRow; n++) { rows.push(row); nums.push(n); }
        const sr = await db.query(
          `INSERT INTO seats (zone_id, row_label, seat_no)
           SELECT $1, * FROM unnest($2::text[], $3::int[]) RETURNING seat_id, row_label, seat_no`,
          [zoneId, rows, nums],
        );
        for (const s of sr.rows) ev.seats.push({ seatId: Number(s.seat_id), zone: z.name, price, label: s.row_label + s.seat_no });
      }
      events.push(ev);
    }

    // ---------- orders / tickets / payments ----------
    const perUser = new Map(); // "userId:eventId" -> số vé còn hiệu lực
    const stats = { paid: 0, cancelled: 0, expired: 0, tickets: 0, checkedIn: 0 };

    async function placeOrder(ev, user, seats, status) {
      const start = Math.max(ev.saleOpenAt, ev.eventDate - 60 * 24 * 3600e3);
      const end = Math.min(NOW.getTime(), ev.eventDate.getTime() - 3600e3);
      const created = new Date(between(start, Math.max(start, end)));
      const total = seats.reduce((s, x) => s + x.price, 0);
      const or = await db.query(
        `INSERT INTO orders (user_id, event_id, total, status, created_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING order_id`,
        [user.userId, ev.eventId, total, status, created, new Date(created.getTime() + 10 * 60e3)],
      );
      const orderId = or.rows[0].order_id;
      const paidAt = new Date(created.getTime() + between(60e3, 240e3));
      const method = pick(METHODS);

      if (status === 'EXPIRED') {
        if (rand() < 0.5)
          await db.query(`INSERT INTO payments (order_id, amount, method, status) VALUES ($1, $2, $3, 'FAILED')`, [orderId, total, method]);
        stats.expired++;
        return;
      }
      const ended = ev.status === 'ENDED';
      for (const s of seats) {
        const ticketStatus = status === 'CANCELLED' ? 'CANCELLED' : ended && rand() < 0.85 ? 'CHECKED_IN' : 'VALID';
        const checkedAt = ticketStatus === 'CHECKED_IN' ? new Date(ev.eventDate.getTime() - between(5, 60) * 60e3) : null;
        await db.query(
          'INSERT INTO tickets (order_id, seat_id, price, status, checked_in_at) VALUES ($1, $2, $3, $4, $5)',
          [orderId, s.seatId, s.price, ticketStatus, checkedAt],
        );
        if (ticketStatus === 'CHECKED_IN') { stats.checkedIn++; user.checkedInEvents = (user.checkedInEvents ?? new Set()).add(ev.eventId); }
        if (status === 'PAID') stats.tickets++;
      }
      await db.query(
        'INSERT INTO payments (order_id, amount, method, status, paid_at) VALUES ($1, $2, $3, $4, $5)',
        [orderId, total, method, status === 'PAID' ? 'SUCCESS' : 'REFUNDED', paidAt],
      );
      if (status === 'PAID') {
        await db.query(`UPDATE seats SET status = 'SOLD' WHERE seat_id = ANY($1::bigint[])`, [seats.map((s) => s.seatId)]);
        const key = user.userId + ':' + ev.eventId;
        perUser.set(key, (perUser.get(key) ?? 0) + seats.length);
        stats.paid++;
      } else stats.cancelled++;
    }

    const isSelling = (ev) => ev.saleOpenAt <= NOW;
    const free = new Map(events.map((ev) => [ev.eventId, shuffle(ev.seats)])); // ghế chưa bán, đã xáo trộn
    const take = (ev, n) => free.get(ev.eventId).splice(0, n);

    // 1) Đối tượng gom vé: đủ 4 vé mỗi sự kiện đang bán
    for (const ev of events.filter(isSelling)) {
      if (ev.status === 'ENDED') continue;
      await placeOrder(ev, byEmail('scalper@example.com'), take(ev, 4), 'PAID');
      if (ev.eventId === events[1].eventId)
        for (const c of ['a', 'b', 'c']) await placeOrder(ev, byEmail(`acc.${c}@example.com`), take(ev, 4), 'PAID');
    }
    await placeOrder(events[6], byEmail('scalper@example.com'), take(events[6], 4), 'PAID');
    // 2) Tài khoản demo có đúng 2 vé Rock (giống mockup): B7, B8
    const rock = events[1];
    const want = new Set(['B7', 'B8']);
    const free2 = free.get(rock.eventId);
    const mine = free2.filter((s) => want.has(s.label));
    free.set(rock.eventId, free2.filter((s) => !want.has(s.label)));
    if (mine.length === 2) await placeOrder(rock, byEmail('khach@example.com'), mine, 'PAID');

    // 3) Khách thường: bán ~55–80% ghế còn lại của mỗi sự kiện đã mở bán
    for (const ev of events.filter(isSelling)) {
      const target = Math.round(ev.seats.length * between(0.55, 0.8));
      let sold = ev.seats.length - free.get(ev.eventId).length;
      let guard = 0;
      while (sold < target && free.get(ev.eventId).length > 0 && guard++ < 5000) {
        const user = pick(pool_);
        const have = perUser.get(user.userId + ':' + ev.eventId) ?? 0;
        if (have >= 4) continue;
        const n = Math.min(1 + Math.floor(rand() * (4 - have)), 4 - have, free.get(ev.eventId).length);
        const seats = take(ev, n);
        const roll = rand();
        if (roll < 0.08) await placeOrder(ev, user, seats, 'CANCELLED'); // vé hủy, ghế trả về AVAILABLE
        else { await placeOrder(ev, user, seats, 'PAID'); sold += n; }
        if (roll >= 0.08 && rand() < 0.05) await placeOrder(ev, pick(pool_), [seats[0]], 'EXPIRED');
      }
    }

    // ---------- reviews (chỉ sự kiện đã diễn ra, người đã soát vé) ----------
    const ended = events[6];
    const reviewers = users.filter((u) => u.checkedInEvents?.has(ended.eventId) && rand() < 0.7);
    for (const u of reviewers) {
      const rating = pick([5, 5, 5, 4, 4, 4, 3, 3, 2]);
      await db.query('INSERT INTO reviews (user_id, event_id, rating, comment) VALUES ($1, $2, $3, $4)', [u.userId, ended.eventId, rating, rand() < 0.75 ? pick(COMMENTS) : null]);
    }

    console.log(`  users ${users.length} · events ${events.length} · seats ${events.reduce((s, e) => s + e.seats.length, 0)}`);
    console.log(`  đơn PAID ${stats.paid} · CANCELLED ${stats.cancelled} · EXPIRED ${stats.expired} · vé bán ${stats.tickets} (đã soát ${stats.checkedIn}) · đánh giá ${reviewers.length}`);
  });
}

// =====================================================================
// Firestore – dựng lại bản sao từ PostgreSQL (nguồn dữ liệu chính)
// =====================================================================
async function seedFirestore() {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  if (!host) throw new Error('Chưa đặt FIRESTORE_EMULATOR_HOST trong backend/.env (script chỉ ghi vào Emulator để tránh ghi nhầm Firestore thật)');
  try {
    await fetch('http://' + host, { signal: AbortSignal.timeout(2500) });
  } catch {
    throw new Error('Không kết nối được Firestore Emulator tại ' + host + '. Chạy: firebase emulators:start --config firebase/firebase.json');
  }
  console.log('▶ Firestore Emulator (' + host + '): dựng lại events/, validTickets/, notifications/…');
  for (const col of ['events', 'validTickets', 'notifications']) await firestore.recursiveDelete(firestore.collection(col));

  const { rows: seats } = await pool.query(
    `SELECT s.seat_id, s.status, s.held_by, s.held_until, s.row_label, s.seat_no, z.name AS zone, z.event_id, e.title, e.event_date
       FROM seats s JOIN zones z ON z.zone_id = s.zone_id JOIN events e ON e.event_id = z.event_id`,
  );
  const { rows: tickets } = await pool.query(
    `SELECT t.qr_code, t.status, t.checked_in_at, o.event_id, u.full_name, z.name AS zone, s.row_label, s.seat_no
       FROM tickets t JOIN orders o ON o.order_id = t.order_id JOIN users u ON u.user_id = o.user_id
       JOIN seats s ON s.seat_id = t.seat_id JOIN zones z ON z.zone_id = s.zone_id
      WHERE t.status <> 'CANCELLED'`,
  );

  const summary = {}; // eventId -> { title, date, zonesSummary }
  for (const s of seats) {
    const e = (summary[s.event_id] ??= { title: s.title, date: s.event_date, zonesSummary: {} });
    const z = (e.zonesSummary[s.zone] ??= { left: 0 });
    if (s.status === 'AVAILABLE') z.left++;
  }

  const bw = firestore.bulkWriter();
  for (const [id, e] of Object.entries(summary)) bw.set(firestore.doc(`events/${id}`), e);
  for (const s of seats)
    bw.set(firestore.doc(`events/${s.event_id}/seats/${s.seat_id}`), {
      status: s.status, heldBy: s.held_by ? String(s.held_by) : null, heldUntil: s.held_until ?? null,
      zone: s.zone, row: s.row_label, number: s.seat_no,
    });
  for (const t of tickets)
    bw.set(firestore.doc(`validTickets/${t.qr_code}`), {
      eventId: String(t.event_id), seatLabel: `${t.zone} · Ghế ${t.row_label}${t.seat_no}`, holderName: t.full_name,
      checkedIn: t.status === 'CHECKED_IN', checkedInAt: t.checked_in_at ?? null,
    });

  const demo = await pool.query(`SELECT user_id FROM users WHERE email = 'khach@example.com'`);
  if (demo.rows[0]) {
    const uid = String(demo.rows[0].user_id);
    bw.set(firestore.doc(`notifications/${uid}/items/welcome`), { message: 'Chào mừng bạn đến với TicketRush!', read: false, createdAt: NOW });
    bw.set(firestore.doc(`notifications/${uid}/items/paid`), { message: 'Thanh toán thành công 2 vé Đêm nhạc Rock Quân khu 7.', read: false, createdAt: NOW });
  }
  await bw.close();
  console.log(`  events ${Object.keys(summary).length} · seats ${seats.length} · validTickets ${tickets.length}`);
}

// =====================================================================
try {
  if (!FS_ONLY) await seedPostgres();
  if (!PG_ONLY) await seedFirestore();
  console.log('\n✔ Xong. Tài khoản đăng nhập:');
  console.log('  ADMIN     admin@ticketrush.vn   / Admin@123');
  console.log('  STAFF     staff1@ticketrush.vn  / Staff@123   (staff2@… cùng mật khẩu)');
  console.log('  CUSTOMER  khach@example.com     / 123456      (tài khoản demo, có 2 vé Rock B7 B8)');
  console.log('  Mọi khách hàng khác: mật khẩu 123456. Gom vé để test #11: scalper@example.com, acc.a|b|c@example.com (chung số 0977123456)');
  await pool.end();
  process.exit(0);
} catch (e) {
  console.error('\n✘ Lỗi seed:', e.message);
  await pool.end().catch(() => {});
  process.exit(1);
}
