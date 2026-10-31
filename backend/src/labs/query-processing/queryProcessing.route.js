import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import * as lab from './queryProcessing.lab.js';

const router = Router();

router.use(authenticate, authorize('ADMIN'));

router.get('/revenue-report', async (_req, res, next) => {
  try {
    const [pgResult, fsResult] = await Promise.all([
      lab.pgRevenueReport(),
      lab.fsRevenueReport(),
    ]);

    res.json({
      topic: 'Query Processing',
      scenario: 'Báo cáo doanh thu & tỷ lệ lấp đầy theo khu vực (JOIN + GROUP BY + HAVING)',
      postgresql: pgResult,
      firestore: fsResult,
    });
  } catch (err) {
    next(err);
  }
});

export default router;

