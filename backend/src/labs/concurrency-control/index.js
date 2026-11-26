// [labs/concurrency-control] Giờ G: N người (mặc định 500) giành M ghế (mặc định 50) trên hai DBMS.
// Bốn chiến lược: không khóa, khóa bi quan, khóa lạc quan, bỏ qua ghế đang bị khóa (xem params.js).
import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { runLab, listRuns } from '../labRunner.js';
import * as postgres from './postgres.js';
import * as firestore from './firestore.js';
import { parseParams } from './params.js';

export const scenario = 'Concurrency control';
const router = Router();

// POST body: { params: { users, seats, strategy } }
router.post('/run', asyncHandler(async (req, res) => {
  const params = parseParams(req.body?.params);
  res.json(await runLab({
    topic: 'concurrency-control',
    scenario,
    params,
    postgres: postgres.run,
    firestore: firestore.run,
  }));
}));

router.get('/runs', asyncHandler(async (_req, res) => {
  res.json(await listRuns('concurrency-control'));
}));

export default router;
