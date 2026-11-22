// [#3] Phòng chờ ảo. Lưu trên Firestore:
//   queues/{eventId}                 { enabled, next, admittedUpTo }
//   queues/{eventId}/entries/{userId} { seq, joinedAt }
// Người vào hàng nhận số thứ tự tăng dần (seq) trong transaction nên không trùng số khi vào đồng thời.
// Admin "cho vào N người" chỉ tăng con trỏ admittedUpTo; ai có seq <= admittedUpTo là đã được vào mua vé.
import { firestore } from '../../config/firebase.js';

const SECONDS_PER_PERSON = 15; // ước lượng thời gian chờ mỗi người phía trước
const metaRef = (eventId) => firestore.collection('queues').doc(String(eventId));
const entryRef = (eventId, userId) => metaRef(eventId).collection('entries').doc(String(userId));
const metaOf = (snap) => ({ enabled: false, next: 0, admittedUpTo: 0, ...(snap.exists ? snap.data() : {}) });

export async function getMeta(eventId) {
  return metaOf(await metaRef(eventId).get());
}

export async function setEnabled(eventId, enabled) {
  await metaRef(eventId).set({ enabled }, { merge: true });
  return getMeta(eventId);
}

export async function join(eventId, userId) {
  return firestore.runTransaction(async (tx) => {
    const [metaSnap, entrySnap] = await Promise.all([tx.get(metaRef(eventId)), tx.get(entryRef(eventId, userId))]);
    const meta = metaOf(metaSnap);
    if (entrySnap.exists) return entrySnap.data().seq; // vào lại → giữ nguyên số cũ
    const seq = meta.next + 1;
    tx.set(metaRef(eventId), { next: seq }, { merge: true });
    tx.set(entryRef(eventId, userId), { seq, joinedAt: new Date().toISOString() });
    return seq;
  });
}

export async function status(eventId, userId) {
  const [meta, entrySnap] = await Promise.all([getMeta(eventId), entryRef(eventId, userId).get()]);
  if (!entrySnap.exists) return { enabled: meta.enabled, inQueue: false, admitted: false, waiting: meta.next - meta.admittedUpTo };
  const { seq } = entrySnap.data();
  const admitted = seq <= meta.admittedUpTo;
  const peopleAhead = admitted ? 0 : seq - meta.admittedUpTo - 1;
  return {
    enabled: meta.enabled,
    inQueue: true,
    admitted,
    position: seq,
    peopleAhead,
    estimatedWaitSeconds: admitted ? 0 : (peopleAhead + 1) * SECONDS_PER_PERSON,
    waiting: Math.max(0, meta.next - meta.admittedUpTo),
  };
}

export async function admit(eventId, count) {
  return firestore.runTransaction(async (tx) => {
    const meta = metaOf(await tx.get(metaRef(eventId)));
    const admittedUpTo = Math.min(meta.next, meta.admittedUpTo + count);
    tx.set(metaRef(eventId), { admittedUpTo }, { merge: true });
    return { admitted: admittedUpTo - meta.admittedUpTo, admittedUpTo, waiting: meta.next - admittedUpTo };
  });
}

export async function leave(eventId, userId) {
  await entryRef(eventId, userId).delete(); // số thứ tự đã cấp không dùng lại; người sau vẫn đứng đúng vị trí tương đối
}

// Xóa toàn bộ hàng đợi của sự kiện (đặt lại từ đầu, giữ nguyên bật/tắt)
export async function reset(eventId) {
  const { enabled } = await getMeta(eventId);
  await firestore.recursiveDelete(metaRef(eventId));
  if (enabled) await metaRef(eventId).set({ enabled });
}
