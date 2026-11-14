// TODO [events.repository] Phụ trách: TV1 (#1, #8) + TV2 (#2)
import { AppError, notImplemented } from '../../utils/AppError.js';
import { pool, withTransaction } from '../../config/pg.js';

// SQL thuần, tham số $1,$2…; ghi chú loại truy vấn a–h trong comment.

// [d] #1 – danh sách thể loại
export async function listGenres(input) {
  const { rows } = await pool.query(
    `SELECT genre_id AS "genreId", name
         FROM genres
        ORDER BY name ASC`,
  );
  return rows;
  // throw notImplemented("events.listGenres");
}

// [d,e] #1 lọc theo thể loại [d]; #2 lọc thành phố + khoảng ngày + khoảng giá [e]
export async function listEvents(input) {
  const query = input.query ?? {};
  const values = [];
  // Trang công khai không hiện sự kiện nháp, đã hủy hoặc đã kết thúc. includeAll (chỉ quản trị/soát vé) hiện mọi trạng thái.
  const where = input.includeAll ? [] : [`e.status IN ('ON_SALE', 'SOLD_OUT')`];

  const addParam = (value) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (query.genreId !== undefined && query.genreId !== "") {
    const genreId = Number(query.genreId);
    if (!Number.isInteger(genreId) || genreId <= 0) {
      throw new AppError(400, "INVALID_GENRE_ID", "Thể loại không hợp lệ.");
    }
    where.push(`e.genre_id = ${addParam(genreId)}::int`);
  }

  if (query.city !== undefined && query.city !== "") {
    where.push(`v.city = ${addParam(String(query.city).trim())}`);
  }

  if (query.dateFrom !== undefined && query.dateFrom !== "") {
    const dateFrom = String(query.dateFrom);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(dateFrom) ||
      Number.isNaN(Date.parse(`${dateFrom}T00:00:00Z`))
    ) {
      throw new AppError(400, "INVALID_DATE_FROM", "Ngày bắt đầu không hợp lệ.");
    }
    // Đầu ngày theo múi giờ Việt Nam (UTC+7), không phụ thuộc timezone của PostgreSQL.
    where.push(
      `e.event_date >= (${addParam(dateFrom)}::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')`,
    );
  }

  if (query.dateTo !== undefined && query.dateTo !== "") {
    const dateTo = String(query.dateTo);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(dateTo) ||
      Number.isNaN(Date.parse(`${dateTo}T00:00:00Z`))
    ) {
      throw new AppError(400, "INVALID_DATE_TO", "Ngày kết thúc không hợp lệ.");
    }
    // Mốc kết thúc là đầu ngày kế tiếp, để bao gồm toàn bộ ngày dateTo.
    where.push(
      `e.event_date < ((${addParam(dateTo)}::date + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')`,
    );
  }

  if (query.dateFrom && query.dateTo && query.dateFrom > query.dateTo) {
    throw new AppError(400, "INVALID_DATE_RANGE", "Ngày bắt đầu không được sau ngày kết thúc.");
  }

  let priceMinParam = null;
  let priceMaxParam = null;

  if (query.priceMin !== undefined && query.priceMin !== "") {
    const priceMin = Number(query.priceMin);
    if (!Number.isFinite(priceMin) || priceMin < 0) {
      throw new AppError(400, "INVALID_PRICE_MIN", "Giá tối thiểu phải là số không âm.");
    }
    priceMinParam = addParam(priceMin);
  }

  if (query.priceMax !== undefined && query.priceMax !== "") {
    const priceMax = Number(query.priceMax);
    if (!Number.isFinite(priceMax) || priceMax < 0) {
      throw new AppError(400, "INVALID_PRICE_MAX", "Giá tối đa phải là số không âm.");
    }
    priceMaxParam = addParam(priceMax);
  }

  if (
    query.priceMin !== undefined &&
    query.priceMin !== "" &&
    query.priceMax !== undefined &&
    query.priceMax !== "" &&
    Number(query.priceMin) > Number(query.priceMax)
  ) {
    throw new AppError(400, "INVALID_PRICE_RANGE", "Giá tối thiểu không được lớn hơn giá tối đa.");
  }

  const having = [];
  if (priceMinParam) having.push(`MIN(z.price) >= ${priceMinParam}::numeric`);
  if (priceMaxParam) having.push(`MIN(z.price) <= ${priceMaxParam}::numeric`);

  const sql = `
      SELECT
        e.event_id AS "eventId",
        e.title,
        g.name AS genre,
        e.genre_id AS "genreId",
        v.name AS "venueName",
        v.city,
        e.event_date AS "eventDate",
        e.sale_open_at AS "saleOpenAt",
        MIN(z.price) AS "minPrice",
        e.status::text AS status,
        e.venue_id AS "venueId"
      FROM events e
      JOIN genres g ON g.genre_id = e.genre_id
      JOIN venues v ON v.venue_id = e.venue_id
      LEFT JOIN zones z ON z.event_id = e.event_id
      ${where.length ? `WHERE ${where.join("\n      AND ")}` : ""}
      GROUP BY
        e.event_id, e.title, g.name, e.genre_id,
        v.name, v.city, e.event_date, e.sale_open_at,
        e.status, e.venue_id
      ${having.length ? `HAVING ${having.join("\n      AND ")}` : ""}
      ORDER BY e.event_date ASC, e.event_id ASC
    `;

  const { rows } = await pool.query(sql, values);
  return rows;
  // throw notImplemented("events.listEvents");
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

// [d] Danh sách địa điểm (cho form tạo/sửa sự kiện, thay cho việc gõ tay mã địa điểm)
export async function listVenues() {
  const { rows } = await pool.query(
    `SELECT venue_id AS "venueId", name, city, address FROM venues ORDER BY city, name`,
  );
  return rows;
}
