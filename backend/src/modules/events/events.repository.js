import { pool, withTransaction } from '../../config/pg.js';
import { AppError } from '../../utils/AppError.js';

const bodyOf = (input) => input?.body ?? input ?? {};
const paramsOf = (input) => input?.params ?? {};

const parseId = (value, field) => {
  const num = Number(value);
  if (value === undefined || value === null || value === '' || !Number.isFinite(num) || num <= 0) {
    throw new AppError(400, 'VALIDATION', `Trường ${field} không hợp lệ`);
  }
  return num;
};

const parseDate = (value, field) => {
  if (!value) throw new AppError(400, 'VALIDATION', `Thiếu ${field}`);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new AppError(400, 'VALIDATION', `Trường ${field} không hợp lệ`);
  return d.toISOString();
};

const normalizeStatus = (status) => {
  const s = String(status ?? '').toUpperCase();
  const allowed = ['DRAFT', 'ON_SALE', 'SOLD_OUT', 'CANCELLED', 'ENDED'];
  if (!allowed.includes(s)) throw new AppError(400, 'VALIDATION', 'status không hợp lệ');
  return s;
};

const toInt = (value, field, { min = 0, max } = {}) => {
  const num = Number(value);
  if (!Number.isFinite(num)) throw new AppError(400, 'VALIDATION', `Trường ${field} không hợp lệ`);
  if (num < min || (max !== undefined && num > max)) {
    throw new AppError(400, 'VALIDATION', `Trường ${field} nằm ngoài phạm vi cho phép`);
  }
  return Math.trunc(num);
};

async function findEventById(eventId) {
  const { rows } = await pool.query(
    `SELECT e.*, g.name AS genre_name, v.name AS venue_name, v.city, v.address
       FROM events e
       JOIN genres g ON g.genre_id = e.genre_id
       JOIN venues v ON v.venue_id = e.venue_id
      WHERE e.event_id = $1`,
    [eventId],
  );

  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy sự kiện');
  return rows[0];
}

async function findZoneById(zoneId) {
  const { rows } = await pool.query(
    `SELECT z.*, COUNT(s.seat_id)::int AS seat_count
       FROM zones z
       LEFT JOIN seats s ON s.zone_id = z.zone_id
      WHERE z.zone_id = $1
      GROUP BY z.zone_id`,
    [zoneId],
  );

  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy khu vực');
  return rows[0];
}

// [d] #1 – danh sách thể loại
export async function listGenres() {
  const { rows } = await pool.query('SELECT genre_id, name FROM genres ORDER BY name ASC');
  return rows;
}

