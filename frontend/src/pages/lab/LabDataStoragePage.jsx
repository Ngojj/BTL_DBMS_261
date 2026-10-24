import { useState } from 'react';
import { labApi } from '../../api/labApi.js';

// ─── Utility ─────────────────────────────────────────────────────────────────
const fmt = (n) => Number(n).toLocaleString('vi-VN');
const msColor = (ms) => ms < 50 ? 'text-emerald-600' : ms < 200 ? 'text-amber-600' : 'text-red-600';

function Badge({ label, color = 'indigo' }) {
  const cls = {
    indigo: 'bg-indigo-100 text-indigo-800',
    emerald: 'bg-emerald-100 text-emerald-800',
    amber: 'bg-amber-100 text-amber-800',
  }[color] ?? 'bg-gray-100 text-gray-700';
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>;
}

function CompareCard({ title, result, color }) {
  if (!result) return null;
  return (
    <div className={`rounded-xl border bg-white p-5 shadow-sm space-y-3 ${color === 'blue' ? 'border-blue-200' : 'border-orange-200'}`}>
      <div className="flex items-center justify-between">
        <h3 className={`text-base font-bold ${color === 'blue' ? 'text-blue-800' : 'text-orange-800'}`}>
          {color === 'blue' ? '🐘 PostgreSQL' : '🔥 Firestore'}
        </h3>
        <span className={`text-2xl font-mono font-bold ${msColor(result.elapsedMs)}`}>
          {result.elapsedMs} ms
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-gray-500">Rows / Docs</dt>
        <dd className="font-medium">{fmt(result.rowCount)}</dd>
        <dt className="text-gray-500">Loại truy vấn</dt>
        <dd className="font-medium">{result.queryType}</dd>
        {result.firestoreReads !== undefined && (
          <>
            <dt className="text-gray-500">Số document reads</dt>
            <dd className="font-medium text-orange-700">{result.firestoreReads}</dd>
          </>
        )}
      </dl>
      <p className="rounded bg-gray-50 px-3 py-2 text-xs text-gray-600 italic">{result.note}</p>
    </div>
  );
}

