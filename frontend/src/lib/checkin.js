// Soát vé QR chạy được khi mất mạng nhờ cache offline của Firestore (xem lib/firebase.js).
// Ngoại lệ được phép ghi trực tiếp: STAFF cập nhật checkedIn/checkedInAt của validTickets/{qrCode}.
// TODO [checkin] Phụ trách: TV5 (#7)
import { collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from './firebase.js';
import { USE_MOCK } from '../api/client.js';
import { mockCheckin } from '../api/mock.js';

// Tải trước danh sách vé của sự kiện vào cache để offline vẫn tra được. Trả về số vé.
export async function preloadValidTickets(eventId) {
  const snap = await getDocs(query(collection(db, 'validTickets'), where('eventId', '==', String(eventId))));
  return snap.size;
}

// → { status: 'valid' | 'used' | 'invalid' | 'error', info?: { seatLabel, holderName } }
// onPendingChange(+1 / -1): theo dõi số lượt soát đang chờ đồng bộ lên server
export async function checkTicket(qrCode, eventId, onPendingChange = () => {}) {
  try {
    const ref = doc(db, 'validTickets', qrCode);
    const snap = await getDoc(ref);
    if (!snap.exists()) return USE_MOCK ? mockCheckin(qrCode, eventId) : { status: 'invalid' };

    const d = snap.data();
    const info = { seatLabel: d.seatLabel, holderName: d.holderName };
    if (String(d.eventId) !== String(eventId)) return { status: 'invalid' };
    if (d.checkedIn) return { status: 'used', info };

    // Không await: khi offline promise chỉ resolve lúc có mạng lại, nhưng ghi đã nằm trong hàng đợi cục bộ
    onPendingChange(+1);
    updateDoc(ref, { checkedIn: true, checkedInAt: serverTimestamp() })
      .catch(() => {})
      .finally(() => onPendingChange(-1));
    return { status: 'valid', info };
  } catch {
    return USE_MOCK ? mockCheckin(qrCode, eventId) : { status: 'error' };
  }
}
