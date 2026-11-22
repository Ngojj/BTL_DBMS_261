// [#3] Phòng chờ ảo: khi admin bật cho sự kiện, khách phải xếp hàng và chờ được cho vào mới giữ ghế được.
import { useCallback, useEffect, useState } from 'react';
import { queueApi } from '../api/queueApi.js';

// Trả về { status, blocked, join, leave }. blocked = true khi phòng chờ đang bật mà khách chưa được vào.
export function useWaitingRoom(eventId, user) {
  const [status, setStatus] = useState(null);
  const isCustomer = user?.role === 'CUSTOMER';

  const refresh = useCallback(async () => {
    try {
      setStatus(await queueApi.status(eventId));
    } catch {
      setStatus(null); // lỗi mạng / máy chủ: không chặn người dùng ở phía giao diện
    }
  }, [eventId]);

  useEffect(() => {
    if (!isCustomer) return undefined;
    refresh();
    const timer = setInterval(refresh, 3000);
    return () => clearInterval(timer);
  }, [isCustomer, refresh]);

  const join = async () => setStatus(await queueApi.join(eventId));
  const leave = async () => {
    await queueApi.leave(eventId);
    refresh();
  };
  return { status, blocked: Boolean(status?.enabled && !status.admitted), join, leave };
}

const fmtWait = (s) => (s < 60 ? 'dưới 1 phút' : `khoảng ${Math.ceil(s / 60)} phút`);

export default function WaitingRoom({ room }) {
  const { status: s } = room;
  const [err, setErr] = useState(null);
  if (!s?.enabled) return null;

  const act = (fn) => async () => {
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr(e.message);
    }
  };

  if (s.admitted) {
    return (
      <div className="rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 px-5 py-4 mb-6">
        <p className="font-bold">Đến lượt bạn rồi! Hãy chọn ghế và giữ chỗ.</p>
        <p className="text-sm">Phòng chờ đang bật; bạn đã được cho vào mua vé.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-ink text-white px-5 py-5 mb-6" role="status" aria-live="polite">
      <p className="text-xs font-bold tracking-widest text-gold">PHÒNG CHỜ ẢO</p>
      {!s.inQueue ? (
        <>
          <h2 className="text-xl font-extrabold mt-1">Sự kiện đang rất đông</h2>
          <p className="text-white/70 text-sm mt-1">Hãy xếp hàng để được cho vào chọn ghế theo thứ tự. Hiện có {s.waiting} người đang chờ.</p>
          <button className="btn-brand mt-4" onClick={act(room.join)}>Vào hàng chờ</button>
        </>
      ) : (
        <>
          <h2 className="text-xl font-extrabold mt-1">Bạn đang ở vị trí số {s.position}</h2>
          <p className="text-white/80 mt-1">
            Còn <b>{s.peopleAhead}</b> người phía trước · chờ {fmtWait(s.estimatedWaitSeconds)}
          </p>
          <p className="text-white/50 text-xs mt-1">Giữ nguyên trang này, bạn sẽ được cho vào tự động. Không cần tải lại.</p>
          <button className="mt-4 rounded-lg border border-white/40 px-4 py-2 text-sm font-bold text-white hover:bg-white/10" onClick={act(room.leave)}>Rời hàng chờ</button>
        </>
      )}
      {err && <p className="text-amber-300 text-sm mt-2">{err}</p>}
    </div>
  );
}
