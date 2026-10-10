// [#10] Thống kê doanh thu và tỷ lệ lấp đầy theo khu vực (loại h: hàm tổng hợp). Phụ trách: TV3
import { adminApi } from '../api/adminApi.js';
import { useAsync } from '../lib/useAsync.js';
import { money } from '../lib/format.js';
import { ErrorBox, Loading, PageHeader } from '../components/ui.jsx';

export default function AdminReportsPage() {
  const revenue = useAsync(() => adminApi.revenue(), []);
  const occupancy = useAsync(() => adminApi.occupancy(), []);
  const totalRevenue = revenue.data?.reduce((s, r) => s + r.revenue, 0) ?? 0;
  const totalTickets = revenue.data?.reduce((s, r) => s + r.ticketsSold, 0) ?? 0;
  const loading = revenue.loading || occupancy.loading;

  return (
    <div>
      <PageHeader
        title="Thống kê doanh thu"
        subtitle="Tổng hợp theo sự kiện và khu vực. Chỉ tính vé còn hiệu lực thuộc đơn đã thanh toán."
        action={<button className="btn-brand" disabled={loading} onClick={() => { revenue.reload(); occupancy.reload(); }}>Làm mới</button>}
      />
      <div className="space-y-6">
        <ErrorBox error={revenue.error ?? occupancy.error} />
        {loading && <Loading />}

        {!revenue.loading && revenue.data && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="card p-5"><p className="label">Tổng doanh thu</p><p className="text-3xl font-extrabold">{money(totalRevenue)}</p></div>
              <div className="card p-5"><p className="label">Vé đã bán</p><p className="text-3xl font-extrabold">{totalTickets}</p></div>
            </div>
            <div className="card overflow-x-auto">
              <table className="w-full">
                <thead><tr><th className="th">Sự kiện</th><th className="th">Khu vực</th><th className="th text-right">Vé bán</th><th className="th text-right">Doanh thu</th></tr></thead>
                <tbody>
                  {revenue.data.length === 0 && <tr><td className="td text-center text-gray-500" colSpan={4}>Chưa có khu vực để thống kê.</td></tr>}
                  {revenue.data.map((r, i) => (
                    <tr key={r.zoneId ?? i}><td className="td">{r.eventTitle}</td><td className="td font-bold">{r.zone}</td><td className="td text-right">{r.ticketsSold}</td><td className="td text-right">{money(r.revenue)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!occupancy.loading && occupancy.data && (
          <div className="card p-5">
            <h2 className="font-bold text-lg mb-4">Tỷ lệ lấp đầy</h2>
            <p className="text-sm text-gray-500 mb-4">Số ghế có vé đã thanh toán / sức chứa của khu vực; không tính ghế đang giữ.</p>
            <div className="space-y-4">
              {occupancy.data.length === 0 && <p className="text-sm text-gray-500">Chưa có khu vực để thống kê.</p>}
              {occupancy.data.map((o, i) => {
                const pct = o.capacity > 0 ? Math.round((o.sold / o.capacity) * 100) : 0;
                return (
                  <div key={o.zoneId ?? i}>
                    <div className="flex justify-between text-sm mb-1">
                      <span><b>{o.zone}</b> · {o.eventTitle}</span>
                      <span className="text-gray-600">{o.sold} / {o.capacity} ({pct}%)</span>
                    </div>
                    <div className="h-3 rounded-full bg-black/10 overflow-hidden"><div className="h-full bg-royal" style={{ width: Math.min(100, Math.max(0, pct)) + '%' }} /></div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
