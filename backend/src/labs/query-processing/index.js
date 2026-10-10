// TODO [labs/query-processing] Phụ trách: TV3 – Query processing
// Kịch bản: Báo cáo doanh thu theo khu vực: một câu SQL JOIN + GROUP BY so với cách làm trên Firestore
import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { runLab, listRuns } from '../labRunner.js';
import * as postgres from './postgres.js';
import * as firestore from './firestore.js';

export const scenario = 'Query processing';
const router = Router();

// POST body: { params: { ... } } – tham số riêng của thí nghiệm
router.post('/run', asyncHandler(async (req, res) => {
  res.json(await runLab({
    topic: 'query-processing',
    scenario,
    params: req.body?.params,
    postgres: postgres.run,
    firestore: firestore.run,
  }));
}));

router.get('/runs', asyncHandler(async (_req, res) => {
  res.json(await listRuns('query-processing'));
}));

export default router;
