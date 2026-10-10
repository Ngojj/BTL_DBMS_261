// TV3 – đọc document, ghép khu và tổng hợp bằng JavaScript tại backend.
import net from 'node:net';
import { firestore } from '../../config/firebase.js';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import { roundMs, sortRows, totals } from './shared.js';

export const LAB_COLLECTION = 'labQueryProcessingRuns';

export async function checkEmulator() {
  if (!env.firestoreEmulatorHost) {
    throw new AppError(503, 'EMULATOR_REQUIRED', 'Lab cần FIRESTORE_EMULATOR_HOST và Firestore Emulator đang chạy');
  }
  const address = new URL('http://' + env.firestoreEmulatorHost);
  await new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: address.hostname.replace(/^\[|\]$/g, ''), port: Number(address.port) });
    const finish = (error) => {
      socket.destroy();
      if (error) reject(new AppError(503, 'EMULATOR_UNAVAILABLE', 'Không kết nối được Firestore Emulator'));
      else resolve();
    };
    socket.setTimeout(2000, () => finish(true));
    socket.once('error', finish);
    socket.once('connect', () => finish());
  });
}

export function datasetRef(runId) {
  // runId do server sinh; không nhận đường dẫn collection từ người dùng.
  return firestore.collection(LAB_COLLECTION).doc(runId);
}

export async function prepare(ref, snapshot) {
  const docs = [
    [ref, { ...snapshot.event, snapshotAt: snapshot.snapshotAt }],
    ...snapshot.zones.map((zone) => [ref.collection('zones').doc(zone.zoneId), zone]),
    ...snapshot.tickets.map((ticket) => [ref.collection('tickets').doc(ticket.ticketId), ticket]),
  ];
  // [a] Dữ liệu riêng từng lần chạy; không ghi vào events/ hoặc validTickets/.
  for (let offset = 0; offset < docs.length; offset += 400) {
    const batch = firestore.batch();
    for (const [doc, data] of docs.slice(offset, offset + 400)) batch.set(doc, data);
    await batch.commit();
  }
  return docs.length;
}

export async function run(_params, ref) {
  if (!ref) throw new AppError(400, 'LAB_NOT_PREPARED', 'Chưa chuẩn bị dữ liệu Firestore cho lần chạy');
  const started = performance.now();
  // [d,f,h] 1 document read + 2 collection queries. JOIN và GROUP BY ở backend.
  const [eventDoc, zones, tickets] = await Promise.all([
    ref.get(), ref.collection('zones').get(),
    ref.collection('tickets').where('orderStatus', '==', 'PAID').get(),
  ]);
  if (!eventDoc.exists) throw new AppError(409, 'LAB_DATASET_MISSING', 'Thiếu dữ liệu thí nghiệm Firestore');
  const { eventId, eventTitle } = eventDoc.data();
  const groups = new Map(zones.docs.map((doc) => {
    const { zoneId, zone } = doc.data();
    return [zoneId, { eventId, eventTitle, zoneId, zone, ticketsSold: 0, revenue: 0 }];
  }));
  for (const doc of tickets.docs) {
    const ticket = doc.data();
    if (!['VALID', 'CHECKED_IN'].includes(ticket.ticketStatus)) continue;
    const group = groups.get(ticket.zoneId);
    if (!group) throw new AppError(409, 'LAB_DATASET_INVALID', 'Vé tham chiếu khu vực không tồn tại');
    group.ticketsSold++;
    group.revenue += ticket.price;
  }
  const rows = sortRows([...groups.values()]);
  const summary = totals(rows);
  return {
    durationMs: roundMs(performance.now() - started),
    metrics: { queries: 3, rowsRead: 1 + zones.size + tickets.size, groups: rows.length, ...summary },
    details: { rows },
  };
}

export async function cleanup(ref) {
  if (ref.parent.id !== LAB_COLLECTION || ref.path.split('/').length !== 2) {
    throw new Error('Chỉ xóa dữ liệu thuộc collection của Query Processing Lab');
  }
  // [b] Chỉ xóa snapshot của lần chạy này, kể cả subcollection sau lỗi ghi dở.
  await firestore.recursiveDelete(ref);
}
