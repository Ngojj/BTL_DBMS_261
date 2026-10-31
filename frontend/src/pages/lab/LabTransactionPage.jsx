import { useState } from 'react';
import { labApi } from '../../api/labApi.js';

export default function LabTransactionPage() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSimulate(shouldFail) {
    setLoading(true);
    setError('');
    try {
      const data = await labApi.transaction.simulate({ shouldFail });
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
          <span className="rounded-full bg-purple-100 text-purple-800 px-2.5 py-0.5 text-xs font-semibold">Topic: Transaction</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-gray-950">Transaction Management & ACID</h1>
        <p className="mt-1 text-sm text-gray-600">
          Kiểm chứng tính chất Nguyên tử (Atomicity) và Bền vững (Durability) trong chu trình đặt vé: Giữ ghế → Tạo đơn → Tạo vé → Thanh toán.
        </p>
      </header>

      {/* Điều khiển */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-gray-800">Chọn kịch bản giao dịch</h2>
        <div className="flex flex-wrap gap-4">
          <button
            type="button"
            onClick={() => handleSimulate(false)}
            disabled={loading}
            className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
          >
            <span>✅ Giao dịch thành công (COMMIT)</span>
          </button>
          <button
            type="button"
            onClick={() => handleSimulate(true)}
            disabled={loading}
            className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
          >
            <span>⚠️ Giả lập lỗi thanh toán (ROLLBACK)</span>
          </button>
        </div>
        {loading && <p className="text-xs text-gray-500 animate-pulse">Đang thực thi transaction trên cả hai DBMS…</p>}
      </div>

      {error && <p role="alert" className="text-red-700 text-sm font-medium">{error}</p>}

      {result && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 rounded-xl bg-gray-50 border p-4">
            <span className="text-sm font-semibold text-gray-700">Kịch bản đã chạy:</span>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${result.shouldFail ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>
              {result.scenario}
            </span>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* PostgreSQL Card */}
            <div className="rounded-xl border border-blue-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="text-lg font-bold text-blue-900">🐘 PostgreSQL Transaction</h3>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${result.postgresql.outcome === 'COMMITTED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  {result.postgresql.outcome}
                </span>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Nhật ký thực thi (Execution Logs):</p>
                <div className="rounded-lg bg-gray-900 p-3 font-mono text-xs text-green-400 space-y-1 overflow-x-auto max-h-60">
                  {result.postgresql.logs?.map((l, i) => (
                    <div key={i}>{l}</div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs text-blue-900 space-y-1">
                <p><strong>Atomicity:</strong> {result.postgresql.acidAnalysis?.atomicity}</p>
                {result.postgresql.acidAnalysis?.isolation && (
                  <p><strong>Isolation:</strong> {result.postgresql.acidAnalysis?.isolation}</p>
                )}
                <p><strong>Trạng thái ghế cuối cùng:</strong> <code className="bg-white px-1.5 py-0.5 rounded font-bold">{result.postgresql.finalSeatStatus}</code></p>
              </div>
            </div>

            {/* Firestore Card */}
            <div className="rounded-xl border border-orange-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="text-lg font-bold text-orange-900">🔥 Firestore runTransaction</h3>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${result.firestore.outcome === 'COMMITTED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  {result.firestore.outcome}
                </span>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Nhật ký thực thi (Execution Logs):</p>
                <div className="rounded-lg bg-gray-900 p-3 font-mono text-xs text-amber-300 space-y-1 overflow-x-auto max-h-60">
                  {result.firestore.logs?.map((l, i) => (
                    <div key={i}>{l}</div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg bg-orange-50 border border-orange-100 p-3 text-xs text-orange-900 space-y-1">
                <p><strong>Mô hình giao dịch:</strong> {result.firestore.characteristics?.model || result.firestore.characteristics?.atomicity}</p>
                {result.firestore.characteristics?.limitations && (
                  <p><strong>Ràng buộc:</strong> {result.firestore.characteristics?.limitations}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

