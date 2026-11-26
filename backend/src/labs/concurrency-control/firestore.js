// [labs/concurrency-control/firestore] Giờ G trên Firestore: cùng kịch bản với postgres.js, dùng Admin SDK như backend.
// Dữ liệu thử nằm dưới concurrencyLabRuns/{runId} và bị xóa ngay sau khi đo.
import { randomUUID } from 'node:crypto';
import { firestore } from '../../config/firebase.js';
import { parseParams, runBuyers, sleep, p95 } from './params.js';

const sid = (i) => 's' + String(i).padStart(3, '0');

export async function run(params = {}) {
  const { users, seats, strategy, thinkMs, concurrency } = parseParams(params);
  const root = firestore.collection('concurrencyLabRuns').doc(randomUUID());
  const seatsCol = root.collection('seats');
  const salesCol = root.collection('sales');
  // Truy vấn chỉ có một điều kiện bằng → dùng chỉ mục tự động, thứ tự theo id: mọi người cùng nhắm ghế s001
  const available = () => seatsCol.where('status', '==', 'AVAILABLE');
  const stats = { ok: 0, soldout: 0, refused: 0, conflicts: 0, callbacks: 0, errors: {} };
  const lat = [];
  try {
    const w = firestore.bulkWriter();
    for (let i = 1; i <= seats; i++) w.set(seatsCol.doc(sid(i)), { status: 'AVAILABLE', holder: null });
    await w.close();

    const inTx = (pickRandom) => (uid) => firestore.runTransaction(async (tx) => {
      stats.callbacks++;
      const q = await tx.get(available().limit(pickRandom ? 20 : 1));
      if (q.empty) return 'soldout';
      const d = pickRandom ? q.docs[Math.floor(Math.random() * q.docs.length)] : q.docs[0];
      await sleep(thinkMs);
      tx.update(d.ref, { status: 'SOLD', holder: uid });
      tx.create(salesCol.doc(), { seat: d.id, user: uid });
      return 'ok';
    });

    const buy = {
      none: async (uid) => {
        const q = await available().limit(1).get();
        if (q.empty) return 'soldout';
        await sleep(thinkMs);
        await q.docs[0].ref.update({ status: 'SOLD', holder: uid });
        await salesCol.add({ seat: q.docs[0].id, user: uid });
        return 'ok';
      },
      pessimistic: inTx(false),
      skip: inTx(true),
      // Lạc quan: ghi có điều kiện "document chưa đổi kể từ lúc đọc" (precondition lastUpdateTime)
      optimistic: async (uid) => {
        for (let attempt = 1; attempt <= 30; attempt++) {
          const q = await available().limit(1).get();
          if (q.empty) return 'soldout';
          await sleep(thinkMs);
          const d = q.docs[0];
          try {
            const b = firestore.batch();
            b.update(d.ref, { status: 'SOLD', holder: uid }, { lastUpdateTime: d.updateTime });
            b.create(salesCol.doc(), { seat: d.id, user: uid });
            await b.commit();
            return 'ok';
          } catch (e) {
            if (e.code !== 9 && e.code !== 10) throw e; // 9 FAILED_PRECONDITION, 10 ABORTED: có người ghi trước
            stats.conflicts++;
          }
        }
        return 'refused';
      },
    }[strategy];

    const t0 = performance.now();
    await runBuyers(users, concurrency, async (i) => {
      const s = performance.now();
      try { stats[await buy('u' + i)]++; }
      catch (e) { stats.refused++; stats.errors[e.code ?? 'app'] = (stats.errors[e.code ?? 'app'] ?? 0) + 1; }
      lat.push(performance.now() - s);
    });
    const elapsedMs = Math.round(performance.now() - t0);

    const [saleSnap, seatSnap] = await Promise.all([salesCol.get(), seatsCol.get()]);
    const holder = Object.fromEntries(seatSnap.docs.map((d) => [d.id, d.get('holder')]));
    const sold = new Set(saleSnap.docs.map((d) => d.get('seat'))).size;
    if (strategy === 'pessimistic' || strategy === 'skip') stats.conflicts = Math.max(0, stats.callbacks - (stats.ok + stats.soldout + stats.refused));
    return {
      metrics: {
        sold, ticketsIssued: saleSnap.size, duplicates: saleSnap.size - sold,
        lostUpdates: saleSnap.docs.filter((d) => holder[d.get('seat')] !== d.get('user')).length,
        buyers: stats.ok, soldOut: stats.soldout, refused: stats.refused,
        seatsLeft: seatSnap.docs.filter((d) => d.get('status') === 'AVAILABLE').length,
        conflicts: stats.conflicts, elapsedMs, p95Ms: p95(lat),
        method: { none: 'Đọc rồi ghi, không transaction', pessimistic: 'runTransaction (khóa bi quan)', optimistic: 'Ghi có điều kiện lastUpdateTime, thử lại tối đa 30 lần', skip: 'runTransaction, chọn ngẫu nhiên 1 trong 20 ghế' }[strategy],
      },
      details: { root: root.path, users, seats, strategy, thinkMs, transactionCallbacks: stats.callbacks, errors: stats.errors },
    };
  } finally {
    await firestore.recursiveDelete(root).catch(() => {});
  }
}
