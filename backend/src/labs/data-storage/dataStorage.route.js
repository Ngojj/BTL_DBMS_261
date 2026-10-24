import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import * as lab from '../../labs/data-storage/dataStorage.lab.js';

const router = Router();

// Tất cả lab endpoints chỉ dành cho ADMIN
router.use(authenticate, authorize('ADMIN'));

/**
 * GET /api/labs/data-storage/my-tickets?userId=<id>
 * Chạy cả hai DBMS và trả về kết quả song song để so sánh.
 */
router.get('/my-tickets', async (req, res, next) => {
  try {
    const userId = Number(req.query.userId ?? req.user?.userId);
    const [pg, fs] = await Promise.all([
      lab.pgReadMyTickets(userId),
      lab.fsReadMyTickets(userId),
    ]);
    res.json({ postgresql: pg, firestore: fs });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/labs/data-storage/storage-size
 * So sánh dung lượng lưu trữ PostgreSQL vs Firestore (ước tính).
 */
router.get('/storage-size', async (_req, res, next) => {
  try {
    const result = await lab.compareStorageSize();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
