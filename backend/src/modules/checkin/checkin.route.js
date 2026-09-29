// TODO [checkin.route] Phụ trách: TV5 (#7)
import { Router } from 'express';
import * as controller from './checkin.controller.js';
import { authenticate, authorize } from '../../middleware/auth.js';

const router = Router();

// [d] #7 – danh sách vé hợp lệ (nạp/đối chiếu với Firestore validTickets)
router.get('/events/:eventId/valid-tickets', authenticate, authorize('STAFF', 'ADMIN'), controller.listValidTickets);
// [c] #7 – nhận danh sách checkedIn từ cổng, cập nhật tickets.status = CHECKED_IN trong PostgreSQL
router.post('/sync', authenticate, authorize('STAFF', 'ADMIN'), controller.syncCheckins);

export default router;
