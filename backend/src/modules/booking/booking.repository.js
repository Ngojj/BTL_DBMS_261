// [booking.repository] #4 mua vé, #5 hủy đơn – SQL thuần, transaction + khóa dòng (SELECT … FOR UPDATE).
// Logic gốc: nhánh Data-Storage (TV4). Đã chỉnh: nhận phương thức thanh toán, trả eventId để đồng bộ Firestore, thêm getOrder cho trang thanh toán.
import { pool, withTransaction } from '../../config/pg.js';
import { AppError } from '../../utils/AppError.js';

const PAYMENT_METHODS = ['CARD', 'E_WALLET', 'BANK_TRANSFER'];

const readUserId = (input) => {
  const userId = Number(input?.user?.userId);
  if (!Number.isSafeInteger(userId) || userId <= 0) throw new AppError(400, 'VALIDATION', 'userId không hợp lệ');
  return userId;
};

const readOrderId = (input) => {
  const orderId = Number(input?.params?.orderId ?? input?.body?.orderId);
  if (!Number.isSafeInteger(orderId) || orderId <= 0) throw new AppError(400, 'VALIDATION', 'orderId không hợp lệ');
  return orderId;
};

const readSeatIds = (input) => {
  const seatIds = input?.body?.seatIds;
  if (!Array.isArray(seatIds) || seatIds.length === 0) throw new AppError(400, 'VALIDATION', 'Phải chọn ít nhất 1 ghế');
  const parsed = seatIds.map(Number);
  if (parsed.some((id) => !Number.isSafeInteger(id) || id <= 0) || new Set(parsed).size !== parsed.length) {
    throw new AppError(400, 'VALIDATION', 'Danh sách ghế không hợp lệ');
  }
  return parsed.sort((left, right) => left - right);
};

async function expireOrders(client, orderIds) {
  if (!orderIds.length) return;
  const { rows } = await client.query(
    'SELECT seat_id FROM tickets WHERE order_id = ANY($1) ORDER BY seat_id FOR UPDATE',
    [orderIds],
  );
  const seatIds = rows.map((row) => row.seat_id);
  await client.query("UPDATE tickets SET status = 'CANCELLED' WHERE order_id = ANY($1) AND status <> 'CANCELLED'", [orderIds]);
  if (seatIds.length) {
    await client.query(
      `UPDATE seats
          SET status = 'AVAILABLE', held_by = NULL, held_until = NULL, version = version + 1
        WHERE seat_id = ANY($1) AND status = 'HELD' AND held_until <= now()`,
      [seatIds],
    );
  }
  await client.query("UPDATE orders SET status = 'EXPIRED' WHERE order_id = ANY($1) AND status = 'PENDING'", [orderIds]);
}

