import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import * as lab from './backupRecovery.lab.js';

const router = Router();

router.use(authenticate, authorize('ADMIN'));

router.post('/simulate', async (_req, res, next) => {
  try {
    const [pgResult, fsResult] = await Promise.all([
      lab.runPgBackupRecoveryLab(),
      lab.runFsBackupRecoveryLab(),
    ]);

    res.json({
      topic: 'Backup & Recovery',
      scenario: 'Sao lưu Snapshot -> Xóa nhầm dữ liệu -> Phục hồi nguyên trạng',
      postgresql: pgResult,
      firestore: fsResult,
    });
  } catch (err) {
    next(err);
  }
});

export default router;

