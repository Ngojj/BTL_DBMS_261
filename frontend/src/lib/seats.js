// Sơ đồ ghế realtime: lắng nghe Firestore events/{eventId}/seats (chỉ đọc).
// TODO [seats] Phụ trách: TV5 – sơ đồ ghế realtime
import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from './firebase.js';
import { USE_MOCK } from '../api/client.js';
import { mockSeats } from '../api/mock.js';

// Ghế giữ đã quá hạn thì coi như trống (backend sẽ dọn sau)
function normalize(seat) {
  const until = seat.heldUntil?.toMillis ? seat.heldUntil.toMillis() : seat.heldUntil ? new Date(seat.heldUntil).getTime() : 0;
  if (seat.status === 'HELD' && until && until < Date.now()) return { ...seat, status: 'AVAILABLE', heldBy: null };
  return seat;
}

// Trả về { seats: [{ seatId, zone, row, number, status: AVAILABLE|HELD|SOLD, heldBy }], live }
// live = true khi dữ liệu đến từ Firestore thật
export function useSeats(eventId) {
  const [state, setState] = useState({ seats: [], live: false });

  useEffect(() => {
    let gotSeats = false; // đã nhận được ghế thật từ Firestore (cache hoặc máy chủ) → không bao giờ đổi sang dữ liệu mẫu
    const useMock = () => USE_MOCK && !gotSeats && setState({ seats: mockSeats(eventId), live: false });
    // Firestore tắt / không với tới được: sau 3 giây vẫn chưa có ghế nào thì dùng dữ liệu mẫu
    const timer = setTimeout(useMock, 3000);
    const unsub = onSnapshot(
      collection(db, 'events', String(eventId), 'seats'),
      (snap) => {
        // Lần đầu SDK có thể phát một bản chụp RỖNG lấy từ cache trước khi máy chủ trả lời: chưa kết luận là "trống"
        if (snap.empty) return snap.metadata.fromCache ? undefined : useMock(); // máy chủ xác nhận chưa có ghế nào
        gotSeats = true;
        setState({ seats: snap.docs.map((d) => normalize({ seatId: d.id, ...d.data() })), live: true });
      },
      useMock,
    );
    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, [eventId]);

  return state;
}
