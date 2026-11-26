// [labs/data-storage] Cùng dữ liệu vé, hai cách lưu: PostgreSQL chuẩn hóa và Firestore theo document (mục 3.1).
// So sánh dung lượng, số lượt đọc để dựng trang "vé của tôi", chi phí ước tính và cái giá của phi chuẩn hóa.
import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { runLab, listRuns } from '../labRunner.js';
import * as postgres from './postgres.js';
import * as firestore from './firestore.js';
import { parseParams } from './shared.js';

export const scenario = 'Data storage';
const router = Router();

// POST body: { params: { tickets, myTickets, model } }
router.post('/run', asyncHandler(async (req, res) => {
  const params = parseParams(req.body?.params);
  res.json(await runLab({
    topic: 'data-storage',
    scenario,
    params,
    postgres: postgres.run,
    firestore: firestore.run,
  }));
}));

router.get('/runs', asyncHandler(async (_req, res) => {
  res.json(await listRuns('data-storage'));
}));

export default router;