// [a] Insert order/tickets và giữ seat trong cùng transaction; khóa user trước khi đếm giới hạn.
export async function createOrder(input = {}) {
  const userId = readUserId(input);
  const eventId = Number(input.body?.eventId);
  const seatIds = readSeatIds(input);
  if (!Number.isSafeInteger(eventId) || eventId <= 0) throw new AppError(400, 'VALIDATION', 'eventId không hợp lệ');

  return withTransaction(async (client) => {
    const userResult = await client.query('SELECT user_id FROM users WHERE user_id = $1 FOR UPDATE', [userId]);
    if (!userResult.rows[0]) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy người dùng');

    const eventResult = await client.query(
      'SELECT event_id, status, sale_open_at, event_date, max_tickets_per_user FROM events WHERE event_id = $1 FOR UPDATE',
      [eventId],
    );
    const event = eventResult.rows[0];
    if (!event) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy sự kiện');
    if (event.status !== 'ON_SALE') throw new AppError(409, 'EVENT_NOT_ON_SALE', 'Sự kiện hiện không mở bán');
    if (new Date(event.sale_open_at) > new Date()) throw new AppError(409, 'SALE_NOT_OPEN', 'Sự kiện chưa mở bán');
    if (new Date(event.event_date) <= new Date()) throw new AppError(409, 'EVENT_ENDED', 'Sự kiện đã kết thúc');

    const staleOrders = await client.query(
      `SELECT o.order_id
         FROM orders o
        WHERE o.status = 'PENDING'
          AND (o.expires_at <= now() OR EXISTS (
            SELECT 1 FROM tickets t JOIN seats s ON s.seat_id = t.seat_id
             WHERE t.order_id = o.order_id AND s.held_until <= now() AND s.status = 'HELD'
          ))
          AND EXISTS (SELECT 1 FROM tickets t WHERE t.order_id = o.order_id AND t.seat_id = ANY($1))
        FOR UPDATE`,
      [seatIds],
    );
    await expireOrders(client, staleOrders.rows.map((row) => row.order_id));

    const countResult = await client.query(
      `SELECT COUNT(*)::int AS count
         FROM tickets t JOIN orders o ON o.order_id = t.order_id
        WHERE o.user_id = $1 AND o.event_id = $2 AND t.status <> 'CANCELLED'
          AND (o.status = 'PAID' OR (o.status = 'PENDING' AND o.expires_at > now()))`,
      [userId, eventId],
    );
    if (Number(countResult.rows[0]?.count ?? 0) + seatIds.length > Number(event.max_tickets_per_user)) {
      throw new AppError(409, 'TICKET_LIMIT_EXCEEDED', 'Bạn đã vượt giới hạn vé cho sự kiện này');
    }

    const seatsResult = await client.query(
      `SELECT s.seat_id, s.status, s.held_by, z.event_id, z.price
         FROM seats s JOIN zones z ON z.zone_id = s.zone_id
        WHERE s.seat_id = ANY($1)
        ORDER BY s.seat_id
        FOR UPDATE OF s`,
      [seatIds],
    );
    if (seatsResult.rows.length !== seatIds.length) throw new AppError(404, 'SEAT_NOT_FOUND', 'Không tìm thấy một hoặc nhiều ghế');
    for (const seat of seatsResult.rows) {
      if (Number(seat.event_id) !== eventId) throw new AppError(409, 'SEAT_EVENT_MISMATCH', 'Ghế không thuộc sự kiện đã chọn');
      if (seat.status !== 'AVAILABLE') throw new AppError(409, 'SEAT_UNAVAILABLE', `Ghế ${seat.seat_id} không còn trống`);
    }

    const total = seatsResult.rows.reduce((sum, seat) => sum + Number(seat.price), 0);
    const orderResult = await client.query(
      `INSERT INTO orders (user_id, event_id, total, status, expires_at)
       VALUES ($1, $2, $3, 'PENDING', now() + INTERVAL '10 minutes') RETURNING *`,
      [userId, eventId, total],
    );
    const order = orderResult.rows[0];
    const tickets = [];
    for (const seat of seatsResult.rows) {
      const ticketResult = await client.query(
        `INSERT INTO tickets (order_id, seat_id, price, status) VALUES ($1, $2, $3, 'VALID') RETURNING ticket_id, seat_id, qr_code, price`,
        [order.order_id, seat.seat_id, seat.price],
      );
      tickets.push(ticketResult.rows[0]);
    }
    await client.query(
      `UPDATE seats SET status = 'HELD', held_by = $1, held_until = $2, version = version + 1
        WHERE seat_id = ANY($3)`,
      [userId, order.expires_at, seatIds],
    );

    return {
      orderId: String(order.order_id), eventId: String(event.event_id),
      total: Number(order.total), status: order.status, expiresAt: order.expires_at,
      ticketCount: tickets.length, tickets,
    };
  });
}

