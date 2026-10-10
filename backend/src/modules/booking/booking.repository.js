import { pool, withTransaction } from '../../config/pg.js';
import { AppError } from '../../utils/AppError.js';

const readBody = (input = {}) => input.body ?? {};
const readParams = (input = {}) => input.params ?? {};

const parseUserId = (userId) => {
  const val = Number(userId);
  if (!Number.isFinite(val) || val <= 0) throw new AppError(400, 'VALIDATION', 'userId không hợp lệ');
  return val;
};

const parseSeatIds = (seatIds) => {
  const values = Array.isArray(seatIds) ? seatIds : [];
  if (values.length === 0) throw new AppError(400, 'VALIDATION', 'Phải chọn ít nhất 1 ghế');
  return values.map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 0);
};

const ensureSeatBelongsToEvent = (seat, eventId) => {
  if (Number(seat.event_id) !== Number(eventId)) {
    throw new AppError(409, 'SEAT_EVENT_MISMATCH', 'Ghế không thuộc sự kiện đã chọn');
  }
};

export async function createOrder(input = {}) {
  const body = readBody(input);
  const userId = parseUserId(input.user?.userId ?? body.userId);
  const eventId = Number(body.eventId ?? body.event_id ?? input.params?.eventId ?? 0);
  const seatIds = parseSeatIds(body.seatIds ?? body.seat_ids ?? []);

  if (!Number.isFinite(eventId) || eventId <= 0) {
    throw new AppError(400, 'VALIDATION', 'eventId không hợp lệ');
  }

  return withTransaction(async (client) => {
    const userRow = await client.query('SELECT user_id, role FROM users WHERE user_id = $1 FOR UPDATE', [userId]);
    if (!userRow.rows[0]) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy người dùng');

    const eventRow = await client.query(
      'SELECT event_id, max_tickets_per_user, sale_open_at, event_date FROM events WHERE event_id = $1 FOR UPDATE',
      [eventId],
    );
    if (!eventRow.rows[0]) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy sự kiện');

    const event = eventRow.rows[0];
    const now = new Date();
    if (now < new Date(event.sale_open_at)) {
      throw new AppError(400, 'VALIDATION', 'Sự kiện chưa mở bán');
    }
    if (now > new Date(event.event_date)) {
      throw new AppError(400, 'VALIDATION', 'Sự kiện đã kết thúc');
    }

    const countRow = await client.query(
      `SELECT COUNT(*)::int AS count
         FROM tickets t
         JOIN orders o ON o.order_id = t.order_id
        WHERE o.user_id = $1 AND o.event_id = $2 AND t.status <> 'CANCELLED'`,
      [userId, eventId],
    );

    const existingCount = Number(countRow.rows[0]?.count ?? 0);
    if (existingCount + seatIds.length > Number(event.max_tickets_per_user)) {
      throw new AppError(409, 'TICKET_LIMIT_EXCEEDED', 'Bạn đã vượt giới hạn vé cho sự kiện này');
    }

    const seats = [];
    for (const seatId of seatIds) {
      const seat = await client.query(
        `SELECT s.seat_id, s.zone_id, s.status, s.held_by, s.held_until, z.event_id, z.price
           FROM seats s
           JOIN zones z ON z.zone_id = s.zone_id
          WHERE s.seat_id = $1
          FOR UPDATE`,
        [seatId],
      );

      if (!seat.rows[0]) throw new AppError(404, 'NOT_FOUND', `Không tìm thấy ghế ${seatId}`);
      const s = seat.rows[0];
      ensureSeatBelongsToEvent(s, eventId);
      if (s.status === 'SOLD' || (s.status === 'HELD' && s.held_by !== userId)) {
        throw new AppError(409, 'SEAT_UNAVAILABLE', `Ghế ${seatId} không còn trống`);
      }
      seats.push(s);
    }

    const total = seats.reduce((sum, s) => sum + Number(s.price), 0);

    const orderRow = await client.query(
      `INSERT INTO orders (user_id, event_id, total, status, expires_at)
       VALUES ($1, $2, $3, 'PENDING', now() + INTERVAL '10 minutes')
       RETURNING *`,
      [userId, eventId, total],
    );

    const order = orderRow.rows[0];
    const ticketRows = [];
    for (const s of seats) {
      const ticketRes = await client.query(
        `INSERT INTO tickets (order_id, seat_id, price, status)
         VALUES ($1, $2, $3, 'VALID')
         RETURNING *`,
        [order.order_id, s.seat_id, s.price],
      );
      ticketRows.push(ticketRes.rows[0]);

      await client.query(
        `UPDATE seats
            SET status = 'HELD', held_by = $1, held_until = now() + INTERVAL '10 minutes', version = version + 1
          WHERE seat_id = $2`,
        [userId, s.seat_id],
      );
    }

    return {
      orderId: String(order.order_id),
      userId: String(order.user_id),
      eventId: String(order.event_id),
      total: Number(order.total),
      status: order.status,
      expiresAt: order.expires_at,
      ticketCount: ticketRows.length,
      tickets: ticketRows,
    };
  });
}

