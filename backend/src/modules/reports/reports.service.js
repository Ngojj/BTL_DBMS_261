// TODO [reports.service] Phụ trách: TV3 (#10, #11)
import * as repo from './reports.repository.js';

// Nghiệp vụ + điều phối transaction. Không viết SQL ở đây (SQL nằm trong repository).

// TODO [h] #10 – doanh thu theo khu vực (SUM/COUNT + GROUP BY)
export async function revenueByZone(input) {
  return repo.revenueByZone(input);
}

// TODO [h] #10 – tỷ lệ lấp đầy theo khu vực
export async function occupancyByZone(input) {
  return repo.occupancyByZone(input);
}

// TODO [g] #11 – tài khoản gom vé: vượt giới hạn / chung số điện thoại (subquery)
export async function suspiciousAccounts(input) {
  return repo.suspiciousAccounts(input);
}
