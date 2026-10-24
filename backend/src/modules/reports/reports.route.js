import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { getRevenue, getScalpers } from './reports.controller.js';

const router = Router();

// GET /api/reports/revenue?eventId=  – doanh thu theo khu vực (ADMIN)
router.get('/revenue',  authenticate, authorize('ADMIN'), getRevenue);
// GET /api/reports/scalpers           – phát hiện gom vé (ADMIN)
router.get('/scalpers', authenticate, authorize('ADMIN'), getScalpers);

export default router;
