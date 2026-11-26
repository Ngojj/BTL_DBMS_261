// [labs/data-storage/firestore] Cùng dữ liệu, lưu theo một trong hai mô hình document (tham số model, xem shared.js).
// Dữ liệu thử nằm dưới dataStorageLabRuns/{runId} và bị xóa ngay sau khi đo.
// Dung lượng tính đúng theo công thức của Firestore (tên document + tên trường + giá trị + 32 byte),
// với đường dẫn như khi để ở gốc database, để so được với PostgreSQL.
import { randomUUID } from 'node:crypto';
import { firestore } from '../../config/firebase.js';
import { parseParams, makeFixture, docSize, USD_PER_READ, PAGE_VIEWS, fmtUsd } from './shared.js';

export async function run(params = {}) {
  const { tickets: n, myTickets, model } = parseParams(params);
  const f = makeFixture(n, myTickets);
  const root = firestore.collection('dataStorageLabRuns').doc(randomUUID());
  const ev = String(f.event.id);
  const zoneOf = Object.fromEntries(f.zones.map((z) => [z.id, z]));
  const userOf = Object.fromEntries(f.users.map((u) => [u.id, u]));

  // [đường dẫn tương đối, dữ liệu]
  const docs = [[`events/${ev}`, { title: f.event.title, date: new Date(f.event.date), venueName: f.event.venue, city: f.event.city, status: 'ON_SALE' }]];
  for (const s of f.seats) docs.push([`events/${ev}/seats/${s.id}`, { zone: zoneOf[s.zoneId].name, row: s.row, no: s.no, status: 'SOLD' }]);
  for (const t of f.tickets) {
    if (model === 'current') {
      docs.push([`validTickets/${t.qr}`, { eventId: f.event.id, seatLabel: t.seatLabel, holderName: userOf[t.userId].fullName, checkedIn: false }]);
    } else {
      docs.push([`users/${t.userId}/myTickets/${t.id}`, {
        qrCode: t.qr, status: 'VALID', price: t.price, eventId: f.event.id, eventTitle: f.event.title, eventDate: new Date(f.event.date),
        venueName: f.event.venue, city: f.event.city, zone: t.zone, seatLabel: t.seatLabel,
      }]);
    }
  }
  const storageBytes = docs.reduce((s, [p, d]) => s + docSize(p, d), 0);
  const byCollection = {};
  for (const [p, d] of docs) {
    const k = p.split('/').filter((_, i) => i % 2 === 0).join('/');
    byCollection[k] ??= { documents: 0, bytes: 0 };
    byCollection[k].documents++; byCollection[k].bytes += docSize(p, d);
  }

  try {
    const w = firestore.bulkWriter();
    for (const [p, d] of docs) w.set(firestore.doc(`${root.path}/${p}`), d);
    await w.close();

    // "Vé của tôi" của khách số 1
    let reads = 0; let rows = [];
    const t0 = performance.now();
    if (model === 'current') {
      // Như mục 3.1.5: danh sách mã QR lấy từ PostgreSQL (ở đây lấy từ dữ liệu thử), mỗi vé đọc 1 validTickets + 1 events
      const mine = f.tickets.filter((t) => t.userId === 1);
      rows = await Promise.all(mine.map(async (t) => {
        const vt = await firestore.doc(`${root.path}/validTickets/${t.qr}`).get(); reads++;
        const e = await firestore.doc(`${root.path}/events/${vt.get('eventId')}`).get(); reads++;
        return { ...vt.data(), eventTitle: e.get('title') };
      }));
    } else {
      const q = await firestore.collection(`${root.path}/users/1/myTickets`).get();
      reads = Math.max(1, q.size); // truy vấn trả về 0 document vẫn tính 1 lượt đọc
      rows = q.docs.map((d) => d.data());
    }
    const queryMs = Math.round(performance.now() - t0);

    const perView = reads * USD_PER_READ;
    return {
      metrics: {
        model: model === 'current' ? 'Như hiện tại: validTickets + events' : 'Phi chuẩn hóa: users/{uid}/myTickets',
        storageBytes,
        records: docs.length,
        readsForMyTickets: reads,
        myTicketsReturned: rows.length,
        queryMs,
        writesOnRename: model === 'current' ? 1 : 1 + n,
        deadTuples: 'Không có',
        seatsBloat: 'Không cần VACUUM',
        estimatedCost: `${fmtUsd(perView * PAGE_VIEWS)} / ${PAGE_VIEWS.toLocaleString('vi-VN')} lượt xem`,
      },
      details: {
        root: root.path, model, byCollection,
        sampleDocument: rows[0] ?? null,
        note: 'Dung lượng chỉ tính document, chưa tính chỉ mục tự động (Firestore tính phí cả phần này). writesOnRename là số document phải sửa nếu đổi tên sự kiện, đếm theo mô hình, không thực hiện.',
      },
    };
  } finally {
    await firestore.recursiveDelete(root).catch(() => {});
  }
}
