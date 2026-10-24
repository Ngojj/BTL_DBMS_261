import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { ticketsApi } from '../api/ticketsApi.js';
import { bookingApi } from '../api/bookingApi.js';

const STATUS_LABEL = { VALID: 'Hợp lệ', CHECKED_IN: 'Đã soát', CANCELLED: 'Đã hủy' };
const STATUS_COLOR = {
  VALID:      'bg-emerald-100 text-emerald-800',
  CHECKED_IN: 'bg-blue-100 text-blue-800',
  CANCELLED:  'bg-gray-100 text-gray-500',
};
const money = (n) => Number(n).toLocaleString('vi-VN') + ' ₫';

// ── QR Canvas ────────────────────────────────────────────────────────────────
function QrCanvas({ value, size = 100 }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (canvasRef.current && value) {
      QRCode.toCanvas(canvasRef.current, value, { width: size, margin: 1 }, (err) => {
        if (err) console.error('QR error', err);
      });
    }
  }, [value, size]);
  return <canvas ref={canvasRef} width={size} height={size} className="rounded" title={value} />;
}

// ── Ticket Card ───────────────────────────────────────────────────────────────
function TicketCard({ ticket, onCancel }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState('');

  async function handleCancel() {
    if (!window.confirm('Hủy vé này? Ghế sẽ được giải phóng.')) return;
    setBusy(true);
    setErr('');
    try {
      await onCancel(ticket.orderId);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const canCancel = ticket.ticketStatus === 'VALID' && ticket.orderStatus !== 'CANCELLED';

  return (
    <li className="flex flex-wrap items-start gap-4 px-5 py-4">
      {/* QR Code */}
      <div className="flex flex-col items-center gap-1 rounded-lg border border-gray-200 bg-white p-2 shadow-sm">
        <QrCanvas value={ticket.qrCode} size={88} />
        <p className="max-w-[88px] truncate text-[9px] text-gray-400 font-mono">{ticket.qrCode.slice(0, 12)}…</p>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <p className="font-semibold text-gray-900">{ticket.seatLabel}</p>
        <p className="text-sm text-gray-600">
          Khu <strong>{ticket.zoneName}</strong> · Hàng {ticket.rowLabel} Ghế {ticket.seatNo}
        </p>
        <p className="text-sm font-bold text-indigo-700">{money(ticket.price)}</p>
        {err && <p className="text-xs text-red-600">{err}</p>}
      </div>

      {/* Status + Cancel */}
      <div className="flex flex-col items-end gap-2">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLOR[ticket.ticketStatus] ?? 'bg-gray-100 text-gray-600'}`}>
          {STATUS_LABEL[ticket.ticketStatus] ?? ticket.ticketStatus}
        </span>
        {canCancel && (
          <button
            type="button"
            onClick={handleCancel}
            disabled={busy}
            className="rounded border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            {busy ? 'Đang hủy…' : 'Hủy vé'}
          </button>
        )}
      </div>
    </li>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MyTicketsPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  function load() {
    setLoading(true);
    ticketsApi.mine()
      .then((data) => setTickets(data.tickets ?? []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleCancel(orderId) {
    await bookingApi.cancel(orderId);
    load(); // refresh list
  }

  if (loading) return <p className="text-gray-500 animate-pulse">Đang tải vé…</p>;
  if (error)   return <p role="alert" className="text-red-700">{error}</p>;

  // Nhóm vé theo sự kiện (chỉ hiện vé chưa hủy trước, hủy sau)
  const byEvent = tickets.reduce((acc, t) => {
    const key = t.eventId;
    if (!acc[key]) acc[key] = { eventTitle: t.eventTitle, eventDate: t.eventDate, venueName: t.venueName, city: t.city, tickets: [] };
    acc[key].tickets.push(t);
    return acc;
  }, {});

  const validCount = tickets.filter((t) => t.ticketStatus === 'VALID').length;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-950">Vé của tôi</h1>
          <p className="mt-1 text-sm text-gray-500">{validCount} vé hợp lệ · {tickets.length} vé tổng</p>
        </div>
        <Link to="/" className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800">
          + Mua thêm vé
        </Link>
      </header>

      {tickets.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 py-16 text-center">
          <p className="text-gray-500 text-lg">🎫 Bạn chưa có vé nào.</p>
          <Link to="/" className="mt-4 inline-block rounded-lg bg-indigo-700 px-5 py-2 text-sm font-semibold text-white">
            Xem sự kiện
          </Link>
        </div>
      )}

      {Object.values(byEvent).map((group) => (
        <section
          key={group.tickets[0].eventId}
          className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
        >
          <header className="border-b border-gray-100 bg-gray-50 px-5 py-4">
            <h2 className="font-bold text-gray-900">{group.eventTitle}</h2>
            <p className="text-sm text-gray-500">
              📅 {new Date(group.eventDate).toLocaleString('vi-VN')}
              &nbsp;·&nbsp;📍 {group.venueName}, {group.city}
            </p>
          </header>

          <ul className="divide-y divide-gray-100">
            {group.tickets.map((ticket) => (
              <TicketCard key={ticket.ticketId} ticket={ticket} onCancel={handleCancel} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
