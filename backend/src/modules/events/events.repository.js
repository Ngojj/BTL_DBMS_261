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
export async function createEvent({ body }) {
  const {
    title,
    genreId,
    venueId,
    eventDate,
    saleOpenAt,
    maxTicketsPerUser = 4,
    status = 'DRAFT',
  } = body;

  const { rows } = await pool.query(
    `
      INSERT INTO events (
        title,
        genre_id,
        venue_id,
        event_date,
        sale_open_at,
        max_tickets_per_user,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING
        event_id AS "eventId",
        title,
        genre_id AS "genreId",
        venue_id AS "venueId",
        event_date AS "eventDate",
        sale_open_at AS "saleOpenAt",
        max_tickets_per_user AS "maxTicketsPerUser",
        status,
        created_at AS "createdAt"
    `,
    [
      title,
      genreId,
      venueId,
      eventDate,
      saleOpenAt,
      maxTicketsPerUser,
      status,
    ],
  );

  return rows[0];
}

// [c] #8 – sửa sự kiện
export async function updateEvent({ params, body }) {
  const { eventId } = params;

  const {
    title,
    genreId,
    venueId,
    eventDate,
    saleOpenAt,
    maxTicketsPerUser,
    status,
  } = body;

  const { rows } = await pool.query(
    `
      UPDATE events
      SET
        title = $2,
        genre_id = $3,
        venue_id = $4,
        event_date = $5,
        sale_open_at = $6,
        max_tickets_per_user = $7,
        status = $8
      WHERE event_id = $1
      RETURNING
        event_id AS "eventId",
        title,
        genre_id AS "genreId",
        venue_id AS "venueId",
        event_date AS "eventDate",
        sale_open_at AS "saleOpenAt",
        max_tickets_per_user AS "maxTicketsPerUser",
        status,
        created_at AS "createdAt"
    `,
    [
      eventId,
      title,
      genreId,
      venueId,
      eventDate,
      saleOpenAt,
      maxTicketsPerUser,
      status,
    ],
  );

  return rows[0] ?? null;
}

// [b] #8 – xóa sự kiện
export async function deleteEvent({ params }) {
  const { rows } = await pool.query(
    `
      DELETE FROM events
      WHERE event_id = $1
      RETURNING event_id AS "eventId", title
    `,
    [params.eventId],
  );

  return rows[0] ?? null;
}
