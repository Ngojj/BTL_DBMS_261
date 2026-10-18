import { Router } from 'express';
import { health } from './health.js';
import authRoutes from '../modules/auth/auth.route.js';
import eventsRoutes from '../modules/events/events.route.js';
import zonesRoutes from '../modules/zones/zones.route.js';
import bookingRoutes from '../modules/booking/booking.route.js';

const router = Router();

router.get('/health', health);
router.use('/auth', authRoutes);
router.use('/events', eventsRoutes);
router.use('/', zonesRoutes);
router.use('/orders', bookingRoutes);

export default router;
