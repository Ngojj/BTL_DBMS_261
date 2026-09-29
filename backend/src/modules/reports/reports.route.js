// TODO [reports.route] Phụ trách: TV3 (#10, #11)
import { Router } from 'express';
import * as controller from './reports.controller.js';
import { authenticate, authorize } from '../../middleware/auth.js';

const router = Router();

// [h] #10 – doanh thu theo khu vực (SUM/COUNT + GROUP BY)
router.get('/revenue', authenticate, authorize('ADMIN'), controller.revenueByZone);
// [h] #10 – tỷ lệ lấp đầy theo khu vực
router.get('/occupancy', authenticate, authorize('ADMIN'), controller.occupancyByZone);
// [g] #11 – tài khoản gom vé: vượt giới hạn / chung số điện thoại (subquery)
router.get('/suspicious-accounts', authenticate, authorize('ADMIN'), controller.suspiciousAccounts);

export default router;
