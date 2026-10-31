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

// DBMS Labs
import dataStorageLabRoutes        from '../labs/data-storage/dataStorage.route.js';
import indexingLabRoutes           from '../labs/indexing/indexing.route.js';
import queryProcessingLabRoutes    from '../labs/query-processing/queryProcessing.route.js';
import transactionLabRoutes        from '../labs/transaction/transaction.route.js';
import concurrencyControlLabRoutes from '../labs/concurrency-control/concurrencyControl.route.js';
import backupRecoveryLabRoutes     from '../labs/backup-recovery/backupRecovery.route.js';

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

// Register DBMS Labs
router.use('/labs/data-storage',        dataStorageLabRoutes);
router.use('/labs/indexing',            indexingLabRoutes);
router.use('/labs/query-processing',    queryProcessingLabRoutes);
router.use('/labs/transaction',         transactionLabRoutes);
router.use('/labs/concurrency-control', concurrencyControlLabRoutes);
router.use('/labs/backup-recovery',     backupRecoveryLabRoutes);

export default router;
