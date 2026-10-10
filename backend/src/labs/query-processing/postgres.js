// TV3 – SQL JOIN + GROUP BY; cùng quy tắc doanh thu với trang admin.
import { pool } from '../../config/pg.js';
import { AppError } from '../../utils/AppError.js';
import { revenueByZone } from '../../modules/reports/reports.repository.js';
import { MAX_TICKETS, MAX_ZONES, roundMs, totals, validateParams } from './shared.js';

export async function run(params = {}, client = pool) {
  const { eventId } = validateParams(params);
  const started = performance.now();
  // [f,h] Một truy vấn báo cáo; rowsRead đếm dòng truyền về backend, không phải dòng quét.
  const rows = await revenueByZone({ eventId }, client);
  const durationMs = roundMs(performance.now() - started);
  return {
    durationMs,
    metrics: { queries: 1, rowsRead: rows.length, groups: rows.length, ...totals(rows) },
    details: { rows },
  };
}

// Dữ liệu thí nghiệm và báo cáo SQL được đọc trên cùng snapshot.
// Không giữ transaction PostgreSQL trong lúc chờ Firestore.
export async function prepare(params) {
  const { eventId } = validateParams(params);
  const client = await pool.connect();
  const started = performance.now();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await client.query("SET LOCAL statement_timeout = '15s'");
    // [d] Xác nhận sự kiện và lấy mốc snapshot của transaction.
    const eventResult = await client.query(
      `SELECT event_id AS "eventId", title AS "eventTitle",
              transaction_timestamp() AS "snapshotAt" FROM events WHERE event_id = $1`, [eventId]);
    if (!eventResult.rows.length) throw new AppError(404, 'EVENT_NOT_FOUND', 'Không tìm thấy sự kiện');
    const { snapshotAt, ...event } = eventResult.rows[0];
    // [d] Danh mục khu; giữ cả khu chưa có vé hoặc chưa sinh ghế.
    const zones = await client.query(
      `SELECT zone_id AS "zoneId", name AS zone FROM zones
        WHERE event_id = $1 ORDER BY zone_id LIMIT $2`, [eventId, MAX_ZONES + 1]);
    // [f] Xuất dữ liệu nguồn, chưa lọc trạng thái và chưa tổng hợp doanh thu.
    const tickets = await client.query(
      `SELECT t.ticket_id AS "ticketId", z.zone_id AS "zoneId", t.price,
              t.status AS "ticketStatus", o.status AS "orderStatus"
         FROM orders o JOIN tickets t ON t.order_id = o.order_id
         JOIN seats s ON s.seat_id = t.seat_id
         JOIN zones z ON z.zone_id = s.zone_id AND z.event_id = o.event_id
        WHERE o.event_id = $1 ORDER BY t.ticket_id LIMIT $2`, [eventId, MAX_TICKETS + 1]);
    if (zones.rows.length > MAX_ZONES || tickets.rows.length > MAX_TICKETS) {
      throw new AppError(422, 'LAB_DATASET_TOO_LARGE', `Lab hỗ trợ tối đa ${MAX_ZONES} khu và ${MAX_TICKETS} vé mỗi sự kiện`);
    }
    const result = await run({ eventId }, client);
    await client.query('COMMIT');
    return {
      event, zones: zones.rows, tickets: tickets.rows, result,
      snapshotAt: snapshotAt.toISOString(),
      preparationMs: roundMs(performance.now() - started - result.durationMs),
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
