// [reports.repository] Thống kê kinh doanh (#10) – SQL thuần, loại truy vấn h (hàm tổng hợp) kết hợp f (join), g (subquery).
// Phụ trách: TV3 (#10, #11)
//
// Quy ước tính doanh thu: SUM(giá vé) của các vé CÒN HIỆU LỰC (status <> 'CANCELLED') thuộc đơn có một lần
// thanh toán SUCCESS (đơn hủy đã hoàn tiền không tính). Ràng buộc uq_success_payment_per_order bảo đảm mỗi đơn
// có tối đa MỘT payment SUCCESS nên phép join không làm nhân đôi dòng. Số này khớp SUM(payments.amount) SUCCESS.
// Ngày được cắt theo giờ Việt Nam (UTC+7) trên payments.paid_at.
import { pool } from '../../config/pg.js';

const TZ = "'Asia/Ho_Chi_Minh'";
const PAID_DAY = `(p.paid_at AT TIME ZONE ${TZ})::date`;

// Vé còn hiệu lực của các đơn đã thanh toán, kèm khu vực và sự kiện
const PAID_TICKETS = `
  FROM tickets t
  JOIN orders   o ON o.order_id  = t.order_id
  JOIN payments p ON p.order_id  = o.order_id AND p.status = 'SUCCESS'
  JOIN seats    s ON s.seat_id   = t.seat_id
  JOIN zones    z ON z.zone_id   = s.zone_id
  JOIN events   e ON e.event_id  = z.event_id
 WHERE t.status <> 'CANCELLED'`;

// Ghép điều kiện lọc (eventId, from, to) vào mệnh đề WHERE; đẩy tham số vào params ($n)
function paidFilter({ eventId, from, to }, params) {
  const w = [];
  if (eventId) { params.push(eventId); w.push(`o.event_id = $${params.length}`); }
  if (from) { params.push(from); w.push(`${PAID_DAY} >= $${params.length}::date`); }
  if (to) { params.push(to); w.push(`${PAID_DAY} <= $${params.length}::date`); }
  return w.length ? ' AND ' + w.join(' AND ') : '';
}

// [h] doanh thu theo sự kiện × khu vực: SUM, COUNT + GROUP BY
export async function revenueByZone({ filters }) {
  const params = [];
  const { rows } = await pool.query(
    `SELECT e.event_id, e.title AS event_title, z.name AS zone,
            COUNT(t.ticket_id) AS tickets_sold,
            COALESCE(SUM(t.price), 0) AS revenue
       ${PAID_TICKETS}${paidFilter(filters, params)}
      GROUP BY e.event_id, e.title, z.zone_id, z.name
      ORDER BY e.event_id, z.price DESC`,
    params,
  );
  return rows;
}

// [h] doanh thu theo ngày, đủ cả những ngày không có đơn (generate_series + LEFT JOIN)
export async function revenueDaily({ filters }) {
  const params = [filters.from, filters.to];
  const eventSql = filters.eventId ? (params.push(filters.eventId), ` AND o.event_id = $${params.length}`) : '';
  const { rows } = await pool.query(
    `WITH days AS (
        SELECT d::date AS day FROM generate_series($1::date, $2::date, interval '1 day') AS d
     ), paid AS (
        SELECT ${PAID_DAY} AS day,
               COUNT(DISTINCT o.order_id) AS orders,
               COUNT(t.ticket_id)         AS tickets,
               SUM(t.price)               AS revenue
          ${PAID_TICKETS}${eventSql}
         GROUP BY 1
     )
     SELECT to_char(days.day, 'YYYY-MM-DD') AS day,
            COALESCE(paid.orders, 0)  AS orders,
            COALESCE(paid.tickets, 0) AS tickets,
            COALESCE(paid.revenue, 0) AS revenue
       FROM days LEFT JOIN paid ON paid.day = days.day
      ORDER BY days.day`,
    params,
  );
  return rows;
}

