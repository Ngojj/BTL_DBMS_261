// Soát vé QR chạy được khi mất mạng nhờ cache offline của Firestore (xem lib/firebase.js).
// Ngoại lệ được phép ghi trực tiếp: STAFF cập nhật checkedIn/checkedInAt của validTickets/{qrCode}.
// TODO [checkin] Phụ trách: TV5 (#7)
import { collection, doc, getDoc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from './firebase.js';
import { api, USE_MOCK } from '../api/client.js';
import { mockCheckin } from '../api/mock.js';

// Theo dõi danh sách vé của sự kiện: kéo toàn bộ vé về cache ngay và GIỮ listener mở, nên khi đang có mạng cache luôn mới
// (vé mua sau khi mở trang cũng có), và khi rớt mạng vẫn tra được. onCount(số vé) gọi mỗi lần có thay đổi từ máy chủ.
// Trả về hàm hủy theo dõi.
export function watchValidTickets(eventId, onCount, onError = () => {}) {
  return onSnapshot(
    query(collection(db, 'validTickets'), where('eventId', '==', String(eventId))),
    (snap) => onCount(snap.size),
    onError,
  );
}

// → { status: 'valid' | 'used' | 'invalid' | 'error', info?: { seatLabel, holderName } }
// onPendingChange(+1 / -1): theo dõi số lượt soát đang chờ đồng bộ lên server
export async function checkTicket(qrCode, eventId, onPendingChange = () => {}) {
  try {
    const ref = doc(db, 'validTickets', qrCode);
    const snap = await getDoc(ref);
    // Firestore đã trả lời mà không có tài liệu → mã này không phải vé hợp lệ (không được rơi về dữ liệu mẫu)
    if (!snap.exists()) return { status: 'invalid', reason: 'unknown' };

    const d = snap.data();
    const info = { seatLabel: d.seatLabel, holderName: d.holderName };
    if (String(d.eventId) !== String(eventId)) return { status: 'invalid', reason: 'other-event', otherEventId: String(d.eventId), info };
    if (d.checkedIn) return { status: 'used', info };

    // Không await: khi offline promise chỉ resolve lúc có mạng lại, nhưng ghi đã nằm trong hàng đợi cục bộ
    onPendingChange(+1);
    updateDoc(ref, { checkedIn: true, checkedInAt: serverTimestamp() })
      .catch(() => {})
      .finally(() => onPendingChange(-1));
    return { status: 'valid', info };
  } catch (e) {
    // Đang ngoại tuyến và mã không có trong cache: dữ liệu đã được tải sẵn cho cả sự kiện nên coi là không hợp lệ,
    // nhưng nói rõ lý do để nhân viên biết có thể do chưa tải sẵn.
    if (e?.code === 'unavailable') return { status: 'invalid', note: 'Không có trong dữ liệu đã tải (đang ngoại tuyến)' };
    return USE_MOCK ? mockCheckin(qrCode, eventId) : { status: 'error' };
  }
}

// Đồng bộ các lượt soát (Firestore) về PostgreSQL. Gọi khi có mạng. → { updated, alreadySynced, cancelled, unknown, … }
export const syncCheckinsToServer = (eventId) => api('/checkin/sync', { method: 'POST', body: { eventId } });
