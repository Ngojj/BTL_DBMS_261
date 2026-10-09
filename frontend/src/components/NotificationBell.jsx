import { useEffect, useRef, useState } from 'react';
import { useNotifications } from '../lib/notifications.js';
import { dateTime } from '../lib/format.js';

export default function NotificationBell({ user }) {
  const { items, unread, markSeen } = useNotifications(user);
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  // Bấm ra ngoài thì đóng
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => !box.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button
        aria-label={'Thông báo' + (unread ? ' (' + unread + ' chưa xem)' : '')}
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          if (!open) markSeen();
        }}
        className="relative w-9 h-9 rounded-full grid place-items-center text-white/70 hover:text-white hover:bg-white/10"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-glow text-ink text-[11px] font-extrabold grid place-items-center">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] card text-ink shadow-xl z-40 overflow-hidden">
          <p className="px-4 py-3 font-bold border-b border-black/10">Thông báo</p>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-500 text-center">Chưa có thông báo nào.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto divide-y divide-black/5">
              {items.map((n) => (
                <li key={n.id} className="px-4 py-3">
                  <p className="text-sm">{n.message}</p>
                  <p className="text-xs text-gray-500 mt-1">{dateTime(n.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
