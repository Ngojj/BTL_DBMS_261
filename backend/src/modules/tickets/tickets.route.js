// TODO [tickets.route] Phụ trách: TV5 (#6)
import { Router } from 'express';
import * as controller from './tickets.controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();

// [f] #6 – vé của tôi: JOIN tickets/orders/seats/zones/events
router.get('/mine', authenticate, controller.listMyTickets);

export default router;
