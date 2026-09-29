// TODO [sync.route] Phụ trách: TV5 (đồng bộ PostgreSQL → Firestore)
import { Router } from 'express';
import * as controller from './sync.controller.js';
import { authenticate, authorize } from '../../middleware/auth.js';

const router = Router();

// [-] Đồng bộ lại toàn bộ trạng thái ghế của một sự kiện
router.post('/events/:eventId', authenticate, authorize('ADMIN'), controller.resyncEvent);
// [-] Đồng bộ lại toàn bộ (events, seats, validTickets)
router.post('/all', authenticate, authorize('ADMIN'), controller.resyncAll);

export default router;
