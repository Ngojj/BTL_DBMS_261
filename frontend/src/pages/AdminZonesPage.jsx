// [#9] Quản lý khu vực và giá vé: thêm (a), sửa (c), xóa (b); sinh ghế cho khu vực (a). Phụ trách: TV2
import { useState } from 'react';
import { eventsApi } from '../api/eventsApi.js';
import { useAsync } from '../lib/useAsync.js';
import { money } from '../lib/format.js';
import { ErrorBox, Field, Loading, PageHeader } from '../components/ui.jsx';

export default function AdminZonesPage() {
  const events = useAsync(() => eventsApi.list(), []);
  const [eventId, setEventId] = useState('');
  const id = eventId || (events.data?.[0] ? String(events.data[0].eventId) : '');
  const zones = useAsync(() => (id ? eventsApi.zones(id) : Promise.resolve([])), [id]);
  const [form, setForm] = useState({ name: '', price: '', capacity: '' });
  const [edit, setEdit] = useState(null); // { zoneId, name, price, capacity } khi đang sửa một dòng
  const [rowsForm, setRowsForm] = useState({ rows: 'A-C', perRow: 16 });
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);

  const run = async (fn, okMsg) => {
    setError(null);
    setNote(null);
    try {
      await fn();
      if (okMsg) setNote(okMsg);
      zones.reload();
    } catch (e) {
      setError(e);
    }
  };

  return (
    <div>
      <PageHeader title="Khu vực và giá vé" subtitle="Mỗi sự kiện có nhiều khu vực; sinh ghế sau khi tạo khu vực." />
      <div className="space-y-4">
        <div className="card p-5 max-w-md">
          <Field label="Sự kiện">
            <select className="input" value={id} onChange={(e) => { setEventId(e.target.value); setEdit(null); }}>
              {events.data?.map((e) => <option key={e.eventId} value={e.eventId}>{e.title}</option>)}
            </select>
          </Field>
        </div>
        <ErrorBox error={error} />
        {note && <p className="rounded-lg bg-emerald-50 text-emerald-800 text-sm px-4 py-3 border border-emerald-200">{note}</p>}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => eventsApi.createZone(id, { name: form.name, price: Number(form.price), capacity: Number(form.capacity) }).then(() => setForm({ name: '', price: '', capacity: '' })),
              'Đã thêm khu vực.',
            );
          }}
          className="card p-5 grid gap-4 sm:grid-cols-4 items-end"
        >
          <Field label="Tên khu (VIP, CAT 1…)"><input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Giá vé (₫)"><input required type="number" min="0" className="input" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></Field>
          <Field label="Sức chứa"><input required type="number" min="1" className="input" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></Field>
          <button className="btn-dark h-[38px]">+ Thêm khu vực</button>
        </form>

        {zones.loading && <Loading />}
        <ErrorBox error={zones.error} />
        {zones.data && (
          <div className="card overflow-x-auto">
            <table className="w-full">
              <thead><tr><th className="th">Khu vực</th><th className="th">Giá</th><th className="th">Sức chứa</th><th className="th">Sinh ghế (hàng, ghế/hàng)</th><th className="th" /></tr></thead>
              <tbody>
                {zones.data.map((z) => {
                  const editing = edit?.zoneId === z.zoneId;
                  return (
                    <tr key={z.zoneId}>
                      <td className="td font-bold">{editing ? <input aria-label="Tên khu" className="input w-28" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /> : z.name}</td>
                      <td className="td">{editing ? <input aria-label="Giá" type="number" min="0" className="input w-32" value={edit.price} onChange={(e) => setEdit({ ...edit, price: e.target.value })} /> : money(z.price)}</td>
                      <td className="td">{editing ? <input aria-label="Sức chứa" type="number" min="1" className="input w-24" value={edit.capacity} onChange={(e) => setEdit({ ...edit, capacity: e.target.value })} /> : z.capacity}</td>
                      <td className="td">
                        <div className="flex gap-2 items-center">
                          <input aria-label="Các hàng" className="input w-24" value={rowsForm.rows} onChange={(e) => setRowsForm({ ...rowsForm, rows: e.target.value })} />
                          <input aria-label="Ghế mỗi hàng" type="number" className="input w-20" value={rowsForm.perRow} onChange={(e) => setRowsForm({ ...rowsForm, perRow: e.target.value })} />
                          <button className="btn-ghost" onClick={() => run(() => eventsApi.generateSeats(z.zoneId, { rows: rowsForm.rows, seatsPerRow: Number(rowsForm.perRow) }), 'Đã sinh ghế cho ' + z.name)}>Sinh ghế</button>
                        </div>
                      </td>
                      <td className="td">
                        <div className="flex justify-end gap-2 whitespace-nowrap">
                          {editing ? (
                            <>
                              <button
                                className="btn-dark"
                                onClick={() =>
                                  run(() => eventsApi.updateZone(z.zoneId, { name: edit.name, price: Number(edit.price), capacity: Number(edit.capacity) }).then(() => setEdit(null)), 'Đã cập nhật khu vực.')
                                }
                              >
                                Lưu
                              </button>
                              <button className="btn-ghost" onClick={() => setEdit(null)}>Hủy</button>
                            </>
                          ) : (
                            <>
                              <button className="btn-ghost" onClick={() => setEdit({ zoneId: z.zoneId, name: z.name, price: z.price, capacity: z.capacity })}>Sửa</button>
                              <button className="btn-ghost" onClick={() => run(() => eventsApi.removeZone(z.zoneId), 'Đã xóa khu vực.')}>Xóa</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
