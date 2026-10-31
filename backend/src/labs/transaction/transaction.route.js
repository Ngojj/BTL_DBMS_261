import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import * as lab from './transaction.lab.js';

const router = Router();

router.use(authenticate, authorize('ADMIN'));

router.post('/simulate', async (req, res, next) => {
  try {
    const shouldFail = Boolean(req.body.shouldFail);
    const userId = req.body.userId ? Number(req.body.userId) : 1;
    const eventId = req.body.eventId ? Number(req.body.eventId) : 1;

    const [pgResult, fsResult] = await Promise.all([
      lab.runPgTransactionLab({ shouldFail, userId, eventId }),
      lab.runFsTransactionLab({ shouldFail, eventId }),
    ]);

    res.json({
      topic: 'Transaction',
      scenario: shouldFail
        ? 'Giả lập lỗi thanh toán (Rollback Behavior)'
        : 'Thanh toán thành công (Commit Behavior)',
      shouldFail,
      postgresql: pgResult,
      firestore: fsResult,
    });
  } catch (err) {
    next(err);
  }
});

export default router;

