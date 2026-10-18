import { pool } from '../../config/pg.js';
import { AppError } from '../../utils/AppError.js';

// SQL thuần, tham số $1,$2…; ghi chú loại truy vấn a–h trong comment.

// Read zones and seats from PostgreSQL for the purchase flow.
export async function listZones(input = {}) {
  const eventId = Number(input.params?.eventId);
  if (!Number.isSafeInteger(eventId) || eventId <= 0) throw new AppError(400, 'VALIDATION', 'eventId không hợp lệ');
  const { rows } = await pool.query(
    `SELECT z.zone_id, z.event_id, z.name, z.price, z.capacity, COUNT(s.seat_id)::int AS seat_count
       FROM zones z LEFT JOIN seats s ON s.zone_id = z.zone_id
      WHERE z.event_id = $1
      GROUP BY z.zone_id
      ORDER BY z.price, z.name`,
    [eventId],
  );
  return rows;
}

export async function listSeats(input = {}) {
  const zoneId = Number(input.params?.zoneId);
  if (!Number.isSafeInteger(zoneId) || zoneId <= 0) throw new AppError(400, 'VALIDATION', 'zoneId không hợp lệ');
  const { rows } = await pool.query(
    `SELECT s.seat_id, s.row_label, s.seat_no,
            CASE WHEN s.status = 'HELD' AND s.held_until <= now() THEN 'AVAILABLE' ELSE s.status END AS status,
            z.price
       FROM seats s JOIN zones z ON z.zone_id = s.zone_id
      WHERE s.zone_id = $1
      ORDER BY s.row_label, s.seat_no`,
    [zoneId],
  );
  return rows;
}
