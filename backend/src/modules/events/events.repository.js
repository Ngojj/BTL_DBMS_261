// TODO [events.repository] Phụ trách: TV1 (#1, #8) + TV2 (#2)
import { notImplemented } from '../../utils/AppError.js';
import { pool, withTransaction } from '../../config/pg.js';

// SQL thuần, tham số $1,$2…; ghi chú loại truy vấn a–h trong comment.

// [d] #1 – danh sách thể loại
export async function listGenres() {
  const {rows} = await pool.query(
    'SELECT genre_id AS "genreId", name FROM genres ORDER BY name;'
  )
  return rows;
}

// [d,e] #1 lọc theo thể loại [d]; #2 lọc thành phố + khoảng ngày + khoảng giá [e]
// [d] #1 – danh sách sự kiện, lọc theo thể loại
export async function listEvents({ query = {} }) {
  const values = [];

  let sql = `
    SELECT
      e.event_id AS "eventId",
      e.title,
      e.genre_id AS "genreId",
      e.venue_id AS "venueId",
      e.event_date AS "eventDate",
      e.sale_open_at AS "saleOpenAt",
      e.status,
      g.name AS genre,
      v.name AS "venueName",
      v.city,
      MIN(z.price) AS "minPrice"
    FROM events e
    JOIN genres g ON e.genre_id = g.genre_id
    JOIN venues v ON e.venue_id = v.venue_id
    LEFT JOIN zones z ON e.event_id = z.event_id
  `;

  if (query.genreId !== undefined) {
    values.push(query.genreId);
    sql += ` WHERE e.genre_id = $1`;
  }

  sql += `
    GROUP BY e.event_id, g.genre_id, v.venue_id
    ORDER BY e.event_date, e.event_id
  `;

  const { rows } = await pool.query(sql, values);
  return rows;
}

// [d] Chi tiết sự kiện + các khu vực
// [d] Chi tiết sự kiện + các khu vực
export async function getEvent({ params }) {
  const { eventId } = params;

  const { rows } = await pool.query(
    `
      SELECT
        e.event_id AS "eventId",
        e.title,
        e.genre_id AS "genreId",
        e.venue_id AS "venueId",
        e.event_date AS "eventDate",
        e.sale_open_at AS "saleOpenAt",
        e.max_tickets_per_user AS "maxTicketsPerUser",
        e.status,
        g.name AS genre,
        v.name AS "venueName",
        v.city,
        MIN(z.price) AS "minPrice"
      FROM events e
      JOIN genres g ON e.genre_id = g.genre_id
      JOIN venues v ON e.venue_id = v.venue_id
      LEFT JOIN zones z ON e.event_id = z.event_id
      WHERE e.event_id = $1
      GROUP BY e.event_id, g.genre_id, v.venue_id
    `,
    [eventId],
  );

  const event = rows[0];
  if (!event) return null;

  const { rows: zones } = await pool.query(
    `
      SELECT
        zone_id AS "zoneId",
        name,
        price,
        capacity
      FROM zones
      WHERE event_id = $1
      ORDER BY zone_id
    `,
    [eventId],
  );

  return { ...event, zones };
}

// [a] #8 – thêm sự kiện
export async function createEvent(input) {
  throw notImplemented('events.createEvent');
}

// [c] #8 – sửa sự kiện
export async function updateEvent(input) {
  throw notImplemented('events.updateEvent');
}

// [b] #8 – xóa sự kiện
export async function deleteEvent(input) {
  throw notImplemented('events.deleteEvent');
}
