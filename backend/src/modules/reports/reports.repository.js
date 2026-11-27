// TODO [reports.repository] Phụ trách: TV3 (#10, #11)
import { notImplemented } from '../../utils/AppError.js';
// import { pool, withTransaction } from '../../config/pg.js';

// SQL thuần, tham số $1,$2…; ghi chú loại truy vấn a–h trong comment.

// [h] #10 – doanh thu theo khu vực (SUM/COUNT + GROUP BY)
export async function revenueByZone(input) {
  throw notImplemented('reports.revenueByZone');
}

// [h] #10 – tỷ lệ lấp đầy theo khu vực
export async function occupancyByZone(input) {
  throw notImplemented('reports.occupancyByZone');
}

// [g] #11 – tài khoản gom vé: vượt giới hạn / chung số điện thoại (subquery)
export async function suspiciousAccounts(input) {
  throw notImplemented('reports.suspiciousAccounts');
}
