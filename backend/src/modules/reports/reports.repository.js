import { pool } from '../../config/pg.js';
import { AppError } from '../../utils/AppError.js';

// [h] hàm tổng hợp: doanh thu theo khu vực (join + GROUP BY)
// [f] join: payments → orders → tickets → seats → zones → events
export async function revenueByZone(input = {}) {
  const eventId = input?.query?.eventId ? Number(input.query.eventId) : null;
  const { rows } = await pool.query(
    `SELECT e.event_id, e.title AS event_title, e.event_date,
            z.zone_id, z.name AS zone_name, z.capacity,
            COUNT(t.ticket_id)::int                        AS tickets_sold,
            z.capacity - COUNT(t.ticket_id)::int           AS tickets_left,
            ROUND(COUNT(t.ticket_id)::numeric / NULLIF(z.capacity,0) * 100, 1) AS fill_pct,
            COALESCE(SUM(t.price), 0)::numeric             AS revenue
       FROM zones z
       JOIN events e ON e.event_id = z.event_id
       LEFT JOIN seats   s ON s.zone_id  = z.zone_id
       LEFT JOIN tickets t ON t.seat_id  = s.seat_id AND t.status <> 'CANCELLED'
       LEFT JOIN orders  o ON o.order_id = t.order_id AND o.status IN ('PAID')
      ${eventId ? 'WHERE e.event_id = $1' : ''}
      GROUP BY e.event_id, e.title, e.event_date, z.zone_id, z.name, z.capacity
      ORDER BY e.event_date DESC, revenue DESC`,
    eventId ? [eventId] : [],
  );
  return rows.map((row) => ({
    eventId:    String(row.event_id),
    eventTitle: row.event_title,
    eventDate:  row.event_date,
    zoneId:     String(row.zone_id),
    zoneName:   row.zone_name,
    capacity:   row.capacity,
    ticketsSold: row.tickets_sold,
    ticketsLeft: row.tickets_left,
    fillPct:    Number(row.fill_pct ?? 0),
    revenue:    Number(row.revenue),
  }));
}

// [g] subquery + [e] điều kiện kết hợp: phát hiện tài khoản gom vé
// Gom vé = vượt giới hạn (đã được chặn ở tầng app) HOẶC nhiều tài khoản chung số ĐT
export async function scalperDetection(input = {}) {
  // Nhiều tài khoản cùng số điện thoại
  const { rows: sharedPhone } = await pool.query(
    `SELECT u.phone,
            COUNT(u.user_id)::int AS account_count,
            ARRAY_AGG(u.email ORDER BY u.created_at) AS emails,
            COALESCE(SUM(sub.ticket_count), 0)::int AS total_tickets
       FROM users u
       LEFT JOIN (
         SELECT o.user_id, COUNT(t.ticket_id) AS ticket_count
           FROM orders o
           JOIN tickets t ON t.order_id = o.order_id AND t.status <> 'CANCELLED'
          WHERE o.status = 'PAID'
          GROUP BY o.user_id
       ) sub ON sub.user_id = u.user_id
      GROUP BY u.phone
     HAVING COUNT(u.user_id) > 1
      ORDER BY account_count DESC, total_tickets DESC`,
  );

  // Người mua nhiều vé nhất (top 20)
  const { rows: topBuyers } = await pool.query(
    `SELECT u.user_id, u.email, u.full_name, u.phone,
            COUNT(t.ticket_id)::int AS total_valid_tickets,
            COUNT(DISTINCT o.event_id)::int AS events_attended
       FROM users u
       JOIN orders  o ON o.user_id  = u.user_id AND o.status = 'PAID'
       JOIN tickets t ON t.order_id = o.order_id AND t.status <> 'CANCELLED'
      GROUP BY u.user_id, u.email, u.full_name, u.phone
      ORDER BY total_valid_tickets DESC
      LIMIT 20`,
  );

  return {
    sharedPhoneGroups: sharedPhone.map((row) => ({
      phone:        row.phone,
      accountCount: row.account_count,
      emails:       row.emails,
      totalTickets: row.total_tickets,
    })),
    topBuyers: topBuyers.map((row) => ({
      userId:        String(row.user_id),
      email:         row.email,
      fullName:      row.full_name,
      phone:         row.phone,
      totalTickets:  row.total_valid_tickets,
      eventsCount:   row.events_attended,
    })),
  };
}
