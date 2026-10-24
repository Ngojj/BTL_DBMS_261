import { pool } from '../../config/pg.js';
import { AppError } from '../../utils/AppError.js';

// [f] join: vé của tôi – join tickets → orders → events → venues → seats → zones
export async function listMyTickets(input = {}) {
  const userId = Number(input?.user?.userId);
  if (!Number.isSafeInteger(userId) || userId <= 0)
    throw new AppError(400, 'VALIDATION', 'userId không hợp lệ');

  const { rows } = await pool.query(
    `SELECT t.ticket_id, t.qr_code, t.status AS ticket_status, t.price, t.checked_in_at,
            o.order_id, o.status AS order_status, o.created_at AS order_created_at,
            e.event_id, e.title AS event_title, e.event_date,
            v.name AS venue_name, v.city,
            z.name AS zone_name,
            s.row_label, s.seat_no
       FROM tickets t
       JOIN orders  o ON o.order_id  = t.order_id
       JOIN events  e ON e.event_id  = o.event_id
       JOIN venues  v ON v.venue_id  = e.venue_id
       JOIN seats   s ON s.seat_id   = t.seat_id
       JOIN zones   z ON z.zone_id   = s.zone_id
      WHERE o.user_id = $1
        AND t.status <> 'CANCELLED'
      ORDER BY e.event_date DESC, t.ticket_id`,
    [userId],
  );
  return rows.map((row) => ({
    ticketId:    String(row.ticket_id),
    qrCode:      row.qr_code,
    ticketStatus: row.ticket_status,
    price:       Number(row.price),
    checkedInAt: row.checked_in_at,
    orderId:     String(row.order_id),
    orderStatus: row.order_status,
    orderCreatedAt: row.order_created_at,
    eventId:     String(row.event_id),
    eventTitle:  row.event_title,
    eventDate:   row.event_date,
    venueName:   row.venue_name,
    city:        row.city,
    zoneName:    row.zone_name,
    rowLabel:    row.row_label,
    seatNo:      row.seat_no,
    seatLabel:   `${row.zone_name} ${row.row_label}${row.seat_no}`,
  }));
}

// [d] Lookup one ticket by QR code – used by checkin
export async function getTicketByQr(qrCode) {
  if (!qrCode) throw new AppError(400, 'VALIDATION', 'qrCode không hợp lệ');
  const { rows } = await pool.query(
    `SELECT t.ticket_id, t.qr_code, t.status, t.checked_in_at,
            o.event_id,
            e.title AS event_title, e.event_date,
            z.name AS zone_name, s.row_label, s.seat_no,
            u.full_name AS holder_name
       FROM tickets t
       JOIN orders o ON o.order_id = t.order_id
       JOIN events e ON e.event_id = o.event_id
       JOIN seats  s ON s.seat_id  = t.seat_id
       JOIN zones  z ON z.zone_id  = s.zone_id
       JOIN users  u ON u.user_id  = o.user_id
      WHERE t.qr_code = $1`,
    [qrCode],
  );
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy vé');
  const row = rows[0];
  return {
    ticketId:    String(row.ticket_id),
    qrCode:      row.qr_code,
    status:      row.status,
    checkedInAt: row.checked_in_at,
    eventId:     String(row.event_id),
    eventTitle:  row.event_title,
    eventDate:   row.event_date,
    zoneName:    row.zone_name,
    rowLabel:    row.row_label,
    seatNo:      row.seat_no,
    seatLabel:   `${row.zone_name} ${row.row_label}${row.seat_no}`,
    holderName:  row.holder_name,
  };
}
