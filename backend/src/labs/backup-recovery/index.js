// TV1: pg_dump/restore vs application-level Firestore JSON snapshot.
import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { runLab, listRuns } from '../labRunner.js';
import * as postgres from './postgres.js';
import * as firestore from './firestore.js';
import { parseParams } from './shared.js';

export const scenario = 'Backup & recovery';
const router = Router();

// POST body: { params: { ... } } – tham số riêng của thí nghiệm
router.post('/run', asyncHandler(async (req, res) => {
  const params = parseParams(req.body?.params);
  res.json(await runLab({
    topic: 'backup-recovery',
    scenario,
    params,
    postgres: postgres.run,
    firestore: firestore.run,
  }));
}));

router.get('/runs', asyncHandler(async (_req, res) => {
  res.json(await listRuns('backup-recovery'));
}));

export default router;
