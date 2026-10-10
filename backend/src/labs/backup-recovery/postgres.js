// TODO [labs/backup-recovery/postgres] Phụ trách: TV1 – Backup & recovery trên PostgreSQL (pg, SQL thuần)
// Kịch bản: Xóa nhầm một sự kiện rồi khôi phục (pg_dump/restore; Firestore export/import hoặc PITR)
// Trả về { metrics: { <tên>: <giá trị> }, details? } – cùng khóa metrics với file còn lại để so sánh.
import { notImplemented } from '../../utils/AppError.js';

export async function run(params = {}) {
  void params;
  throw notImplemented('labs.backupRecovery.postgres');
}
