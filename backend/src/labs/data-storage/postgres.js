// [labs/data-storage/postgres] Phụ trách: TV4 – Data storage trên PostgreSQL (pg, SQL thuần)
// Kịch bản: Cùng dữ liệu vé lưu theo hai mô hình; so sánh dung lượng (heap/index/TOAST),
//           số lần đọc để hiện trang "vé của tôi", chi phí và tình trạng dead tuple / HOT update.
import { pool } from '../../config/pg.js';

const TABLES = [
  'users', 'genres', 'venues', 'events', 'zones',
  'seats', 'orders', 'tickets', 'payments', 'reviews',
];

export async function run(params = {}) {
  const targetTickets = Math.max(1, Number(params.tickets) || 10000);

  // 1. Đo dung lượng thực tế tách riêng Heap, Index, TOAST cho toàn bộ 10 bảng trong schema.sql
  const { rows: tableRows } = await pool.query(
    `SELECT
       c.relname AS table_name,
       COALESCE(s.n_live_tup, 0)::bigint AS live_rows,
       COALESCE(s.n_dead_tup, 0)::bigint AS dead_rows,
       COALESCE(s.n_tup_upd, 0)::bigint AS updates,
       COALESCE(s.n_tup_hot_upd, 0)::bigint AS hot_updates,
       pg_relation_size(c.oid)::bigint AS heap_bytes,
       pg_indexes_size(c.oid)::bigint AS index_bytes,
       pg_total_relation_size(c.oid)::bigint AS total_bytes,
       (pg_total_relation_size(c.oid) - pg_relation_size(c.oid) - pg_indexes_size(c.oid))::bigint AS toast_bytes
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
     WHERE n.nspname = 'public'
       AND c.relkind = 'r'
       AND c.relname = ANY($1)
     ORDER BY pg_total_relation_size(c.oid) DESC`,
    [TABLES],
  );

  let actualTotalBytes = 0;
  let actualHeapBytes = 0;
  let actualIndexBytes = 0;
  let actualToastBytes = 0;
  let actualTicketRows = 0;

  const tables = tableRows.map((r) => {
    const heap = Number(r.heap_bytes);
    const index = Number(r.index_bytes);
    const toast = Math.max(0, Number(r.toast_bytes));
    const total = Number(r.total_bytes);
    actualHeapBytes += heap;
    actualIndexBytes += index;
    actualToastBytes += toast;
    actualTotalBytes += total;
    if (r.table_name === 'tickets') actualTicketRows = Number(r.live_rows);
    return {
      table: r.table_name,
      liveRows: Number(r.live_rows),
      deadRows: Number(r.dead_rows),
      updates: Number(r.updates),
      hotUpdates: Number(r.hot_updates),
      heapBytes: heap,
      indexBytes: index,
      toastBytes: toast,
      totalBytes: total,
    };
  });

  // Đếm chính xác số vé thực tế bằng COUNT(*) (vì pg_stat_user_tables có thể trễ trước ANALYZE)
  const { rows: countRows } = await pool.query(`SELECT COUNT(*)::int AS cnt FROM tickets`);
  const exactTicketCount = Number(countRows[0]?.cnt ?? actualTicketRows);

  // 2. Chạy truy vấn [f] "Vé của tôi" thật (1 SQL query JOIN 6 bảng) cho user có vé (khach@example.com hoặc user nhiều vé nhất)
  const { rows: targetUserRows } = await pool.query(
    `SELECT o.user_id, u.email, COUNT(*)::int AS ticket_cnt
       FROM tickets t
       JOIN orders o ON o.order_id = t.order_id
       JOIN users  u ON u.user_id = o.user_id
      WHERE t.status <> 'CANCELLED'
      GROUP BY o.user_id, u.email
      ORDER BY (u.email = 'khach@example.com') DESC, ticket_cnt DESC
      LIMIT 1`,
  );

  const testUser = targetUserRows[0];
  let myTicketsCount = 0;
  let myTicketsPayloadBytes = 0;
  if (testUser) {
    const { rows: myTickets } = await pool.query(
      `SELECT t.ticket_id, t.qr_code, t.status AS ticket_status, t.price,
              o.order_id, o.status AS order_status,
              e.event_id, e.title AS event_title, e.event_date,
              v.name AS venue_name, v.city,
              z.name AS zone_name, s.row_label, s.seat_no
         FROM tickets t
         JOIN orders  o ON o.order_id = t.order_id
         JOIN events  e ON e.event_id = o.event_id
         JOIN venues  v ON v.venue_id = e.venue_id
         JOIN seats   s ON s.seat_id  = t.seat_id
         JOIN zones   z ON z.zone_id  = s.zone_id
        WHERE o.user_id = $1 AND t.status <> 'CANCELLED'
        ORDER BY e.event_date DESC, t.ticket_id`,
      [testUser.user_id],
    );
    myTicketsCount = myTickets.length;
    myTicketsPayloadBytes = Buffer.byteLength(JSON.stringify(myTickets), 'utf8');
  }

  // 3. Quy đổi dung lượng tại quy mô targetTickets (nếu DB hiện tại nhỏ hơn targetTickets)
  const ticketTable = tables.find((t) => t.table === 'tickets');
  const seatTable = tables.find((t) => t.table === 'seats');
  const orderTable = tables.find((t) => t.table === 'orders');

  // Nếu DB chưa có đủ targetTickets vé, tính dung lượng ngoại suy từ byte/dòng đo được trên DB thật
  let storageBytes = actualTotalBytes;
  let scaled = false;
  if (exactTicketCount > 0 && targetTickets > exactTicketCount) {
    scaled = true;
    const ratio = targetTickets / exactTicketCount;
    const dynamicBytes = (ticketTable?.totalBytes ?? 0) + (seatTable?.totalBytes ?? 0) + (orderTable?.totalBytes ?? 0);
    const staticBytes = actualTotalBytes - dynamicBytes;
    storageBytes = Math.round(staticBytes + dynamicBytes * ratio);
  }

  return {
    metrics: {
      storageBytes,
      readsForMyTickets: 1,
      estimatedCost: '0 đ (self-hosted)',
    },
    details: {
      model: 'normalized (10 tables)',
      targetTickets,
      actualTicketCount: exactTicketCount,
      scaledFromActual: scaled,
      actualDatabase: {
        totalBytes: actualTotalBytes,
        heapBytes: actualHeapBytes,
        indexBytes: actualIndexBytes,
        toastBytes: actualToastBytes,
      },
      myTicketsQuery: {
        userEmail: testUser?.email ?? null,
        ticketsReturned: myTicketsCount,
        sqlQueries: 1,
        payloadBytes: myTicketsPayloadBytes,
      },
      seatsMvcc: seatTable
        ? {
            liveRows: seatTable.liveRows,
            deadRows: seatTable.deadRows,
            updates: seatTable.updates,
            hotUpdates: seatTable.hotUpdates,
          }
        : null,
      tables,
    },
  };
}
