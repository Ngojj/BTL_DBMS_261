// [#7] Soát vé QR ở cổng, chạy được khi mất mạng (Firestore offline → đồng bộ PostgreSQL). Loại c.
// Phụ trách: TV5
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import QrScanner from '../components/QrScanner.jsx';
import { eventsApi } from '../api/eventsApi.js';
import { checkTicket, preloadValidTickets } from '../lib/checkin.js';
import { useAsync, useOnline } from '../lib/useAsync.js';

const RESULT = {
  valid: { box: 'bg-emerald-700', title: 'Vé hợp lệ', icon: '✓' },
  used: { box: 'bg-amber-600', title: 'Vé đã được soát', icon: '!' },
  invalid: { box: 'bg-red-700', title: 'Vé không hợp lệ', icon: '✕' },
  error: { box: 'bg-red-700', title: 'Chưa tra được vé (chưa có dữ liệu offline)', icon: '✕' },
};

export default function CheckinPage() {
  const [params, setParams] = useSearchParams();
  const gate = params.get('gate') ?? '1';
  const online = useOnline();
  const events = useAsync(() => eventsApi.list(), []);
  const [eventId, setEventId] = useState(params.get('eventId') ?? '');
  const [result, setResult] = useState(null);
  const [checked, setChecked] = useState(0);
  const [pending, setPending] = useState(0);
  const [preloaded, setPreloaded] = useState(null);
  const [manual, setManual] = useState(null); // null = ẩn ô nhập
  const last = useRef({ code: '', at: 0 });

  useEffect(() => {
    if (!eventId && events.data?.length) setEventId(String(events.data[0].eventId));
  }, [events.data, eventId]);

  // Tải trước danh sách vé của sự kiện vào cache để soát được cả khi rớt mạng
  useEffect(() => {
    if (!eventId || !online) return;
    preloadValidTickets(eventId).then(setPreloaded).catch(() => setPreloaded(null));
  }, [eventId, online]);

  const handleCode = useCallback(
    async (raw) => {
      const code = raw.trim();
      if (!code || !eventId) return;
      const now = Date.now();
      if (last.current.code === code && now - last.current.at < 3000) return; // camera đọc lặp
      last.current = { code, at: now };
      const r = await checkTicket(code, eventId, (d) => setPending((p) => Math.max(0, p + d)));
      setResult(r);
      if (r.status === 'valid') setChecked((c) => c + 1);
    },
    [eventId],
  );

  const eventTitle = events.data?.find((e) => String(e.eventId) === eventId)?.title;
  const res = result && RESULT[result.status];

  return (
    <div className="min-h-screen bg-ink text-white">
      <div className="max-w-md mx-auto p-4 min-h-screen flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white/60">
              Cổng {gate} · Nhân viên soát vé · <Link to="/" className="underline">thoát</Link>
            </p>
            <select
              aria-label="Sự kiện"
              value={eventId}
              onChange={(e) => { setEventId(e.target.value); setParams({ eventId: e.target.value, gate }); }}
              className="bg-transparent text-xl font-extrabold w-full focus:outline-none"
            >
              {events.data?.map((e) => (
                <option key={e.eventId} value={e.eventId} className="text-ink text-base">{e.title}</option>
              ))}
            </select>
          </div>
          <span className={'shrink-0 rounded-full px-4 py-2 text-sm font-bold ' + (online ? 'bg-emerald-600' : 'bg-gold text-ink')}>
            {online ? 'Trực tuyến' : '⌀ Ngoại tuyến'}
          </span>
        </div>

        <p className="rounded-xl bg-white/10 px-4 py-3 text-sm text-white/80">
          Vẫn soát được vé khi mất mạng. Lượt soát được lưu trên máy và tự đồng bộ khi có mạng.
          {preloaded != null && <span className="text-white/50"> Đã tải sẵn {preloaded} vé của sự kiện này.</span>}
        </p>

        <QrScanner onScan={handleCode} />

        {res && (
          <div className={'rounded-2xl px-5 py-4 flex items-center gap-4 ' + res.box}>
            <span className="w-14 h-14 rounded-full bg-white/20 grid place-items-center text-2xl shrink-0">{res.icon}</span>
            <div className="min-w-0">
              <p className="text-2xl font-extrabold leading-tight">{res.title}</p>
              {result.info && <p className="text-white/85 font-semibold truncate">{result.info.seatLabel} · {result.info.holderName}</p>}
            </div>
          </div>
        )}

        <div className="mt-auto">
          <div className="flex justify-between text-sm text-white/60 mb-3">
            <span>Đã soát tại cổng này: {checked} lượt</span>
            <span>Chờ đồng bộ: {pending} lượt</span>
          </div>
          {manual === null ? (
            <button onClick={() => setManual('')} className="w-full rounded-2xl bg-white/10 hover:bg-white/15 py-4 font-bold">
              Nhập mã vé thủ công
            </button>
          ) : (
            <form
              onSubmit={(e) => { e.preventDefault(); handleCode(manual); setManual(''); }}
              className="flex gap-2"
            >
              <input
                autoFocus
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder="Dán mã QR (UUID) của vé"
                className="flex-1 rounded-xl bg-white/10 px-4 py-3 font-mono text-sm focus:outline-none focus:ring-2 ring-glow"
              />
              <button className="rounded-xl bg-glow text-ink font-bold px-5">Soát</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
