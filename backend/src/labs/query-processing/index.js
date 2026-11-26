// [labs/query-processing] Phụ trách: Query processing
// Kịch bản: Báo cáo doanh thu theo khu vực (Q_DT): một câu SQL JOIN + GROUP BY so với bốn cách làm trên Firestore.
import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { runLab, listRuns } from '../labRunner.js';
import * as postgres from './postgres.js';
import * as firestore from './firestore.js';
import { parseParams } from './params.js';

export const scenario = 'Query processing';
const router = Router();

// POST body: { params: { tickets: 500|1000|2000|5000, approach: 'A'|'B'|'C'|'D' } }
router.post('/run', asyncHandler(async (req, res) => {
  // Trả 400 trước khi chạy DBMS hoặc lưu một kết quả thí nghiệm không hợp lệ.
  const params = parseParams(req.body?.params);
  res.json(await runLab({
    topic: 'query-processing',
    scenario,
    params,
    postgres: postgres.run,
    firestore: firestore.run,
  }));
}));

router.get('/runs', asyncHandler(async (_req, res) => {
  res.json(await listRuns('query-processing'));
}));

export default router;
