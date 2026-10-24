import { useEffect, useState } from 'react';
import { adminApi } from '../../api/adminApi.js';

export default function AdminScalpersPage() {
  const [data,    setData]    = useState({ sharedPhoneGroups: [], topBuyers: [] });
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    adminApi.scalpers()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold text-gray-900">Phát hiện gom vé</h1>
      {error && <p role="alert" className="text-red-700 text-sm">{error}</p>}
      {loading && <p className="text-gray-500 animate-pulse">Đang tải…</p>}

      {/* ── Nhiều tài khoản chung SĐT ── */}
      <section>
        <h2 className="mb-3 font-semibold text-gray-800">
          Số điện thoại dùng nhiều tài khoản
          <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
            {data.sharedPhoneGroups.length} nhóm
          </span>
        </h2>
        {data.sharedPhoneGroups.length === 0 ? (
          <p className="text-sm text-green-700">✓ Không phát hiện trường hợp bất thường.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  {['Số điện thoại', 'Số TK', 'Email', 'Tổng vé'].map((h) => (
                    <th key={h} className="px-4 py-3 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.sharedPhoneGroups.map((group) => (
                  <tr key={group.phone} className="bg-red-50">
                    <td className="px-4 py-3 font-mono font-medium text-red-800">{group.phone}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">{group.accountCount}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 text-xs">{(group.emails ?? []).join(', ')}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900 text-right">{group.totalTickets}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Top người mua vé ── */}
      <section>
        <h2 className="mb-3 font-semibold text-gray-800">Top 20 người mua nhiều vé nhất</h2>
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                {['#', 'Email', 'Họ tên', 'SĐT', 'Sự kiện', 'Tổng vé'].map((h) => (
                  <th key={h} className="px-4 py-3 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.topBuyers.map((buyer, idx) => (
                <tr key={buyer.userId} className={idx < 3 ? 'bg-amber-50' : 'hover:bg-gray-50'}>
                  <td className="px-4 py-3 text-gray-500">{idx + 1}</td>
                  <td className="px-4 py-3 text-gray-800">{buyer.email}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{buyer.fullName}</td>
                  <td className="px-4 py-3 font-mono text-gray-600">{buyer.phone}</td>
                  <td className="px-4 py-3 text-gray-700 text-right">{buyer.eventsCount}</td>
                  <td className="px-4 py-3 font-bold text-gray-900 text-right">{buyer.totalTickets}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.topBuyers.length === 0 && <p className="px-4 py-8 text-center text-gray-500">Chưa có dữ liệu.</p>}
        </div>
      </section>
    </div>
  );
}
