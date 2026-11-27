// [#6] Vé của tôi (loại f: join) · hủy vé/đơn (loại c). Thiết kế ưu tiên điện thoại.
// Vé được lưu vào localStorage sau mỗi lần tải để xem lại khi mất mạng.
// Phụ trách: TV5 (#6)
import { useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { bookingApi } from '../api/bookingApi.js';
import { useAsync } from '../lib/useAsync.js';
import { money, shortDate, timeStr } from '../lib/format.js';
import { ErrorBox, Loading } from '../components/ui.jsx';

const CACHE_KEY = 'ticketrush_tickets_cache';

async function loadTickets() {
  try {
    const list = await bookingApi.myTickets();
    localStorage.setItem(CACHE_KEY, JSON.stringify(list));
    return { list, cached: false };
  } catch (e) {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) return { list: JSON.parse(raw), cached: true };
    throw e;
  }
}

const STATUS = {
  VALID: ['text-emerald-700', 'Hợp lệ'],
  CHECKED_IN: ['text-gray-500', 'Đã sử dụng'],
  CANCELLED: ['text-red-700', 'Đã hủy'],
};

// 7f3a·c21e·9b04
const shortCode = (qr) => (qr.replace(/-/g, '').slice(0, 12).match(/.{1,4}/g) ?? []).join('·');

// Mã vạch trang trí, sinh cố định từ mã QR (mỗi ký tự hex quyết định độ rộng một vạch)
function Barcode({ value }) {
  let x = 0;
  const bars = [];
  for (const ch of value.replace(/-/g, '')) {
    const n = parseInt(ch, 16);
    const w = 1 + (n % 3);
    if (n % 2 === 0) bars.push(<rect key={x} x={x} y="0" width={w} height="36" />);
    x += w + 1;
  }
  return (
    <svg viewBox={'0 0 ' + x + ' 36'} preserveAspectRatio="none" className="w-full h-9" fill="#14151a" aria-hidden="true">
      {bars}
    </svg>
  );
}

// Một dòng hóa đơn: nhãn ..... giá trị
function Line({ label, children, strong }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-gray-600 shrink-0">{label}</span>
      <span className="flex-1 border-b-2 border-dotted border-black/25 translate-y-[-3px]" />
      <span className={'text-right ' + (strong ? 'font-bold text-base' : 'font-medium')}>{children}</span>
    </div>
  );
}

function TicketCard({ t, index, total, onCancel }) {
  const [bright, setBright] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [tone, label] = STATUS[t.status] ?? STATUS.VALID;
  const inactive = t.status !== 'VALID';

  return (
    <div className="min-w-full snap-center pr-3 last:pr-0">
      <div className="receipt">
        <div className="receipt-paper px-6 pt-5 pb-6 font-mono text-[13px] text-ink">
          <div className="text-center">
            <p className="text-xl font-extrabold tracking-[0.2em]">TICKETRUSH</p>
            <p className="text-[11px] tracking-[0.25em] text-gray-500">VÉ ĐIỆN TỬ · E-TICKET</p>
          </div>

          <div className="receipt-rule my-4" />
          <p className="text-lg font-bold leading-snug text-center">{t.eventTitle}</p>
          <p className="text-center text-gray-600 mt-1">{shortDate(t.eventDate)} · {timeStr(t.eventDate)}</p>
          <p className="text-center text-gray-600">{t.venueName}, {t.city}</p>
          <div className="receipt-rule my-4" />

          <div className="space-y-2">
            <Line label="Khu">{t.zone}</Line>
            <Line label="Ghế" strong>{t.seatLabel}</Line>
            <Line label="Cổng">{t.gate ?? '—'}</Line>
            <Line label="Người nhận">{t.holderName}</Line>
            <Line label="Mã đơn">#{String(t.orderId).slice(-6).toUpperCase()}</Line>
          </div>
          {t.price != null && (
            <>
              <div className="receipt-rule my-3" />
              <Line label="THÀNH TIỀN" strong>{money(t.price)}</Line>
            </>
          )}
          <div className="receipt-rule my-4" />

          <div className="relative mx-auto w-fit">
            <div className={'bg-white p-3 border border-black/15 ' + (inactive ? 'opacity-30' : '')}>
              <QRCodeSVG value={t.qrCode} size={190} level="M" />
            </div>
            <span className={'receipt-stamp absolute -right-5 -bottom-3 bg-white/70 text-sm ' + tone}>{label}</span>
          </div>
          <p className="text-center tracking-[0.3em] text-gray-600 mt-4">{shortCode(t.qrCode)}</p>

          <div className="receipt-rule my-4" />
          <Barcode value={t.qrCode} />
          <p className="text-center text-[11px] text-gray-500 mt-3">
            Vé {index + 1} / {total}{total > 1 && ' · vuốt để xem vé kế'}
          </p>
          <p className="text-center text-[11px] tracking-widest text-gray-500 mt-1">*** CẢM ƠN QUÝ KHÁCH ***</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <button className="btn-ghost py-3 text-base" onClick={() => setBright(true)}>Tăng độ sáng</button>
        {confirm ? (
          <button className="btn py-3 text-base bg-red-700 text-white" onClick={() => onCancel(t)}>Xác nhận hủy đơn?</button>
        ) : (
          <button
            className="btn-ghost py-3 text-base text-[#8f2c10] disabled:opacity-40"
            disabled={t.status !== 'VALID'}
            onClick={() => setConfirm(true)}
          >
            Hủy vé
          </button>
        )}
      </div>
      {confirm && <p className="text-xs text-gray-500 mt-2">Hủy vé sẽ hủy toàn bộ đơn hàng chứa vé này và hoàn lại các ghế.</p>}

      {bright && (
        <button className="fixed inset-0 z-50 bg-white grid place-items-center" onClick={() => setBright(false)} aria-label="Đóng">
          <div className="text-center">
            <QRCodeSVG value={t.qrCode} size={Math.min(320, window.innerWidth - 64)} level="M" />
            <p className="font-mono mt-4 text-gray-700">{shortCode(t.qrCode)}</p>
            <p className="text-sm text-gray-500 mt-6">Chạm để đóng</p>
          </div>
        </button>
      )}
    </div>
  );
}

