import { useState } from 'react';
import { labApi } from '../../api/labApi.js';

export default function LabConcurrencyControlPage() {
  const [concurrency, setConcurrency] = useState(25);
  const [seatsCount, setSeatsCount] = useState(4);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSimulate() {
    setLoading(true);
    setError('');
    try {
      const data = await labApi.concurrencyControl.simulateRushHour({
        concurrency,
        seatsCount,
      });
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
          <span className="rounded-full bg-rose-100 text-rose-800 px-2.5 py-0.5 text-xs font-semibold">Topic: Concurrency Control</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-gray-950">Concurrency Control – Giả lập "Giờ G"</h1>
        <p className="mt-1 text-sm text-gray-600">
          Mô phỏng hàng loạt khách hàng cùng tranh mua số lượng vé giới hạn vào giờ mở bán. So sánh: Không khóa (Race Condition) vs Khóa bi quan PostgreSQL (`FOR UPDATE`) vs Khóa lạc quan Firestore (OCC).
        </p>
      </header>

      {/* Điều khiển tham số */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-gray-800">Cấu hình tải giờ G</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Số luồng tranh mua đồng thời (Concurrency: {concurrency} requests)
            </label>
            <input
              type="range"
              min="5"
              max="60"
              step="5"
              value={concurrency}
              onChange={(e) => setConcurrency(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-[11px] text-gray-400 mt-1">
              <span>5 reqs</span>
              <span>30 reqs</span>
              <span>60 reqs</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Số lượng ghế mở bán (Available Seats: {seatsCount} ghế)
            </label>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={seatsCount}
              onChange={(e) => setSeatsCount(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-[11px] text-gray-400 mt-1">
              <span>1 ghế</span>
              <span>5 ghế</span>
              <span>10 ghế</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSimulate}
          disabled={loading}
          className="rounded-lg bg-rose-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-50"
        >
          {loading ? '⚡ Đang mô phỏng tranh mua đồng thời…' : '🚀 Kích hoạt "Giờ G" (Chạy mô phỏng)'}
        </button>
      </div>

      {error && <p role="alert" className="text-red-700 text-sm font-medium">{error}</p>}

      {/* Kết quả 3 chiến lược */}
      {result && (
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            {/* 1. No Lock Card */}
            <div className={`rounded-xl border p-5 shadow-sm space-y-3 bg-white ${result.results.noLock.isOverbooked ? 'border-red-400 ring-2 ring-red-100' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="text-sm font-bold text-gray-900">1. Không khóa (No Lock)</h3>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${result.results.noLock.isOverbooked ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-700'}`}>
                  {result.results.noLock.isOverbooked ? '⚠️ OVERBOOKING' : 'SAFE'}
                </span>
              </div>
              <div className="space-y-1 text-xs">
                <p>Số yêu cầu: <strong>{result.results.noLock.concurrency}</strong></p>
                <p>Số ghế thực tế: <strong>{result.results.noLock.totalSeats}</strong></p>
                <p className="text-red-600 font-bold">Số vé đã bán: {result.results.noLock.soldCount}</p>
                <p>Thời gian: {result.results.noLock.durationMs} ms</p>
              </div>
              <p className="text-[11px] text-red-700 bg-red-50 p-2.5 rounded border border-red-100">
                {result.results.noLock.conclusion}
              </p>
            </div>

            {/* 2. PostgreSQL Pessimistic Lock Card */}
            <div className="rounded-xl border border-blue-200 bg-white p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="text-sm font-bold text-blue-900">2. PostgreSQL Lock</h3>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  FOR UPDATE
                </span>
              </div>
              <div className="space-y-1 text-xs">
                <p>Số yêu cầu: <strong>{result.results.pgPessimisticLock.concurrency}</strong></p>
                <p>Số ghế thực tế: <strong>{result.results.pgPessimisticLock.totalSeats}</strong></p>
                <p className="text-emerald-700 font-bold">Số vé đã bán: {result.results.pgPessimisticLock.soldCount}</p>
                <p>Từ chối an toàn: {result.results.pgPessimisticLock.rejectedCount}</p>
                <p>Thời gian: {result.results.pgPessimisticLock.durationMs} ms</p>
              </div>
              <p className="text-[11px] text-blue-800 bg-blue-50 p-2.5 rounded border border-blue-100">
                {result.results.pgPessimisticLock.conclusion}
              </p>
            </div>

            {/* 3. Firestore OCC Card */}
            <div className="rounded-xl border border-orange-200 bg-white p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="text-sm font-bold text-orange-900">3. Firestore OCC</h3>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-orange-100 text-orange-800">
                  runTransaction
                </span>
              </div>
              <div className="space-y-1 text-xs">
                <p>Số yêu cầu: <strong>{result.results.firestoreOCC.concurrency}</strong></p>
                <p>Số ghế thực tế: <strong>{result.results.firestoreOCC.totalSeats}</strong></p>
                <p className="text-orange-700 font-bold">Số vé đã bán: {result.results.firestoreOCC.soldCount}</p>
                <p>Số lần xung đột retry: {result.results.firestoreOCC.retryConflicts}</p>
                <p>Thời gian: {result.results.firestoreOCC.durationMs} ms</p>
              </div>
              <p className="text-[11px] text-orange-800 bg-orange-50 p-2.5 rounded border border-orange-100">
                {result.results.firestoreOCC.conclusion}
              </p>
            </div>
          </div>

          {/* Phân tích lý thuyết */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-sm space-y-2">
            <h4 className="font-bold text-gray-900">📝 So sánh chiến lược Concurrency:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-700 mt-2">
              <div className="rounded bg-white p-3 border">
                <p className="font-bold text-blue-900">🐘 Pessimistic Locking (Khóa bi quan):</p>
                <p className="mt-1">
                  Khóa cứng dòng dữ liệu ngay từ đầu. Phù hợp tuyệt đối với hệ thống bán vé có tính cạnh tranh cực cao (Hotspot contention). Không bị lãng phí CPU hay số lần thử lại vô ích.
                </p>
              </div>
              <div className="rounded bg-white p-3 border">
                <p className="font-bold text-orange-900">🔥 Optimistic Concurrency Control (Khóa lạc quan):</p>
                <p className="mt-1">
                  Không giữ khóa, phát hiện xung đột lúc commit và tự retry. Hoạt động cực tốt khi ít xung đột; nhưng khi 1.000 người cùng tranh 1 vé, số lần retry bùng nổ sẽ gây quá tải quota và tăng thời gian phản hồi.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

