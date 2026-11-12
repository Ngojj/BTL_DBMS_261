// TODO [reports.route] Phụ trách: TV3 (#10, #11)
import { Router } from 'express';
import * as controller from './reports.controller.js';
import { authenticate, authorize } from '../../middleware/auth.js';

const router = Router();

// Tham số lọc chung: ?eventId=&from=YYYY-MM-DD&to=YYYY-MM-DD
// [h] #10 – chỉ số tổng quan (doanh thu, vé, đơn, tỷ lệ hủy, lấp đầy, check-in, top sự kiện)
router.get('/overview', authenticate, authorize('ADMIN'), controller.overview);
// [h] #10 – doanh thu theo sự kiện × khu vực (SUM/COUNT + GROUP BY)
router.get('/revenue', authenticate, authorize('ADMIN'), controller.revenueByZone);
// [h] #10 – doanh thu từng ngày (mặc định 30 ngày gần nhất)
router.get('/revenue/daily', authenticate, authorize('ADMIN'), controller.revenueDaily);
// [h] #10 – tỷ lệ lấp đầy theo khu vực
router.get('/occupancy', authenticate, authorize('ADMIN'), controller.occupancyByZone);
// [g] #11 – tài khoản gom vé: vượt giới hạn / chung số điện thoại (subquery)
router.get('/suspicious-accounts', authenticate, authorize('ADMIN'), controller.suspiciousAccounts);

export default router;
