import { Router } from 'express';
import { health } from './health.js';
import authRoutes from '../modules/auth/auth.route.js';
import eventsRoutes from '../modules/events/events.route.js';
import zonesRoutes from '../modules/zones/zones.route.js';
import bookingRoutes from '../modules/booking/booking.route.js';
import ticketsRoutes from '../modules/tickets/tickets.route.js';
import checkinRoutes from '../modules/checkin/checkin.route.js';
import reportsRoutes from '../modules/reports/reports.route.js';
import reviewsRoutes from '../modules/reviews/reviews.route.js';
import queueRoutes from '../modules/queue/queue.route.js';
import syncRoutes from '../modules/sync/sync.route.js';
import labRoutes from '../labs/index.js';

const router = Router();

router.get('/health', health);
router.use('/auth', authRoutes);
router.use('/events/:eventId/queue', queueRoutes);
router.use('/events', eventsRoutes);
router.use('/', zonesRoutes);
router.use('/orders', bookingRoutes);
router.use('/tickets', ticketsRoutes);
router.use('/checkin', checkinRoutes);
router.use('/admin/reports', reportsRoutes);
router.use('/', reviewsRoutes);
router.use('/admin/sync', syncRoutes);
router.use('/admin/labs', labRoutes);

export default router;
