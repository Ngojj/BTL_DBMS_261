import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { bookingApi } from '../api/bookingApi.js';

const money = (amount) => `${Number(amount).toLocaleString('vi-VN')} ₫`;

export default function CheckoutPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    bookingApi.mine()
      .then((orders) => {
        const currentOrder = orders.find((item) => item.orderId === orderId);
        if (!currentOrder) throw new Error('Không tìm thấy đơn hàng');
        setOrder(currentOrder);
      })
      .catch((err) => setError(err.message));
  }, [orderId]);

  useEffect(() => {
    if (order?.status !== 'PENDING' || !order.expiresAt) return undefined;
    const tick = () => setSecondsLeft(Math.max(0, Math.floor((new Date(order.expiresAt) - Date.now()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [order]);

  async function pay() {
    setBusy(true);
    setError('');
    try {
      const result = await bookingApi.pay(orderId);
      setOrder((current) => ({ ...current, status: result.status }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    setError('');
    try {
      const result = await bookingApi.cancel(orderId);
      setOrder((current) => ({ ...current, status: result.status }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const countdown = `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link to="/" className="text-sm font-medium text-indigo-700 hover:underline">← Danh sách sự kiện</Link>
      <header className="border-b border-gray-200 pb-4">
        <h1 className="text-2xl font-bold text-gray-950">Xác nhận đơn hàng</h1>
        {order?.status === 'PENDING' && <p className="mt-1 text-sm text-gray-600">Thời gian giữ ghế: <strong>{countdown}</strong></p>}
      </header>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {order && <>
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">{order.eventTitle}</h2>
          <p className="text-sm text-gray-700">{order.venueName} · {order.eventDate && new Date(order.eventDate).toLocaleString('vi-VN')}</p>
          <p className="text-sm text-gray-700">{order.ticketCount} vé</p>
          <p className="border-t border-gray-200 pt-3 text-xl font-bold">Tổng cộng: {money(order.total)}</p>
          <p className="text-sm text-gray-600">Thanh toán giả lập, không phát sinh giao dịch thật.</p>
        </section>
        {order.status === 'PENDING' && <div className="flex flex-wrap gap-3">
          <button type="button" onClick={pay} disabled={busy || secondsLeft === 0} className="rounded bg-indigo-700 px-4 py-2 font-semibold text-white disabled:opacity-50">
            {busy ? 'Đang xử lý…' : 'Thanh toán giả lập'}
          </button>
          <button type="button" onClick={cancel} disabled={busy} className="rounded border border-gray-300 px-4 py-2 font-semibold disabled:opacity-50">Hủy đơn</button>
        </div>}
        {order.status === 'PAID' && <div className="flex flex-wrap items-center gap-3">
          <p role="status" className="font-semibold text-green-800">✓ Đã thanh toán thành công</p>
          <Link to="/my-tickets" className="rounded-lg bg-indigo-700 px-4 py-2 font-semibold text-white hover:bg-indigo-800 shadow">
            Xem vé &amp; mã QR của tôi →
          </Link>
          <button type="button" onClick={cancel} disabled={busy} className="rounded-lg border border-red-300 px-4 py-2 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
            {busy ? 'Đang hủy…' : 'Hủy đơn / hoàn tiền'}
          </button>
        </div>}
        {['CANCELLED', 'EXPIRED'].includes(order.status) && <p role="status" className="font-semibold text-gray-700">{order.status === 'CANCELLED' ? 'Đơn đã hủy.' : 'Đơn đã hết hạn giữ ghế.'}</p>}
      </>}
    </div>
  );
}
