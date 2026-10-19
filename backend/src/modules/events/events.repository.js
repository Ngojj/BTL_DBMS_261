// TODO [events.repository] Phụ trách: TV1 (#1, #8) + TV2 (#2)
import { notImplemented } from "../../utils/AppError.js";
import { pool, withTransaction } from "../../config/pg.js";

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
  const where = [
    // Không hiển thị sự kiện nháp, đã hủy hoặc đã kết thúc trên trang sự kiện sắp diễn ra.
    `e.status IN ('ON_SALE', 'SOLD_OUT')`,
  ];

  const addParam = (value) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (query.genreId !== undefined && query.genreId !== "") {
    const genreId = Number(query.genreId);
    if (!Number.isInteger(genreId) || genreId <= 0) {
      const error = new Error("Thể loại không hợp lệ.");
      error.status = 400;
      error.code = "INVALID_GENRE_ID";
      throw error;
    }
    where.push(`e.genre_id = ${addParam(genreId)}::int`);
  }

  if (query.city !== undefined && query.city !== "") {
    where.push(`v.city = ${addParam(String(query.city).trim())}`);
  }

  if (query.dateFrom !== undefined && query.dateFrom !== "") {
    const dateFrom = String(query.dateFrom);
    if (
      !/^\\d{4}-\\d{2}-\\d{2}$/.test(dateFrom) ||
      Number.isNaN(Date.parse(`${dateFrom}T00:00:00Z`))
    ) {
      const error = new Error("Ngày bắt đầu không hợp lệ.");
      error.status = 400;
      error.code = "INVALID_DATE_FROM";
      throw error;
    }
    // Đầu ngày theo múi giờ Việt Nam (UTC+7), không phụ thuộc timezone của PostgreSQL.
    where.push(
      `e.event_date >= (${addParam(dateFrom)}::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')`,
    );
  }

  if (query.dateTo !== undefined && query.dateTo !== "") {
    const dateTo = String(query.dateTo);
    if (
      !/^\\d{4}-\\d{2}-\\d{2}$/.test(dateTo) ||
      Number.isNaN(Date.parse(`${dateTo}T00:00:00Z`))
    ) {
      const error = new Error("Ngày kết thúc không hợp lệ.");
      error.status = 400;
      error.code = "INVALID_DATE_TO";
      throw error;
    }
    // Mốc kết thúc là đầu ngày kế tiếp, để bao gồm toàn bộ ngày dateTo.
    where.push(
      `e.event_date < ((${addParam(dateTo)}::date + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')`,
    );
  }

  if (query.dateFrom && query.dateTo && query.dateFrom > query.dateTo) {
    const error = new Error("Ngày bắt đầu không được sau ngày kết thúc.");
    error.status = 400;
    error.code = "INVALID_DATE_RANGE";
    throw error;
  }

  let priceMinParam = null;
  let priceMaxParam = null;

  if (query.priceMin !== undefined && query.priceMin !== "") {
    const priceMin = Number(query.priceMin);
    if (!Number.isFinite(priceMin) || priceMin < 0) {
      const error = new Error("Giá tối thiểu phải là số không âm.");
      error.status = 400;
      error.code = "INVALID_PRICE_MIN";
      throw error;
    }
    priceMinParam = addParam(priceMin);
  }

  if (query.priceMax !== undefined && query.priceMax !== "") {
    const priceMax = Number(query.priceMax);
    if (!Number.isFinite(priceMax) || priceMax < 0) {
      const error = new Error("Giá tối đa phải là số không âm.");
      error.status = 400;
      error.code = "INVALID_PRICE_MAX";
      throw error;
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
    const error = new Error("Giá tối thiểu không được lớn hơn giá tối đa.");
    error.status = 400;
    error.code = "INVALID_PRICE_RANGE";
    throw error;
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
      WHERE ${where.join("\n      AND ")}
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
export async function getEvent(input) {
  throw notImplemented("events.getEvent");
}

// [a] #8 – thêm sự kiện
export async function createEvent(input) {
  throw notImplemented("events.createEvent");
}

// [c] #8 – sửa sự kiện
export async function updateEvent(input) {
  throw notImplemented("events.updateEvent");
}

// [b] #8 – xóa sự kiện
export async function deleteEvent(input) {
  throw notImplemented("events.deleteEvent");
}
