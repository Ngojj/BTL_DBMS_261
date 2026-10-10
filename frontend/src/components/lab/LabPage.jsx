// Trang thí nghiệm dùng chung: mô tả kịch bản, nút chạy, bảng kết quả hai cột, ghi chú kết luận.
// TODO [LabPage] Phụ trách: TV3 (khung DBMS Lab) – thêm form tham số riêng từng topic, hiển thị details (EXPLAIN…)
import { useState } from 'react';
import { labsApi } from '../../api/labsApi.js';
import LabResultTable from './LabResultTable.jsx';

export default function LabPage({ topic, title, scenario }) {
  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleRun() {
    setLoading(true);
    setError(null);
    try {
      setRun(await labsApi.run(topic, {}));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-gray-600">{scenario}</p>
      <button onClick={handleRun} disabled={loading} className="px-4 py-2 rounded bg-indigo-600 text-white disabled:opacity-50">
        {loading ? 'Đang chạy…' : 'Chạy thí nghiệm'}
      </button>
      {error && <p className="text-red-600">{error}</p>}
      {run && <LabResultTable run={run} />}
      <section>
        <h2 className="font-semibold">Kết luận</h2>
        <p className="text-gray-400">TODO: ghi chú kết luận (đưa vào báo cáo).</p>
      </section>
    </div>
  );
}
