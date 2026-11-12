// Biểu đồ cột doanh thu theo ngày (SVG thuần). data: [{ day: 'YYYY-MM-DD', revenue, orders, tickets }]
import { useState } from 'react';
import { money } from '../lib/format.js';

const W = 760;
const H = 240;
const PAD = { top: 12, right: 8, bottom: 28, left: 52 };

// Làm tròn trần lên số "đẹp" (1, 2, 5 × 10^n) cho trục tung
function niceMax(v) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}
// 12.500.000 → "12,5 tr"; 1.200.000.000 → "1,2 tỷ"
const short = (v) => (v >= 1e9 ? +(v / 1e9).toFixed(1) + ' tỷ' : v >= 1e6 ? +(v / 1e6).toFixed(1) + ' tr' : v >= 1e3 ? +(v / 1e3).toFixed(0) + ' k' : String(v));
const dm = (ymd) => ymd.slice(8, 10) + '/' + ymd.slice(5, 7);

export default function RevenueChart({ data }) {
  const [hover, setHover] = useState(null);
  if (!data?.length) return <p className="text-gray-500 text-sm py-10 text-center">Không có dữ liệu trong khoảng này.</p>;

  const max = niceMax(Math.max(...data.map((d) => d.revenue)));
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const step = iw / data.length;
  const bw = Math.max(2, Math.min(28, step * 0.7));
  const y = (v) => PAD.top + ih - (v / max) * ih;
  const every = Math.ceil(data.length / 8); // nhãn trục hoành thưa ra cho khỏi chồng
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => max * t);
  const cur = hover != null ? data[hover] : null;

  return (
    <div>
      <p className="h-6 text-sm text-gray-600">
        {cur ? (
          <>
            <b>{dm(cur.day)}</b>: {money(cur.revenue)} · {cur.orders} đơn · {cur.tickets} vé
          </>
        ) : (
          'Rê chuột vào cột để xem chi tiết từng ngày.'
        )}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`Biểu đồ doanh thu ${data.length} ngày, từ ${dm(data[0].day)} đến ${dm(data.at(-1).day)}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="currentColor" strokeOpacity={t === 0 ? 0.35 : 0.1} />
            <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#6b7280">{short(t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = PAD.left + i * step + (step - bw) / 2;
          const h = Math.max(d.revenue > 0 ? 2 : 0, (d.revenue / max) * ih);
          return (
            <g key={d.day} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={PAD.left + i * step} y={PAD.top} width={step} height={ih} fill="transparent" />
              <rect x={x} y={PAD.top + ih - h} width={bw} height={h} rx="2" fill={hover === i ? '#b93a17' : '#2b3acb'}>
                <title>{`${dm(d.day)}: ${money(d.revenue)}`}</title>
              </rect>
              {i % every === 0 && (
                <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="#6b7280">{dm(d.day)}</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
