// [#10] Thống kê kinh doanh: doanh thu, vé, đơn, tỷ lệ hủy, lấp đầy, check-in (loại h: hàm tổng hợp).
// Bộ lọc: sự kiện + khoảng ngày. Phụ trách: TV3
import { useMemo, useState } from 'react';
import { adminApi } from '../api/adminApi.js';
import { eventsApi } from '../api/eventsApi.js';
import { useAsync } from '../lib/useAsync.js';
import { money } from '../lib/format.js';
import { ErrorBox, Field, Loading, PageHeader, Pill } from '../components/ui.jsx';
import RevenueChart from '../components/RevenueChart.jsx';

const todayVN = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const daysAgo = (n) => {
  const d = new Date(todayVN() + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};
const PRESETS = [
  ['7 ngày', () => ({ from: daysAgo(6), to: todayVN() })],
  ['30 ngày', () => ({ from: daysAgo(29), to: todayVN() })],
  ['90 ngày', () => ({ from: daysAgo(89), to: todayVN() })],
  ['Tất cả', () => ({ from: '', to: '' })],
];

function Kpi({ label, value, sub, tone }) {
  return (
    <div className="card p-5">
      <p className="label">{label}</p>
      <p className={'text-3xl font-extrabold tracking-tight ' + (tone ?? '')}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

function Bar({ pct, held = 0, color = 'bg-royal' }) {
  return (
    <div className="h-3 rounded-full bg-black/10 overflow-hidden flex">
      <div className={'h-full ' + color} style={{ width: Math.min(100, pct) + '%' }} />
      {held > 0 && <div className="h-full bg-gold" style={{ width: Math.min(100 - pct, held) + '%' }} />}
    </div>
  );
}

export default function AdminReportsPage() {
  const [filters, setFilters] = useState({ eventId: '', ...PRESETS[1][1]() });
  const [preset, setPreset] = useState('30 ngày');
  const query = useMemo(() => ({ eventId: filters.eventId, from: filters.from, to: filters.to }), [filters]);
  const set = (k) => (e) => { setPreset(null); setFilters({ ...filters, [k]: e.target.value }); };

  const events = useAsync(() => eventsApi.list(), []);
  const overview = useAsync(() => adminApi.overview(query), [query]);
  const daily = useAsync(() => adminApi.revenueDaily(query), [query]);
  const revenue = useAsync(() => adminApi.revenue(query), [query]);
  const occupancy = useAsync(() => adminApi.occupancy({ eventId: filters.eventId }), [filters.eventId]);

  const o = overview.data;
  const loading = overview.loading || daily.loading || revenue.loading || occupancy.loading;
  const error = overview.error ?? daily.error ?? revenue.error ?? occupancy.error;

  return (
    <div>
      <PageHeader title="Thống kê doanh thu" subtitle="Doanh thu tính trên các vé còn hiệu lực của đơn đã thanh toán; đơn hủy đã hoàn tiền không tính." />

      <div className="card p-4 flex flex-wrap gap-4 items-end mb-6">
        <div className="w-full sm:w-64">
          <Field label="Sự kiện">
            <select className="input" value={filters.eventId} onChange={set('eventId')}>
              <option value="">Tất cả sự kiện</option>
              {events.data?.map((e) => <option key={e.eventId} value={e.eventId}>{e.title}</option>)}
            </select>
          </Field>
        </div>
        <div className="w-[calc(50%-0.5rem)] sm:w-auto"><Field label="Từ ngày"><input type="date" className="input" value={filters.from} max={filters.to || undefined} onChange={set('from')} /></Field></div>
        <div className="w-[calc(50%-0.5rem)] sm:w-auto"><Field label="Đến ngày"><input type="date" className="input" value={filters.to} min={filters.from || undefined} onChange={set('to')} /></Field></div>
        <div className="flex gap-2 flex-wrap">
          {PRESETS.map(([label, range]) => (
            <button
              key={label}
              onClick={() => { setPreset(label); setFilters({ ...filters, ...range() }); }}
              className={'rounded-full px-4 py-2 text-sm font-bold border ' + (preset === label ? 'bg-ink text-white border-ink' : 'bg-white border-black/15 hover:bg-black/5')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <ErrorBox error={error} />
      {loading && !o && <Loading />}

      {o && (
        <div className={'space-y-6 transition-opacity ' + (loading ? 'opacity-60' : '')}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Kpi label="Tổng doanh thu" value={money(o.revenue)} sub={`${o.paidOrders} đơn đã thanh toán`} />
            <Kpi label="Vé đã bán" value={o.ticketsSold.toLocaleString('vi-VN')} sub={`Giá vé trung bình ${money(o.avgTicketPrice)}`} />
            <Kpi label="Giá trị đơn trung bình" value={money(o.avgOrderValue)} sub={`${o.orders.expired} đơn hết hạn giữ ghế`} />
            <Kpi label="Tỷ lệ lấp đầy" value={o.occupancyRate + '%'} sub={`${o.seatsSold.toLocaleString('vi-VN')} / ${o.seatCapacity.toLocaleString('vi-VN')} ghế`} />
            <Kpi label="Tỷ lệ hủy đơn" value={o.cancelRate + '%'} tone={o.cancelRate > 15 ? 'text-red-700' : ''} sub={`${o.orders.cancelled} đơn hủy / ${o.orders.paid + o.orders.cancelled} đơn`} />
            <Kpi label="Tỷ lệ đã soát vé" value={o.checkInRate + '%'} sub={`${o.checkedIn} / ${o.ticketsSold} vé đã vào cổng`} />
          </div>

          <section className="card p-5">
            <h2 className="font-bold text-lg">
              Doanh thu theo ngày{' '}
              {!filters.from && !filters.to && <span className="text-sm font-normal text-gray-500">(30 ngày gần nhất; các chỉ số khác tính trên toàn bộ thời gian)</span>}
            </h2>
            {daily.data && <RevenueChart data={daily.data} />}
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card p-5">
              <h2 className="font-bold text-lg mb-4">Sự kiện doanh thu cao nhất</h2>
              {o.topEvents.length === 0 && <p className="text-gray-500 text-sm">Chưa có doanh thu.</p>}
              <ul className="space-y-4">
                {o.topEvents.map((e) => (
                  <li key={e.eventId}>
                    <div className="flex justify-between gap-3 text-sm mb-1">
                      <span className="font-bold min-w-0">
                        {e.title} {e.aboveAverage && <Pill tone="green">Trên trung bình</Pill>}
                      </span>
                      <span className="shrink-0">{money(e.revenue)} <span className="text-gray-500">({e.share}%)</span></span>
                    </div>
                    <Bar pct={e.share} color="bg-brand" />
                  </li>
                ))}
              </ul>
            </section>

            <section className="card p-5">
              <h2 className="font-bold text-lg mb-4">Lấp đầy theo khu vực</h2>
              {occupancy.data?.length === 0 && <p className="text-gray-500 text-sm">Chưa có khu vực.</p>}
              <ul className="space-y-4">
                {occupancy.data?.map((z) => (
                  <li key={z.eventId + z.zone}>
                    <div className="flex justify-between gap-3 text-sm mb-1">
                      <span><b>{z.zone}</b> · {z.eventTitle}</span>
                      <span className="text-gray-600 shrink-0">{z.sold} / {z.capacity} ({z.rate}%)</span>
                    </div>
                    <Bar pct={z.rate} held={z.capacity ? (z.held / z.capacity) * 100 : 0} />
                  </li>
                ))}
              </ul>
              <p className="text-xs text-gray-500 mt-4"><span className="inline-block w-2 h-2 rounded-full bg-royal" /> đã bán <span className="inline-block w-2 h-2 rounded-full bg-gold ml-3" /> đang giữ chỗ</p>
            </section>
          </div>

          <section className="card overflow-x-auto">
            <h2 className="font-bold text-lg px-5 pt-5">Doanh thu theo sự kiện và khu vực</h2>
            <table className="w-full mt-2 min-w-[520px]">
              <thead><tr><th className="th">Sự kiện</th><th className="th">Khu vực</th><th className="th text-right">Vé bán</th><th className="th text-right">Doanh thu</th></tr></thead>
              <tbody>
                {revenue.data?.map((r) => (
                  <tr key={r.eventId + r.zone}><td className="td">{r.eventTitle}</td><td className="td font-bold">{r.zone}</td><td className="td text-right">{r.ticketsSold}</td><td className="td text-right">{money(r.revenue)}</td></tr>
                ))}
                {revenue.data?.length === 0 && <tr><td className="td text-gray-500" colSpan={4}>Không có doanh thu trong khoảng này.</td></tr>}
              </tbody>
              {revenue.data?.length > 0 && (
                <tfoot>
                  <tr className="bg-paper font-bold">
                    <td className="td" colSpan={2}>Tổng</td>
                    <td className="td text-right">{revenue.data.reduce((s, r) => s + r.ticketsSold, 0)}</td>
                    <td className="td text-right">{money(revenue.data.reduce((s, r) => s + r.revenue, 0))}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </section>
        </div>
      )}
    </div>
  );
}
