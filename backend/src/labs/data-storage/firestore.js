// [labs/data-storage/firestore] Phụ trách: TV4 – Data storage trên Firestore (Admin SDK)
// Kịch bản: Cùng dữ liệu vé lưu theo mô hình document phi chuẩn hóa;
//           đo kích thước document theo công thức chính thức của Google Cloud Firestore,
//           đếm số document reads để dựng trang "vé của tôi" và ước tính chi phí Standard tier.
import { firestore } from '../../config/firebase.js';
import { pool } from '../../config/pg.js';

// Công thức tính dung lượng document của Google Cloud Firestore:
// https://firebase.google.com/docs/firestore/storage-size
function stringSizeBytes(str) {
  return Buffer.byteLength(String(str), 'utf8') + 1;
}

function docNameSizeBytes(pathStr) {
  // Tổng (len(segment) + 1) cho từng collectionId / docId + 16 bytes overhead
  const segments = pathStr.split('/').filter(Boolean);
  return segments.reduce((sum, seg) => sum + stringSizeBytes(seg), 0) + 16;
}

function fieldValueSizeBytes(val) {
  if (val === null || val === undefined) return 1;
  if (typeof val === 'boolean') return 1;
  if (typeof val === 'number') return 8;
  if (typeof val === 'string') return stringSizeBytes(val);
  if (val instanceof Date || typeof val?.toDate === 'function') return 8;
  if (Array.isArray(val)) return val.reduce((s, v) => s + fieldValueSizeBytes(v), 0);
  if (typeof val === 'object') {
    return Object.entries(val).reduce(
      (s, [k, v]) => s + stringSizeBytes(k) + fieldValueSizeBytes(v),
      0,
    );
  }
  return 8;
}

function calcFirestoreDocumentBytes(docPath, data) {
  const nameBytes = docNameSizeBytes(docPath);
  const fieldsBytes = Object.entries(data ?? {}).reduce(
    (sum, [k, v]) => sum + stringSizeBytes(k) + fieldValueSizeBytes(v),
    0,
  );
  // 32 bytes document overhead
  return nameBytes + fieldsBytes + 32;
}

// Chi phí Standard tier (US multi-region):
// - Document reads: $0.06 / 100.000 reads
// - Storage: $0.18 / GiB / tháng
const READ_PRICE_PER_100K = 0.06;
const STORAGE_PRICE_PER_GIB = 0.18;

