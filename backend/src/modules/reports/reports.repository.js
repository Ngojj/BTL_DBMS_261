// Phụ trách: TV3 (#10, #11)
import { notImplemented } from '../../utils/AppError.js';
import { pool } from '../../config/pg.js';

// SQL thuần, tham số $1,$2…; ghi chú loại truy vấn a–h trong comment.

// [h] #10 – doanh thu theo khu vực (SUM/COUNT + GROUP BY)
export async function revenueByZone({ eventId = null } = {}) {
  // Giá tại thời điểm mua; không JOIN payments vì một đơn có thể có nhiều lần thử.
  // LEFT JOIN giữ lại cả khu chưa có ghế hoặc chưa bán vé.
  const { rows } = await pool.query(
    `SELECT e.event_id AS "eventId", e.title AS "eventTitle",
            z.zone_id AS "zoneId", z.name AS zone,
            (COUNT(t.ticket_id) FILTER (WHERE o.order_id IS NOT NULL))::int AS "ticketsSold",
            COALESCE(SUM(t.price) FILTER (WHERE o.order_id IS NOT NULL), 0) AS revenue
       FROM events e
       JOIN zones z ON z.event_id = e.event_id
       LEFT JOIN seats s ON s.zone_id = z.zone_id
       LEFT JOIN tickets t ON t.seat_id = s.seat_id
                          AND t.status IN ('VALID', 'CHECKED_IN')
       LEFT JOIN orders o ON o.order_id = t.order_id
                         AND o.event_id = e.event_id AND o.status = 'PAID'
      WHERE ($1::bigint IS NULL OR e.event_id = $1::bigint)
      GROUP BY e.event_id, e.title, z.zone_id, z.name
      ORDER BY e.event_id, z.zone_id`,
    [eventId],
  );
  return rows;
}

// [h] #10 – tỷ lệ lấp đầy theo khu vực
export async function occupancyByZone({ eventId = null } = {}) {
  // Lấp đầy theo vé đã thanh toán, không tính ghế đang giữ hoặc vé đã hủy.
  const { rows } = await pool.query(
    `SELECT e.event_id AS "eventId", e.title AS "eventTitle",
            z.zone_id AS "zoneId", z.name AS zone, z.capacity,
            (COUNT(DISTINCT s.seat_id) FILTER (WHERE o.order_id IS NOT NULL))::int AS sold
       FROM events e
       JOIN zones z ON z.event_id = e.event_id
       LEFT JOIN seats s ON s.zone_id = z.zone_id
       LEFT JOIN tickets t ON t.seat_id = s.seat_id
                          AND t.status IN ('VALID', 'CHECKED_IN')
       LEFT JOIN orders o ON o.order_id = t.order_id
                         AND o.event_id = e.event_id AND o.status = 'PAID'
      WHERE ($1::bigint IS NULL OR e.event_id = $1::bigint)
      GROUP BY e.event_id, e.title, z.zone_id, z.name, z.capacity
      ORDER BY e.event_id, z.zone_id`,
    [eventId],
  );
  return rows;
}

// [g] #11 – tài khoản gom vé: vượt giới hạn / chung số điện thoại (subquery)
export async function suspiciousAccounts(input) {
  throw notImplemented('reports.suspiciousAccounts');
}
