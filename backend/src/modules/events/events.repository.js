import { pool } from '../../config/pg.js';
import { AppError } from '../../utils/AppError.js';

// SQL thuần, tham số $1,$2…; ghi chú loại truy vấn a–h trong comment.

// [d] List events available for the week-42 purchase flow.
export async function listEvents() {
  const { rows } = await pool.query(
    `SELECT e.event_id, e.title, e.genre_id, e.venue_id, e.event_date, e.sale_open_at,
            e.max_tickets_per_user, e.status, g.name AS genre_name,
            v.name AS venue_name, v.city, COALESCE(MIN(z.price), 0) AS min_price
       FROM events e
       JOIN genres g ON g.genre_id = e.genre_id
       JOIN venues v ON v.venue_id = e.venue_id
       LEFT JOIN zones z ON z.event_id = e.event_id
      WHERE e.status IN ('ON_SALE', 'SOLD_OUT')
      GROUP BY e.event_id, g.name, v.name, v.city
      ORDER BY e.event_date`,
  );
  return rows;
}

// [d] One-condition event detail lookup used by seat selection.
export async function getEvent(input = {}) {
  const eventId = Number(input.params?.eventId);
  if (!Number.isSafeInteger(eventId) || eventId <= 0) throw new AppError(400, 'VALIDATION', 'eventId không hợp lệ');
  const result = await pool.query(
    `SELECT e.*, g.name AS genre_name, v.name AS venue_name, v.city, v.address
       FROM events e
       JOIN genres g ON g.genre_id = e.genre_id
       JOIN venues v ON v.venue_id = e.venue_id
      WHERE e.event_id = $1`,
    [eventId],
  );
  if (!result.rows[0]) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy sự kiện');
  const zones = await pool.query(
    'SELECT zone_id, name, price, capacity FROM zones WHERE event_id = $1 ORDER BY price, name',
    [eventId],
  );
  return { ...result.rows[0], zones: zones.rows };
}
