import { useState } from 'react';
import { labApi } from '../../api/labApi.js';

export default function LabBackupRecoveryPage() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSimulate() {
    setLoading(true);
    setError('');
    try {
      const data = await labApi.backupRecovery.simulate();
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-indigo-100 text-indigo-800 px-2.5 py-0.5 text-xs font-semibold">DBMS Lab</span>
          <span className="rounded-full bg-cyan-100 text-cyan-800 px-2.5 py-0.5 text-xs font-semibold">Topic: Backup & Recovery</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-gray-950">Backup, Disaster Recovery & PITR</h1>
        <p className="mt-1 text-sm text-gray-600">
          Mô phỏng chu trình 3 bước: Sao lưu Snapshot → Giả lập thảm họa xóa nhầm sự kiện → Phục hồi nguyên vẹn dữ liệu. Đánh giá chỉ số RTO và RPO.
        </p>
      </header>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-gray-800">Quy trình thử nghiệm</h2>
        <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
          <li><strong>Tạo bản Snapshot:</strong> Export trạng thái dữ liệu hiện tại của các bảng/collections.</li>
          <li><strong>Giả lập sự cố:</strong> Admin vô tình xóa nhầm một sự kiện đang lưu trữ.</li>
          <li><strong>Khôi phục (Restore):</strong> Đọc bản sao lưu và tái thiết lập dữ liệu nguyên trạng ban đầu.</li>
        </ol>

        <button
          type="button"
          onClick={handleSimulate}
          disabled={loading}
          className="rounded-lg bg-cyan-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-800 disabled:opacity-50"
        >
          {loading ? 'Đang thực hiện quy trình sao lưu & khôi phục…' : '▶ Chạy kịch bản Backup & Recovery'}
        </button>
      </div>

      {error && <p role="alert" className="text-red-700 text-sm font-medium">{error}</p>}

      {result && (
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* PostgreSQL Card */}
            <div className="rounded-xl border border-blue-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="text-lg font-bold text-blue-900">🐘 PostgreSQL Recovery</h3>
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded font-bold">
                  RTO: {result.postgresql.rtoEstimate}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-gray-50 p-2.5 rounded">
                  <span className="text-gray-500 block">Kích thước Snapshot:</span>
                  <span className="font-mono font-bold text-gray-900">{result.postgresql.backupSizePretty}</span>
                </div>
                <div className="bg-gray-50 p-2.5 rounded">
                  <span className="text-gray-500 block">Thời gian tạo Backup:</span>
                  <span className="font-mono font-bold text-gray-900">{result.postgresql.backupDurationMs} ms</span>
                </div>
                <div className="bg-gray-50 p-2.5 rounded">
                  <span className="text-gray-500 block">Thời gian Restore (RTO):</span>
                  <span className="font-mono font-bold text-emerald-700">{result.postgresql.restoreDurationMs} ms</span>
                </div>
                <div className="bg-gray-50 p-2.5 rounded">
                  <span className="text-gray-500 block">Mức mất mát dữ liệu (RPO):</span>
                  <span className="font-bold text-gray-800">{result.postgresql.rpoEstimate}</span>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-700">Timeline các bước xử lý:</p>
                <div className="space-y-1.5 text-xs">
                  {result.postgresql.timeline?.map((t) => (
                    <div key={t.step} className="rounded bg-blue-50/60 p-2 border border-blue-100">
                      <span className="font-bold text-blue-800">Bước {t.step} [{t.phase}]: </span>
                      <span className="text-gray-700">{t.description}</span>
                      <span className="text-gray-500 font-mono ml-1">({t.durationMs} ms)</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Firestore Card */}
            <div className="rounded-xl border border-orange-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="text-lg font-bold text-orange-900">🔥 Firestore Export / PITR</h3>
                <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded font-bold">
                  RTO: {result.firestore.rtoEstimate}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-gray-50 p-2.5 rounded">
                  <span className="text-gray-500 block">Kích thước Snapshot:</span>
                  <span className="font-mono font-bold text-gray-900">{result.firestore.backupSizePretty}</span>
                </div>
                <div className="bg-gray-50 p-2.5 rounded">
                  <span className="text-gray-500 block">Thời gian Export:</span>
                  <span className="font-mono font-bold text-gray-900">{result.firestore.backupDurationMs} ms</span>
                </div>
                <div className="bg-gray-50 p-2.5 rounded">
                  <span className="text-gray-500 block">Thời gian Restore (RTO):</span>
                  <span className="font-mono font-bold text-emerald-700">{result.firestore.restoreDurationMs} ms</span>
                </div>
                <div className="bg-gray-50 p-2.5 rounded">
                  <span className="text-gray-500 block">Mức mất mát dữ liệu (RPO):</span>
                  <span className="font-bold text-gray-800">{result.firestore.rpoEstimate}</span>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-700">Timeline các bước xử lý:</p>
                <div className="space-y-1.5 text-xs">
                  {result.firestore.timeline?.map((t) => (
                    <div key={t.step} className="rounded bg-orange-50/60 p-2 border border-orange-100">
                      <span className="font-bold text-orange-800">Bước {t.step} [{t.phase}]: </span>
                      <span className="text-gray-700">{t.description}</span>
                      <span className="text-gray-500 font-mono ml-1">({t.durationMs} ms)</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-sm space-y-2">
            <h4 className="font-bold text-gray-900">📝 Nhận định so sánh Cơ chế Backup & Phục hồi:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-700 mt-2">
              <div className="rounded bg-white p-3 border">
                <p className="font-bold text-blue-900">PostgreSQL (Tự quản trị / On-prem / RDS):</p>
                <p className="mt-1">
                  Cung cấp công cụ chuẩn <code>pg_dump</code> (logical) và <code>pg_basebackup</code> + WAL replication (physical). Khả năng cấu hình PITR linh hoạt, khôi phục trạng thái chuẩn xác đến từng giao dịch (transaction commit time).
                </p>
              </div>
              <div className="rounded bg-white p-3 border">
                <p className="font-bold text-orange-900">Cloud Firestore (Serverless Database):</p>
                <p className="mt-1">
                  Được quản lý hoàn toàn (Fully Managed) bởi Google Cloud. Hỗ trợ PITR 7 ngày gần nhất qua gói Blaze mà không cần cấu hình cụm máy chủ, tự động lưu trữ phân tán đa vùng (Multi-region replication).
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

