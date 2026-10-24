import { useState } from 'react';
import { checkinApi } from '../api/reviewsCheckinApi.js';
import { useAuth } from '../context/AuthContext.jsx';

const STATUS_COLOR = { VALID: 'bg-green-50 border-green-400', CHECKED_IN: 'bg-blue-50 border-blue-400', CANCELLED: 'bg-red-50 border-red-400' };
const STATUS_LABEL = { VALID: '✓ Hợp lệ', CHECKED_IN: '✓ Đã soát', CANCELLED: '✗ Đã hủy' };

export default function CheckinPage() {
  const { user } = useAuth();
  const [qrInput, setQrInput] = useState('');
  const [ticket,  setTicket]  = useState(null);
  const [result,  setResult]  = useState(null); // { success, message }
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  if (!user || !['STAFF', 'ADMIN'].includes(user.role)) {
    return <p className="p-8 text-red-700">Chỉ STAFF hoặc ADMIN mới được truy cập trang này.</p>;
  }

  async function lookup(e) {
    e.preventDefault();
    if (!qrInput.trim()) return;
    setError(''); setTicket(null); setResult(null); setLoading(true);
    try {
      const data = await checkinApi.lookup(qrInput.trim());
      setTicket(data.ticket);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function doCheckin() {
    if (!ticket) return;
    setLoading(true); setResult(null);
    try {
      const data = await checkinApi.checkin(ticket.qrCode);
      const t = data.ticket;
      setTicket(t);
      setResult({
        success: true,
        message: t.alreadyCheckedIn ? 'Vé đã được soát trước đó.' : 'Soát vé thành công!',
      });
    } catch (err) {
      setResult({ success: false, message: err.message });
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setQrInput(''); setTicket(null); setResult(null); setError('');
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold text-gray-950">Soát vé</h1>

      {/* ── Input QR ── */}
      <form onSubmit={lookup} className="flex gap-2">
        <input
          id="qrInput"
          value={qrInput}
          onChange={(e) => setQrInput(e.target.value)}
          placeholder="Nhập hoặc quét mã QR (UUID vé)…"
          className="flex-1 rounded border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          autoFocus
        />
        <button type="submit" disabled={loading || !qrInput.trim()}
          className="rounded bg-indigo-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {loading ? '…' : 'Tra cứu'}
        </button>
      </form>

      {error && <p role="alert" className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {/* ── Thông tin vé ── */}
      {ticket && (
        <div className={`rounded-xl border-2 px-5 py-5 space-y-3 ${STATUS_COLOR[ticket.status] ?? 'bg-gray-50 border-gray-300'}`}>
          <div className="flex items-center justify-between">
            <p className="font-bold text-lg text-gray-900">{ticket.holderName}</p>
            <span className={`rounded-full px-3 py-1 text-sm font-semibold ${ticket.status === 'VALID' ? 'bg-green-600 text-white' : ticket.status === 'CHECKED_IN' ? 'bg-blue-600 text-white' : 'bg-gray-400 text-white'}`}>
              {STATUS_LABEL[ticket.status] ?? ticket.status}
            </span>
          </div>
          <div className="space-y-1 text-sm text-gray-700">
            <p><strong>Sự kiện:</strong> {ticket.eventTitle}</p>
            <p><strong>Ngày:</strong> {new Date(ticket.eventDate).toLocaleString('vi-VN')}</p>
            <p><strong>Ghế:</strong> {ticket.seatLabel} (Hàng {ticket.rowLabel}, Số {ticket.seatNo})</p>
            <p><strong>Khu:</strong> {ticket.zoneName}</p>
            {ticket.checkedInAt && <p className="text-blue-700"><strong>Soát lúc:</strong> {new Date(ticket.checkedInAt).toLocaleString('vi-VN')}</p>}
          </div>

          {result && (
            <p className={`rounded px-3 py-2 text-sm font-semibold ${result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {result.message}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            {ticket.status === 'VALID' && !result?.success && (
              <button onClick={doCheckin} disabled={loading}
                className="rounded bg-green-700 px-5 py-2 font-semibold text-white disabled:opacity-50">
                {loading ? 'Đang soát…' : 'Xác nhận soát vé'}
              </button>
            )}
            <button onClick={reset}
              className="rounded border border-gray-300 px-5 py-2 font-semibold text-gray-700">
              Quét vé mới
            </button>
          </div>
        </div>
      )}

      {/* ── Hướng dẫn ── */}
      {!ticket && !error && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 py-12 text-center">
          <p className="text-gray-500 text-sm">Nhập UUID vé vào ô trên hoặc dùng máy quét QR.</p>
          <p className="mt-1 text-xs text-gray-400">Soát vé offline: trang này dùng Firestore khi mất mạng (cấu hình TV5).</p>
        </div>
      )}
    </div>
  );
}
