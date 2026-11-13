// [tickets.repository] #6 vé của tôi – SQL thuần, loại f (join). Ý tưởng truy vấn: nhánh Data-Storage (TV4);
// dữ liệu trả về theo hợp đồng của frontend (xem docs/api.md).
import { pool } from '../../config/pg.js';
import { AppError } from '../../utils/AppError.js';

// [f] join: vé của tôi – tickets → orders → events → venues → seats → zones → users
// Chỉ vé của đơn đã thanh toán (PAID); vé đã hủy vẫn trả về để trang hiện trạng thái "Đã hủy".
export async function listMyTickets(input = {}) {
  const userId = Number(input?.user?.userId);
  if (!Number.isSafeInteger(userId) || userId <= 0) throw new AppError(400, 'VALIDATION', 'userId không hợp lệ');

  const { rows } = await pool.query(
    `SELECT t.ticket_id, t.qr_code, t.status, t.price, t.checked_in_at,
            o.order_id, o.status AS order_status,
            e.event_id, e.title AS event_title, e.event_date,
            v.name AS venue_name, v.city,
            z.name AS zone_name, s.row_label, s.seat_no,
            u.full_name AS holder_name
       FROM tickets t
       JOIN orders  o ON o.order_id = t.order_id
       JOIN users   u ON u.user_id  = o.user_id
       JOIN events  e ON e.event_id = o.event_id
       JOIN venues  v ON v.venue_id = e.venue_id
       JOIN seats   s ON s.seat_id  = t.seat_id
       JOIN zones   z ON z.zone_id  = s.zone_id
      WHERE o.user_id = $1
        AND o.status IN ('PAID', 'CANCELLED')
        AND NOT (o.status = 'CANCELLED' AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.order_id = o.order_id))
      ORDER BY e.event_date, t.ticket_id`,
    [userId],
  );
  return rows.map((r) => ({
    ticketId: String(r.ticket_id), orderId: String(r.order_id), qrCode: r.qr_code,
    status: r.order_status === 'CANCELLED' ? 'CANCELLED' : r.status,
    price: Number(r.price), checkedInAt: r.checked_in_at,
    eventId: String(r.event_id), eventTitle: r.event_title, eventDate: r.event_date,
    venueName: r.venue_name, city: r.city,
    zone: r.zone_name, seatLabel: r.row_label + r.seat_no, holderName: r.holder_name,
  }));
}