// [h] tỷ lệ lấp đầy theo khu vực: số ghế SOLD / HELD trên sức chứa của khu
export async function occupancyByZone({ filters }) {
  const params = [];
  const eventSql = filters.eventId ? (params.push(filters.eventId), `WHERE z.event_id = $${params.length}`) : '';
  const { rows } = await pool.query(
    `SELECT e.event_id, e.title AS event_title, z.name AS zone, z.capacity,
            COUNT(s.seat_id) FILTER (WHERE s.status = 'SOLD') AS sold,
            COUNT(s.seat_id) FILTER (WHERE s.status = 'HELD' AND s.held_until > now()) AS held
       FROM zones z
       JOIN events e ON e.event_id = z.event_id
       LEFT JOIN seats s ON s.zone_id = z.zone_id
       ${eventSql}
      GROUP BY e.event_id, e.title, z.zone_id, z.name, z.capacity, z.price
      ORDER BY e.event_id, z.price DESC`,
    params,
  );
  return rows;
}

// Chỉ số tổng quan: 5 truy vấn tổng hợp chạy song song
export async function overview({ filters }) {
  const p1 = [];
  const f1 = paidFilter(filters, p1);
  const totals = pool.query(
    `SELECT COALESCE(SUM(t.price), 0) AS revenue, COUNT(t.ticket_id) AS tickets, COUNT(DISTINCT o.order_id) AS paid_orders,
            COUNT(t.ticket_id) FILTER (WHERE t.status = 'CHECKED_IN') AS checked_in
       ${PAID_TICKETS}${f1}`,
    p1,
  );

  // Đơn theo trạng thái (lọc theo ngày tạo đơn)
  const p2 = [];
  const w2 = [];
  if (filters.eventId) { p2.push(filters.eventId); w2.push(`event_id = $${p2.length}`); }
  if (filters.from) { p2.push(filters.from); w2.push(`(created_at AT TIME ZONE ${TZ})::date >= $${p2.length}::date`); }
  if (filters.to) { p2.push(filters.to); w2.push(`(created_at AT TIME ZONE ${TZ})::date <= $${p2.length}::date`); }
  const orders = pool.query(
    `SELECT status, COUNT(*) AS n FROM orders ${w2.length ? 'WHERE ' + w2.join(' AND ') : ''} GROUP BY status`,
    p2,
  );

  // Lấp đầy tổng: ghế bán / sức chứa của các khu
  const p3 = [];
  const w3 = filters.eventId ? (p3.push(filters.eventId), `WHERE z.event_id = $${p3.length}`) : '';
  const seats = pool.query(
    `SELECT COALESCE(SUM(z.capacity), 0) AS capacity,
            (SELECT COUNT(*) FROM seats s2 JOIN zones z2 ON z2.zone_id = s2.zone_id
              WHERE s2.status = 'SOLD' ${filters.eventId ? 'AND z2.event_id = $1' : ''}) AS sold
       FROM zones z ${w3}`,
    p3,
  );

  // [g] subquery: doanh thu từng sự kiện và cờ "cao hơn doanh thu trung bình của các sự kiện"
  const p4 = [];
  const f4 = paidFilter({ ...filters, eventId: null }, p4);
  const byEvent = pool.query(
    `SELECT ev.event_id, ev.title, ev.revenue, ev.tickets,
            ev.revenue > (SELECT AVG(r.revenue) FROM (SELECT SUM(t.price) AS revenue ${PAID_TICKETS}${f4} GROUP BY e.event_id) r) AS above_average
       FROM (SELECT e.event_id, e.title, SUM(t.price) AS revenue, COUNT(t.ticket_id) AS tickets ${PAID_TICKETS}${f4} GROUP BY e.event_id, e.title) ev
      ORDER BY ev.revenue DESC
      LIMIT 5`,
    p4,
  );

  const [t, o, s, e] = await Promise.all([totals, orders, seats, byEvent]);
  return { totals: t.rows[0], orders: o.rows, seats: s.rows[0], topEvents: e.rows };
}

