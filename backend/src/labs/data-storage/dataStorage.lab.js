import { pool } from '../../config/pg.js';
import { firestore } from '../../config/firebase.js';
import { AppError } from '../../utils/AppError.js';

/**
 * [Data Storage Lab] So sánh đọc "Vé của tôi" giữa PostgreSQL và Firestore.
 * PostgreSQL: 1 query JOIN 6 bảng.
 * Firestore:  đọc validTickets theo userId, sau đó resolve event info.
 */

// [f] join: đọc vé của user qua 6 bảng
export async function pgReadMyTickets(userId) {
  if (!userId) throw new AppError(400, 'VALIDATION', 'userId bắt buộc');
  const start = Date.now();
  const { rows, rowCount } = await pool.query(
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
    [userId],
  );
  const elapsedMs = Date.now() - start;
  return {
    dbms: 'postgresql',
    operation: 'listMyTickets',
    rowCount,
    elapsedMs,
    queryType: '[f] join – 6 tables',
    note: '1 SQL query, index on orders(user_id)',
    data: rows.map((r) => ({
      ticketId: String(r.ticket_id), qrCode: r.qr_code,
      ticketStatus: r.ticket_status, price: Number(r.price),
      eventTitle: r.event_title, eventDate: r.event_date,
      venueName: r.venue_name, city: r.city,
      zoneName: r.zone_name, rowLabel: r.row_label, seatNo: r.seat_no,
    })),
  };
}

// Firestore: đọc validTickets rồi resolve event info (mô phỏng pattern document)
export async function fsReadMyTickets(userId) {
  if (!userId) throw new AppError(400, 'VALIDATION', 'userId bắt buộc');

  // Lấy qr_code list từ PostgreSQL (vì Firestore không store userId trong validTickets by design)
  // Thực tế: STAFF/app sẽ lắng nghe collection group hoặc dùng userId subcollection.
  // Lab này dùng cách đơn giản nhất: query PG để có qrCodes, rồi đọc từng doc trong Firestore.
  const start = Date.now();

  const { rows: qrRows } = await pool.query(
    `SELECT t.qr_code FROM tickets t JOIN orders o ON o.order_id = t.order_id
      WHERE o.user_id = $1 AND t.status <> 'CANCELLED'`,
    [userId],
  );
  const qrCodes = qrRows.map((r) => r.qr_code);

  let firestoreReads = 0;
  const tickets = [];

  for (const qrCode of qrCodes) {
    const vtDoc = await firestore.collection('validTickets').doc(qrCode).get();
    firestoreReads++;
    if (!vtDoc.exists) continue;
    const vt = vtDoc.data();

    // Đọc event info (document riêng)
    const evDoc = await firestore.collection('events').doc(String(vt.eventId)).get();
    firestoreReads++;
    const ev = evDoc.data() ?? {};

    tickets.push({ qrCode, seatLabel: vt.seatLabel, holderName: vt.holderName,
                   checkedIn: vt.checkedIn, eventTitle: ev.title ?? '', eventStatus: ev.status ?? '' });
  }

  const elapsedMs = Date.now() - start;
  return {
    dbms: 'firestore',
    operation: 'listMyTickets',
    rowCount: tickets.length,
    elapsedMs,
    firestoreReads,
    note: `${firestoreReads} document reads (validTickets + events), ~$${(firestoreReads * 0.0000006).toFixed(7)} nếu dùng bản Standard`,
    queryType: 'document reads',
    data: tickets,
  };
}

// [h] hàm tổng hợp: dung lượng lưu trữ ước tính
export async function compareStorageSize() {
  const pgResult = await pool.query(`
    SELECT
      relname AS table_name,
      pg_size_pretty(pg_total_relation_size(oid)) AS total_size,
      pg_total_relation_size(oid) AS size_bytes
    FROM pg_class
    WHERE relname IN ('users','genres','venues','events','zones','seats','orders','tickets','payments','reviews')
      AND relkind = 'r'
    ORDER BY size_bytes DESC`);

  const pgTotalBytes = pgResult.rows.reduce((s, r) => s + Number(r.size_bytes), 0);

  // Ước tính Firestore: mỗi document ~1–5 KB
  const countsR = await pool.query(
    `SELECT 'events' AS c, COUNT(*) AS n FROM events
     UNION ALL SELECT 'seats', COUNT(*) FROM seats
     UNION ALL SELECT 'validTickets (=tickets)', COUNT(*) FROM tickets WHERE status <> 'CANCELLED'`,
  );
  const estimatedFsDocs = countsR.rows.reduce((s, r) => s + Number(r.n), 0);
  const estimatedFsBytes = estimatedFsDocs * 2048; // ~2KB/doc trung bình

  return {
    postgresql: {
      tables: pgResult.rows.map((r) => ({ tableName: r.table_name, totalSize: r.total_size, bytes: Number(r.size_bytes) })),
      totalBytes: pgTotalBytes,
      totalSizePretty: `${(pgTotalBytes / 1024).toFixed(1)} KB`,
    },
    firestore: {
      estimatedDocuments: estimatedFsDocs,
      estimatedBytes: estimatedFsBytes,
      estimatedSizePretty: `${(estimatedFsBytes / 1024).toFixed(1)} KB`,
      note: 'Ước tính ~2 KB/document. Thực tế phụ thuộc trường denormalize.',
    },
    summary: 'PostgreSQL: chuẩn hóa → ít lặp. Firestore: denormalized → đọc nhanh, tốn hơn khi có nhiều field trùng.',
  };
}
