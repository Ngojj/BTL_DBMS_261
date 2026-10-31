import { useState } from 'react';
import { labApi } from '../../api/labApi.js';

const msColor = (ms) => (ms < 5 ? 'text-emerald-600' : ms < 50 ? 'text-amber-600' : 'text-red-600');

export default function LabIndexingPage() {
  const [userId, setUserId] = useState(1);
  const [eventId, setEventId] = useState(1);
  const [status, setStatus] = useState('PAID');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleRun() {
    setLoading(true);
    setError('');
    try {
      const data = await labApi.indexing.explainCompare({ userId, eventId, status });
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
          <span className="rounded-full bg-blue-100 text-blue-800 px-2.5 py-0.5 text-xs font-semibold">Topic: Indexing</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-gray-950">Indexing & Query Optimization</h1>
        <p className="mt-1 text-sm text-gray-600">
          So sánh hiệu quả B-Tree Index trên PostgreSQL (Index Scan vs Seq Scan) với cơ chế Single-field / Composite Index trên Firestore.
        </p>
      </header>

      {/* Điều khiển tham số */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-gray-800">Cấu hình điều kiện tìm kiếm đơn hàng</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">User ID</label>
            <input
              type="number"
              value={userId}
              onChange={(e) => setUserId(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Event ID</label>
            <input
              type="number"
              value={eventId}
              onChange={(e) => setEventId(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Trạng thái đơn</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="PAID">PAID</option>
              <option value="PENDING">PENDING</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRun}
          disabled={loading}
          className="rounded-lg bg-indigo-700 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-50"
        >
          {loading ? 'Đang phân tích EXPLAIN ANALYZE…' : '▶ Chạy phân tích Index'}
        </button>
      </div>

      {error && <p role="alert" className="text-red-700 text-sm font-medium">{error}</p>}

      {/* Kết quả so sánh */}
      {result && (
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* PostgreSQL: Index vs Seq Scan */}
            <div className="rounded-xl border border-blue-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="text-lg font-bold text-blue-900">🐘 PostgreSQL Optimizer</h3>
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded font-medium">EXPLAIN ANALYZE</span>
              </div>

              {/* So sánh With Index vs Without Index */}
              <div className="space-y-3">
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-emerald-900 text-sm">✅ Khi dùng Index ({result.postgresql.withIndex.scanType})</span>
                    <span className={`font-mono font-bold ${msColor(result.postgresql.withIndex.executionTimeMs)}`}>
                      {result.postgresql.withIndex.executionTimeMs} ms
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-700">
                    <div>Planning Time: <strong>{result.postgresql.withIndex.planningTimeMs} ms</strong></div>
                    <div>Cost: <strong>{result.postgresql.withIndex.totalCost}</strong></div>
                    <div>Shared Hit Blocks: <strong>{result.postgresql.withIndex.sharedHitBlocks}</strong></div>
                    <div>Actual Rows: <strong>{result.postgresql.withIndex.actualRows}</strong></div>
                  </div>
                </div>

                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-amber-900 text-sm">⚠️ Khi ép Sequential Scan ({result.postgresql.withoutIndex.scanType})</span>
                    <span className={`font-mono font-bold ${msColor(result.postgresql.withoutIndex.executionTimeMs)}`}>
                      {result.postgresql.withoutIndex.executionTimeMs} ms
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-700">
                    <div>Planning Time: <strong>{result.postgresql.withoutIndex.planningTimeMs} ms</strong></div>
                    <div>Cost: <strong>{result.postgresql.withoutIndex.totalCost}</strong></div>
                    <div>Shared Hit Blocks: <strong>{result.postgresql.withoutIndex.sharedHitBlocks}</strong></div>
                    <div>Actual Rows: <strong>{result.postgresql.withoutIndex.actualRows}</strong></div>
                  </div>
                </div>
              </div>

              {/* Danh sách indexes trên bảng */}
              <div className="border-t pt-3">
                <p className="text-xs font-semibold text-gray-600 mb-2">Các Index hiện có trên bảng `orders`:</p>
                <div className="space-y-1">
                  {result.postgresql.indexesOnTable.map((idx) => (
                    <div key={idx.indexname} className="flex justify-between text-xs bg-gray-50 px-2 py-1 rounded">
                      <code className="text-indigo-700">{idx.indexname}</code>
                      <span className="text-gray-500">{idx.size_pretty}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Cloud Firestore Index Mechanism */}
            <div className="rounded-xl border border-orange-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="text-lg font-bold text-orange-900">🔥 Cloud Firestore Indexing</h3>
                <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded font-medium">B-Tree Distributed</span>
              </div>

              <div className="space-y-3 text-sm">
                <div className="rounded-lg bg-orange-50 border border-orange-200 p-3">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-orange-900">Độ trễ truy vấn (Query Latency)</span>
                    <span className="font-mono font-bold text-orange-700">{result.firestore.elapsedMs} ms</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    Số documents tìm thấy: <strong>{result.firestore.docsFound}</strong> (Reads: {result.firestore.readsCount})
                  </p>
                </div>

                <div className="space-y-2 text-xs text-gray-700">
                  <div className="rounded border border-gray-100 bg-gray-50 p-2.5">
                    <p className="font-semibold text-gray-900">Single-field Index:</p>
                    <p className="mt-0.5 text-gray-600">{result.firestore.indexMechanism?.singleFieldIndex}</p>
                  </div>
                  <div className="rounded border border-gray-100 bg-gray-50 p-2.5">
                    <p className="font-semibold text-gray-900">Composite Index:</p>
                    <p className="mt-0.5 text-gray-600">{result.firestore.indexMechanism?.compositeIndex}</p>
                  </div>
                  <div className="rounded border border-gray-100 bg-gray-50 p-2.5">
                    <p className="font-semibold text-gray-900">Write Amplification:</p>
                    <p className="mt-0.5 text-gray-600">{result.firestore.indexMechanism?.writeCost}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Nhận xét tổng kết */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-sm space-y-2">
            <h4 className="font-bold text-gray-900">📝 Kết luận bài thực hành:</h4>
            <ul className="list-disc list-inside text-gray-700 space-y-1">
              <li><strong>PostgreSQL:</strong> Hỗ trợ B-Tree, GiST, GIN, Partial Unique Index (như <code>uq_active_ticket_per_seat</code>). Chỉ tạo index khi cần để tránh tốn dung lượng và làm chậm lệnh INSERT.</li>
              <li><strong>Cloud Firestore:</strong> Tự động đánh index cho tất cả các field đơn để đảm bảo mọi truy vấn đều chạy theo đường tiệm cận O(log N) mà không cần quét bảng; tuy nhiên người lập trình bắt buộc phải định nghĩa Composite Index trong <code>firestore.indexes.json</code> cho các bộ lọc phức tạp.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

