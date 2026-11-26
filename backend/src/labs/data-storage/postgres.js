// [labs/data-storage/postgres] Lưu chuẩn hóa: 7 bảng rút gọn từ schema TicketRush, tạo dưới dạng bảng tạm (TEMP)
// nên mỗi lần chạy có dữ liệu riêng, tự mất khi đóng kết nối, không đụng bảng thật.
// Đo: (1) dung lượng bảng + chỉ mục (pg_total_relation_size); (2) "vé của tôi" = một câu JOIN 6 bảng;
//     (3) dead tuple ở bảng ghế sau khi mỗi ghế đổi trạng thái AVAILABLE → HELD → SOLD, rồi VACUUM.
import { pool } from '../../config/pg.js';
import { parseParams, makeFixture } from './shared.js';

const DDL = `
CREATE TEMP TABLE ds_users  (user_id int PRIMARY KEY, full_name text NOT NULL, email text NOT NULL UNIQUE);
CREATE TEMP TABLE ds_venues (venue_id int PRIMARY KEY, name text NOT NULL, city text NOT NULL);
CREATE TEMP TABLE ds_events (event_id int PRIMARY KEY, venue_id int NOT NULL REFERENCES ds_venues, title text NOT NULL, event_date timestamptz NOT NULL);
CREATE TEMP TABLE ds_zones  (zone_id int PRIMARY KEY, event_id int NOT NULL REFERENCES ds_events, name text NOT NULL, price numeric(12,0) NOT NULL);
CREATE TEMP TABLE ds_seats  (seat_id int PRIMARY KEY, zone_id int NOT NULL REFERENCES ds_zones, row_label text NOT NULL, seat_no int NOT NULL,
                             status text NOT NULL DEFAULT 'AVAILABLE', held_by int, UNIQUE (zone_id, row_label, seat_no));
CREATE TEMP TABLE ds_orders (order_id int PRIMARY KEY, user_id int NOT NULL REFERENCES ds_users, event_id int NOT NULL REFERENCES ds_events, status text NOT NULL DEFAULT 'PAID');
CREATE INDEX ON ds_orders (user_id);
CREATE TEMP TABLE ds_tickets (ticket_id int PRIMARY KEY, order_id int NOT NULL REFERENCES ds_orders, seat_id int NOT NULL REFERENCES ds_seats,
                              qr_code uuid NOT NULL UNIQUE, price numeric(12,0) NOT NULL, status text NOT NULL DEFAULT 'VALID');
CREATE INDEX ON ds_tickets (order_id);`;
const TABLES = ['ds_users', 'ds_venues', 'ds_events', 'ds_zones', 'ds_seats', 'ds_orders', 'ds_tickets'];

const MY_TICKETS = `
SELECT t.ticket_id, t.qr_code, t.status, t.price, e.title, e.event_date, v.name AS venue, v.city, z.name AS zone, s.row_label, s.seat_no
  FROM ds_tickets t
  JOIN ds_orders o ON o.order_id = t.order_id
  JOIN ds_events e ON e.event_id = o.event_id
  JOIN ds_venues v ON v.venue_id = e.venue_id
  JOIN ds_seats  s ON s.seat_id  = t.seat_id
  JOIN ds_zones  z ON z.zone_id  = s.zone_id
 WHERE o.user_id = $1 AND t.status <> 'CANCELLED'
 ORDER BY t.ticket_id`;

// Chèn nhiều dòng một lần bằng unnest để không phải gửi N câu INSERT
const bulk = (c, table, cols, types, rows) => c.query(
  `INSERT INTO ${table} (${cols.join(',')}) SELECT * FROM unnest(${types.map((t, i) => `$${i + 1}::${t}[]`).join(',')})`,
  cols.map((_, i) => rows.map((r) => r[i])));

