// [labs/transaction] Phụ trách: TV1 – Transaction
// Kịch bản: Luồng mua vé; nút giả lập lỗi thanh toán để thấy rollback ở hai bên
import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { runLab, listRuns } from '../labRunner.js';
import * as postgres from './postgres.js';
import * as firestore from './firestore.js';
import { parseParams } from './params.js';

export const scenario = 'Transaction';
const router = Router();

// POST body: { params: { ... } } – tham số riêng của thí nghiệm
router.post('/run', asyncHandler(async (req, res) => {
  // Trả 400 trước khi chạy DBMS hoặc lưu một kết quả thí nghiệm không hợp lệ.
  const params = parseParams(req.body?.params);
  res.json(await runLab({
    topic: 'transaction',
    scenario,
    params,
    postgres: postgres.run,
    firestore: firestore.run,
  }));
}));

router.get('/runs', asyncHandler(async (_req, res) => {
  res.json(await listRuns('transaction'));
}));

export default router;
