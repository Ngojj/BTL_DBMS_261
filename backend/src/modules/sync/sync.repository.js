// [sync.repository] Đồng bộ PostgreSQL → Firestore (PostgreSQL là nguồn dữ liệu chính, Firestore chỉ là bản sao).
// Ý tưởng và truy vấn: nhánh Data-Storage (TV4). Đã đổi batch (giới hạn 500 thao tác) sang BulkWriter để sự kiện lớn không lỗi.
import { firestore } from '../../config/firebase.js';
import { pool } from '../../config/pg.js';
import { AppError } from '../../utils/AppError.js';

// Trạng thái ghế của một sự kiện → events/{id}/seats/* và events/{id}.zonesSummary
// Gọi sau mỗi createOrder / payOrder / cancelOrder. Ghế HELD đã quá hạn được coi là AVAILABLE.
export async function syncEventSeats(eventId) {
  const { rows } = await pool.query(
    `SELECT s.seat_id, s.held_by, s.held_until, s.row_label, s.seat_no, z.name AS zone_name, z.zone_id, e.title, e.event_date,
            CASE WHEN s.status = 'HELD' AND s.held_until <= now() THEN 'AVAILABLE' ELSE s.status END AS effective_status
       FROM seats s
       JOIN zones z  ON z.zone_id  = s.zone_id
       JOIN events e ON e.event_id = z.event_id
      WHERE z.event_id = $1`,
    [eventId],
  );
  if (!rows.length) return { seats: 0 };

  const writer = firestore.bulkWriter();
  const eventRef = firestore.collection('events').doc(String(eventId));
  const zones = {};
  for (const s of rows) {
    const expired = s.effective_status === 'AVAILABLE';
    writer.set(eventRef.collection('seats').doc(String(s.seat_id)), {
      status: s.effective_status, heldBy: expired ? null : s.held_by ? String(s.held_by) : null,
      heldUntil: expired ? null : s.held_until ?? null, zone: s.zone_name, zoneId: String(s.zone_id), row: s.row_label, number: s.seat_no,
    }, { merge: true });
    const z = (zones[s.zone_name] ??= { total: 0, left: 0 });
    z.total += 1;
    if (expired) z.left += 1;
  }
  writer.set(eventRef, { title: rows[0].title, date: rows[0].event_date, zonesSummary: zones }, { merge: true });
  await writer.close();
  return { seats: rows.length };
}

// Danh sách vé còn hiệu lực của sự kiện → validTickets/{qrCode} (cho soát vé offline)
export async function syncValidTickets(eventId) {
  const { rows } = await pool.query(
    `SELECT t.qr_code, o.event_id, u.full_name AS holder_name, z.name AS zone_name, s.row_label, s.seat_no, t.status, t.checked_in_at
       FROM tickets t
       JOIN orders o ON o.order_id = t.order_id
       JOIN users  u ON u.user_id  = o.user_id
       JOIN seats  s ON s.seat_id  = t.seat_id
       JOIN zones  z ON z.zone_id  = s.zone_id
      WHERE o.event_id = $1 AND o.status = 'PAID' AND t.status IN ('VALID', 'CHECKED_IN')`,
    [eventId],
  );
  const writer = firestore.bulkWriter();
  for (const r of rows) {
    writer.set(firestore.collection('validTickets').doc(r.qr_code), {
      eventId: String(r.event_id), seatLabel: r.zone_name + ' · Ghế ' + r.row_label + r.seat_no, holderName: r.holder_name,
      checkedIn: r.status === 'CHECKED_IN', checkedInAt: r.checked_in_at ?? null,
    });
  }
  await writer.close();
  return { tickets: rows.length };
}

// [-] Đồng bộ lại toàn bộ trạng thái ghế và vé hợp lệ của một sự kiện
export async function resyncEvent({ params }) {
  const eventId = Number(params?.eventId);
  if (!Number.isSafeInteger(eventId) || eventId <= 0) throw new AppError(400, 'VALIDATION', 'eventId không hợp lệ');
  const found = await pool.query('SELECT 1 FROM events WHERE event_id = $1', [eventId]);
  if (!found.rowCount) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy sự kiện');
  const seats = await syncEventSeats(eventId);
  const tickets = await syncValidTickets(eventId);
  return { eventId: String(eventId), ...seats, ...tickets };
}

// [-] Đồng bộ lại toàn bộ sự kiện
export async function resyncAll() {
  const { rows } = await pool.query('SELECT event_id FROM events ORDER BY event_id');
  let seats = 0;
  let tickets = 0;
  for (const { event_id: id } of rows) {
    seats += (await syncEventSeats(id)).seats;
    tickets += (await syncValidTickets(id)).tickets;
  }
  return { events: rows.length, seats, tickets };
}
