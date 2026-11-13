// [#4] Chọn ghế trên sơ đồ realtime và giữ ghế (loại a qua POST /api/orders)
// Phụ trách: TV5 (sơ đồ ghế realtime, lib/seats.js) + TV4 (#4 mua vé)
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { eventsApi } from '../api/eventsApi.js';
import { bookingApi } from '../api/bookingApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSeats } from '../lib/seats.js';
import { useAsync } from '../lib/useAsync.js';
import { fullDate, money, timeStr } from '../lib/format.js';
import { ErrorBox, Loading } from '../components/ui.jsx';
import Reviews from '../components/Reviews.jsx';

const SEAT_STYLE = {
  AVAILABLE: 'bg-white border-gray-400 hover:border-royal hover:bg-indigo-50 cursor-pointer',
  SELECTED: 'bg-royal border-royal cursor-pointer',
  HELD: 'bg-gold border-gold cursor-not-allowed',
  SOLD: 'bg-sold border-sold cursor-not-allowed',
};

function Seat({ seat, state, onClick }) {
  return (
    <button
      type="button"
      title={'Ghế ' + seat.row + seat.number}
      aria-label={'Ghế ' + seat.row + seat.number}
      disabled={state === 'HELD' || state === 'SOLD'}
      onClick={onClick}
      className={'w-6 h-6 rounded-[5px] border transition-colors shrink-0 ' + SEAT_STYLE[state]}
    />
  );
}