// ─── Section 1: My Tickets comparison ─────────────────────────────────────────
function MyTicketsSection() {
  const [userId, setUserId] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function run() {
    if (!userId) return;
    setLoading(true);
    setError('');
    try {
      const res = await labApi.dataStorage.myTickets(userId);
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Thí nghiệm 1: Đọc "Vé của tôi"</h2>
        <p className="mt-1 text-sm text-gray-600">
          So sánh thời gian và số lần đọc khi lấy danh sách vé của một user.
          PostgreSQL dùng 1 câu JOIN 6 bảng; Firestore đọc từng document riêng lẻ.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          id="lab-userId"
          type="number"
          min="1"
          placeholder="User ID (VD: 3)"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm w-48"
        />
        <button
          id="lab-run-tickets"
          type="button"
          onClick={run}
          disabled={loading || !userId}
          className="rounded-lg bg-indigo-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? 'Đang chạy…' : '▶ Chạy thí nghiệm'}
        </button>
      </div>

      {error && <p role="alert" className="text-red-700 text-sm">{error}</p>}

      {result && (
        <div className="grid gap-4 md:grid-cols-2">
          <CompareCard title="PostgreSQL" result={result.postgresql} color="blue" />
          <CompareCard title="Firestore" result={result.firestore} color="orange" />
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm space-y-1">
          <p className="font-semibold text-gray-800">📝 Nhận xét:</p>
          <ul className="list-disc list-inside text-gray-700 space-y-1">
            <li>PostgreSQL: <strong>1 SQL query</strong>, optimizer dùng index scan hiệu quả.</li>
            <li>Firestore: <strong>{result.firestore?.firestoreReads ?? '?'} document reads</strong> –
              mỗi vé đọc 2 document (validTickets + events); tốn phí khi có nhiều vé.</li>
            <li>Kết luận: với nghiệp vụ JOIN nhiều bảng, PostgreSQL nhanh và rẻ hơn; Firestore phù hợp khi cần realtime/offline.</li>
          </ul>
        </div>
      )}
    </section>
  );
}

// ─── Section 2: Storage Size ──────────────────────────────────────────────────
function StorageSizeSection() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function run() {
    setLoading(true);
    setError('');
    try {
      const res = await labApi.dataStorage.storageSize();
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Thí nghiệm 2: Dung lượng lưu trữ</h2>
        <p className="mt-1 text-sm text-gray-600">
          So sánh tổng dung lượng PostgreSQL (pg_total_relation_size) với ước tính Firestore (~2 KB/document).
        </p>
      </div>

      <button
        id="lab-run-storage"
        type="button"
        onClick={run}
        disabled={loading}
        className="rounded-lg bg-indigo-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {loading ? 'Đang tính…' : '▶ Chạy thí nghiệm'}
      </button>

      {error && <p role="alert" className="text-red-700 text-sm">{error}</p>}

      {result && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* PostgreSQL */}
          <div className="rounded-xl border border-blue-200 bg-white p-5 shadow-sm space-y-3">
            <h3 className="text-base font-bold text-blue-800">🐘 PostgreSQL</h3>
            <p className="text-2xl font-mono font-bold text-blue-900">{result.postgresql.totalSizePretty}</p>
            <table className="w-full text-xs">
              <thead><tr className="text-gray-500"><th className="text-left pb-1">Bảng</th><th className="text-right pb-1">Kích thước</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {result.postgresql.tables.map((t) => (
                  <tr key={t.tableName}>
                    <td className="py-0.5 font-mono text-gray-700">{t.tableName}</td>
                    <td className="py-0.5 text-right text-gray-600">{t.totalSize}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Firestore */}
          <div className="rounded-xl border border-orange-200 bg-white p-5 shadow-sm space-y-3">
            <h3 className="text-base font-bold text-orange-800">🔥 Firestore (ước tính)</h3>
            <p className="text-2xl font-mono font-bold text-orange-900">{result.firestore.estimatedSizePretty}</p>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              <dt className="text-gray-500">Số documents</dt>
              <dd className="font-medium">{fmt(result.firestore.estimatedDocuments)}</dd>
              <dt className="text-gray-500">Ước tính/doc</dt>
              <dd className="font-medium">~2 KB</dd>
            </dl>
            <p className="text-xs text-gray-500 italic">{result.firestore.note}</p>
          </div>
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm">
          <p className="font-semibold text-gray-800">📝 Nhận xét:</p>
          <p className="mt-1 text-gray-700">{result.summary}</p>
        </div>
      )}
    </section>
  );
}

// ─── Data model comparison table ──────────────────────────────────────────────
function ModelCompareTable() {
  const rows = [
    { tieu: 'Cấu trúc',    pg: '10 bảng chuẩn hóa (3NF)',         fs: 'Collection/document, denormalized' },
    { tieu: '"Vé của tôi"', pg: '1 query JOIN 6 bảng',             fs: '2+ reads/vé (validTickets + events)' },
    { tieu: 'Ghi vé mới',  pg: '1 ACID transaction',               fs: 'batch write nhiều document' },
    { tieu: 'Realtime',    pg: 'Polling / LISTEN-NOTIFY',          fs: 'onSnapshot push tự động' },
    { tieu: 'Offline',     pg: 'Không hỗ trợ native',              fs: 'IndexedDB cache tự động' },
    { tieu: 'Nhất quán',   pg: 'ACID serializable',                fs: 'Eventual (cross-document)' },
    { tieu: 'Chi phí đọc', pg: 'Không tính theo operation',        fs: '~$0.06/100k reads' },
  ];
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold text-gray-900">So sánh mô hình lưu trữ</h2>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Tiêu chí</th>
              <th className="px-4 py-3 text-left font-semibold text-blue-700">🐘 PostgreSQL</th>
              <th className="px-4 py-3 text-left font-semibold text-orange-700">🔥 Firestore</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.tieu} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-700">{r.tieu}</td>
                <td className="px-4 py-3 text-gray-600">{r.pg}</td>
                <td className="px-4 py-3 text-gray-600">{r.fs}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function LabDataStoragePage() {
  return (
    <div className="space-y-10">
      <header>
        <div className="flex items-center gap-3">
          <Badge label="DBMS Lab" color="indigo" />
          <Badge label="Topic: Data Storage" color="amber" />
        </div>
        <h1 className="mt-2 text-2xl font-bold text-gray-950">Data Storage & Management</h1>
        <p className="mt-1 text-sm text-gray-600">
          Cùng dữ liệu vé lưu theo hai mô hình; so sánh số lần đọc để hiện "Vé của tôi" và ước tính dung lượng lưu trữ.
        </p>
      </header>

      <ModelCompareTable />
      <hr className="border-gray-200" />
      <MyTicketsSection />
      <hr className="border-gray-200" />
      <StorageSizeSection />
    </div>
  );
}
