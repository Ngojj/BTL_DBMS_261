// Đánh giá sự kiện: điểm trung bình (loại h: AVG/COUNT), danh sách, gửi đánh giá (loại a: insert).
// Mỗi người một đánh giá cho một sự kiện (ràng buộc UNIQUE trong bảng reviews). Phụ trách: TV1 (giả định)
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { eventsApi } from '../api/eventsApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useAsync } from '../lib/useAsync.js';
import { dateStr } from '../lib/format.js';
import { ErrorBox } from './ui.jsx';

function Stars({ value, onPick, size = 'text-xl' }) {
  return (
    <span className={'inline-flex ' + size} role={onPick ? 'radiogroup' : 'img'} aria-label={'Điểm ' + value + ' trên 5'}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = n <= Math.round(value);
        const star = <span className={on ? 'text-gold' : 'text-black/15'}>★</span>;
        return onPick ? (
          <button key={n} type="button" role="radio" aria-checked={n === value} aria-label={n + ' sao'} onClick={() => onPick(n)} className="px-0.5 hover:scale-110 transition-transform">
            {star}
          </button>
        ) : (
          <span key={n}>{star}</span>
        );
      })}
    </span>
  );
}

export default function Reviews({ eventId }) {
  const { user } = useAuth();
  const location = useLocation();
  const list = useAsync(() => eventsApi.reviews(eventId), [eventId]);
  const summary = useAsync(() => eventsApi.reviewSummary(eventId), [eventId]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await eventsApi.addReview(eventId, { rating, comment: comment.trim() }, user);
      setSent(true);
      setComment('');
      list.reload();
      summary.reload();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const s = summary.data;
  return (
    <section className="card p-5 sm:p-7 mt-6">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <h2 className="text-2xl font-extrabold tracking-tight">Đánh giá</h2>
        {s && (
          <div className="flex items-center gap-3">
            <span className="text-4xl font-extrabold">{s.count ? s.average.toFixed(1) : '—'}</span>
            <div>
              <Stars value={s.average} />
              <p className="text-xs text-gray-500">{s.count} lượt đánh giá</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px] items-start">
        <ul className="space-y-4">
          {list.data?.length === 0 && <li className="text-gray-500">Chưa có đánh giá nào.</li>}
          {list.data?.map((r) => (
            <li key={r.reviewId} className="border-b border-black/10 pb-4 last:border-0">
              <div className="flex items-center justify-between gap-3">
                <span className="font-bold">{r.userName}</span>
                <span className="text-xs text-gray-500">{dateStr(r.createdAt)}</span>
              </div>
              <Stars value={r.rating} size="text-base" />
              {r.comment && <p className="text-gray-700 mt-1">{r.comment}</p>}
            </li>
          ))}
          <ErrorBox error={list.error} />
        </ul>

        <div className="rounded-xl bg-paper p-4">
          {!user ? (
            <p className="text-sm text-gray-600">
              <Link to="/login" state={{ from: location.pathname }} className="font-bold text-brand">Đăng nhập</Link> để viết đánh giá.
            </p>
          ) : sent ? (
            <p className="text-sm text-emerald-700 font-semibold">Cảm ơn bạn đã đánh giá!</p>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <p className="font-bold">Đánh giá của bạn</p>
              <Stars value={rating} onPick={setRating} size="text-3xl" />
              <textarea
                className="input min-h-[90px]"
                maxLength={500}
                placeholder="Chia sẻ cảm nhận của bạn (không bắt buộc)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <ErrorBox error={error} />
              <button className="btn-dark w-full" disabled={busy}>{busy ? 'Đang gửi…' : 'Gửi đánh giá'}</button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
