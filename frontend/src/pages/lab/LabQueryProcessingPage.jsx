import { useState } from 'react';
import { labApi } from '../../api/labApi.js';

const money = (n) => Number(n || 0).toLocaleString('vi-VN') + ' ₫';
const msColor = (ms) => (ms < 10 ? 'text-emerald-600' : ms < 100 ? 'text-amber-600' : 'text-red-600');

export default function LabQueryProcessingPage() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleRun() {
    setLoading(true);
    setError('');
    try {
      const data = await labApi.queryProcessing.revenueReport();
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
          <span className="rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-xs font-semibold">Topic: Query Processing</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-gray-950">Query Processing & Aggregations</h1>
        <p className="mt-1 text-sm text-gray-600">
          So sánh xử lý báo cáo doanh thu & tỷ lệ bán vé theo khu vực giữa PostgreSQL Query Engine (Hash Join, Group Aggregate) và NoSQL Document Store (In-Memory Aggregation).
        </p>
      </header>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
        <h2 className="text-base font-bold text-gray-800">Kịch bản thí nghiệm</h2>
        <p className="text-sm text-gray-600">
          Tổng hợp doanh thu theo từng khu vực: <code>SUM(price)</code>, <code>COUNT(*)</code>, gom nhóm theo <code>GROUP BY zone_id, zone_name, event_title</code> và lọc <code>HAVING COUNT &gt;= 0</code>.
        </p>
        <button
          type="button"
          onClick={handleRun}
          disabled={loading}
          className="rounded-lg bg-indigo-700 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-50"
        >
          {loading ? 'Đang thực thi báo cáo hai bên…' : '▶ Chạy so sánh Query Processing'}
        </button>
      </div>

      {error && <p role="alert" className="text-red-700 text-sm font-medium">{error}</p>}

      {result && (
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* PostgreSQL Card */}
            <div className="rounded-xl border border-blue-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="text-lg font-bold text-blue-900">🐘 PostgreSQL Engine</h3>
                <span className="font-mono font-bold text-xl text-blue-800">{result.postgresql.executionTimeMs} ms</span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b">
                  <span className="text-gray-500">Chiến lược thực thi:</span>
                  <span className="font-semibold text-gray-800">{result.postgresql.strategy}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-gray-500">Planning Time:</span>
                  <span className="font-mono">{result.postgresql.planningTimeMs} ms</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-gray-500">Total Wall-clock Time:</span>
                  <span className={`font-mono font-bold ${msColor(result.postgresql.elapsedWallClockMs)}`}>
                    {result.postgresql.elapsedWallClockMs} ms
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-gray-500">Buffer Hits:</span>
                  <span className="font-mono">{result.postgresql.sharedHitBlocks} blocks</span>
                </div>
                <div className="py-1">
                  <span className="text-gray-500 block mb-1">Query Plan Pipeline:</span>
                  <div className="flex flex-wrap gap-1">
                    {result.postgresql.queryPlanNodes?.map((n, i) => (
                      <span key={i} className="rounded bg-blue-50 text-blue-700 px-2 py-0.5 font-mono text-[11px]">
                        {n}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-700 space-y-1">
                <p><strong>Predicate Pushdown:</strong> {result.postgresql.characteristics?.pushdown}</p>
                <p><strong>Memory:</strong> {result.postgresql.characteristics?.memory}</p>
              </div>
            </div>

            {/* Cloud Firestore Card */}
            <div className="rounded-xl border border-orange-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="text-lg font-bold text-orange-900">🔥 Firestore In-Memory</h3>
                <span className="font-mono font-bold text-xl text-orange-800">{result.firestore.elapsedWallClockMs} ms</span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b">
                  <span className="text-gray-500">Chiến lược xử lý:</span>
                  <span className="font-semibold text-gray-800">{result.firestore.strategy}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-gray-500">Số Document Reads:</span>
                  <span className="font-mono font-bold text-orange-700">{result.firestore.documentReads} docs</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-gray-500">Thời gian tính toán RAM:</span>
                  <span className="font-mono">{result.firestore.inMemoryAggregationMs} ms</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-gray-500">Ước tính chi phí API:</span>
                  <span className="font-mono font-bold text-gray-800">${result.firestore.estimatedCostUsd}</span>
                </div>
              </div>

              <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-700 space-y-1">
                <p><strong>Kéo dữ liệu:</strong> {result.firestore.characteristics?.pushdown}</p>
                <p><strong>Bộ nhớ Node.js:</strong> {result.firestore.characteristics?.memory}</p>
              </div>
            </div>
          </div>

          {/* Bảng dữ liệu kết quả */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
            <h4 className="font-bold text-gray-900">Kết quả tổng hợp doanh thu theo khu vực</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Khu vực</th>
                    <th className="px-3 py-2 text-left">Sự kiện</th>
                    <th className="px-3 py-2 text-right">Số vé đã bán</th>
                    <th className="px-3 py-2 text-right">Doanh thu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {result.postgresql.data?.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-semibold text-gray-900">{row.zone_name}</td>
                      <td className="px-3 py-2 text-gray-600">{row.event_title}</td>
                      <td className="px-3 py-2 text-right font-mono">{row.tickets_sold}</td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-indigo-700">{money(row.total_revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

