// Phụ trách: TV3 (#10, #11)
import * as repo from './reports.repository.js';
import { AppError } from '../../utils/AppError.js';

// Nghiệp vụ + điều phối transaction. Không viết SQL ở đây (SQL nằm trong repository).

function reportFilters({ query = {} } = {}) {
  const { eventId } = query;
  if (eventId === undefined) return { eventId: null };
  // Giữ id BIGINT dưới dạng string để không mất chính xác.
  if (typeof eventId !== 'string' || !/^[1-9]\d{0,18}$/.test(eventId)
      || BigInt(eventId) > 9223372036854775807n) {
    throw new AppError(400, 'VALIDATION', 'eventId phải là mã sự kiện nguyên dương hợp lệ');
  }
  return { eventId };
}

// [h] #10 – doanh thu theo khu vực (SUM/COUNT + GROUP BY)
export async function revenueByZone(input) {
  return repo.revenueByZone(reportFilters(input));
}

// [h] #10 – tỷ lệ lấp đầy theo khu vực
export async function occupancyByZone(input) {
  return repo.occupancyByZone(reportFilters(input));
}

// TODO [g] #11 – tài khoản gom vé: vượt giới hạn / chung số điện thoại (subquery)
export async function suspiciousAccounts(input) {
  return repo.suspiciousAccounts(input);
}
