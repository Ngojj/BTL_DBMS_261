// TODO [labs/transaction] Phụ trách: TV1 – Transaction
// Kịch bản: Luồng mua vé; nút giả lập lỗi thanh toán để thấy rollback ở hai bên
import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { runLab, listRuns } from '../labRunner.js';
import * as postgres from './postgres.js';
import * as firestore from './firestore.js';

export const scenario = 'Transaction';
const router = Router();

// POST body: { params: { ... } } – tham số riêng của thí nghiệm
router.post('/run', asyncHandler(async (req, res) => {
  res.json(await runLab({
    topic: 'transaction',
    scenario,
    params: req.body?.params,
    postgres: postgres.run,
    firestore: firestore.run,
  }));
}));

router.get('/runs', asyncHandler(async (_req, res) => {
  res.json(await listRuns('transaction'));
}));

export default router;