// [g] #11 – tài khoản gom vé (subquery + CTE). Ba dấu hiệu, tính trên vé còn hiệu lực của đơn PAID:
//   1) OVER_LIMIT   – một tài khoản mua vượt max_tickets_per_user của một sự kiện
//   2) SHARED_PHONE – nhiều tài khoản khách hàng dùng chung số điện thoại; GROUP_OVER_LIMIT nếu tổng vé của cả nhóm
//                     cho một sự kiện vượt giới hạn của MỘT người (bằng chứng gom vé qua nhiều tài khoản)
//   3) REPEAT_AT_LIMIT – mua đủ giới hạn ở từ atLimitEvents sự kiện trở lên (mua hết mức ở mọi show)
// Trigger ticket_rules đã chặn (1) ở mức một tài khoản nên (1) chỉ xuất hiện nếu dữ liệu bị sửa trực tiếp.
export async function suspiciousAccounts({ atLimitEvents }) {
  const { rows } = await pool.query(
    `WITH purchases AS (
       SELECT o.user_id, e.event_id, e.title, e.max_tickets_per_user AS lim, COUNT(t.ticket_id)::int AS n
         FROM orders o
         JOIN events  e ON e.event_id = o.event_id
         JOIN tickets t ON t.order_id = o.order_id AND t.status <> 'CANCELLED'
        WHERE o.status = 'PAID'
        GROUP BY o.user_id, e.event_id, e.title, e.max_tickets_per_user
     ), shared_phones AS (
       SELECT phone, COUNT(*)::int AS accounts
         FROM users WHERE role = 'CUSTOMER'
        GROUP BY phone HAVING COUNT(*) > 1
     ), group_buys AS (
       SELECT u.phone, p.event_id, p.title, p.lim, SUM(p.n)::int AS total
         FROM purchases p
         JOIN users u ON u.user_id = p.user_id
        WHERE u.phone IN (SELECT phone FROM shared_phones)
        GROUP BY u.phone, p.event_id, p.title, p.lim
       HAVING SUM(p.n) > p.lim
     )
     SELECT u.user_id, u.email, u.full_name, u.phone,
            COALESCE((SELECT SUM(p.n) FROM purchases p WHERE p.user_id = u.user_id), 0)::int AS ticket_count,
            COALESCE(sp.accounts, 0) AS shared_accounts,
            COALESCE((SELECT jsonb_agg(jsonb_build_object('eventId', p.event_id::text, 'eventTitle', p.title, 'tickets', p.n, 'limit', p.lim) ORDER BY p.event_id)
                        FROM purchases p WHERE p.user_id = u.user_id AND p.n > p.lim), '[]'::jsonb) AS over_limit,
            COALESCE((SELECT jsonb_agg(jsonb_build_object('eventId', g.event_id::text, 'eventTitle', g.title, 'tickets', g.total, 'limit', g.lim) ORDER BY g.event_id)
                        FROM group_buys g WHERE g.phone = u.phone), '[]'::jsonb) AS group_over_limit,
            (SELECT COUNT(*)::int FROM purchases p WHERE p.user_id = u.user_id AND p.n >= p.lim) AS at_limit_events
       FROM users u
       LEFT JOIN shared_phones sp ON sp.phone = u.phone
      WHERE u.role = 'CUSTOMER'
        AND ( sp.phone IS NOT NULL
           OR EXISTS (SELECT 1 FROM purchases p WHERE p.user_id = u.user_id AND p.n > p.lim)
           OR (SELECT COUNT(*) FROM purchases p WHERE p.user_id = u.user_id AND p.n >= p.lim) >= $1 )
      ORDER BY ticket_count DESC, u.user_id`,
    [atLimitEvents],
  );
  return rows;
}
