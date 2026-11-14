// [#3] Phòng chờ ảo – gắn dưới /api/events/:eventId/queue
import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as service from './queue.service.js';

const router = Router({ mergeParams: true });
const ctx = (req) => ({ eventId: req.params.eventId, user: req.user });

router.post('/join', authenticate, asyncHandler(async (req, res) => res.json(await service.join(ctx(req)))));
router.get('/status', authenticate, asyncHandler(async (req, res) => res.json(await service.status(ctx(req)))));
router.post('/leave', authenticate, asyncHandler(async (req, res) => res.json(await service.leave(ctx(req)))));
// Quản trị: bật/tắt phòng chờ và cho N người tiếp theo vào
router.get('/', authenticate, authorize('ADMIN'), asyncHandler(async (req, res) => res.json(await service.meta(req.params.eventId))));
router.put('/', authenticate, authorize('ADMIN'), asyncHandler(async (req, res) => res.json(await service.setEnabled({ eventId: req.params.eventId, enabled: req.body?.enabled }))));
router.delete('/', authenticate, authorize('ADMIN'), asyncHandler(async (req, res) => res.json(await service.reset(req.params.eventId))));
router.post('/admit', authenticate, authorize('ADMIN'), asyncHandler(async (req, res) => res.json(await service.admit({ eventId: req.params.eventId, count: req.body?.count }))));

export default router;
