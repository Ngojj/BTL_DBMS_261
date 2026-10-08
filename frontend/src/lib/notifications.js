// Thông báo của người dùng: lắng nghe Firestore notifications/{userId}/items (chỉ đọc, ghi do backend qua sync).
// Cần đã đăng nhập Firebase bằng custom token (uid = String(user_id)) – xem AuthContext.connectFirebase.
// Trạng thái "đã xem" lưu cục bộ (client không được ghi vào Firestore).
import { useCallback, useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from './firebase.js';
import { USE_MOCK } from '../api/client.js';
import { notifications as mockNotifications } from '../api/mock.js';

const seenKey = (uid) => 'ticketrush_notif_seen_' + uid;
const toIso = (t) => (t?.toDate ? t.toDate().toISOString() : t);

// → { items: [{ id, message, createdAt(ISO) }], unread, markSeen }
export function useNotifications(user) {
  const uid = user?.userId;
  const [items, setItems] = useState([]);
  const [seen, setSeen] = useState(0);

  useEffect(() => {
    if (!uid) {
      setItems([]);
      return undefined;
    }
    setSeen(Number(localStorage.getItem(seenKey(uid))) || 0);
    const fallback = () => USE_MOCK && setItems(mockNotifications());
    return onSnapshot(
      query(collection(db, 'notifications', String(uid), 'items'), orderBy('createdAt', 'desc'), limit(10)),
      (snap) => (snap.empty ? (snap.metadata.fromCache ? undefined : fallback()) : setItems(snap.docs.map((d) => ({ id: d.id, message: d.data().message, createdAt: toIso(d.data().createdAt) })))),
      fallback, // chưa đăng nhập Firebase / Emulator tắt / bị Security Rules chặn
    );
  }, [uid]);

  const markSeen = useCallback(() => {
    const now = Date.now();
    setSeen(now);
    if (uid) localStorage.setItem(seenKey(uid), String(now));
  }, [uid]);

  return { items, unread: items.filter((n) => new Date(n.createdAt).getTime() > seen).length, markSeen };
}