// [d,e] #1 lọc theo thể loại [d]; #2 lọc thành phố + khoảng ngày + khoảng giá [e]
export async function listEvents(input = {}) {
  const query = input.query ?? {};
  const conditions = [];
  const params = [];
  let index = 1;

  const genreId = query.genreId ?? query.genre_id ?? query.genre;
  if (genreId !== undefined && genreId !== null && genreId !== '') {
    conditions.push(`e.genre_id = $${index}`);
    params.push(parseId(genreId, 'genreId'));
    index += 1;
  }

  const city = query.city ?? query.location;
  if (city) {
    conditions.push(`LOWER(v.city) = LOWER($${index})`);
    params.push(String(city));
    index += 1;
  }

  const startDate = query.startDate ?? query.from;
  if (startDate) {
    conditions.push(`e.event_date >= $${index}`);
    params.push(parseDate(startDate, 'startDate'));
    index += 1;
  }

  const endDate = query.endDate ?? query.to;
  if (endDate) {
    conditions.push(`e.event_date <= $${index}`);
    params.push(parseDate(endDate, 'endDate'));
    index += 1;
  }

  const minPrice = query.minPrice ?? query.min_price;
  if (minPrice !== undefined && minPrice !== null && minPrice !== '') {
    conditions.push(`COALESCE(MIN(z.price), 0) >= $${index}`);
    params.push(Number(minPrice));
    index += 1;
  }

  const maxPrice = query.maxPrice ?? query.max_price;
  if (maxPrice !== undefined && maxPrice !== null && maxPrice !== '') {
    conditions.push(`COALESCE(MIN(z.price), 0) <= $${index}`);
    params.push(Number(maxPrice));
    index += 1;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT e.*, g.name AS genre_name, v.name AS venue_name, v.city, v.address,
            COALESCE(MIN(z.price), 0) AS min_price
       FROM events e
       JOIN genres g ON g.genre_id = e.genre_id
       JOIN venues v ON v.venue_id = e.venue_id
       LEFT JOIN zones z ON z.event_id = e.event_id
       ${whereClause}
      GROUP BY e.event_id, g.name, v.name, v.city, v.address
      ORDER BY e.event_date ASC`,
    params,
  );

  return rows;
}

// [d] Chi tiết sự kiện + các khu vực
export async function getEvent(input = {}) {
  const eventId = parseId(paramsOf(input).eventId ?? bodyOf(input).eventId, 'eventId');
  const event = await findEventById(eventId);
  const { rows: zones } = await pool.query(
    `SELECT * FROM zones WHERE event_id = $1 ORDER BY price DESC, name ASC`,
    [eventId],
  );
  return { ...event, zones };
}

// [a] #8 – thêm sự kiện
export async function createEvent(input = {}) {
  const body = bodyOf(input);
  const title = String(body.title ?? '').trim();
  if (!title) throw new AppError(400, 'VALIDATION', 'Thiếu tiêu đề sự kiện');

  const genreId = parseId(body.genreId ?? body.genre_id, 'genreId');
  const venueId = parseId(body.venueId ?? body.venue_id, 'venueId');
  const eventDate = parseDate(body.eventDate ?? body.event_date, 'eventDate');
  const saleOpenAt = parseDate(body.saleOpenAt ?? body.sale_open_at, 'saleOpenAt');

  const maxTicketsPerUser = toInt(body.maxTicketsPerUser ?? body.max_tickets_per_user ?? 4, 'maxTicketsPerUser', {
    min: 1,
    max: 10,
  });

  if (new Date(saleOpenAt) >= new Date(eventDate)) {
    throw new AppError(400, 'VALIDATION', 'saleOpenAt phải trước eventDate');
  }

  const status = normalizeStatus(body.status ?? 'DRAFT');

  const { rows } = await pool.query(
    `INSERT INTO events (title, genre_id, venue_id, event_date, sale_open_at, max_tickets_per_user, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [title, genreId, venueId, eventDate, saleOpenAt, maxTicketsPerUser, status],
  );

  return rows[0];
}

// [c] #8 – sửa sự kiện
export async function updateEvent(input = {}) {
  const body = bodyOf(input);
  const eventId = parseId(paramsOf(input).eventId ?? body.eventId, 'eventId');
  const current = await findEventById(eventId);

  const updates = {};
  const fields = [];
  const values = [];
  let index = 1;

  if (body.title !== undefined) {
    const title = String(body.title).trim();
    if (!title) throw new AppError(400, 'VALIDATION', 'Thiếu tiêu đề sự kiện');
    updates.title = title;
  }
  if (body.genreId !== undefined || body.genre_id !== undefined) {
    updates.genre_id = parseId(body.genreId ?? body.genre_id, 'genreId');
  }
  if (body.venueId !== undefined || body.venue_id !== undefined) {
    updates.venue_id = parseId(body.venueId ?? body.venue_id, 'venueId');
  }
  if (body.eventDate !== undefined || body.event_date !== undefined) {
    updates.event_date = parseDate(body.eventDate ?? body.event_date, 'eventDate');
  }
  if (body.saleOpenAt !== undefined || body.sale_open_at !== undefined) {
    updates.sale_open_at = parseDate(body.saleOpenAt ?? body.sale_open_at, 'saleOpenAt');
  }
  if (body.maxTicketsPerUser !== undefined || body.max_tickets_per_user !== undefined) {
    updates.max_tickets_per_user = toInt(body.maxTicketsPerUser ?? body.max_tickets_per_user, 'maxTicketsPerUser', {
      min: 1,
      max: 10,
    });
  }
  if (body.status !== undefined) {
    updates.status = normalizeStatus(body.status);
  }

  if (Object.keys(updates).length === 0) {
    return current;
  }

  const nextEventDate = updates.event_date ?? current.event_date;
  const nextSaleOpenAt = updates.sale_open_at ?? current.sale_open_at;
  if (new Date(nextSaleOpenAt) >= new Date(nextEventDate)) {
    throw new AppError(400, 'VALIDATION', 'saleOpenAt phải trước eventDate');
  }

  Object.entries(updates).forEach(([key, value]) => {
    fields.push(`${key} = $${index}`);
    values.push(value);
    index += 1;
  });

  values.push(eventId);

  const { rows } = await pool.query(
    `UPDATE events SET ${fields.join(', ')} WHERE event_id = $${index} RETURNING *`,
    values,
  );

  return rows[0];
}

// [b] #8 – xóa sự kiện
export async function deleteEvent(input = {}) {
  const eventId = parseId(paramsOf(input).eventId ?? bodyOf(input).eventId, 'eventId');
  const event = await findEventById(eventId);
  await pool.query('DELETE FROM events WHERE event_id = $1', [eventId]);
  return { deleted: true, event };
}

