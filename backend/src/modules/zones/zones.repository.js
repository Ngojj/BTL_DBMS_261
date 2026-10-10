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

const parsePositiveNumber = (value, field) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    throw new AppError(400, 'VALIDATION', `Trường ${field} không hợp lệ`);
  }
  return num;
};

const getRowLabel = (index) => {
  let label = '';
  let n = index;
  do {
    const rem = n % 26;
    label = String.fromCharCode(65 + rem) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label || 'A';
};

// [d] #9 – khu vực của sự kiện
export async function listZones(input = {}) {
  const eventId = parseId(paramsOf(input).eventId ?? bodyOf(input).eventId, 'eventId');
  const { rows } = await pool.query(
    `SELECT z.*, COUNT(s.seat_id)::int AS seat_count
       FROM zones z
       LEFT JOIN seats s ON s.zone_id = z.zone_id
      WHERE z.event_id = $1
      GROUP BY z.zone_id
      ORDER BY z.price DESC, z.name ASC`,
    [eventId],
  );
  return rows;
}

// [a] #9 – thêm khu vực + giá vé
export async function createZone(input = {}) {
  const body = bodyOf(input);
  const eventId = parseId(paramsOf(input).eventId ?? body.eventId, 'eventId');
  const name = String(body.name ?? '').trim();
  if (!name) throw new AppError(400, 'VALIDATION', 'Thiếu tên khu vực');

  const price = parsePositiveNumber(body.price, 'price');
  const capacity = parsePositiveNumber(body.capacity, 'capacity');

  const eventExists = await pool.query('SELECT event_id FROM events WHERE event_id = $1', [eventId]);
  if (!eventExists.rows[0]) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy sự kiện');

  const dup = await pool.query('SELECT 1 FROM zones WHERE event_id = $1 AND LOWER(name) = LOWER($2)', [eventId, name]);
  if (dup.rows[0]) throw new AppError(409, 'CONFLICT', 'Khu vực đã tồn tại trong sự kiện');

  const { rows } = await pool.query(
    `INSERT INTO zones (event_id, name, price, capacity)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [eventId, name, price, capacity],
  );
  return rows[0];
}

// [c] #9 – sửa khu vực / giá
export async function updateZone(input = {}) {
  const body = bodyOf(input);
  const zoneId = parseId(paramsOf(input).zoneId ?? body.zoneId, 'zoneId');
  const current = await pool.query('SELECT * FROM zones WHERE zone_id = $1', [zoneId]);
  if (!current.rows[0]) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy khu vực');

  const updates = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) throw new AppError(400, 'VALIDATION', 'Thiếu tên khu vực');
    updates.name = name;
  }
  if (body.price !== undefined) updates.price = parsePositiveNumber(body.price, 'price');
  if (body.capacity !== undefined) updates.capacity = parsePositiveNumber(body.capacity, 'capacity');

  if (Object.keys(updates).length === 0) return current.rows[0];

  const assignments = [];
  const values = [];
  let index = 1;

  Object.entries(updates).forEach(([key, value]) => {
    assignments.push(`${key} = $${index}`);
    values.push(value);
    index += 1;
  });

  const { rows } = await pool.query(
    `UPDATE zones SET ${assignments.join(', ')} WHERE zone_id = $${index} RETURNING *`,
    [...values, zoneId],
  );

  return rows[0];
}

// [b] #9 – xóa khu vực
export async function deleteZone(input = {}) {
  const zoneId = parseId(paramsOf(input).zoneId ?? bodyOf(input).zoneId, 'zoneId');
  const zone = await pool.query('SELECT * FROM zones WHERE zone_id = $1', [zoneId]);
  if (!zone.rows[0]) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy khu vực');
  await pool.query('DELETE FROM zones WHERE zone_id = $1', [zoneId]);
  return { deleted: true, zone: zone.rows[0] };
}

// [a] #9 – sinh ghế cho khu vực (bulk insert)
export async function generateSeats(input = {}) {
  const body = bodyOf(input);
  const zoneId = parseId(paramsOf(input).zoneId ?? body.zoneId, 'zoneId');
  const rowsPerBlock = Number(body.rowsPerBlock ?? body.rows_per_block ?? 10);
  if (!Number.isFinite(rowsPerBlock) || rowsPerBlock <= 0) {
    throw new AppError(400, 'VALIDATION', 'rowsPerBlock không hợp lệ');
  }

  const zoneRow = await pool.query('SELECT * FROM zones WHERE zone_id = $1', [zoneId]);
  if (!zoneRow.rows[0]) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy khu vực');

  const zone = zoneRow.rows[0];
  const seatCount = Number(zone.capacity ?? body.capacity ?? 10);
  const resolvedSeatCount = Number.isFinite(seatCount) && seatCount > 0 ? seatCount : 10;
  const generated = [];
  const totalRows = Math.max(1, Math.ceil(resolvedSeatCount / rowsPerBlock));

  for (let index = 0; index < resolvedSeatCount; index += 1) {
    const rowLabel = getRowLabel(Math.floor(index / rowsPerBlock));
    const seatNo = (index % rowsPerBlock) + 1;
    generated.push([zoneId, rowLabel, seatNo]);
  }

  if (generated.length > 0) {
    const placeholders = [];
    const params = [zoneId];
    let index = 2;

    generated.forEach(([, rowLabel, seatNo]) => {
      placeholders.push(`($1, $${index}, $${index + 1})`);
      params.push(rowLabel, seatNo);
      index += 2;
    });

    await pool.query(
      `INSERT INTO seats (zone_id, row_label, seat_no) VALUES ${placeholders.join(', ')} ON CONFLICT (zone_id, row_label, seat_no) DO NOTHING`,
      params,
    );
  }

  return { zoneId: String(zoneId), generated: generated.length, rows: totalRows, zone };
}

