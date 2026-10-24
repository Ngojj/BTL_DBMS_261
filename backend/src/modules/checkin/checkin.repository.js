import { withTransaction } from '../../config/pg.js';
import { getTicketByQr } from '../tickets/tickets.repository.js';
import { AppError } from '../../utils/AppError.js';
import { firestore } from '../../config/firebase.js';

// [c] update: soát vé – đánh dấu CHECKED_IN trong PostgreSQL và đồng bộ Firestore
export async function checkinByQr(qrCode) {
  if (!qrCode) throw new AppError(400, 'VALIDATION', 'qrCode không hợp lệ');

  // Lookup trước để trả nhanh thông tin vé
  const ticket = await getTicketByQr(qrCode);

  if (ticket.status === 'CHECKED_IN')
    return { ...ticket, alreadyCheckedIn: true };
  if (ticket.status !== 'VALID')
    throw new AppError(409, 'TICKET_INVALID', `Vé ở trạng thái ${ticket.status}, không thể soát`);

  const result = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE tickets
          SET status = 'CHECKED_IN', checked_in_at = now()
        WHERE qr_code = $1 AND status = 'VALID'
        RETURNING ticket_id, checked_in_at`,
      [qrCode],
    );
    if (!rows[0]) throw new AppError(409, 'CHECKIN_RACE', 'Vé vừa được soát bởi thiết bị khác');
    return rows[0];
  });

  // Đồng bộ sang Firestore (best-effort, không block response)
  const checkedInAt = result.checked_in_at;
  firestore
    .collection('validTickets')
    .doc(qrCode)
    .set(
      {
        eventId:     ticket.eventId,
        seatLabel:   ticket.seatLabel,
        holderName:  ticket.holderName,
        checkedIn:   true,
        checkedInAt: checkedInAt,
      },
      { merge: true },
    )
    .catch((err) => console.error('[sync] Firestore checkin write failed:', err.message));

  return { ...ticket, status: 'CHECKED_IN', checkedInAt, alreadyCheckedIn: false };
}

// Lookup vé theo QR để STAFF xem thông tin trước khi soát (offline fallback trên FE dùng Firestore)
export { getTicketByQr } from '../tickets/tickets.repository.js';
