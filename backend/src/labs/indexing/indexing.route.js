import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import * as lab from './indexing.lab.js';

const router = Router();

router.use(authenticate, authorize('ADMIN'));

router.get('/explain-compare', async (req, res, next) => {
  try {
    const userId = req.query.userId ? Number(req.query.userId) : 1;
    const eventId = req.query.eventId ? Number(req.query.eventId) : 1;
    const status = req.query.status || 'PAID';

    const [pgResult, fsResult] = await Promise.all([
      lab.comparePostgresIndexing({ userId, eventId, status }),
      lab.compareFirestoreIndexing({ eventId }),
    ]);

    res.json({
      topic: 'Indexing',
      parameters: { userId, eventId, status },
      postgresql: pgResult,
      firestore: fsResult,
    });
  } catch (err) {
    next(err);
  }
});

export default router;

