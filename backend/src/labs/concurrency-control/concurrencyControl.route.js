import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import * as lab from './concurrencyControl.lab.js';

const router = Router();

router.use(authenticate, authorize('ADMIN'));

router.post('/simulate-rush-hour', async (req, res, next) => {
  try {
    const concurrency = Math.min(Math.max(Number(req.body.concurrency) || 20, 5), 100);
    const seatsCount = Math.min(Math.max(Number(req.body.seatsCount) || 3, 1), 20);

    const [noLockResult, pgLockResult, fsOccResult] = await Promise.all([
      lab.simulatePgNoLock({ concurrency, seatsCount }),
      lab.simulatePgPessimisticLock({ concurrency, seatsCount }),
      lab.simulateFirestoreOCC({ concurrency: Math.min(concurrency, 20), seatsCount }),
    ]);

    res.json({
      topic: 'Concurrency Control',
      scenario: 'Giả lập "Giờ G": N khách hàng tranh mua M ghế giới hạn',
      parameters: { concurrency, seatsCount },
      results: {
        noLock: noLockResult,
        pgPessimisticLock: pgLockResult,
        firestoreOCC: fsOccResult,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;

