import { useEffect, useState } from 'react';
import { adminApi } from '../../api/adminApi.js';
import { queueApi } from '../../api/queueApi.js';

const STATUS_COLOR = {
  DRAFT: 'bg-gray-100 text-gray-600',
  ON_SALE: 'bg-green-100 text-green-700',
  SOLD_OUT: 'bg-orange-100 text-orange-700',
  CANCELLED: 'bg-red-100 text-red-700',
  ENDED: 'bg-gray-200 text-gray-500',
};

const INITIAL_FORM = {
  title: '', genreId: '', venueId: '', eventDate: '', saleOpenAt: '',
  maxTicketsPerUser: 4, status: 'DRAFT',
};

export default function AdminEventsPage() {
  const [events,  setEvents]  = useState([]);
  const [genres,  setGenres]  = useState([]);
  const [venues,  setVenues]  = useState([]);
  const [form,    setForm]    = useState(INITIAL_FORM);
  const [editing, setEditing] = useState(null); // eventId being edited
  const [zoneForm, setZoneForm] = useState({ eventId: null, name: '', price: '', capacity: '', rowCount: 1, seatsPerRow: 10 });
  const [error,   setError]   = useState('');
  const [busy,    setBusy]    = useState(false);
  const [queueMsg, setQueueMsg] = useState({});

  useEffect(() => {
    adminApi.listEvents().then((d) => setEvents(d.events ?? [])).catch((e) => setError(e.message));
    adminApi.genres().then((d) => setGenres(d.genres ?? []));
    adminApi.venues().then((d) => setVenues(d.venues ?? []));
  }, []);

  function setField(e) { setForm((f) => ({ ...f, [e.target.name]: e.target.value })); }
  function setZoneField(e) { setZoneForm((f) => ({ ...f, [e.target.name]: e.target.value })); }

  async function saveEvent(e) {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      if (editing) {
        const updated = await adminApi.updateEvent(editing, form);
        setEvents((ev) => ev.map((x) => x.eventId === editing ? { ...x, ...updated.event, eventId: String(updated.event.event_id ?? updated.event.eventId) } : x));
        setEditing(null);
      } else {
        const created = await adminApi.createEvent(form);
        const newEvent = created.event;
        setEvents((ev) => [{ ...newEvent, eventId: String(newEvent.event_id ?? newEvent.eventId), genreName: genres.find((g)=>String(g.genre_id)===String(form.genreId))?.name, venueName: venues.find((v)=>String(v.venue_id)===String(form.venueId))?.name, zoneCount: 0, totalCapacity: 0 }, ...ev]);
      }
      setForm(INITIAL_FORM);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function deleteEvent(eventId) {
    if (!window.confirm('Xóa sự kiện này? Dữ liệu vé sẽ bị mất.')) return;
    try {
      await adminApi.deleteEvent(eventId);
      setEvents((ev) => ev.filter((x) => x.eventId !== eventId));
    } catch (err) { setError(err.message); }
  }

  async function admitQueue(eventId, count = 10) {
    try {
      const res = await queueApi.admit(eventId, count);
      setQueueMsg((m) => ({ ...m, [eventId]: `✅ Đã mở cho ${res.admittedCount} người vào` }));
      setTimeout(() => setQueueMsg((m) => { const n = { ...m }; delete n[eventId]; return n; }), 4000);
    } catch (err) {
      setQueueMsg((m) => ({ ...m, [eventId]: `❌ ${err.message}` }));
    }
  }

  async function saveZone(e) {    e.preventDefault(); setError(''); setBusy(true);
    try {
      await adminApi.createZone(zoneForm.eventId, {
        name: zoneForm.name, price: Number(zoneForm.price),
        capacity: Number(zoneForm.capacity),
        rowCount: Number(zoneForm.rowCount), seatsPerRow: Number(zoneForm.seatsPerRow),
      });
      setZoneForm({ eventId: null, name: '', price: '', capacity: '', rowCount: 1, seatsPerRow: 10 });
      // Refresh list
      const updated = await adminApi.listEvents();
      setEvents(updated.events ?? []);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold text-gray-900">Quản lý sự kiện</h1>
      {error && <p role="alert" className="text-red-700 text-sm">{error}</p>}

      {/* ── Form tạo / sửa sự kiện ── */}
      <form onSubmit={saveEvent} className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
        <h2 className="font-semibold text-gray-800">{editing ? 'Sửa sự kiện' : 'Thêm sự kiện mới'}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input name="title" value={form.title} onChange={setField} placeholder="Tên sự kiện" required
            className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          <select name="status" value={form.status} onChange={setField}
            className="rounded border border-gray-300 px-3 py-2 text-sm">
            {['DRAFT','ON_SALE','SOLD_OUT','CANCELLED','ENDED'].map((s) => <option key={s}>{s}</option>)}
          </select>
          <select name="genreId" value={form.genreId} onChange={setField} required
            className="rounded border border-gray-300 px-3 py-2 text-sm">
            <option value="">-- Thể loại --</option>
            {genres.map((g) => <option key={g.genre_id} value={g.genre_id}>{g.name}</option>)}
          </select>
          <select name="venueId" value={form.venueId} onChange={setField} required
            className="rounded border border-gray-300 px-3 py-2 text-sm">
            <option value="">-- Địa điểm --</option>
            {venues.map((v) => <option key={v.venue_id} value={v.venue_id}>{v.name} – {v.city}</option>)}
          </select>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Ngày diễn</label>
            <input type="datetime-local" name="eventDate" value={form.eventDate} onChange={setField} required
              className="rounded border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Mở bán lúc</label>
            <input type="datetime-local" name="saleOpenAt" value={form.saleOpenAt} onChange={setField} required
              className="rounded border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <input type="number" name="maxTicketsPerUser" value={form.maxTicketsPerUser} onChange={setField}
            min={1} max={10} placeholder="Tối đa vé/người"
            className="rounded border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={busy}
            className="rounded bg-indigo-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {editing ? 'Lưu thay đổi' : 'Thêm sự kiện'}
          </button>
          {editing && (
            <button type="button" onClick={() => { setEditing(null); setForm(INITIAL_FORM); }}
              className="rounded border border-gray-300 px-4 py-2 text-sm font-semibold">Hủy</button>
          )}
        </div>
      </form>

      {/* ── Form thêm khu vực ── */}
      {zoneForm.eventId && (
        <form onSubmit={saveZone} className="rounded-xl border border-indigo-200 bg-indigo-50 p-5 space-y-3">
          <h2 className="font-semibold text-indigo-800">Thêm khu vực cho sự kiện #{zoneForm.eventId}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { name: 'name', placeholder: 'Tên khu (VIP, GA…)', required: true },
              { name: 'price', placeholder: 'Giá (VND)', type: 'number', required: true },
              { name: 'capacity', placeholder: 'Sức chứa', type: 'number', required: true },
              { name: 'rowCount', placeholder: 'Số hàng', type: 'number' },
              { name: 'seatsPerRow', placeholder: 'Ghế/hàng', type: 'number' },
            ].map(({ name, ...rest }) => (
              <input key={name} name={name} value={zoneForm[name]} onChange={setZoneField}
                className="rounded border border-indigo-200 bg-white px-3 py-2 text-sm" {...rest} />
            ))}
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={busy}
              className="rounded bg-indigo-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Thêm khu vực</button>
            <button type="button" onClick={() => setZoneForm((f) => ({ ...f, eventId: null }))}
              className="rounded border border-gray-300 px-4 py-2 text-sm font-semibold">Đóng</button>
          </div>
        </form>
      )}

      {/* ── Danh sách sự kiện ── */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              {['Tên sự kiện', 'Thể loại', 'Địa điểm', 'Ngày diễn', 'Trạng thái', 'Khu/Sức chứa', ''].map((h) => (
                <th key={h} className="px-4 py-3 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {events.map((ev) => (
              <tr key={ev.eventId} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{ev.title}</td>
                <td className="px-4 py-3 text-gray-600">{ev.genreName}</td>
                <td className="px-4 py-3 text-gray-600">{ev.venueName}<br /><span className="text-xs text-gray-400">{ev.city}</span></td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{new Date(ev.eventDate).toLocaleDateString('vi-VN')}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLOR[ev.status] ?? 'bg-gray-100'}`}>{ev.status}</span>
                </td>
                <td className="px-4 py-3 text-gray-600">{ev.zoneCount} khu · {(ev.totalCapacity ?? 0).toLocaleString()} ghế</td>
                <td className="px-4 py-3 flex items-center gap-2 whitespace-nowrap">
                  <button onClick={() => { setEditing(ev.eventId); setForm({ title: ev.title, genreId: ev.genreId ?? '', venueId: ev.venueId ?? '', status: ev.status, eventDate: '', saleOpenAt: '', maxTicketsPerUser: ev.maxTickets ?? 4 }); }}
                    className="text-indigo-600 hover:underline text-xs">Sửa</button>
                  <button onClick={() => setZoneForm((f) => ({ ...f, eventId: ev.eventId }))}
                    className="text-emerald-600 hover:underline text-xs">+ Khu vực</button>
                  <button onClick={() => deleteEvent(ev.eventId)}
                    className="text-red-600 hover:underline text-xs">Xóa</button>
                  <button onClick={() => admitQueue(ev.eventId, 10)}
                    className="text-purple-600 hover:underline text-xs" title="Mở hàng đợi cho 10 người">⏩ Hàng đợi</button>
                  {queueMsg[ev.eventId] && (
                    <span className="text-xs text-gray-500 ml-1">{queueMsg[ev.eventId]}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {events.length === 0 && <p className="px-4 py-8 text-center text-gray-500">Chưa có sự kiện nào.</p>}
      </div>
    </div>
  );
}