export async function run(params = {}) {
  const { tickets: n, myTickets } = parseParams(params);
  const f = makeFixture(n, myTickets);
  const c = await pool.connect();
  try {
    await c.query(DDL);
    await c.query('INSERT INTO ds_venues VALUES (1, $1, $2)', [f.event.venue, f.event.city]);
    await c.query('INSERT INTO ds_events VALUES (1, 1, $1, $2)', [f.event.title, f.event.date]);
    await bulk(c, 'ds_users', ['user_id', 'full_name', 'email'], ['int', 'text', 'text'], f.users.map((u) => [u.id, u.fullName, u.email]));
    await bulk(c, 'ds_zones', ['zone_id', 'event_id', 'name', 'price'], ['int', 'int', 'text', 'numeric'], f.zones.map((z) => [z.id, 1, z.name, z.price]));
    await bulk(c, 'ds_seats', ['seat_id', 'zone_id', 'row_label', 'seat_no'], ['int', 'int', 'text', 'int'], f.seats.map((s) => [s.id, s.zoneId, s.row, s.no]));
    await bulk(c, 'ds_orders', ['order_id', 'user_id', 'event_id'], ['int', 'int', 'int'], f.orders.map((o) => [o.id, o.userId, 1]));
    await bulk(c, 'ds_tickets', ['ticket_id', 'order_id', 'seat_id', 'qr_code', 'price'], ['int', 'int', 'int', 'uuid', 'numeric'],
      f.tickets.map((t) => [t.id, t.orderId, t.seatId, t.qr, t.price]));

    const size = async () => (await c.query(
      `SELECT relname, pg_relation_size(oid) AS heap, pg_indexes_size(oid) AS idx, pg_total_relation_size(oid) AS total
         FROM pg_class WHERE relname = ANY($1) AND relpersistence = 't' AND relkind = 'r'`, [TABLES])).rows
      .map((r) => ({ table: r.relname.replace('ds_', ''), heapBytes: Number(r.heap), indexBytes: Number(r.idx), totalBytes: Number(r.total) }));
    const tables = await size();
    const storageBytes = tables.reduce((s, t) => s + t.totalBytes, 0);

    // "Vé của tôi": một câu SQL, kết 6 bảng
    const t0 = performance.now();
    const mine = await c.query(MY_TICKETS, [1]);
    const queryMs = Math.round((performance.now() - t0) * 100) / 100;

    // Mỗi ghế đổi trạng thái hai lần như khi mua vé thật: mỗi UPDATE để lại một phiên bản cũ (dead tuple)
    const seatsBefore = tables.find((t) => t.table === 'seats').heapBytes;
    await c.query("UPDATE ds_seats SET status = 'HELD', held_by = 1");
    await c.query("UPDATE ds_seats SET status = 'SOLD', held_by = NULL");
    const dead = async () => {
      await c.query('SELECT pg_stat_force_next_flush()').catch(() => {});
      await c.query('SELECT pg_stat_clear_snapshot()');
      const r = await c.query("SELECT n_dead_tup, n_tup_hot_upd FROM pg_stat_all_tables WHERE relid = 'ds_seats'::regclass");
      return { dead: Number(r.rows[0]?.n_dead_tup ?? 0), hot: Number(r.rows[0]?.n_tup_hot_upd ?? 0) };
    };
    await new Promise((r) => setTimeout(r, 50));
    const afterUpdate = await dead();
    const seatsAfter = Number((await c.query("SELECT pg_relation_size('ds_seats') AS b")).rows[0].b);
    await c.query('VACUUM ds_seats');
    await new Promise((r) => setTimeout(r, 50));
    const afterVacuum = await dead();

    return {
      metrics: {
        model: 'Chuẩn hóa: 7 bảng, khóa ngoại',
        storageBytes,
        records: f.users.length + 1 + 1 + f.zones.length + n + f.orders.length + n,
        readsForMyTickets: 1,
        myTicketsReturned: mine.rowCount,
        queryMs,
        writesOnRename: 1,
        deadTuples: afterUpdate.dead,
        seatsBloat: `${(seatsBefore / 1024).toFixed(0)} KB → ${(seatsAfter / 1024).toFixed(0)} KB`,
        estimatedCost: 'Không tính theo lượt đọc (trả theo máy chủ)',
      },
      details: {
        tables,
        seatUpdates: { rows: n, updates: 2 * n, deadTuplesAfterUpdate: afterUpdate.dead, hotUpdates: afterUpdate.hot, deadTuplesAfterVacuum: afterVacuum.dead, seatsHeapBytesBefore: seatsBefore, seatsHeapBytesAfter: seatsAfter },
        sampleRow: mine.rows[0] ?? null,
        note: 'Dung lượng gồm heap + chỉ mục + TOAST của bảng tạm. VACUUM đánh dấu chỗ trống để dùng lại, không trả dung lượng về hệ điều hành.',
      },
    };
  } finally {
    await c.query(`DROP TABLE IF EXISTS ${[...TABLES].reverse().join(', ')}`).catch(() => {});
    c.release();
  }
}
