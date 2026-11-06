import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { bookingApi } from '../api/bookingApi.js';
import { eventsApi } from '../api/eventsApi.js';
import { reviewsApi } from '../api/reviewsCheckinApi.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function EventDetailPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [event, setEvent] = useState(null);
  const [zones, setZones] = useState([]);
  const [zoneId, setZoneId] = useState('');
  const [seats, setSeats] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reviews
  const [reviewsData, setReviewsData] = useState({ reviews: [], stats: { count: 0, avg: 0 } });
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [reviewSuccess, setReviewSuccess] = useState('');

  useEffect(() => {
    eventsApi.get(eventId).then((row) => {
      setEvent(row);
      setZones(row.zones ?? []);
      if (row.zones?.[0]) setZoneId(String(row.zones[0].zone_id));
    }).catch((err) => setError(err.message));

    loadReviews();
  }, [eventId]);

  function loadReviews() {
    reviewsApi.list(eventId)
      .then((res) => {
        setReviewsData({
          reviews: res.reviews || [],
          stats: {
            count: res.stats?.count ? Number(res.stats.count) : (res.reviews?.length || 0),
            avg: res.stats?.avg ? Number(res.stats.avg).toFixed(1) : 0,
          },
        });
      })
      .catch(() => {});
  }

  useEffect(() => {
    if (!zoneId) return;
    setSelected([]);
    eventsApi.seats(zoneId).then(setSeats).catch((err) => setError(err.message));
  }, [zoneId]);

  function toggleSeat(seatId) {
    setSelected((current) => current.includes(seatId) ? current.filter((id) => id !== seatId) : [...current, seatId]);
  }

  async function reserveSeats() {
    if (!user) {
      navigate('/login', { state: { from: `/events/${eventId}` } });
      return;
    }
    setLoading(true);
    setError('');
    try {
      const order = await bookingApi.createOrder({ eventId, seatIds: selected });
      navigate(`/checkout/${order.orderId}`);
    } catch (err) {
      setError(err.message);
      const updatedSeats = await eventsApi.seats(zoneId).catch(() => []);
      setSeats(updatedSeats);
    } finally {
      setLoading(false);
    }
  }

  async function submitReview(e) {
    e.preventDefault();
    if (!user) {
      navigate('/login', { state: { from: `/events/${eventId}` } });
      return;
    }
    setReviewError('');
    setReviewSuccess('');
    try {
      await reviewsApi.create(eventId, { rating: Number(rating), comment });
      setReviewSuccess('Đánh giá của bạn đã được ghi nhận!');
      setComment('');
      loadReviews();
    } catch (err) {
      setReviewError(err.message || 'Không thể gửi đánh giá');
    }
  }

  const selectedTotal = seats.filter((seat) => selected.includes(String(seat.seat_id)))
    .reduce((sum, seat) => sum + Number(seat.price), 0);

  const isSaleOpen = event ? new Date(event.sale_open_at) <= new Date() : true;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <Link to="/" className="text-sm font-medium text-indigo-700 hover:underline">← Danh sách sự kiện</Link>
        <Link
          to={`/events/${eventId}/waiting-room`}
          className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-900 px-3 py-1 text-xs font-bold hover:bg-amber-200 transition"
        >
          <span>⏳ Phòng chờ ảo (Waiting Room)</span>
        </Link>
      </div>

      {event && (
        <header className="border-b border-gray-200 pb-5 space-y-2">
          <p className="text-sm text-gray-600">{event.genre_name} · {event.city}</p>
          <h1 className="text-3xl font-bold text-gray-950">{event.title}</h1>
          <p className="text-gray-700">📍 {event.venue_name} · 📅 {new Date(event.event_date).toLocaleString('vi-VN')}</p>
          {!isSaleOpen && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 flex items-center justify-between">
              <div>
                <strong>Chưa đến giờ mở bán chính thức!</strong> Sự kiện mở bán lúc: {new Date(event.sale_open_at).toLocaleString('vi-VN')}
              </div>
              <Link
                to={`/events/${eventId}/waiting-room`}
                className="rounded-lg bg-amber-600 text-white px-3 py-1.5 font-bold hover:bg-amber-700"
              >
                Vào hàng đợi ngay
              </Link>
            </div>
          )}
        </header>
      )}

      {error && <p role="alert" className="text-red-700 bg-red-50 p-3 rounded-lg border border-red-200 text-sm">{error}</p>}

      {/* Sơ đồ chọn ghế */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Chọn ghế</h2>
          <label className="flex items-center gap-2 text-sm font-medium">
            Khu vực
            <select
              value={zoneId}
              onChange={(e) => setZoneId(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              {zones.map((zone) => (
                <option key={zone.zone_id} value={zone.zone_id}>
                  {zone.name} · {Number(zone.price).toLocaleString('vi-VN')} ₫
                </option>
              ))}
            </select>
          </label>
        </div>

        {seats.length === 0 ? (
          <p className="text-gray-600">Khu vực chưa có ghế.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-center gap-6 text-xs text-gray-600">
              <span className="flex items-center gap-1.5"><span className="h-4 w-4 rounded border border-gray-300 bg-white"></span> Trống</span>
              <span className="flex items-center gap-1.5"><span className="h-4 w-4 rounded bg-indigo-700"></span> Đang chọn</span>
              <span className="flex items-center gap-1.5"><span className="h-4 w-4 rounded bg-gray-200"></span> Đã bán / Giữ</span>
            </div>
            <div className="grid min-w-max grid-cols-8 gap-2 sm:grid-cols-10 md:grid-cols-12 justify-center">
              {seats.map((seat) => {
                const id = String(seat.seat_id);
                const isSelected = selected.includes(id);
                const available = seat.status === 'AVAILABLE';
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={!available}
                    aria-pressed={isSelected}
                    onClick={() => toggleSeat(id)}
                    title={`Hàng ${seat.row_label}, ghế ${seat.seat_no}`}
                    className={`h-10 w-10 rounded border text-xs font-medium transition ${
                      isSelected
                        ? 'border-indigo-800 bg-indigo-700 text-white font-bold shadow'
                        : available
                        ? 'border-gray-300 bg-white text-gray-800 hover:border-indigo-600 hover:bg-indigo-50'
                        : 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400'
                    }`}
                  >
                    {seat.row_label}{seat.seat_no}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Footer đặt vé */}
      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-gray-200 pt-4 bg-white p-4 rounded-xl shadow-sm">
        <div>
          <p className="text-sm text-gray-600">{selected.length} ghế đã chọn</p>
          <p className="text-2xl font-bold text-indigo-700">{selectedTotal.toLocaleString('vi-VN')} ₫</p>
        </div>
        <button
          type="button"
          onClick={reserveSeats}
          disabled={!selected.length || loading}
          className="rounded-lg bg-indigo-700 px-6 py-3 font-semibold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50 shadow"
        >
          {loading ? 'Đang giữ ghế…' : 'Tiếp tục thanh toán →'}
        </button>
      </footer>

      {/* Đánh giá sau sự kiện (#h aggregate) */}
      <section className="space-y-4 border-t border-gray-200 pt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-950">Đánh giá sự kiện</h2>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-amber-500 text-lg">★</span>
            <span className="font-bold text-gray-900">{reviewsData.stats.avg} / 5</span>
            <span className="text-gray-500">({reviewsData.stats.count} lượt đánh giá)</span>
          </div>
        </div>

        {/* Form gửi review */}
        <form onSubmit={submitReview} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-gray-800">Gửi đánh giá của bạn (Dành cho khán giả đã mua vé)</h3>
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-gray-600">Số sao:</label>
            <select
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
              className="rounded border border-gray-300 px-2 py-1 text-sm bg-white"
            >
              <option value="5">⭐⭐⭐⭐⭐ (5 sao)</option>
              <option value="4">⭐⭐⭐⭐ (4 sao)</option>
              <option value="3">⭐⭐⭐ (3 sao)</option>
              <option value="2">⭐⭐ (2 sao)</option>
              <option value="1">⭐ (1 sao)</option>
            </select>
          </div>
          <textarea
            placeholder="Cảm nhận của bạn về buổi diễn, âm thanh, địa điểm..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:outline-none focus:border-indigo-600"
          />
          {reviewError && <p className="text-xs text-red-600">{reviewError}</p>}
          {reviewSuccess && <p className="text-xs text-emerald-600">{reviewSuccess}</p>}
          <button
            type="submit"
            className="rounded-lg bg-indigo-700 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-800"
          >
            Gửi nhận xét
          </button>
        </form>

        {/* Danh sách review */}
        <div className="space-y-2">
          {reviewsData.reviews.length === 0 ? (
            <p className="text-xs text-gray-500 italic">Chưa có đánh giá nào cho sự kiện này.</p>
          ) : (
            reviewsData.reviews.map((rev) => (
              <div key={rev.review_id} className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-900">{rev.full_name || 'Khán giả'}</span>
                  <span className="text-amber-500 font-bold">{'★'.repeat(rev.rating)}</span>
                </div>
                {rev.comment && <p className="text-gray-700">{rev.comment}</p>}
                <p className="text-[10px] text-gray-400">{new Date(rev.created_at).toLocaleDateString('vi-VN')}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
