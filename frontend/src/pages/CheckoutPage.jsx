// [#4] Thanh toán giả lập (loại a: insert payments, c: update orders/seats/tickets) · [#5] hủy đơn (loại c)
// Phụ trách: TV4
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader.jsx';
import { ErrorBox, Loading } from '../components/ui.jsx';
import { bookingApi } from '../api/bookingApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useAsync, useCountdown } from '../lib/useAsync.js';
import { dateStr, mmss, money, timeStr } from '../lib/format.js';

const METHODS = [
  ['CARD', 'Thẻ ngân hàng', 'Visa, Mastercard, thẻ nội địa'],
  ['E_WALLET', 'Ví điện tử', 'Quét mã QR bằng ứng dụng ví'],
  ['BANK_TRANSFER', 'Chuyển khoản', 'Xác nhận tự động trong vài phút'],
];

function Steps({ current }) {
  const steps = ['1. Chọn ghế', '2. Thanh toán', '3. Nhận vé'];
  return (
    <p className="text-sm font-bold mb-4">
      {steps.map((s, i) => (
        <span key={s}>
          <span className={i + 1 === current ? 'text-brand' : i + 1 < current ? 'text-ink' : 'text-gray-500'}>{s}</span>
          {i < 2 && <span className="mx-3 text-gray-400">—</span>}
        </span>
      ))}
    </p>
  );
}

export default function CheckoutPage() {
  const { orderId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const order = useAsync(() => bookingApi.getOrder(orderId), [orderId]);
  const left = useCountdown(order.data?.expiresAt);
  const [buyer, setBuyer] = useState({ fullName: user?.fullName ?? '', phone: user?.phone ?? '', email: user?.email ?? '' });
  const [method, setMethod] = useState('CARD');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const set = (k) => (e) => setBuyer({ ...buyer, [k]: e.target.value });

  const o = order.data;
  const expired = o && o.status === 'PENDING' && left === 0;
  const timer = (
    <div className="flex items-center gap-3 rounded-full bg-white/10 px-4 py-2 text-sm">
      <span className="text-gold">◷</span>
      <span className="text-white/70">Ghế được giữ còn</span>
      <b className="font-mono text-gold text-base">{left == null ? '--:--' : mmss(left)}</b>
    </div>
  );

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const res = await bookingApi.pay(orderId, { method, buyer });
      // Đơn hết hạn giữ ghế: backend trả 200 kèm paid:false (đã trả ghế về trống) – không được báo thành công
      if (res?.paid === false || (res?.status && res.status !== 'PAID')) {
        setError('Đơn hàng đã hết hạn giữ ghế, ghế đã được trả về trạng thái trống. Vui lòng chọn lại.');
        order.reload();
      } else setDone(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function back() {
    try {
      await bookingApi.cancel(orderId); // trả ghế về trống
    } catch {
      /* đơn có thể đã hết hạn */
    }
    navigate(o ? '/events/' + o.eventId : '/');
  }

  return (
    <div className="min-h-screen">
      <AppHeader nav={false} right={done ? null : timer} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <Steps current={done ? 3 : 2} />
        {order.loading && <Loading />}
        <ErrorBox error={order.error} />

        {done && (
          <div className="card p-10 text-center max-w-xl mx-auto">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 grid place-items-center text-3xl mx-auto mb-4">✓</div>
            <h1 className="text-2xl font-extrabold">Thanh toán thành công</h1>
            <p className="text-gray-600 mt-2">Vé và mã QR đã sẵn sàng. Bạn có thể xem cả khi mất mạng.</p>
            <Link to="/my-tickets" className="btn-brand mt-6 px-6 py-3">Xem vé của tôi</Link>
          </div>
        )}

        {o && !done && (
          <div className="grid gap-6 lg:grid-cols-[1fr_440px] items-start">
            <div className="space-y-5">
              <section className="card p-6">
                <h2 className="font-bold text-lg mb-4">Thông tin người nhận vé</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><label className="label">Họ và tên</label><input className="input font-semibold" value={buyer.fullName} onChange={set('fullName')} /></div>
                  <div><label className="label">Số điện thoại</label><input className="input font-semibold" value={buyer.phone} onChange={set('phone')} /></div>
                  <div className="sm:col-span-2"><label className="label">Email nhận vé</label><input type="email" className="input font-semibold" value={buyer.email} onChange={set('email')} /></div>
                </div>
              </section>

              <section className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-lg">Phương thức thanh toán</h2>
                  <span className="rounded-full bg-gray-100 text-gray-600 text-xs font-bold px-3 py-1">Thanh toán giả lập</span>
                </div>
                <div className="space-y-3">
                  {METHODS.map(([key, name, desc]) => (
                    <label
                      key={key}
                      className={'flex items-center gap-4 rounded-xl border-2 px-4 py-4 cursor-pointer ' + (method === key ? 'border-royal bg-indigo-50' : 'border-black/10 hover:bg-black/[0.02]')}
                    >
                      <input type="radio" name="method" className="accent-royal w-5 h-5" checked={method === key} onChange={() => setMethod(key)} />
                      <span>
                        <span className="block font-bold">{name}</span>
                        <span className="block text-sm text-gray-500">{desc}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </section>
            </div>

            <aside className="card p-6 flex flex-col lg:min-h-[520px]">
              <h2 className="font-bold text-lg mb-2">Đơn hàng</h2>
              <p className="font-bold">{o.eventTitle}</p>
              <p className="text-sm text-gray-500 pb-3 border-b border-black/10">
                {timeStr(o.eventDate)} · {dateStr(o.eventDate)} · {o.venueName}
              </p>
              <ul className="py-3 space-y-2">
                {o.items.map((i) => (
                  <li key={i.seatId} className="flex justify-between">
                    <span>Ghế {i.seatLabel} · {i.zone}</span>
                    <b>{money(i.price)}</b>
                  </li>
                ))}
                <li className="flex justify-between text-gray-500"><span>Phí dịch vụ</span><span>{money(0)}</span></li>
              </ul>

              <div className="mt-auto pt-4 border-t border-black/10">
                <div className="flex justify-between items-baseline mb-4">
                  <span className="font-bold">Tổng cộng</span>
                  <span className="text-3xl font-extrabold">{money(o.total)}</span>
                </div>
                {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
                <button className="btn-brand w-full py-3 text-base" onClick={pay} disabled={busy || expired}>
                  {busy ? 'Đang xử lý…' : 'Thanh toán ' + money(o.total)}
                </button>
                <button onClick={back} className="block mx-auto mt-3 text-sm font-bold text-brand">Quay lại chọn ghế</button>
                <p className="text-xs text-gray-500 mt-4">
                  Nếu thanh toán không thành công, đơn hàng được hủy toàn bộ và ghế trả về trạng thái trống.
                </p>
              </div>
            </aside>
          </div>
        )}

        {expired && !done && (
          <div className="fixed inset-0 bg-black/60 grid place-items-center p-4">
            <div className="card p-8 text-center max-w-sm">
              <h2 className="text-xl font-extrabold">Hết thời gian giữ ghế</h2>
              <p className="text-gray-600 mt-2">Ghế đã được trả về trạng thái trống. Vui lòng chọn lại.</p>
              <button className="btn-brand mt-5" onClick={() => navigate('/events/' + o.eventId)}>Chọn lại ghế</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
