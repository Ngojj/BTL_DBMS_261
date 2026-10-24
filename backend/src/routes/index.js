import { Router } from 'express';
import { health } from './health.js';
import authRoutes    from '../modules/auth/auth.route.js';
import eventsRoutes  from '../modules/events/events.route.js';
import zonesRoutes   from '../modules/zones/zones.route.js';
import bookingRoutes from '../modules/booking/booking.route.js';
import ticketsRoutes from '../modules/tickets/tickets.route.js';
import reviewsRoutes from '../modules/reviews/reviews.route.js';
import reportsRoutes from '../modules/reports/reports.route.js';
import adminRoutes   from '../modules/admin/admin.route.js';
import checkinRoutes from '../modules/checkin/checkin.route.js';
import syncRoutes    from '../modules/sync/sync.route.js';
import dataStorageLabRoutes from '../labs/data-storage/dataStorage.route.js';

const router = Router();

router.get('/health', health);
router.use('/auth',    authRoutes);
router.use('/events',  eventsRoutes);
router.use('/events',  reviewsRoutes); // GET/POST /api/events/:eventId/reviews
router.use('/',        zonesRoutes);
router.use('/orders',  bookingRoutes);
router.use('/tickets', ticketsRoutes);
router.use('/reports', reportsRoutes);
router.use('/admin',   adminRoutes);
router.use('/checkin', checkinRoutes);
router.use('/sync',    syncRoutes);
router.use('/labs/data-storage', dataStorageLabRoutes);

export default router;
