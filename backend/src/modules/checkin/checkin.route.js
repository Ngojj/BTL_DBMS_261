import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { lookup, checkin } from './checkin.controller.js';

const router = Router();
const staff  = [authenticate, authorize('STAFF', 'ADMIN')];

// GET  /api/checkin/:qrCode  – xem thông tin vé (STAFF/ADMIN)
router.get ('/:qrCode', ...staff, lookup);
// POST /api/checkin/:qrCode  – soát vé (STAFF/ADMIN)
router.post('/:qrCode', ...staff, checkin);
// POST /api/checkin          – body { qrCode } – dùng khi QR scan offline gửi lên
router.post('/', ...staff, checkin);

export default router;
