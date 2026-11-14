// [#3] Phòng chờ ảo (quản trị): bật/tắt cho từng sự kiện và cho N người tiếp theo vào mua vé.
import { useCallback, useEffect, useState } from 'react';
import { eventsApi } from '../api/eventsApi.js';
import { queueApi } from '../api/queueApi.js';
import { useAsync } from '../lib/useAsync.js';
import { ErrorBox, Loading, PageHeader, Pill } from '../components/ui.jsx';

function QueueRow({ ev, onError }) {
  const [meta, setMeta] = useState(null);
  const [count, setCount] = useState(5);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => queueApi.meta(ev.eventId).then(setMeta).catch(onError), [ev.eventId, onError]);
  useEffect(() => {
    load();
    const t = setInterval(load, 4000); // số người đang chờ thay đổi liên tục
    return () => clearInterval(t);
  }, [load]);

  const run = (fn) => async () => {
    setBusy(true);
    onError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };
  const waiting = meta ? Math.max(0, meta.next - meta.admittedUpTo) : 0;

  return (
    <tr>
      <td className="td font-bold">{ev.title}</td>
      <td className="td">{meta ? <Pill tone={meta.enabled ? 'green' : 'gray'}>{meta.enabled ? 'Đang bật' : 'Tắt'}</Pill> : '…'}</td>
      <td className="td text-right">{meta ? meta.next : '…'}</td>
      <td className="td text-right">{meta ? meta.admittedUpTo : '…'}</td>
      <td className="td text-right font-bold">{waiting}</td>
      <td className="td">
        <div className="flex gap-2 justify-end items-center whitespace-nowrap">
          <button className="btn-ghost" disabled={busy || !meta} onClick={run(() => queueApi.setEnabled(ev.eventId, !meta.enabled))}>
            {meta?.enabled ? 'Tắt' : 'Bật'}
          </button>
          <input aria-label="Số người cho vào" type="number" min="1" max="500" className="input !w-20" value={count} onChange={(e) => setCount(e.target.value)} />
          <button className="btn-brand" disabled={busy || !meta?.enabled || waiting === 0} onClick={run(() => queueApi.admit(ev.eventId, Number(count)))}>
            Cho vào
          </button>
          <button className="btn-ghost" disabled={busy || !meta || meta.next === 0} onClick={run(() => queueApi.reset(ev.eventId))}>Đặt lại</button>
        </div>
      </td>
    </tr>
  );
}

export default function AdminQueuePage() {
  const events = useAsync(() => eventsApi.list(), []);
  const [error, setError] = useState(null);
  return (
    <div>
      <PageHeader
        title="Phòng chờ ảo"
        subtitle="Khi bật, khách phải xếp hàng và chờ được cho vào mới giữ ghế được. Dùng cho đợt mở bán đông người."
      />
      <div className="space-y-4">
        <ErrorBox error={error} />
        {events.loading && <Loading />}
        <ErrorBox error={events.error} />
        {events.data && (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead>
                <tr>
                  <th className="th">Sự kiện</th><th className="th">Phòng chờ</th>
                  <th className="th text-right">Đã xếp hàng</th><th className="th text-right">Đã cho vào</th><th className="th text-right">Đang chờ</th><th className="th" />
                </tr>
              </thead>
              <tbody>{events.data.map((ev) => <QueueRow key={ev.eventId} ev={ev} onError={setError} />)}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
