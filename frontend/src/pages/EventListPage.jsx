import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { eventsApi } from '../api/eventsApi.js';

const formatDate = (value) => new Date(value).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' });

export default function EventListPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    eventsApi.list()
      .then((data) => setEvents(Array.isArray(data) ? data : (data?.events || [])))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const eventList = Array.isArray(events) ? events : [];

  return (
    <div className="space-y-5">
      <header className="border-b border-gray-200 pb-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-indigo-700">TicketRush</p>
        <h1 className="mt-1 text-3xl font-bold text-gray-950">Sự kiện đang mở bán</h1>
      </header>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {loading && <p className="text-gray-600 animate-pulse">Đang tải sự kiện…</p>}
      {!loading && !error && eventList.length === 0 && <p className="text-gray-600">Chưa có sự kiện mở bán.</p>}
      <div className="divide-y divide-gray-200">
        {eventList.map((event) => (
          <article key={event.event_id} className="grid gap-3 py-5 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <p className="text-sm text-gray-600">{event.genre_name} · {event.city}</p>
              <h2 className="mt-1 text-xl font-semibold text-gray-950">{event.title}</h2>
              <p className="mt-1 text-sm text-gray-700">{event.venue_name} · {formatDate(event.event_date)}</p>
              <p className="mt-1 text-sm text-gray-600">Giá từ {Number(event.min_price).toLocaleString('vi-VN')} ₫</p>
            </div>
            <Link
              to={`/events/${event.event_id}`}
              className="inline-flex justify-center rounded bg-indigo-700 px-4 py-2 font-medium text-white hover:bg-indigo-800"
            >
              Chọn ghế
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
