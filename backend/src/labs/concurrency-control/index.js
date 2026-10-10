// TODO [labs/concurrency-control] Phụ trách: TV5 – Concurrency control
// Kịch bản: "Giả lập giờ G": N người (mặc định 500) giành M vé (mặc định 50); đo số vé bán, bán trùng, xung đột/thử lại, thời gian; có biến thể "không khóa"
import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { runLab, listRuns } from '../labRunner.js';
import * as postgres from './postgres.js';
import * as firestore from './firestore.js';

export const scenario = 'Concurrency control';
const router = Router();

// POST body: { params: { ... } } – tham số riêng của thí nghiệm
router.post('/run', asyncHandler(async (req, res) => {
  res.json(await runLab({
    topic: 'concurrency-control',
    scenario,
    params: req.body?.params,
    postgres: postgres.run,
    firestore: firestore.run,
  }));
}));

router.get('/runs', asyncHandler(async (_req, res) => {
  res.json(await listRuns('concurrency-control'));
}));

export default router;
