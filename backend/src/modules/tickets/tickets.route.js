import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { getMyTickets } from './tickets.controller.js';

const router = Router();

// GET /api/tickets  – vé của tôi (CUSTOMER đã đăng nhập)
router.get('/', authenticate, getMyTickets);

export default router;