function ZoneBlock({ zone, rows, stateOf, toggle }) {
  return (
    <div className="mb-5">
      <p className="text-center text-xs font-bold tracking-wider text-gray-600 mb-2">
        {zone.name.toUpperCase()} · {money(zone.price)}
      </p>
      <div className="space-y-1">
        {rows.map(({ row, seats }) => {
          const half = Math.ceil(seats.length / 2);
          return (
            <div key={row} className="flex items-center justify-center gap-1">
              <span className="w-5 text-xs font-bold text-gray-600 text-center">{row}</span>
              <div className="flex gap-1">
                {seats.slice(0, half).map((s) => <Seat key={s.seatId} seat={s} state={stateOf(s)} onClick={() => toggle(s)} />)}
              </div>
              <span className="w-6 shrink-0" />
              <div className="flex gap-1">
                {seats.slice(half).map((s) => <Seat key={s.seatId} seat={s} state={stateOf(s)} onClick={() => toggle(s)} />)}
              </div>
              <span className="w-5 text-xs font-bold text-gray-600 text-center">{row}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function EventDetailPage() {
  const { eventId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const event = useAsync(() => eventsApi.get(eventId), [eventId]);
  const { seats } = useSeats(eventId);
  const [selected, setSelected] = useState([]);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const max = event.data?.maxTicketsPerUser ?? 4;
  const zones = useMemo(() => [...(event.data?.zones ?? [])].sort((a, b) => b.price - a.price), [event.data]);
  const seatById = useMemo(() => Object.fromEntries(seats.map((s) => [s.seatId, s])), [seats]);

  // zone → [{ row, seats }]
  const layout = useMemo(() => {
    const byZone = {};
    for (const s of seats) ((byZone[s.zone] ??= {})[s.row] ??= []).push(s);
    return Object.fromEntries(
      Object.entries(byZone).map(([z, rows]) => [
        z,
        Object.keys(rows).sort().map((row) => ({ row, seats: rows[row].sort((a, b) => a.number - b.number) })),
      ]),
    );
  }, [seats]);

  // Ghế đã chọn mà bị người khác lấy mất (realtime) thì bỏ khỏi danh sách chọn
  useEffect(() => {
    setSelected((cur) => {
      const keep = cur.filter((id) => seatById[id]?.status === 'AVAILABLE');
      if (keep.length !== cur.length) setMsg('Có ghế vừa được người khác giữ, đã bỏ khỏi lựa chọn của bạn.');
      return keep.length === cur.length ? cur : keep;
    });
  }, [seatById]);

  const stateOf = (s) => (selected.includes(s.seatId) ? 'SELECTED' : s.status);
  const priceOf = (s) => zones.find((z) => z.name === s.zone)?.price ?? 0;
  const chosen = selected.map((id) => seatById[id]).filter(Boolean);
  const total = chosen.reduce((sum, s) => sum + priceOf(s), 0);

  function toggle(seat) {
    if (seat.status !== 'AVAILABLE') return;
    if (selected.includes(seat.seatId)) return setSelected(selected.filter((id) => id !== seat.seatId));
    if (selected.length >= max) return setMsg('Tối đa ' + max + ' vé mỗi tài khoản cho sự kiện này.');
    setMsg(null);
    setSelected([...selected, seat.seatId]);
  }

  async function hold() {
    if (!user) return navigate('/login', { state: { from: location.pathname } });
    setBusy(true);
    setMsg(null);
    try {
      const order = await bookingApi.createOrder({ eventId, seatIds: selected }, user, chosen.map((s) => ({ ...s, price: priceOf(s) })));
      navigate('/checkout/' + order.orderId);
    } catch (e) {
      setMsg(e.message);
      setSelected([]);
    } finally {
      setBusy(false);
    }
  }

  if (event.loading) return <Loading />;
  if (event.error) return <ErrorBox error={event.error} />;
  const e = event.data;

  const rowRange = (z) => {
    const rows = (layout[z.name] ?? []).map((r) => r.row);
    return rows.length ? `hàng ${rows[0]}–${rows[rows.length - 1]}` : '';
  };

  return (
    // pb-24: chừa chỗ cho thanh "Giữ ghế" cố định ở đáy (điện thoại) để không che phần cuối trang
    <div className={selected.length ? 'pb-24 lg:pb-0' : ''}>
    {/* minmax(0,1fr) + min-w-0: sơ đồ ghế rộng 640px phải cuộn BÊN TRONG thẻ, không được làm cả trang rộng ra ngoài màn hình */}
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_350px] items-start">
      <section className="card p-4 sm:p-7 min-w-0">
        <Link to="/" className="text-sm font-bold text-brand">← Tất cả sự kiện</Link>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1">{e.title}</h1>
        <p className="text-gray-600 mb-5">
          {timeStr(e.eventDate)} · {fullDate(e.eventDate)} · {e.venueName}, {e.city}
        </p>

        <p className="sm:hidden text-xs text-gray-500 mb-2">← Vuốt ngang để xem hết sơ đồ →</p>
        <div className="overflow-x-auto pb-2 -mx-1 px-1">
          <div className="min-w-[640px]">
            <div className="mx-auto max-w-[590px] bg-ink text-white text-center rounded-b-[36px] py-3 text-sm font-bold tracking-[0.25em] mb-5">
              SÂN KHẤU
            </div>
            {seats.length === 0 && <p className="text-center text-gray-500 py-10">Đang tải sơ đồ ghế…</p>}
            {zones.map((z) => (
              <ZoneBlock key={z.zoneId} zone={z} rows={layout[z.name] ?? []} stateOf={stateOf} toggle={toggle} />
            ))}
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-6 text-sm text-gray-700">
          {[['AVAILABLE', 'Còn trống'], ['SELECTED', 'Ghế bạn chọn'], ['HELD', 'Người khác đang giữ'], ['SOLD', 'Đã bán']].map(([k, label]) => (
            <span key={k} className="flex items-center gap-2">
              <span className={'w-5 h-5 rounded-[5px] border ' + SEAT_STYLE[k].split(' cursor')[0].replace(/hover:\S+/g, '')} /> {label}
            </span>
          ))}
        </div>
      </section>

      <aside className="space-y-4 lg:sticky lg:top-4 min-w-0">
        <div className="card p-5">
          <h2 className="font-bold text-lg mb-3">Giá vé</h2>
          <ul className="space-y-2 text-[15px]">
            {zones.map((z) => (
              <li key={z.zoneId} className="flex justify-between gap-2">
                <span className="text-gray-600">{z.name} ({rowRange(z)})</span>
                <b>{money(z.price)}</b>
              </li>
            ))}
          </ul>
          <p className="text-sm text-gray-500 mt-3">Tối đa {max} vé mỗi tài khoản cho sự kiện này.</p>
        </div>

        <div className="card p-5 flex flex-col min-h-[300px]">
          <div className="flex justify-between items-baseline mb-3">
            <h2 className="font-bold text-lg">Ghế đã chọn</h2>
            <span className="text-sm text-gray-500">{selected.length} / {max} vé</span>
          </div>
          <div className="space-y-2">
            {chosen.map((s) => (
              <div key={s.seatId} className="flex items-center justify-between rounded-xl bg-indigo-50 px-4 py-2.5">
                <div>
                  <p className="font-bold text-royal leading-tight">Ghế {s.row}{s.number}</p>
                  <p className="text-xs text-gray-500">{s.zone}</p>
                </div>
                <div className="flex items-center gap-3">
                  <b>{money(priceOf(s))}</b>
                  <button
                    aria-label={'Bỏ ghế ' + s.row + s.number}
                    onClick={() => toggle(s)}
                    className="w-10 h-10 sm:w-8 sm:h-8 rounded-lg bg-white border border-black/10 hover:bg-black/5"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
            {chosen.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">Bấm vào ghế trống để chọn.</p>}
          </div>

          <div className="mt-auto pt-5 border-t border-black/10">
            {msg && <p className="text-sm text-red-600 mb-3">{msg}</p>}
            <div className="flex justify-between items-baseline mb-3">
              <span className="text-gray-600">Tạm tính</span>
              <span className="text-2xl font-extrabold">{money(total)}</span>
            </div>
            <button className="btn-brand w-full py-3 text-base" disabled={selected.length === 0 || busy} onClick={hold}>
              {busy ? 'Đang giữ ghế…' : 'Giữ ghế và thanh toán'}
            </button>
            <p className="text-xs text-gray-500 text-center mt-3">Ghế được giữ cho bạn trong 10 phút.</p>
          </div>
        </div>
      </aside>
    </div>
    {selected.length > 0 && (
      <div className="lg:hidden fixed inset-x-0 bottom-0 z-30 bg-white border-t border-black/10 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <div className="min-w-0">
            <p className="text-xs text-gray-500">{selected.length} / {max} ghế</p>
            <p className="text-xl font-extrabold leading-tight">{money(total)}</p>
          </div>
          <button className="btn-brand flex-1 py-3 text-base" disabled={busy} onClick={hold}>
            {busy ? 'Đang giữ ghế…' : 'Giữ ghế và thanh toán'}
          </button>
        </div>
        {msg && <p className="text-xs text-red-600 mt-2">{msg}</p>}
      </div>
    )}
    <Reviews eventId={eventId} />
    </div>
  );
}
