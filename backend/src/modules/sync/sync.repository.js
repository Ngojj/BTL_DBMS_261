// [sync.repository] Đồng bộ PostgreSQL → Firestore (PostgreSQL là nguồn dữ liệu chính, Firestore chỉ là bản sao).
// Ý tưởng và truy vấn: nhánh Data-Storage (TV4). Đã đổi batch (giới hạn 500 thao tác) sang BulkWriter để sự kiện lớn không lỗi.
import { firestore } from '../../config/firebase.js';
import { pool } from '../../config/pg.js';
import { AppError } from '../../utils/AppError.js';
import { syncCheckins } from '../checkin/checkin.repository.js';

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

// Dữ liệu một vé trong validTickets. checkedIn chỉ được ghi khi PostgreSQL đã là CHECKED_IN: ghi bằng merge để KHÔNG ghi đè
// một lượt soát offline đã nằm trong Firestore nhưng chưa kịp đồng bộ về PostgreSQL. Thiếu checkedIn nghĩa là chưa soát.
const ticketDoc = (r) => ({
  eventId: String(r.event_id), seatLabel: r.zone_name + ' · Ghế ' + r.row_label + r.seat_no, holderName: r.holder_name,
  ...(r.status === 'CHECKED_IN' && { checkedIn: true, checkedInAt: r.checked_in_at }),
});
const TICKET_COLS = `t.qr_code, t.status, t.checked_in_at, o.status AS order_status, o.event_id,
            u.full_name AS holder_name, z.name AS zone_name, s.row_label, s.seat_no`;
const TICKET_JOINS = `FROM tickets t
       JOIN orders o ON o.order_id = t.order_id
       JOIN users  u ON u.user_id  = o.user_id
       JOIN seats  s ON s.seat_id  = t.seat_id
       JOIN zones  z ON z.zone_id  = s.zone_id`;

// Vé của MỘT đơn → validTickets (đơn đã thanh toán: tạo / cập nhật; vé hoặc đơn đã hủy: xóa để không soát được nữa).
// Gọi sau khi thanh toán và sau khi hủy đơn.
export async function syncOrderTickets(orderId) {
  const { rows } = await pool.query(`SELECT ${TICKET_COLS} ${TICKET_JOINS} WHERE t.order_id = $1`, [orderId]);
  const writer = firestore.bulkWriter();
  for (const r of rows) {
    const ref = firestore.collection('validTickets').doc(r.qr_code);
    if (r.order_status === 'PAID' && r.status !== 'CANCELLED') writer.set(ref, ticketDoc(r), { merge: true });
    else writer.delete(ref);
  }
  await writer.close();
  return { tickets: rows.length };
}

// Toàn bộ vé còn hiệu lực của sự kiện → validTickets; xóa các vé đã hủy còn sót lại trong Firestore.
export async function syncValidTickets(eventId) {
  const { rows } = await pool.query(
    `SELECT ${TICKET_COLS} ${TICKET_JOINS} WHERE o.event_id = $1 AND o.status = 'PAID' AND t.status IN ('VALID', 'CHECKED_IN')`,
    [eventId],
  );
  const live = new Set(rows.map((r) => r.qr_code));
  const stale = await firestore.collection('validTickets').where('eventId', '==', String(eventId)).get();
  const writer = firestore.bulkWriter();
  for (const r of rows) writer.set(firestore.collection('validTickets').doc(r.qr_code), ticketDoc(r), { merge: true });
  let removed = 0;
  for (const d of stale.docs) if (!live.has(d.id)) { writer.delete(d.ref); removed++; }
  await writer.close();
  return { tickets: rows.length, removed };
}

// [-] Đồng bộ lại toàn bộ trạng thái ghế và vé hợp lệ của một sự kiện
export async function resyncEvent({ params }) {
  const eventId = Number(params?.eventId);
  if (!Number.isSafeInteger(eventId) || eventId <= 0) throw new AppError(400, 'VALIDATION', 'eventId không hợp lệ');
  const found = await pool.query('SELECT 1 FROM events WHERE event_id = $1', [eventId]);
  if (!found.rowCount) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy sự kiện');
  await syncCheckins({ body: { eventId } }); // giữ các lượt soát offline chưa về PostgreSQL
  const seats = await syncEventSeats(eventId);
  const tickets = await syncValidTickets(eventId);
  return { eventId: String(eventId), ...seats, ...tickets };
}

// [-] Đồng bộ lại toàn bộ sự kiện
export async function resyncAll() {
  const { rows } = await pool.query('SELECT event_id FROM events ORDER BY event_id');
  let seats = 0;
  let tickets = 0;
  await syncCheckins({ body: {} });
  for (const { event_id: id } of rows) {
    seats += (await syncEventSeats(id)).seats;
    tickets += (await syncValidTickets(id)).tickets;
  }
  return { events: rows.length, seats, tickets };
}
