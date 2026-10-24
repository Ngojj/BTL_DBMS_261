import { useEffect, useState } from 'react';
import { adminApi } from '../../api/adminApi.js';

export default function AdminRevenuePage() {
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [eventId, setEventId] = useState('');

  function load(eid) {
    setLoading(true);
    adminApi.revenue(eid || undefined)
      .then((res) => setData(res.data ?? []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  // Tổng doanh thu
  const totalRevenue = data.reduce((s, r) => s + r.revenue, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900">Thống kê doanh thu</h1>
        <div className="flex items-center gap-2">
          <input
            placeholder="Event ID (để trống = tất cả)"
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm w-52"
          />
          <button onClick={() => load(eventId)}
            className="rounded bg-indigo-700 px-4 py-2 text-sm font-semibold text-white">Lọc</button>
        </div>
      </div>

      {error && <p role="alert" className="text-red-700 text-sm">{error}</p>}

      <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-5 py-4">
        <p className="text-sm text-indigo-700">Tổng doanh thu</p>
        <p className="text-3xl font-bold text-indigo-900">{totalRevenue.toLocaleString('vi-VN')} ₫</p>
      </div>

      {loading ? (
        <p className="text-gray-500 animate-pulse">Đang tải…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                {['Sự kiện', 'Khu vực', 'Sức chứa', 'Đã bán', 'Còn lại', 'Lấp đầy', 'Doanh thu'].map((h) => (
                  <th key={h} className="px-4 py-3 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.map((row) => (
                <tr key={row.zoneId} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{row.eventTitle}</p>
                    <p className="text-xs text-gray-400">{new Date(row.eventDate).toLocaleDateString('vi-VN')}</p>
                  </td>
                  <td className="px-4 py-3 font-medium text-indigo-700">{row.zoneName}</td>
                  <td className="px-4 py-3 text-gray-700 text-right">{row.capacity.toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-700 text-right">{row.ticketsSold.toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-700 text-right">{row.ticketsLeft.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 rounded-full bg-gray-200">
                        <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${row.fillPct}%` }} />
                      </div>
                      <span className="text-xs text-gray-600">{row.fillPct}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-900 text-right">
                    {row.revenue.toLocaleString('vi-VN')} ₫
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.length === 0 && <p className="px-4 py-8 text-center text-gray-500">Không có dữ liệu.</p>}
        </div>
      )}
    </div>
  );
}