export async function payOrder(input = {}) {
  const userId = parseUserId(input.user?.userId ?? input.body?.userId);
  const orderId = Number(input.params?.orderId ?? input.body?.orderId ?? 0);
  if (!Number.isFinite(orderId) || orderId <= 0) throw new AppError(400, 'VALIDATION', 'orderId không hợp lệ');

  return withTransaction(async (client) => {
    const orderRow = await client.query('SELECT * FROM orders WHERE order_id = $1 FOR UPDATE', [orderId]);
    if (!orderRow.rows[0]) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy đơn hàng');

    const order = orderRow.rows[0];
    if (Number(order.user_id) !== userId) throw new AppError(403, 'FORBIDDEN', 'Bạn không có quyền thanh toán đơn này');
    if (order.status === 'PAID') return { orderId: String(order.order_id), status: 'PAID', paid: true };
    if (order.status === 'CANCELLED') throw new AppError(409, 'ORDER_CANCELLED', 'Đơn đã bị hủy');

    await client.query(
      `INSERT INTO payments (order_id, amount, method, status, paid_at)
       VALUES ($1, $2, $3, 'SUCCESS', now())`,
      [orderId, order.total, 'CARD'],
    );

    await client.query(
      `UPDATE orders SET status = 'PAID' WHERE order_id = $1`,
      [orderId],
    );

    await client.query(
      `UPDATE seats
          SET status = 'SOLD', held_by = NULL, held_until = NULL, version = version + 1
        WHERE seat_id IN (SELECT seat_id FROM tickets WHERE order_id = $1)`,
      [orderId],
    );

    return {
      orderId: String(order.order_id),
      status: 'PAID',
      paid: true,
      amount: Number(order.total),
    };
  });
}

export async function cancelOrder(input = {}) {
  const userId = parseUserId(input.user?.userId ?? input.body?.userId);
  const orderId = Number(input.params?.orderId ?? input.body?.orderId ?? 0);
  if (!Number.isFinite(orderId) || orderId <= 0) throw new AppError(400, 'VALIDATION', 'orderId không hợp lệ');

  return withTransaction(async (client) => {
    const orderRow = await client.query('SELECT * FROM orders WHERE order_id = $1 FOR UPDATE', [orderId]);
    if (!orderRow.rows[0]) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy đơn hàng');

    const order = orderRow.rows[0];
    if (Number(order.user_id) !== userId) throw new AppError(403, 'FORBIDDEN', 'Bạn không có quyền hủy đơn này');
    if (order.status === 'CANCELLED') return { cancelled: true, orderId: String(order.order_id), status: 'CANCELLED' };

    const ticketRow = await client.query('SELECT * FROM tickets WHERE order_id = $1 FOR UPDATE', [orderId]);
    const seatIds = ticketRow.rows.map((t) => t.seat_id);

    if (seatIds.length > 0) {
      await client.query(
        `UPDATE tickets SET status = 'CANCELLED' WHERE order_id = $1`,
        [orderId],
      );
      await client.query(
        `UPDATE seats
            SET status = 'AVAILABLE', held_by = NULL, held_until = NULL, version = version + 1
          WHERE seat_id = ANY($1)`,
        [seatIds],
      );
    }

    await client.query(
      `UPDATE orders SET status = 'CANCELLED' WHERE order_id = $1`,
      [orderId],
    );

    return {
      cancelled: true,
      orderId: String(order.order_id),
      status: 'CANCELLED',
      seatIds,
    };
  });
}

export async function listMyOrders(input = {}) {
  const userId = parseUserId(input.user?.userId ?? input.body?.userId);
  const { rows } = await pool.query(
    `SELECT o.*, COUNT(t.ticket_id)::int AS ticket_count, COALESCE(SUM(t.price), 0)::numeric AS ticket_total
       FROM orders o
       LEFT JOIN tickets t ON t.order_id = o.order_id
      WHERE o.user_id = $1
      GROUP BY o.order_id
      ORDER BY o.created_at DESC`,
    [userId],
  );

  return rows.map((row) => ({
    orderId: String(row.order_id),
    userId: String(row.user_id),
    eventId: String(row.event_id),
    total: Number(row.total),
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    ticketCount: Number(row.ticket_count ?? 0),
    ticketTotal: Number(row.ticket_total ?? 0),
  }));
}
