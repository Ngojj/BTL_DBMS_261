/**
 * scripts/seed.js – Nạp dữ liệu mẫu vào PostgreSQL và Firestore
 * Chạy: node scripts/seed.js
 * Yêu cầu: backend/.env, PostgreSQL và Firebase Emulator đang chạy.
 *
 * Dữ liệu mẫu:
 *  - 1 ADMIN, 1 STAFF, 8 CUSTOMER (2 cặp dùng chung phone để test #11)
 *  - 3 thể loại nhạc, 2 địa điểm
 *  - 3 sự kiện (1 ON_SALE, 1 ENDED, 1 DRAFT) mỗi sự kiện 3 khu vực
 *  - Mỗi khu vực 3 hàng x 5 ghế = 15 ghế
 *  - Vài orders/tickets/payments cho sự kiện ON_SALE
 *  - 2 reviews cho sự kiện ENDED
 */

import { pool, withTransaction } from '../backend/src/config/pg.js';
import { firestore }             from '../backend/src/config/firebase.js';
import bcrypt                    from 'bcrypt';

const HASH_ROUNDS = 10;
const PASSWORD    = '123456';

async function main() {
  const client = await pool.connect();
  try {
    // ── Xóa dữ liệu cũ (cascade) ──────────────────────────────────────────
    await client.query(`
      TRUNCATE reviews, payments, tickets, orders, seats, zones,
               events, venues, genres, users RESTART IDENTITY CASCADE
    `);
    console.log('✓ Đã xóa dữ liệu cũ');

    // ── Users ─────────────────────────────────────────────────────────────
    const hash = await bcrypt.hash(PASSWORD, HASH_ROUNDS);
    const usersResult = await client.query(`
      INSERT INTO users (email, phone, full_name, password_hash, role) VALUES
        ('admin@ticketrush.vn',    '0901234567', 'Quản trị viên',   $1, 'ADMIN'),
        ('staff@ticketrush.vn',    '0901234568', 'Nhân viên soát',  $1, 'STAFF'),
        ('alice@example.com',      '0912345001', 'Nguyễn Thị Alice',$1, 'CUSTOMER'),
        ('bob@example.com',        '0912345002', 'Trần Văn Bob',    $1, 'CUSTOMER'),
        ('charlie@example.com',    '0912345002', 'Lê Thị Charlie',  $1, 'CUSTOMER'),
        ('david@example.com',      '0912345003', 'Phạm Văn David',  $1, 'CUSTOMER'),
        ('eve@example.com',        '0912345003', 'Hoàng Thị Eve',   $1, 'CUSTOMER'),
        ('frank@example.com',      '0912345004', 'Ngô Văn Frank',   $1, 'CUSTOMER'),
        ('grace@example.com',      '0912345005', 'Vũ Thị Grace',    $1, 'CUSTOMER'),
        ('henry@example.com',      '0912345006', 'Đặng Văn Henry',  $1, 'CUSTOMER')
      RETURNING user_id, email, role`,
      [hash],
    );
    const users = usersResult.rows;
    const customerId = (email) => users.find((u) => u.email === email).user_id;
    console.log(`✓ ${users.length} users`);

    // ── Genres ────────────────────────────────────────────────────────────
    const genresResult = await client.query(`
      INSERT INTO genres (name) VALUES ('Pop'), ('Rock'), ('EDM')
      RETURNING genre_id, name`);
    const genres = genresResult.rows;
    console.log(`✓ ${genres.length} genres`);

    // ── Venues ────────────────────────────────────────────────────────────
    const venuesResult = await client.query(`
      INSERT INTO venues (name, city, address) VALUES
        ('Nhà hát Lớn Hà Nội',   'Hà Nội',    '1 Tràng Tiền, Hoàn Kiếm'),
        ('Sân khấu Gaia HCM',    'TP HCM',    '13 Lê Quý Đôn, Quận 3')
      RETURNING venue_id, name`);
    const venues = venuesResult.rows;
    console.log(`✓ ${venues.length} venues`);

    // ── Events ────────────────────────────────────────────────────────────
    const now = new Date();
    const future   = (days) => new Date(now.getTime() + days * 86400_000);
    const past     = (days) => new Date(now.getTime() - days * 86400_000);

    const eventsResult = await client.query(`
      INSERT INTO events (title, genre_id, venue_id, event_date, sale_open_at, max_tickets_per_user, status) VALUES
        ('Đêm Nhạc Pop Xuân 2027',    $1, $2, $3, $4, 4, 'ON_SALE'),
        ('Rock Fest 2026',             $5, $6, $7, $8, 4, 'ENDED'),
        ('EDM Countdown 2027',         $9, $10, $11, $12, 2, 'DRAFT')
      RETURNING event_id, title, status`,
      [
        genres[0].genre_id, venues[0].venue_id, future(30).toISOString(), past(1).toISOString(),
        genres[1].genre_id, venues[1].venue_id, past(10).toISOString(),   past(45).toISOString(),
        genres[2].genre_id, venues[0].venue_id, future(90).toISOString(), future(60).toISOString(),
      ],
    );
    const events = eventsResult.rows;
    console.log(`✓ ${events.length} events`);

    // ── Zones & Seats ─────────────────────────────────────────────────────
    const zoneConfig = [
      { name: 'VIP',  price: 1_500_000, capacity: 15 },
      { name: 'CAT1', price:   800_000, capacity: 15 },
      { name: 'GA',   price:   350_000, capacity: 15 },
    ];

    const allZones = [];
    for (const event of events) {
      for (const zc of zoneConfig) {
        const r = await client.query(
          `INSERT INTO zones (event_id, name, price, capacity) VALUES ($1, $2, $3, $4) RETURNING zone_id`,
          [event.event_id, zc.name, zc.price, zc.capacity],
        );
        allZones.push({ ...r.rows[0], event_id: event.event_id, name: zc.name, price: zc.price });
      }
    }
    console.log(`✓ ${allZones.length} zones`);

    // Bulk insert seats: 3 hàng (A,B,C) x 5 ghế
    let totalSeats = 0;
    for (const zone of allZones) {
      const rows = [];
      const params = [];
      let p = 1;
      for (const row of ['A', 'B', 'C']) {
        for (let no = 1; no <= 5; no++) {
          rows.push(`($${p++}, $${p++}, $${p++})`);
          params.push(zone.zone_id, row, no);
        }
      }
      await client.query(
        `INSERT INTO seats (zone_id, row_label, seat_no) VALUES ${rows.join(', ')}`,
        params,
      );
      totalSeats += 15;
    }
    console.log(`✓ ${totalSeats} seats`);

    // ── Vé mẫu cho sự kiện ON_SALE (event[0]) ────────────────────────────
    const onSaleEvent   = events[0];
    const vipZone       = allZones.find((z) => z.event_id === onSaleEvent.event_id && z.name === 'VIP');
    const cat1Zone      = allZones.find((z) => z.event_id === onSaleEvent.event_id && z.name === 'CAT1');

    // Lấy ghế đầu tiên của khu VIP
    const vipSeats = await client.query(
      `SELECT seat_id, price FROM seats s JOIN zones z ON z.zone_id = s.zone_id
        WHERE s.zone_id = $1 ORDER BY seat_id LIMIT 2`, [vipZone.zone_id],
    );

    // Order PAID – Alice mua 2 ghế VIP
    const aliceId = customerId('alice@example.com');
    const orderR = await client.query(
      `INSERT INTO orders (user_id, event_id, total, status, expires_at)
       VALUES ($1, $2, $3, 'PAID', now() + interval '10 min') RETURNING order_id`,
      [aliceId, onSaleEvent.event_id, vipSeats.rows.reduce((s, r) => s + Number(r.price), 0)],
    );
    const orderId = orderR.rows[0].order_id;

    for (const seat of vipSeats.rows) {
      await client.query(
        `INSERT INTO tickets (order_id, seat_id, price, status) VALUES ($1, $2, $3, 'VALID')`,
        [orderId, seat.seat_id, seat.price],
      );
      await client.query(
        `UPDATE seats SET status = 'SOLD', held_by = NULL, held_until = NULL WHERE seat_id = $1`,
        [seat.seat_id],
      );
    }
    await client.query(
      `INSERT INTO payments (order_id, amount, method, status, paid_at)
       VALUES ($1, $2, 'CARD', 'SUCCESS', now())`,
      [orderId, vipSeats.rows.reduce((s, r) => s + Number(r.price), 0)],
    );
    console.log('✓ Order PAID (Alice, VIP x2)');

    // Order PENDING – Bob giữ 1 ghế CAT1
    const cat1Seats = await client.query(
      `SELECT seat_id, price FROM seats WHERE zone_id = $1 ORDER BY seat_id LIMIT 1`,
      [cat1Zone.zone_id],
    );
    const bobId = customerId('bob@example.com');
    const bobOrderR = await client.query(
      `INSERT INTO orders (user_id, event_id, total, status, expires_at)
       VALUES ($1, $2, $3, 'PENDING', now() + interval '10 min') RETURNING order_id`,
      [bobId, onSaleEvent.event_id, cat1Seats.rows[0].price],
    );
    await client.query(
      `INSERT INTO tickets (order_id, seat_id, price, status) VALUES ($1, $2, $3, 'VALID')`,
      [bobOrderR.rows[0].order_id, cat1Seats.rows[0].seat_id, cat1Seats.rows[0].price],
    );
    await client.query(
      `UPDATE seats SET status = 'HELD', held_by = $1, held_until = now() + interval '10 min'
        WHERE seat_id = $2`,
      [bobId, cat1Seats.rows[0].seat_id],
    );
    console.log('✓ Order PENDING (Bob, CAT1 x1)');

    // ── Reviews cho sự kiện ENDED (event[1]) ──────────────────────────────
    const endedEvent = events[1];
    await client.query(
      `INSERT INTO reviews (user_id, event_id, rating, comment) VALUES
        ($1, $2, 5, 'Concert tuyệt vời! Âm thanh rất hay.'),
        ($3, $2, 4, 'Tổ chức tốt, muốn được trải nghiệm thêm.')`,
      [aliceId, endedEvent.event_id, bobId],
    );
    console.log('✓ 2 reviews (sự kiện ENDED)');

    // ── Đồng bộ Firestore ─────────────────────────────────────────────────
    console.log('Đang đồng bộ Firestore…');
    for (const event of events) {
      const zones = allZones.filter((z) => z.event_id === event.event_id);
      const zonesSummary = {};
      for (const z of zones) {
        const soldR = await client.query(
          `SELECT COUNT(*) AS sold FROM seats WHERE zone_id = $1 AND status = 'SOLD'`,
          [z.zone_id],
        );
        zonesSummary[z.name] = { capacity: 15, left: 15 - Number(soldR.rows[0].sold) };
      }
      const evRef = firestore.collection('events').doc(String(event.event_id));
      await evRef.set({ title: event.title, status: event.status, zonesSummary });

      // Seats
      const seatsR = await client.query(
        `SELECT s.seat_id, s.row_label, s.seat_no, s.status, s.held_by, s.held_until, z.name AS zone_name
           FROM seats s JOIN zones z ON z.zone_id = s.zone_id
          WHERE z.event_id = $1`, [event.event_id],
      );
      const batch = firestore.batch();
      for (const seat of seatsR.rows) {
        const sRef = evRef.collection('seats').doc(String(seat.seat_id));
        batch.set(sRef, {
          status: seat.status,
          heldBy: seat.held_by ? String(seat.held_by) : null,
          heldUntil: seat.held_until ?? null,
          zone: seat.zone_name, row: seat.row_label, number: seat.seat_no,
        });
      }
      await batch.commit();
    }

    // validTickets
    const validR = await client.query(
      `SELECT t.qr_code, o.event_id, z.name AS zone_name, s.row_label, s.seat_no, u.full_name
         FROM tickets t JOIN orders o ON o.order_id = t.order_id
         JOIN seats s ON s.seat_id = t.seat_id JOIN zones z ON z.zone_id = s.zone_id
         JOIN users u ON u.user_id = o.user_id
        WHERE t.status IN ('VALID', 'CHECKED_IN')`,
    );
    const vtBatch = firestore.batch();
    for (const vt of validR.rows) {
      const vtRef = firestore.collection('validTickets').doc(vt.qr_code);
      vtBatch.set(vtRef, {
        eventId: String(vt.event_id),
        seatLabel: `${vt.zone_name} ${vt.row_label}${vt.seat_no}`,
        holderName: vt.full_name,
        checkedIn: false, checkedInAt: null,
      });
    }
    await vtBatch.commit();

    console.log('✓ Firestore synced');
    console.log('\n✅ Seed hoàn tất! Đăng nhập thử với admin@ticketrush.vn / 123456');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error('❌ Seed lỗi:', e.message); process.exit(1); });
