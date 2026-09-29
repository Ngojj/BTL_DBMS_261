// TODO [labs/backup-recovery] Phụ trách: TV1 – Backup & recovery
// Kịch bản: Xóa nhầm một sự kiện rồi khôi phục (pg_dump/restore; Firestore export/import hoặc PITR)
import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { runLab, listRuns } from '../labRunner.js';
import * as postgres from './postgres.js';
import * as firestore from './firestore.js';

export const scenario = 'Backup & recovery';
const router = Router();

// POST body: { params: { ... } } – tham số riêng của thí nghiệm
router.post('/run', asyncHandler(async (req, res) => {
  res.json(await runLab({
    topic: 'backup-recovery',
    scenario,
    params: req.body?.params,
    postgres: postgres.run,
    firestore: firestore.run,
  }));
}));

router.get('/runs', asyncHandler(async (_req, res) => {
  res.json(await listRuns('backup-recovery'));
}));

export default router;