export async function run(params = {}) {
  const targetTickets = Math.max(1, Number(params.tickets) || 10000);

  // 1. Lấy user kiểm thử giống PostgreSQL để so sánh công bằng
  const { rows: targetUserRows } = await pool.query(
    `SELECT o.user_id, u.email, COUNT(*)::int AS ticket_cnt
       FROM tickets t
       JOIN orders o ON o.order_id = t.order_id
       JOIN users  u ON u.user_id = o.user_id
      WHERE t.status <> 'CANCELLED'
      GROUP BY o.user_id, u.email
      ORDER BY (u.email = 'khach@example.com') DESC, ticket_cnt DESC
      LIMIT 1`,
  );
  const testUser = targetUserRows[0];

  let qrRows = [];
  if (testUser) {
    const res = await pool.query(
      `SELECT t.qr_code
         FROM tickets t
         JOIN orders o ON o.order_id = t.order_id
        WHERE o.user_id = $1 AND t.status <> 'CANCELLED'`,
      [testUser.user_id],
    );
    qrRows = res.rows;
  }

  // 2. Đo thực tế trên Firestore: dựng trang "Vé của tôi"
  //    Đọc validTickets/{qrCode} + events/{eventId} (phi chuẩn hóa nhưng không có userId trong validTickets)
  let readsForMyTickets = 0;
  let sampleTicketDocBytes = 0;
  let sampleEventDocBytes = 0;
  const ticketsRead = [];

  for (const r of qrRows) {
    const vtSnap = await firestore.doc(`validTickets/${r.qr_code}`).get();
    readsForMyTickets++;
    if (!vtSnap.exists) continue;
    const vtData = vtSnap.data();
    sampleTicketDocBytes += calcFirestoreDocumentBytes(`validTickets/${r.qr_code}`, vtData);

    const evSnap = await firestore.doc(`events/${vtData.eventId}`).get();
    readsForMyTickets++;
    if (evSnap.exists) {
      sampleEventDocBytes += calcFirestoreDocumentBytes(`events/${vtData.eventId}`, evSnap.data());
    }
    ticketsRead.push({ qrCode: r.qr_code, seatLabel: vtData.seatLabel });
  }

  if (qrRows.length > 0 && ticketsRead.length === 0) {
    throw new Error('Firestore chưa có dữ liệu validTickets. Hãy chạy: node scripts/seed.js');
  }

  // 3. Lấy mẫu tổng dung lượng thực tế trong Firestore (events, validTickets, một mẫu seats)
  const eventsSnap = await firestore.collection('events').get();
  const validTicketsSnap = await firestore.collection('validTickets').limit(200).get();
  const validTicketsCountAgg = await firestore.collection('validTickets').count().get();
  const totalValidTickets = validTicketsCountAgg.data().count;

  let eventsBytes = 0;
  let seatsBytesSample = 0;
  let seatsSampleCount = 0;
  let totalSeatsCount = 0;

  for (const evDoc of eventsSnap.docs) {
    eventsBytes += calcFirestoreDocumentBytes(`events/${evDoc.id}`, evDoc.data());
    const seatsCountAgg = await firestore.collection(`events/${evDoc.id}/seats`).count().get();
    totalSeatsCount += seatsCountAgg.data().count;
    if (seatsSampleCount < 100) {
      const seatsSnap = await firestore.collection(`events/${evDoc.id}/seats`).limit(50).get();
      for (const sDoc of seatsSnap.docs) {
        seatsBytesSample += calcFirestoreDocumentBytes(`events/${evDoc.id}/seats/${sDoc.id}`, sDoc.data());
        seatsSampleCount++;
      }
    }
  }

  let vtBytesSample = 0;
  for (const vtDoc of validTicketsSnap.docs) {
    vtBytesSample += calcFirestoreDocumentBytes(`validTickets/${vtDoc.id}`, vtDoc.data());
  }

  const avgTicketDocBytes = validTicketsSnap.size > 0
    ? vtBytesSample / validTicketsSnap.size
    : (ticketsRead.length > 0 ? sampleTicketDocBytes / ticketsRead.length : 260);
  const avgSeatDocBytes = seatsSampleCount > 0 ? seatsBytesSample / seatsSampleCount : 200;

  // Cộng thêm ước lượng single-field index overhead (~2 index entries ASC/DESC cho các field phổ biến ~ 2.2x dữ liệu doc)
  const INDEX_MULTIPLIER = 2.2;
  const actualStorageBytes = Math.round(
    (eventsBytes + totalSeatsCount * avgSeatDocBytes + totalValidTickets * avgTicketDocBytes) * INDEX_MULTIPLIER,
  );

  let storageBytes = actualStorageBytes;
  let scaled = false;
  if (totalValidTickets > 0 && targetTickets > totalValidTickets) {
    scaled = true;
    const ratio = targetTickets / totalValidTickets;
    const dynamicPart = (totalSeatsCount * avgSeatDocBytes + totalValidTickets * avgTicketDocBytes) * INDEX_MULTIPLIER;
    storageBytes = Math.round(eventsBytes * INDEX_MULTIPLIER + dynamicPart * ratio);
  }

  // Chi phí ước tính cho 100.000 lượt mở trang "Vé của tôi" + lưu trữ 1 tháng
  const readsPer100kViews = readsForMyTickets * 100000;
  const readCostPer100kViews = (readsPer100kViews / 100000) * READ_PRICE_PER_100K;
  const storageCostMonthly = (storageBytes / (1024 ** 3)) * STORAGE_PRICE_PER_GIB;

  return {
    metrics: {
      storageBytes,
      readsForMyTickets,
      estimatedCost: `$${readCostPer100kViews.toFixed(2)} / 100K lượt xem`,
    },
    details: {
      model: 'denormalized documents (validTickets + events/{id}/seats)',
      formula: 'Google Cloud Firestore Storage Size + ~2.2x automatic single-field index overhead',
      targetTickets,
      actualDocuments: {
        events: eventsSnap.size,
        seats: totalSeatsCount,
        validTickets: totalValidTickets,
      },
      avgBytesPerDoc: {
        validTicket: Math.round(avgTicketDocBytes),
        seat: Math.round(avgSeatDocBytes),
      },
      actualStorageBytes,
      scaledFromActual: scaled,
      myTicketsRead: {
        userEmail: testUser?.email ?? null,
        ticketsReturned: ticketsRead.length,
        documentReads: readsForMyTickets,
        pattern: '2 * N (validTickets/{qrCode} + events/{eventId})',
      },
      pricingEstimate: {
        readCostPerSingleCall: `$${((readsForMyTickets / 100000) * READ_PRICE_PER_100K).toFixed(7)}`,
        readCostPer100kViews: `$${readCostPer100kViews.toFixed(2)}`,
        storageCostPerMonth: `$${storageCostMonthly.toFixed(4)}`,
      },
    },
  };
}
