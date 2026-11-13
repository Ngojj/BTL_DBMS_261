// [checkin.repository] #7 soát vé QR – SQL thuần. Phụ trách: TV5
//
// Luồng: nhân viên quét QR trên trình duyệt, tra và ghi `validTickets/{qrCode}.checkedIn` trực tiếp vào Firestore
// (chạy được khi mất mạng nhờ cache offline). Khi có mạng, frontend gọi POST /api/checkin/sync; backend ĐỌC các vé
// đã checkedIn trong Firestore rồi cập nhật PostgreSQL (nguồn dữ liệu chính): tickets.status = CHECKED_IN.
import { firestore } from '../../config/firebase.js';
import { pool } from '../../config/pg.js';
import { AppError } from '../../utils/AppError.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readEventId(v, required) {
  if (v == null || v === '') {
    if (required) throw new AppError(400, 'VALIDATION', 'Thiếu eventId');
    return null;
  }
  if (!/^[1-9]\d{0,17}$/.test(String(v))) throw new AppError(400, 'VALIDATION', 'eventId không hợp lệ');
  return Number(v);
}

// [d] danh sách vé hợp lệ của sự kiện (đối chiếu với Firestore validTickets; dùng khi Firestore không với tới được)
// Chỉ vé còn hiệu lực của đơn đã thanh toán.
export async function listValidTickets({ params }) {
  const eventId = readEventId(params?.eventId, true);
  const { rows } = await pool.query(
    `SELECT t.qr_code, t.status, t.checked_in_at, u.full_name AS holder_name, z.name AS zone_name, s.row_label, s.seat_no
       FROM tickets t
       JOIN orders o ON o.order_id = t.order_id
       JOIN users  u ON u.user_id  = o.user_id
       JOIN seats  s ON s.seat_id  = t.seat_id
       JOIN zones  z ON z.zone_id  = s.zone_id
      WHERE o.event_id = $1 AND o.status = 'PAID' AND t.status IN ('VALID', 'CHECKED_IN')
      ORDER BY z.zone_id, s.row_label, s.seat_no`,
    [eventId],
  );
  return rows.map((r) => ({
    qrCode: r.qr_code, seatLabel: r.zone_name + ' · Ghế ' + r.row_label + r.seat_no, holderName: r.holder_name,
    checkedIn: r.status === 'CHECKED_IN', checkedInAt: r.checked_in_at,
  }));
}

// [c] đồng bộ ngược Firestore → PostgreSQL. body: { eventId? } (bỏ trống = mọi sự kiện)
// Idempotent: gọi nhiều lần không đổi kết quả. Không bao giờ "bỏ soát" một vé.
export async function syncCheckins({ body }) {
  const eventId = readEventId(body?.eventId, false);
  let q = firestore.collection('validTickets').where('checkedIn', '==', true);
  if (eventId) q = q.where('eventId', '==', String(eventId));
  const snap = await q.get();

  const seen = new Map(); // qrCode → thời điểm soát (Date | null)
  let malformed = 0;
  for (const d of snap.docs) {
    if (!UUID.test(d.id)) { malformed++; continue; }
    seen.set(d.id.toLowerCase(), d.data().checkedInAt?.toDate?.() ?? null);
  }
  const result = { checkedInInFirestore: snap.size, updated: 0, alreadySynced: 0, cancelled: 0, unknown: 0, malformed };
  if (!seen.size) return result;

  const qrs = [...seen.keys()];
  const { rows: before } = await pool.query('SELECT qr_code, status FROM tickets WHERE qr_code = ANY($1::uuid[])', [qrs]);
  const state = new Map(before.map((r) => [r.qr_code, r.status]));

  const toUpdate = qrs.filter((q) => state.get(q) === 'VALID');
  if (toUpdate.length) {
    // Chỉ vé của đơn đã thanh toán; giữ thời điểm soát gốc (checkedInAt của Firestore), thiếu thì dùng giờ máy chủ
    const { rowCount } = await pool.query(
      `UPDATE tickets t
          SET status = 'CHECKED_IN', checked_in_at = COALESCE(x.at, now())
         FROM unnest($1::uuid[], $2::timestamptz[]) AS x(qr, at), orders o
        WHERE t.qr_code = x.qr AND t.status = 'VALID' AND o.order_id = t.order_id AND o.status = 'PAID'`,
      [toUpdate, toUpdate.map((q) => seen.get(q))],
    );
    result.updated = rowCount;
  }
  for (const q of qrs) {
    const st = state.get(q);
    if (st === undefined) result.unknown++;
    else if (st === 'CHECKED_IN') result.alreadySynced++;
    else if (st === 'CANCELLED') result.cancelled++;
  }
  return result;
}
