// [labs/query-processing/firestore] Q_DT trên Firestore. Firestore không có JOIN và GROUP BY nên cài đặt bằng bốn cách (như mục TN3 của báo cáo):
//   A. Chuẩn hóa, ứng dụng tự kết: khu vực → ghế → vé rồi cộng ở ứng dụng
//   B. Phi chuẩn hóa, đọc hết vé của sự kiện rồi cộng ở ứng dụng
//   C. Phi chuẩn hóa, mỗi khu một truy vấn gộp count() + sum() chạy trên máy chủ
//   D. Duy trì sẵn một document tổng hợp (chi phí chuyển sang lúc ghi)
// Dữ liệu thử nằm ở queryLabRuns/{runId}, tách khỏi events/validTickets của ứng dụng và bị xóa sạch khi xong.
// Đếm theo cách Firestore tính phí: mỗi document trả về = 1 lượt đọc (kết quả rỗng vẫn tính 1);
// truy vấn gộp tính 1 lượt đọc cho mỗi 1.000 mục chỉ mục khớp (tối thiểu 1).
import { randomUUID } from 'node:crypto';
import { AggregateField } from 'firebase-admin/firestore';
import { firestore } from '../../config/firebase.js';
import { buildDataset, expectedRevenue, sameAsExpected, EVENT_ID } from './dataset.js';
import { parseParams } from './params.js';

const IN_LIMIT = 30; // Firestore: toán tử "in" tối đa 30 giá trị
const PARALLEL = 10; // số truy vấn "in" chạy song song ở cách A

async function getDocs(query, c) {
  c.queries += 1;
  const snap = await query.get();
  c.reads += Math.max(1, snap.size);
  return snap.docs;
}

async function approachA(root, c) {
  const zones = await getDocs(root.collection('zones'), c);
  const out = {};
  for (const zone of zones) {
    const { name } = zone.data();
    const seats = await getDocs(root.collection('seats').where('zoneId', '==', zone.data().zoneId), c);
    const seatIds = seats.map((s) => s.data().seatId);
    const chunks = [];
    for (let i = 0; i < seatIds.length; i += IN_LIMIT) chunks.push(seatIds.slice(i, i + IN_LIMIT));
    const g = (out[name] = { tickets: 0, revenue: 0 });
    for (let i = 0; i < chunks.length; i += PARALLEL) {
      const batches = await Promise.all(chunks.slice(i, i + PARALLEL).map((ids) => getDocs(root.collection('tickets').where('seatId', 'in', ids), c)));
      for (const t of batches.flat().map((d) => d.data())) {
        if (!t.active) continue; // vé hủy vẫn bị đọc (và tính phí) rồi mới bỏ ở ứng dụng
        g.tickets += 1;
        g.revenue += t.price;
      }
    }
  }
  return out;
}

async function approachB(root, c) {
  const docs = await getDocs(root.collection('tickets').where('active', '==', true), c);
  const out = {};
  for (const t of docs.map((d) => d.data())) {
    const g = (out[t.zone] ??= { tickets: 0, revenue: 0 });
    g.tickets += 1;
    g.revenue += t.price;
  }
  return out;
}

async function approachC(root, c, zoneNames) {
  // Danh sách khu vực là cấu hình đã biết của sự kiện nên không tính là lượt đọc (đúng như bảng 3.3.2 của báo cáo).
  const out = {};
  for (const name of zoneNames) {
    c.queries += 1;
    const snap = await root.collection('tickets').where('zone', '==', name).where('active', '==', true)
      .aggregate({ n: AggregateField.count(), total: AggregateField.sum('price') }).get();
    const { n, total } = snap.data();
    c.reads += Math.max(1, Math.ceil(n / 1000));
    if (n > 0) out[name] = { tickets: n, revenue: total };
  }
  return out;
}

async function approachD(root, c) {
  c.queries += 1;
  c.reads += 1;
  return (await root.collection('summary').doc('revenue').get()).data().byZone;
}

const APPROACH_FN = { A: approachA, B: approachB, C: approachC, D: approachD };
const APPROACH_NAME = {
  A: 'Chuẩn hóa, ứng dụng tự kết',
  B: 'Phi chuẩn hóa, đọc hết rồi cộng',
  C: 'Phi chuẩn hóa, gộp count/sum trên máy chủ',
  D: 'Document tổng hợp duy trì sẵn',
};

export async function run(params = {}) {
  const { tickets: n, approach } = parseParams(params);
  const ds = buildDataset(n);
  const expected = expectedRevenue(ds);
  const root = firestore.collection('queryLabRuns').doc(randomUUID());
  try {
    // Nạp dữ liệu thử (không tính vào thời gian truy vấn)
    const writer = firestore.bulkWriter();
    for (const z of ds.zones) writer.set(root.collection('zones').doc(String(z.id)), { zoneId: z.id, eventId: EVENT_ID, name: z.name, price: z.price });
    for (const s of ds.seats) writer.set(root.collection('seats').doc(String(s.seatId)), { seatId: s.seatId, zoneId: s.zoneId });
    for (const t of ds.tickets) {
      writer.set(root.collection('tickets').doc(String(t.ticketId)), { seatId: t.seatId, eventId: EVENT_ID, zone: t.zone, price: t.price, active: t.active });
    }
    writer.set(root.collection('summary').doc('revenue'), { byZone: Object.fromEntries(Object.entries(expected).filter(([, g]) => g.tickets > 0)) });
    await writer.close();

    const zoneNames = ds.zones.map((z) => z.name);
    const perApproach = {};
    for (const key of Object.keys(APPROACH_FN)) {
      const c = { queries: 0, reads: 0 };
      const t0 = performance.now();
      const got = await APPROACH_FN[key](root, c, zoneNames);
      const ms = performance.now() - t0;
      perApproach[key] = {
        name: APPROACH_NAME[key],
        queries: c.queries,
        reads: c.reads,
        queryMs: Number(ms.toFixed(1)),
        groups: Object.keys(got).length,
        revenue: Object.values(got).reduce((s, g) => s + g.revenue, 0),
        matchesExpected: sameAsExpected(got, expected),
      };
    }

    const sel = perApproach[approach];
    return {
      metrics: {
        queries: sel.queries,
        rowsRead: sel.reads,
        groups: sel.groups,
        revenue: sel.revenue,
        matchesExpected: sel.matchesExpected,
        queryMs: sel.queryMs,
        plan: `Cách ${approach}`,
      },
      details: {
        tickets: n,
        selected: approach,
        note: 'Thời gian đo trên máy chủ ứng dụng gọi Firestore (kể cả trình giả lập) nên chỉ mang tính tham khảo; số lượt đọc và số lượt gọi mới là số liệu so sánh chính.',
        approaches: perApproach,
      },
    };
  } finally {
    await firestore.recursiveDelete(root).catch((err) => console.error('[lab query] không dọn được queryLabRuns:', err.message));
  }
}
