import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import * as controller from './queue.controller.js';

const router = Router({ mergeParams: true });

// Tham gia và theo dõi hàng đợi cần đăng nhập
router.post('/join', authenticate, controller.joinQueue);
router.get('/status', authenticate, controller.getQueueStatus);
router.post('/leave', authenticate, controller.leaveQueue);

// Admin mở cổng cho N người tiếp theo vào mua vé
router.post('/admit', authenticate, authorize('ADMIN'), controller.admitUsers);

export default router;

