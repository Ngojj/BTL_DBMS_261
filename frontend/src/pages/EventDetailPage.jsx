import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { bookingApi } from '../api/bookingApi.js';
import { eventsApi } from '../api/eventsApi.js';
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

  useEffect(() => {
    eventsApi.get(eventId).then((row) => {
      setEvent(row);
      setZones(row.zones ?? []);
      if (row.zones?.[0]) setZoneId(String(row.zones[0].zone_id));
    }).catch((err) => setError(err.message));
  }, [eventId]);

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

  const selectedTotal = seats.filter((seat) => selected.includes(String(seat.seat_id)))
    .reduce((sum, seat) => sum + Number(seat.price), 0);

  return (
    <div className="space-y-6">
      <Link to="/" className="text-sm font-medium text-indigo-700 hover:underline">← Sự kiện</Link>
      {event && <header className="border-b border-gray-200 pb-5">
        <p className="text-sm text-gray-600">{event.genre_name} · {event.city}</p>
        <h1 className="mt-1 text-3xl font-bold text-gray-950">{event.title}</h1>
        <p className="mt-2 text-gray-700">{event.venue_name} · {new Date(event.event_date).toLocaleString('vi-VN')}</p>
      </header>}
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Chọn ghế</h2>
          <label className="flex items-center gap-2 text-sm">Khu vực
            <select value={zoneId} onChange={(change) => setZoneId(change.target.value)} className="rounded border border-gray-300 bg-white px-3 py-2">
              {zones.map((zone) => <option key={zone.zone_id} value={zone.zone_id}>{zone.name} · {Number(zone.price).toLocaleString('vi-VN')} ₫</option>)}
            </select>
          </label>
        </div>
        {seats.length === 0 ? <p className="text-gray-600">Khu vực chưa có ghế.</p> : <div className="overflow-x-auto border-y border-gray-200 py-5">
          <div className="grid min-w-max grid-cols-8 gap-2 sm:grid-cols-10 md:grid-cols-12">
            {seats.map((seat) => {
              const id = String(seat.seat_id);
              const isSelected = selected.includes(id);
              const available = seat.status === 'AVAILABLE';
              return <button key={id} type="button" disabled={!available} aria-pressed={isSelected}
                onClick={() => toggleSeat(id)} title={`Hàng ${seat.row_label}, ghế ${seat.seat_no}`}
                className={`h-10 w-10 rounded border text-xs font-medium ${isSelected ? 'border-indigo-800 bg-indigo-700 text-white' : available ? 'border-gray-300 bg-white text-gray-800 hover:border-indigo-600' : 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400'}`}>
                {seat.row_label}{seat.seat_no}
              </button>;
            })}
          </div>
        </div>}
      </section>
      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-gray-200 pt-4">
        <div><p className="text-sm text-gray-600">{selected.length} ghế đã chọn</p><p className="text-xl font-bold">{selectedTotal.toLocaleString('vi-VN')} ₫</p></div>
        <button type="button" onClick={reserveSeats} disabled={!selected.length || loading} className="rounded bg-indigo-700 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
          {loading ? 'Đang giữ ghế…' : 'Tiếp tục thanh toán'}
        </button>
      </footer>
    </div>
  );
}