// [a,c] Insert payment and update order/seats atomically; no real payment provider is called.
export async function payOrder(input = {}) {
  const userId = readUserId(input);
  const orderId = readOrderId(input);
  const method = input.body?.method ?? 'CARD';
  if (!PAYMENT_METHODS.includes(method)) throw new AppError(400, 'VALIDATION', 'Phương thức thanh toán không hợp lệ');
  return withTransaction(async (client) => {
    const result = await client.query('SELECT * FROM orders WHERE order_id = $1 FOR UPDATE', [orderId]);
    const order = result.rows[0];
    if (!order) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy đơn hàng');
    if (Number(order.user_id) !== userId) throw new AppError(403, 'FORBIDDEN', 'Bạn không có quyền thanh toán đơn này');
    // already: true = đơn đã thanh toán từ trước, lần gọi này không làm gì (không gửi thông báo lần nữa)
    if (order.status === 'PAID') return { orderId: String(orderId), eventId: String(order.event_id), status: 'PAID', paid: true, already: true };
    if (order.status !== 'PENDING') throw new AppError(409, 'ORDER_NOT_PAYABLE', 'Đơn hàng không thể thanh toán');
    if (new Date(order.expires_at) <= new Date()) {
      await expireOrders(client, [orderId]);
      return { orderId: String(orderId), eventId: String(order.event_id), status: 'EXPIRED', paid: false };
    }

    const tickets = await client.query(
      `SELECT t.seat_id, s.status, s.held_by, s.held_until
         FROM tickets t JOIN seats s ON s.seat_id = t.seat_id
        WHERE t.order_id = $1 ORDER BY s.seat_id FOR UPDATE OF s`,
      [orderId],
    );
    if (!tickets.rows.length || tickets.rows.some((seat) => seat.status !== 'HELD' || Number(seat.held_by) !== userId || new Date(seat.held_until) <= new Date())) {
      throw new AppError(409, 'HOLD_EXPIRED', 'Thời gian giữ ghế đã hết');
    }
    if (Number(order.total) > 0) {
      await client.query(
        `INSERT INTO payments (order_id, amount, method, status, paid_at) VALUES ($1, $2, $3, 'SUCCESS', now())`,
        [orderId, order.total, method],
      );
    }
    await client.query("UPDATE orders SET status = 'PAID' WHERE order_id = $1", [orderId]);
    await client.query(
      `UPDATE seats SET status = 'SOLD', held_by = NULL, held_until = NULL, version = version + 1
        WHERE seat_id IN (SELECT seat_id FROM tickets WHERE order_id = $1)`,
      [orderId],
    );
    return { orderId: String(orderId), eventId: String(order.event_id), status: 'PAID', paid: true, amount: Number(order.total) };
  });
}

// [c] Cancel all tickets in the order, release seats, and record simulated refund state.
export async function cancelOrder(input = {}) {
  const userId = readUserId(input);
  const orderId = readOrderId(input);
  return withTransaction(async (client) => {
    const result = await client.query('SELECT * FROM orders WHERE order_id = $1 FOR UPDATE', [orderId]);
    const order = result.rows[0];
    if (!order) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy đơn hàng');
    if (Number(order.user_id) !== userId) throw new AppError(403, 'FORBIDDEN', 'Bạn không có quyền hủy đơn này');
    if (order.status === 'CANCELLED') return { cancelled: true, orderId: String(orderId), eventId: String(order.event_id), status: 'CANCELLED', already: true };
    if (order.status === 'EXPIRED') return { cancelled: false, orderId: String(orderId), eventId: String(order.event_id), status: 'EXPIRED' };

    const ticketResult = await client.query('SELECT ticket_id, seat_id, status FROM tickets WHERE order_id = $1 FOR UPDATE', [orderId]);
    if (ticketResult.rows.some((ticket) => ticket.status === 'CHECKED_IN')) {
      throw new AppError(409, 'TICKET_ALREADY_CHECKED_IN', 'Không thể hủy vé đã được soát');
    }
    const seatIds = ticketResult.rows.map((ticket) => ticket.seat_id);
    await client.query("UPDATE tickets SET status = 'CANCELLED' WHERE order_id = $1 AND status <> 'CANCELLED'", [orderId]);
    if (seatIds.length) {
      await client.query(
        `UPDATE seats SET status = 'AVAILABLE', held_by = NULL, held_until = NULL, version = version + 1
          WHERE seat_id = ANY($1) AND ((status = 'HELD' AND held_by = $2) OR (status = 'SOLD' AND $3 = 'PAID'))`,
        [seatIds, userId, order.status],
      );
    }
    if (order.status === 'PAID') {
      await client.query("UPDATE payments SET status = 'REFUNDED' WHERE order_id = $1 AND status = 'SUCCESS'", [orderId]);
    }
    await client.query("UPDATE orders SET status = 'CANCELLED' WHERE order_id = $1", [orderId]);
    return { cancelled: true, orderId: String(orderId), eventId: String(order.event_id), status: 'CANCELLED', seatIds };
  });
}

