// TODO [sync.publisher] Phụ trách: TV5
// Hàm được gọi SAU KHI transaction PostgreSQL đã COMMIT (booking, checkin, events, zones).
// Ghi Firestore lỗi thì thử lại (retry có backoff); không được làm hỏng nghiệp vụ đã commit.
import { firestore } from '../../config/firebase.js';

// TODO: events/{eventId}/seats/{seatId} <- { status, heldBy, heldUntil, zone, row, number }
export async function publishSeatChanged(seat) {
  void firestore; void seat;
}

// TODO: events/{eventId}.zonesSummary = { VIP: { left }, ... }
export async function publishZonesSummary(eventId) {
  void eventId;
}

// TODO: validTickets/{qrCode} <- { eventId, seatLabel, holderName, checkedIn, checkedInAt }
export async function publishValidTicket(ticket) {
  void ticket;
}

// TODO: notifications/{userId}/items/{id} <- { message, read, createdAt }
export async function publishNotification(userId, message) {
  void userId; void message;
}
