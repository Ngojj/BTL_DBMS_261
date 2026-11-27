// TODO [labs/indexing] Phụ trách: TV2 – Indexing
// Kịch bản: Tìm đơn theo email/sự kiện/trạng thái; bật/tắt index; EXPLAIN ANALYZE (PostgreSQL) và Query Explain (Firestore)
import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { runLab, listRuns } from '../labRunner.js';
import * as postgres from './postgres.js';
import * as firestore from './firestore.js';

export const scenario = 'Indexing';
const router = Router();

// POST body: { params: { ... } } – tham số riêng của thí nghiệm
router.post('/run', asyncHandler(async (req, res) => {
  res.json(await runLab({
    topic: 'indexing',
    scenario,
    params: req.body?.params,
    postgres: postgres.run,
    firestore: firestore.run,
  }));
}));

router.get('/runs', asyncHandler(async (_req, res) => {
  res.json(await listRuns('indexing'));
}));

export default router;
