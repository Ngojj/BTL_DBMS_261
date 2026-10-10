// TODO [BackupRecoveryLabPage] Phụ trách: TV1 – DBMS Lab: Backup & recovery
// Kịch bản: Xóa nhầm một sự kiện rồi khôi phục (pg_dump/restore; Firestore export/import hoặc PITR)
import LabPage from '../../components/lab/LabPage.jsx';

export default function BackupRecoveryLabPage() {
  return (
    <LabPage
      topic="backup-recovery"
      title="Backup & recovery"
      scenario="Xóa nhầm một sự kiện rồi khôi phục (pg_dump/restore; Firestore export/import hoặc PITR)"
    />
  );
}
