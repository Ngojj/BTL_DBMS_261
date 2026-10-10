// Phụ trách: TV3 (#10, #11)
import { pool } from '../../config/pg.js';

// SQL thuần, tham số $1,$2…; ghi chú loại truy vấn a–h trong comment.

// [h] #10 – doanh thu theo khu vực (SUM/COUNT + GROUP BY)
export async function revenueByZone({ eventId = null } = {}, db = pool) {
  // Giá tại thời điểm mua; không JOIN payments vì một đơn có thể có nhiều lần thử.
  // LEFT JOIN giữ lại cả khu chưa có ghế hoặc chưa bán vé.
  const { rows } = await db.query(
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
export async function suspiciousAccounts() {
  // Giới hạn áp dụng từng sự kiện, không áp dụng tổng vé của mọi sự kiện.
  // Số điện thoại chung chỉ là dấu hiệu để admin kiểm tra, không kết luận gian lận.
  const { rows } = await pool.query(
    `WITH purchases AS (
       SELECT o.user_id, e.event_id, e.title, e.max_tickets_per_user,
              COUNT(t.ticket_id)::int AS ticket_count
         FROM orders o
         JOIN events e ON e.event_id = o.event_id
         JOIN tickets t ON t.order_id = o.order_id
        WHERE o.status = 'PAID' AND t.status IN ('VALID', 'CHECKED_IN')
        GROUP BY o.user_id, e.event_id, e.title, e.max_tickets_per_user
     ), shared_phones AS (
       SELECT phone, COUNT(*)::int AS account_count
         FROM users WHERE role = 'CUSTOMER'
        GROUP BY phone HAVING COUNT(*) > 1
     )
     SELECT u.user_id AS "userId", u.email, u.phone,
            COALESCE((SELECT SUM(p.ticket_count)::int FROM purchases p
                       WHERE p.user_id = u.user_id), 0) AS "ticketCount",
            COALESCE(sp.account_count, 0) AS "sharedPhoneAccounts",
            COALESCE((SELECT jsonb_agg(jsonb_build_object(
                         'eventId', p.event_id::text, 'eventTitle', p.title,
                         'ticketCount', p.ticket_count, 'limit', p.max_tickets_per_user
                       ) ORDER BY p.event_id)
                        FROM purchases p
                       WHERE p.user_id = u.user_id
                         AND p.ticket_count > p.max_tickets_per_user), '[]'::jsonb) AS "exceededEvents"
       FROM users u
       LEFT JOIN shared_phones sp ON sp.phone = u.phone
      WHERE u.role = 'CUSTOMER'
        AND (sp.phone IS NOT NULL OR EXISTS (
          SELECT 1 FROM purchases p WHERE p.user_id = u.user_id
            AND p.ticket_count > p.max_tickets_per_user
        ))
      ORDER BY "ticketCount" DESC, u.user_id`,
  );
  return rows;
}
