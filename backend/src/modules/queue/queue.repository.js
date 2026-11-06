import { firestore } from '../../config/firebase.js';

// In-memory fallback queue khi Firestore emulator tắt hoặc timeout
const memoryQueues = new Map();

function getMemoryQueue(eventId) {
  if (!memoryQueues.has(eventId)) {
    memoryQueues.set(eventId, new Map());
  }
  return memoryQueues.get(eventId);
}

// Timeout helper để không bị treo gRPC khi emulator không chạy
const FS_TIMEOUT_MS = 600;
function withTimeout(promise) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('FIRESTORE_OFFLINE_TIMEOUT')), FS_TIMEOUT_MS)),
  ]);
}

export async function joinQueue({ eventId, userId, fullName }) {
  const eventIdStr = String(eventId);
  const userIdStr = String(userId);

  try {
    const queueRef = firestore.collection('events').doc(eventIdStr).collection('queue');
    const userDocRef = queueRef.doc(userIdStr);
    const existing = await withTimeout(userDocRef.get());

    if (existing.exists) {
      const data = existing.data();
      return {
        eventId: eventIdStr,
        userId: userIdStr,
        position: data.position,
        joinedAt: data.joinedAt,
        admitted: data.admitted ?? false,
      };
    }

    const snapshot = await withTimeout(queueRef.get());
    const position = snapshot.size + 1;
    const now = new Date().toISOString();

    const queueData = {
      userId: userIdStr,
      fullName: fullName || `User #${userIdStr}`,
      position,
      joinedAt: now,
      admitted: false,
    };

    await withTimeout(userDocRef.set(queueData));

    return {
      eventId: eventIdStr,
      userId: userIdStr,
      ...queueData,
    };
  } catch {
    // Fallback in-memory ngay lập tức
    const memQueue = getMemoryQueue(eventIdStr);
    if (memQueue.has(userIdStr)) {
      return memQueue.get(userIdStr);
    }
    const position = memQueue.size + 1;
    const entry = {
      eventId: eventIdStr,
      userId: userIdStr,
      fullName: fullName || `User #${userIdStr}`,
      position,
      joinedAt: new Date().toISOString(),
      admitted: false,
    };
    memQueue.set(userIdStr, entry);
    return entry;
  }
}

export async function getQueueStatus({ eventId, userId }) {
  const eventIdStr = String(eventId);
  const userIdStr = String(userId);

  try {
    const queueRef = firestore.collection('events').doc(eventIdStr).collection('queue');
    const userDoc = await withTimeout(queueRef.doc(userIdStr).get());

    if (!userDoc.exists) {
      return { inQueue: false };
    }

    const userData = userDoc.data();
    if (userData.admitted) {
      return { inQueue: true, admitted: true, position: 0, estimatedWaitSeconds: 0 };
    }

    const aheadSnap = await withTimeout(
      queueRef
        .where('admitted', '==', false)
        .where('position', '<', userData.position)
        .get()
    );

    const peopleAhead = aheadSnap.size;
    const estimatedWaitSeconds = Math.max(peopleAhead * 15, 10);

    return {
      inQueue: true,
      admitted: false,
      position: userData.position,
      peopleAhead,
      estimatedWaitSeconds,
      joinedAt: userData.joinedAt,
    };
  } catch {
    const memQueue = getMemoryQueue(eventIdStr);
    const entry = memQueue.get(userIdStr);
    if (!entry) return { inQueue: false };
    return {
      inQueue: true,
      admitted: entry.admitted,
      position: entry.position,
      peopleAhead: Math.max(0, entry.position - 1),
      estimatedWaitSeconds: Math.max(10, (entry.position - 1) * 15),
    };
  }
}

export async function admitUsers({ eventId, count = 5 }) {
  const eventIdStr = String(eventId);
  const admittedUsers = [];

  try {
    const queueRef = firestore.collection('events').doc(eventIdStr).collection('queue');
    const snapshot = await withTimeout(
      queueRef
        .where('admitted', '==', false)
        .orderBy('position', 'asc')
        .limit(count)
        .get()
    );

    if (snapshot.empty) return { admittedCount: 0, users: [] };

    const batch = firestore.batch();
    snapshot.forEach((doc) => {
      batch.update(doc.ref, { admitted: true, admittedAt: new Date().toISOString() });
      admittedUsers.push({ userId: doc.id, ...doc.data(), admitted: true });
    });

    await withTimeout(batch.commit());
    return { admittedCount: admittedUsers.length, users: admittedUsers };
  } catch {
    const memQueue = getMemoryQueue(eventIdStr);
    let admittedCount = 0;
    for (const [uid, item] of memQueue.entries()) {
      if (!item.admitted && admittedCount < count) {
        item.admitted = true;
        admittedUsers.push(item);
        admittedCount++;
      }
    }
    return { admittedCount, users: admittedUsers };
  }
}

export async function leaveQueue({ eventId, userId }) {
  const eventIdStr = String(eventId);
  const userIdStr = String(userId);

  try {
    await withTimeout(firestore.collection('events').doc(eventIdStr).collection('queue').doc(userIdStr).delete());
  } catch {
    const memQueue = getMemoryQueue(eventIdStr);
    memQueue.delete(userIdStr);
  }
  return { success: true };
}
