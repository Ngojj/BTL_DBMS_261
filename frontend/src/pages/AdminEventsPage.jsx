// [#8] Quản lý sự kiện: thêm (a), sửa (c), xóa (b). Phụ trách: TV1
// Đồng bộ lại Firestore (module sync, TV5): nút "Đồng bộ" từng sự kiện và "Đồng bộ tất cả".
import { useState } from 'react';
import { eventsApi } from '../api/eventsApi.js';
import { adminApi } from '../api/adminApi.js';
import { useAsync } from '../lib/useAsync.js';
import { dateStr, isoToLocal, localToIso, money, timeStr } from '../lib/format.js';
import { ErrorBox, Field, Loading, PageHeader, Pill } from '../components/ui.jsx';

const STATUSES = ['DRAFT', 'ON_SALE', 'SOLD_OUT', 'CANCELLED', 'ENDED'];
const empty = { title: '', genreId: '', venueId: '', eventDate: '', saleOpenAt: '', maxTicketsPerUser: 4, status: 'DRAFT' };

export default function AdminEventsPage() {
  const events = useAsync(() => eventsApi.list(), []);
  const genres = useAsync(() => eventsApi.genres(), []);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null); // null = đang thêm mới
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const closeForm = () => {
    setOpen(false);
    setEditingId(null);
    setForm(empty);
  };

  async function startEdit(id) {
    setError(null);
    setNote(null);
    try {
      const e = await eventsApi.get(id);
      setForm({
        title: e.title,
        genreId: e.genreId ?? '',
        venueId: e.venueId ?? '',
        eventDate: isoToLocal(e.eventDate),
        saleOpenAt: isoToLocal(e.saleOpenAt),
        maxTicketsPerUser: e.maxTicketsPerUser ?? 4,
        status: e.status,
      });
      setEditingId(id);
      setOpen(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err);
    }
  }

  async function save(e) {
    e.preventDefault();
    setError(null);
    setNote(null);
    const body = {
      ...form,
      genreId: Number(form.genreId),
      venueId: Number(form.venueId),
      maxTicketsPerUser: Number(form.maxTicketsPerUser),
      eventDate: localToIso(form.eventDate),
      saleOpenAt: localToIso(form.saleOpenAt),
    };
    try {
      if (editingId) await eventsApi.update(editingId, body); // [c] update
      else await eventsApi.create(body); // [a] insert
      setNote(editingId ? 'Đã cập nhật sự kiện.' : 'Đã thêm sự kiện.');
      closeForm();
      events.reload();
    } catch (err) {
      setError(err);
    }
  }

  async function remove(id) {
    setError(null);
    try {
      await eventsApi.remove(id); // [b] delete
      setConfirmId(null);
      events.reload();
    } catch (err) {
      setError(err);
    }
  }

  async function sync(id) {
    setError(null);
    setNote(null);
    setBusyId(id ?? 'all');
    try {
      await (id ? adminApi.resyncEvent(id) : adminApi.resyncAll());
      setNote(id ? 'Đã đồng bộ lại sự kiện #' + id + ' sang Firestore.' : 'Đã đồng bộ lại toàn bộ sang Firestore.');
    } catch (err) {
      setError(err);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Sự kiện"
        subtitle="Thêm, sửa, xóa sự kiện và đồng bộ lại sơ đồ ghế sang Firestore."
        action={
          <div className="flex gap-2">
            <button className="btn-ghost" disabled={busyId === 'all'} onClick={() => sync(null)} title="Dựng lại toàn bộ bản sao Firestore từ PostgreSQL">
              {busyId === 'all' ? 'Đang đồng bộ…' : 'Đồng bộ tất cả'}
            </button>
            <button className="btn-brand" onClick={() => (open ? closeForm() : setOpen(true))}>{open ? 'Đóng' : '+ Thêm sự kiện'}</button>
          </div>
        }
      />
      <div className="space-y-4">
        <ErrorBox error={error} />
        {note && <p className="rounded-lg bg-emerald-50 text-emerald-800 text-sm px-4 py-3 border border-emerald-200">{note}</p>}

        {open && (
          <form onSubmit={save} className="card p-5 grid gap-4 sm:grid-cols-2">
            <h2 className="sm:col-span-2 font-bold text-lg">{editingId ? 'Sửa sự kiện #' + editingId : 'Thêm sự kiện'}</h2>
            <div className="sm:col-span-2"><Field label="Tên sự kiện"><input required className="input" value={form.title} onChange={set('title')} /></Field></div>
            <Field label="Thể loại">
              <select required className="input" value={form.genreId} onChange={set('genreId')}>
                <option value="">Chọn…</option>
                {genres.data?.map((g) => <option key={g.genreId} value={g.genreId}>{g.name}</option>)}
              </select>
            </Field>
            <Field label="Mã địa điểm (venue_id)"><input required type="number" min="1" className="input" value={form.venueId} onChange={set('venueId')} /></Field>
            <Field label="Ngày diễn ra"><input required type="datetime-local" className="input" value={form.eventDate} onChange={set('eventDate')} /></Field>
            <Field label="Giờ mở bán"><input required type="datetime-local" className="input" value={form.saleOpenAt} onChange={set('saleOpenAt')} /></Field>
            <Field label="Số vé tối đa / người"><input type="number" min="1" max="10" className="input" value={form.maxTicketsPerUser} onChange={set('maxTicketsPerUser')} /></Field>
            <Field label="Trạng thái">
              <select className="input" value={form.status} onChange={set('status')}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
            </Field>
            <div className="sm:col-span-2 flex gap-2">
              <button className="btn-dark">{editingId ? 'Lưu thay đổi' : 'Lưu sự kiện'}</button>
              <button type="button" className="btn-ghost" onClick={closeForm}>Hủy</button>
            </div>
          </form>
        )}

        {events.loading && <Loading />}
        <ErrorBox error={events.error} />
        {events.data && (
          <div className="card overflow-x-auto">
            <table className="w-full">
              <thead><tr><th className="th">Sự kiện</th><th className="th">Thời gian</th><th className="th">Địa điểm</th><th className="th">Giá từ</th><th className="th">Trạng thái</th><th className="th" /></tr></thead>
              <tbody>
                {events.data.map((ev) => (
                  <tr key={ev.eventId}>
                    <td className="td font-bold">{ev.title}</td>
                    <td className="td whitespace-nowrap">{timeStr(ev.eventDate)} · {dateStr(ev.eventDate)}</td>
                    <td className="td">{ev.venueName} · {ev.city}</td>
                    <td className="td">{money(ev.minPrice)}</td>
                    <td className="td"><Pill tone="blue">{ev.status}</Pill></td>
                    <td className="td">
                      <div className="flex justify-end gap-2 whitespace-nowrap">
                        <button className="btn-ghost" disabled={busyId === ev.eventId} onClick={() => sync(ev.eventId)}>
                          {busyId === ev.eventId ? 'Đang đồng bộ…' : 'Đồng bộ'}
                        </button>
                        <button className="btn-ghost" onClick={() => startEdit(ev.eventId)}>Sửa</button>
                        {confirmId === ev.eventId ? (
                          <button className="btn bg-red-700 text-white" onClick={() => remove(ev.eventId)}>Xác nhận xóa</button>
                        ) : (
                          <button className="btn-ghost" onClick={() => setConfirmId(ev.eventId)}>Xóa</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