export default function MyTicketsPage() {
  const tickets = useAsync(loadTickets, []);
  const [tab, setTab] = useState('upcoming');
  const [index, setIndex] = useState(0);
  const [error, setError] = useState(null);
  const scroller = useRef(null);

  const list = tickets.data?.list ?? [];
  const upcoming = list.filter((t) => new Date(t.eventDate) >= Date.now() - 6 * 3600e3 && t.status !== 'CANCELLED');
  const past = list.filter((t) => !upcoming.includes(t));
  const shown = tab === 'upcoming' ? upcoming : past;

  async function cancel(t) {
    setError(null);
    try {
      await bookingApi.cancel(t.orderId);
      tickets.reload();
    } catch (e) {
      setError(e);
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="flex items-center gap-3 flex-wrap mb-3">
        <span className="rounded-full bg-white border border-black/10 px-4 py-2 text-sm font-semibold text-gray-700">
          <span className="text-emerald-700">✓</span>{' '}
          {tickets.data?.cached ? 'Đang xem bản đã lưu trên máy' : 'Đã lưu để xem khi mất mạng'}
        </span>
      </div>
      <h1 className="text-4xl font-extrabold tracking-tight mb-4">Vé của tôi</h1>

      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-black/[0.07] p-1.5 mb-4">
        {[['upcoming', 'Sắp diễn ra (' + upcoming.length + ')'], ['past', 'Đã qua']].map(([k, label]) => (
          <button
            key={k}
            onClick={() => { setTab(k); setIndex(0); scroller.current?.scrollTo({ left: 0 }); }}
            className={'rounded-xl py-3 font-bold ' + (tab === k ? 'bg-white shadow-sm' : 'text-gray-500')}
          >
            {label}
          </button>
        ))}
      </div>

      {tickets.loading && <Loading />}
      <ErrorBox error={tickets.error ?? error} />
      {!tickets.loading && shown.length === 0 && !tickets.error && (
        <p className="text-center text-gray-500 py-12">Chưa có vé nào.</p>
      )}

      <div
        ref={scroller}
        onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        className="flex overflow-x-auto snap-x snap-mandatory [scrollbar-width:none]"
      >
        {shown.map((t, i) => (
          <TicketCard key={t.ticketId} t={t} index={i} total={shown.length} onCancel={cancel} />
        ))}
      </div>
      {shown.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-4">
          {shown.map((t, i) => <span key={t.ticketId} className={'w-2 h-2 rounded-full ' + (i === index ? 'bg-ink' : 'bg-black/20')} />)}
        </div>
      )}
    </div>
  );
}