// [d] One-condition lookup, grouped with order summary for checkout.
export async function listMyOrders(input = {}) {
  const userId = readUserId(input);
  const { rows } = await pool.query(
    `SELECT o.*, e.title AS event_title, e.event_date, v.name AS venue_name,
            COUNT(t.ticket_id)::int AS ticket_count, COALESCE(SUM(t.price), 0)::numeric AS ticket_total
       FROM orders o
       JOIN events e ON e.event_id = o.event_id
       JOIN venues v ON v.venue_id = e.venue_id
       LEFT JOIN tickets t ON t.order_id = o.order_id AND t.status <> 'CANCELLED'
      WHERE o.user_id = $1
      GROUP BY o.order_id, e.event_id, v.venue_id
      ORDER BY o.created_at DESC`,
    [userId],
  );
  return rows.map((row) => ({
    orderId: String(row.order_id), userId: String(row.user_id), eventId: String(row.event_id),
    eventTitle: row.event_title, eventDate: row.event_date, venueName: row.venue_name,
    total: Number(row.total), status: row.status, createdAt: row.created_at, expiresAt: row.expires_at,
    ticketCount: Number(row.ticket_count), ticketTotal: Number(row.ticket_total),
  }));
}

// [f] join: chi tiết một đơn cho trang thanh toán. Chỉ chủ đơn xem được.
export async function getOrder(input = {}) {
  const userId = readUserId(input);
  const orderId = readOrderId(input);
  const { rows } = await pool.query(
    `SELECT o.order_id, o.user_id, o.event_id, o.total, o.status, o.expires_at,
            e.title AS event_title, e.event_date, v.name AS venue_name, v.city
       FROM orders o
       JOIN events e ON e.event_id = o.event_id
       JOIN venues v ON v.venue_id = e.venue_id
      WHERE o.order_id = $1`,
    [orderId],
  );
  const o = rows[0];
  if (!o) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy đơn hàng');
  if (Number(o.user_id) !== userId) throw new AppError(403, 'FORBIDDEN', 'Bạn không có quyền xem đơn này');

  const items = await pool.query(
    `SELECT s.seat_id, s.row_label, s.seat_no, z.name AS zone, t.price
       FROM tickets t
       JOIN seats s ON s.seat_id = t.seat_id
       JOIN zones z ON z.zone_id = s.zone_id
      WHERE t.order_id = $1
      ORDER BY s.seat_id`,
    [orderId],
  );
  return {
    orderId: String(o.order_id), eventId: String(o.event_id), eventTitle: o.event_title, eventDate: o.event_date,
    venueName: o.venue_name, city: o.city, status: o.status, total: Number(o.total), expiresAt: o.expires_at,
    items: items.rows.map((i) => ({ seatId: String(i.seat_id), seatLabel: i.row_label + i.seat_no, zone: i.zone, price: Number(i.price) })),
  };
}
