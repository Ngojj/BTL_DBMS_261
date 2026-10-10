// Gắn 6 topic DBMS Lab vào /api/admin/labs/<topic>/(run|runs). Chỉ ADMIN.
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import dataStorage from './data-storage/index.js';
import indexing from './indexing/index.js';
import queryProcessing from './query-processing/index.js';
import transaction from './transaction/index.js';
import concurrencyControl from './concurrency-control/index.js';
import backupRecovery from './backup-recovery/index.js';

const router = Router();
router.use(authenticate, authorize('ADMIN'));
router.use('/data-storage', dataStorage);
router.use('/indexing', indexing);
router.use('/query-processing', queryProcessing);
router.use('/transaction', transaction);
router.use('/concurrency-control', concurrencyControl);
router.use('/backup-recovery', backupRecovery);

export default router;
