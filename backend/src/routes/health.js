import { pool } from '../config/pg.js';
import { firestore } from '../config/firebase.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// GET /api/health – kiểm tra kết nối cả hai DBMS
export const health = asyncHandler(async (_req, res) => {
  const status = { postgres: 'down', firestore: 'down' };
  try {
    await pool.query('SELECT 1');
    status.postgres = 'up';
  } catch (e) {
    status.postgres = 'down: ' + e.message;
  }
  try {
    await firestore.listCollections();
    status.firestore = 'up';
  } catch (e) {
    status.firestore = 'down: ' + e.message;
  }
  const ok = status.postgres === 'up' && status.firestore === 'up';
  res.status(ok ? 200 : 503).json({ ok, ...status });
});
