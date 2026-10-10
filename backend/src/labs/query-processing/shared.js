import { AppError } from '../../utils/AppError.js';

export const MAX_TICKETS = 10000;
export const MAX_ZONES = 1000;
export const roundMs = (elapsed) => Math.round(elapsed * 1000) / 1000;

export function validateParams(params = {}) {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    throw new AppError(400, 'VALIDATION', 'params phải là object chứa eventId');
  }
  const value = params.eventId === undefined ? 1 : params.eventId;
  if ((typeof value !== 'string' && typeof value !== 'number')
      || (typeof value === 'number' && !Number.isSafeInteger(value))) {
    throw new AppError(400, 'VALIDATION', 'eventId phải là mã sự kiện nguyên dương hợp lệ');
  }
  const eventId = String(value);
  if (!/^[1-9]\d{0,18}$/.test(eventId) || BigInt(eventId) > 9223372036854775807n) {
    throw new AppError(400, 'VALIDATION', 'eventId phải là mã sự kiện nguyên dương hợp lệ');
  }
  return { eventId };
}

export function totals(rows) {
  let ticketsSold = 0;
  let revenue = 0;
  for (const row of rows) {
    ticketsSold += row.ticketsSold;
    revenue += row.revenue;
    if (!Number.isSafeInteger(ticketsSold) || !Number.isSafeInteger(revenue)) {
      throw new AppError(422, 'UNSAFE_TOTAL', 'Tổng vượt miền số nguyên an toàn của JavaScript');
    }
  }
  return { ticketsSold, revenue };
}

export function sortRows(rows) {
  return rows.sort((a, b) => BigInt(a.zoneId) < BigInt(b.zoneId) ? -1 : BigInt(a.zoneId) > BigInt(b.zoneId) ? 1 : 0);
}

// So sánh từng khu, không chỉ so tổng (hai khu có thể bị gán nhầm mà tổng vẫn bằng).
export function sameRows(a, b) {
  const canonical = (rows) => sortRows([...rows]).map((r) =>
    [r.eventId, r.eventTitle, r.zoneId, r.zone, r.ticketsSold, r.revenue]);
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}
