// TODO [labs/data-storage] Phụ trách: TV4 – Data storage
// Kịch bản: Cùng dữ liệu vé lưu theo hai mô hình; so sánh dung lượng, số lần đọc để hiện trang "vé của tôi", ước tính chi phí Firestore
import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { runLab, listRuns } from '../labRunner.js';
import * as postgres from './postgres.js';
import * as firestore from './firestore.js';

export const scenario = 'Data storage';
const router = Router();

// POST body: { params: { ... } } – tham số riêng của thí nghiệm
router.post('/run', asyncHandler(async (req, res) => {
  res.json(await runLab({
    topic: 'data-storage',
    scenario,
    params: req.body?.params,
    postgres: postgres.run,
    firestore: firestore.run,
  }));
}));

router.get('/runs', asyncHandler(async (_req, res) => {
  res.json(await listRuns('data-storage'));
}));

export default router;
