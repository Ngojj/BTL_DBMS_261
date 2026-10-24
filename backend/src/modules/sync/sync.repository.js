import { firestore } from '../../config/firebase.js';
import { pool } from '../../config/pg.js';

// Đồng bộ trạng thái ghế của một sự kiện từ PostgreSQL sang Firestore
// Gọi sau mỗi createOrder / payOrder / cancelOrder
export async function syncEventSeats(eventId) {
  const { rows } = await pool.query(
    `SELECT s.seat_id, s.status,
            CASE WHEN s.status = 'HELD' AND s.held_until <= now() THEN 'AVAILABLE' ELSE s.status END AS effective_status,
            s.held_by, s.held_until, s.row_label, s.seat_no,
            z.name AS zone_name, z.zone_id
       FROM seats s
       JOIN zones z ON z.zone_id = s.zone_id
      WHERE z.event_id = $1`,
    [eventId],
  );

  const batch = firestore.batch();
  const eventRef = firestore.collection('events').doc(String(eventId));

  // Cập nhật từng ghế
  for (const seat of rows) {
    const seatRef = eventRef.collection('seats').doc(String(seat.seat_id));
    batch.set(seatRef, {
      status:    seat.effective_status,
      heldBy:    seat.held_by ? String(seat.held_by) : null,
      heldUntil: seat.held_until ?? null,
      zone:      seat.zone_name,
      zoneId:    String(seat.zone_id),
      row:       seat.row_label,
      number:    seat.seat_no,
    }, { merge: true });
  }

  // Cập nhật zonesSummary trên document sự kiện
  const zoneMap = {};
  for (const seat of rows) {
    const z = seat.zone_name;
    if (!zoneMap[z]) zoneMap[z] = { total: 0, left: 0 };
    zoneMap[z].total += 1;
    if (seat.effective_status === 'AVAILABLE') zoneMap[z].left += 1;
  }
  batch.set(eventRef, { zonesSummary: zoneMap }, { merge: true });

  await batch.commit();
}

// Đồng bộ toàn bộ danh sách vé hợp lệ của một sự kiện vào validTickets (cho soát vé offline)
export async function syncValidTickets(eventId) {
  const { rows } = await pool.query(
    `SELECT t.qr_code, o.event_id, u.full_name AS holder_name,
            z.name AS zone_name, s.row_label, s.seat_no,
            t.status, t.checked_in_at
       FROM tickets t
       JOIN orders o ON o.order_id = t.order_id
       JOIN users  u ON u.user_id  = o.user_id
       JOIN seats  s ON s.seat_id  = t.seat_id
       JOIN zones  z ON z.zone_id  = s.zone_id
      WHERE o.event_id = $1 AND t.status IN ('VALID', 'CHECKED_IN')`,
    [eventId],
  );

  const batch = firestore.batch();
  for (const row of rows) {
    const ref = firestore.collection('validTickets').doc(row.qr_code);
    batch.set(ref, {
      eventId:     String(row.event_id),
      seatLabel:   `${row.zone_name} ${row.row_label}${row.seat_no}`,
      holderName:  row.holder_name,
      checkedIn:   row.status === 'CHECKED_IN',
      checkedInAt: row.checked_in_at ?? null,
    });
  }
  await batch.commit();
}
