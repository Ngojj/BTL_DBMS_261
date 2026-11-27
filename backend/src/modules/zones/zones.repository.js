// TODO [zones.repository] Phụ trách: TV2 (#9)
// import { notImplemented } from '../../utils/AppError.js';
import { pool, withTransaction } from "../../config/pg.js";

// SQL thuần, tham số $1,$2…; ghi chú loại truy vấn a–h trong comment.

// [d] #9 – khu vực của sự kiện
export async function listZones({ params }) {
  const { rows } = await pool.query(
    `SELECT
       z.zone_id,
       z.event_id,
       z.name,
       z.price,
       z.capacity,
       COUNT(s.seat_id)::int AS seat_count,
       COUNT(s.seat_id) FILTER (WHERE s.status = 'AVAILABLE')::int AS available_seats,
       COUNT(s.seat_id) FILTER (WHERE s.status = 'HELD')::int AS held_seats,
       COUNT(s.seat_id) FILTER (WHERE s.status = 'SOLD')::int AS sold_seats
     FROM zones z
     LEFT JOIN seats s
       ON s.zone_id = z.zone_id
     WHERE z.event_id = $1
     GROUP BY z.zone_id
     ORDER BY z.zone_id`,
    [params.eventId],
  );

  return rows;
  // throw notImplemented("zones.listZones");
}

// Thống kê nội bộ cho khu vực
export async function getZoneStats(zoneId) {
  const { rows } = await pool.query(
    `SELECT
       z.zone_id,
       z.event_id,
       z.capacity,

       (
         SELECT COUNT(*)::int
         FROM seats s
         WHERE s.zone_id = z.zone_id
       ) AS seat_count,

       (
         SELECT COUNT(*)::int
         FROM tickets t
         JOIN seats s
           ON s.seat_id = t.seat_id
         WHERE s.zone_id = z.zone_id
       ) AS ticket_count

     FROM zones z
     WHERE z.zone_id = $1`,
    [zoneId],
  );

  return rows[0] ?? null;
}

// [a] #9 – thêm khu vực + giá vé
export async function createZone({ params, body }) {
  const { rows } = await pool.query(
    `INSERT INTO zones (
       event_id,
       name,
       price,
       capacity
     )
     VALUES ($1, $2, $3, $4)
     RETURNING
       zone_id,
       event_id,
       name,
       price,
       capacity`,
    [params.eventId, body.name, body.price, body.capacity],
  );

  return rows[0];
  // throw notImplemented("zones.createZone");
}

// [c] #9 – sửa khu vực / giá
export async function updateZone({ params, body }) {
  const { rows } = await pool.query(
    `UPDATE zones
        SET name = $2,
            price = $3,
            capacity = $4
      WHERE zone_id = $1
      RETURNING
        zone_id,
        event_id,
        name,
        price,
        capacity`,
    [params.zoneId, body.name, body.price, body.capacity],
  );

  return rows[0] ?? null;
  // throw notImplemented("zones.updateZone");
}

// [b] #9 – xóa khu vực
export async function deleteZone({ params }) {
  const { rows } = await pool.query(
    `DELETE FROM zones
      WHERE zone_id = $1
      RETURNING
        zone_id,
        event_id,
        name`,
    [params.zoneId],
  );

  return rows[0] ?? null;
  // throw notImplemented("zones.deleteZone");
}

// [a] #9 – sinh ghế cho khu vực (bulk insert)
export async function generateSeats({ params, body }) {
  const seatRows = body.seatRows ?? [];

  if (seatRows.length === 0) {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS seat_count
       FROM seats
       WHERE zone_id = $1`,
      [params.zoneId],
    );

    return {
      created: 0,
      seatCount: rows[0].seat_count,
    };
  }

  const zoneIds = seatRows.map(() => params.zoneId);
  const rowLabels = seatRows.map((seat) => seat.rowLabel);
  const seatNos = seatRows.map((seat) => seat.seatNo);

  const { rows } = await pool.query(
    `WITH inserted AS (
       INSERT INTO seats (
         zone_id,
         row_label,
         seat_no
       )
       SELECT *
       FROM unnest(
         $1::bigint[],
         $2::varchar[],
         $3::smallint[]
       )
       ON CONFLICT (
         zone_id,
         row_label,
         seat_no
       )
       DO NOTHING
       RETURNING seat_id
     )

     SELECT
       (
         SELECT COUNT(*)
         FROM inserted
       )::int AS created,

       (
         SELECT COUNT(*)
         FROM seats
         WHERE zone_id = $4
       )::int AS seat_count`,
    [zoneIds, rowLabels, seatNos, params.zoneId],
  );

  return rows[0];
  // throw notImplemented("zones.generateSeats");
}
