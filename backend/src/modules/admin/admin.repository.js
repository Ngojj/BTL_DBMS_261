import { pool, withTransaction } from '../../config/pg.js';
import { AppError } from '../../utils/AppError.js';

// ─── EVENTS CRUD ─────────────────────────────────────────────────────────────

// [d] truy vấn một điều kiện – list all events for admin (bao gồm DRAFT)
export async function adminListEvents() {
  const { rows } = await pool.query(
    `SELECT e.event_id, e.title, e.status, e.event_date, e.sale_open_at,
            e.max_tickets_per_user, e.created_at,
            g.name AS genre_name, v.name AS venue_name, v.city,
            COUNT(DISTINCT z.zone_id)::int AS zone_count,
            COALESCE(SUM(z.capacity), 0)::int AS total_capacity
       FROM events e
       JOIN genres g ON g.genre_id = e.genre_id
       JOIN venues v ON v.venue_id = e.venue_id
       LEFT JOIN zones z ON z.event_id = e.event_id
      GROUP BY e.event_id, g.name, v.name, v.city
      ORDER BY e.event_date DESC`,
  );
  return rows.map((row) => ({
    eventId:         String(row.event_id),
    title:           row.title,
    status:          row.status,
    eventDate:       row.event_date,
    saleOpenAt:      row.sale_open_at,
    maxTickets:      row.max_tickets_per_user,
    createdAt:       row.created_at,
    genreName:       row.genre_name,
    venueName:       row.venue_name,
    city:            row.city,
    zoneCount:       row.zone_count,
    totalCapacity:   row.total_capacity,
  }));
}

// [a] insert event
export async function adminCreateEvent(input = {}) {
  const { title, genreId, venueId, eventDate, saleOpenAt, maxTicketsPerUser = 4, status = 'DRAFT' } = input?.body ?? {};
  if (!title || !genreId || !venueId || !eventDate || !saleOpenAt)
    throw new AppError(400, 'VALIDATION', 'Thiếu thông tin sự kiện');
  const { rows } = await pool.query(
    `INSERT INTO events (title, genre_id, venue_id, event_date, sale_open_at, max_tickets_per_user, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [title, genreId, venueId, eventDate, saleOpenAt, maxTicketsPerUser, status],
  );
  return rows[0];
}

// [c] update event
export async function adminUpdateEvent(input = {}) {
  const eventId = Number(input?.params?.eventId);
  if (!Number.isSafeInteger(eventId) || eventId <= 0)
    throw new AppError(400, 'VALIDATION', 'eventId không hợp lệ');
  const { title, status, eventDate, saleOpenAt, maxTicketsPerUser } = input?.body ?? {};
  const { rows } = await pool.query(
    `UPDATE events
        SET title                = COALESCE($1, title),
            status               = COALESCE($2, status),
            event_date           = COALESCE($3, event_date),
            sale_open_at         = COALESCE($4, sale_open_at),
            max_tickets_per_user = COALESCE($5, max_tickets_per_user)
      WHERE event_id = $6 RETURNING *`,
    [title ?? null, status ?? null, eventDate ?? null, saleOpenAt ?? null, maxTicketsPerUser ?? null, eventId],
  );
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy sự kiện');
  return rows[0];
}

// [b] delete event (CASCADE zones → seats → tickets → orders → payments → reviews)
export async function adminDeleteEvent(input = {}) {
  const eventId = Number(input?.params?.eventId);
  if (!Number.isSafeInteger(eventId) || eventId <= 0)
    throw new AppError(400, 'VALIDATION', 'eventId không hợp lệ');
  const { rowCount } = await pool.query('DELETE FROM events WHERE event_id = $1', [eventId]);
  if (!rowCount) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy sự kiện');
  return { deleted: true, eventId: String(eventId) };
}

// ─── ZONES CRUD ──────────────────────────────────────────────────────────────

// [a] insert zone + sinh ghế
export async function adminCreateZone(input = {}) {
  const eventId = Number(input?.params?.eventId);
  if (!Number.isSafeInteger(eventId) || eventId <= 0)
    throw new AppError(400, 'VALIDATION', 'eventId không hợp lệ');
  const { name, price, capacity, rowCount = 1, seatsPerRow } = input?.body ?? {};
  if (!name || price == null || !capacity)
    throw new AppError(400, 'VALIDATION', 'Thiếu name, price hoặc capacity');

  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO zones (event_id, name, price, capacity) VALUES ($1, $2, $3, $4) RETURNING *`,
      [eventId, name, price, capacity],
    );
    const zone = rows[0];

    // Sinh ghế tự động nếu cung cấp rowCount và seatsPerRow
    const rCount = Number(rowCount);
    const sCount = Number(seatsPerRow);
    if (rCount > 0 && sCount > 0) {
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      for (let r = 0; r < rCount; r++) {
        const rowLabel = alphabet[r] ?? String(r + 1);
        for (let s = 1; s <= sCount; s++) {
          await client.query(
            'INSERT INTO seats (zone_id, row_label, seat_no) VALUES ($1, $2, $3)',
            [zone.zone_id, rowLabel, s],
          );
        }
      }
    }
    return { zoneId: String(zone.zone_id), name: zone.name, price: Number(zone.price), capacity: zone.capacity };
  });
}

// [c] update zone price/capacity
export async function adminUpdateZone(input = {}) {
  const zoneId = Number(input?.params?.zoneId);
  if (!Number.isSafeInteger(zoneId) || zoneId <= 0)
    throw new AppError(400, 'VALIDATION', 'zoneId không hợp lệ');
  const { name, price, capacity } = input?.body ?? {};
  const { rows } = await pool.query(
    `UPDATE zones
        SET name     = COALESCE($1, name),
            price    = COALESCE($2, price),
            capacity = COALESCE($3, capacity)
      WHERE zone_id = $4 RETURNING *`,
    [name ?? null, price ?? null, capacity ?? null, zoneId],
  );
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy khu vực');
  return rows[0];
}

// [b] delete zone
export async function adminDeleteZone(input = {}) {
  const zoneId = Number(input?.params?.zoneId);
  if (!Number.isSafeInteger(zoneId) || zoneId <= 0)
    throw new AppError(400, 'VALIDATION', 'zoneId không hợp lệ');
  const { rowCount } = await pool.query('DELETE FROM zones WHERE zone_id = $1', [zoneId]);
  if (!rowCount) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy khu vực');
  return { deleted: true, zoneId: String(zoneId) };
}

// ─── GENRES & VENUES (lookup cho form tạo sự kiện) ──────────────────────────

export async function listGenres() {
  const { rows } = await pool.query('SELECT genre_id, name FROM genres ORDER BY name');
  return rows;
}

export async function listVenues() {
  const { rows } = await pool.query('SELECT venue_id, name, city, address FROM venues ORDER BY city, name');
  return rows;
}
