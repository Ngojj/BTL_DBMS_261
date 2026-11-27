// TODO [checkin.service] Phụ trách: TV5 (#7)
import * as repo from './checkin.repository.js';

// Nghiệp vụ + điều phối transaction. Không viết SQL ở đây (SQL nằm trong repository).

// TODO [d] #7 – danh sách vé hợp lệ (nạp/đối chiếu với Firestore validTickets)
export async function listValidTickets(input) {
  return repo.listValidTickets(input);
}

// TODO [c] #7 – nhận danh sách checkedIn từ cổng, cập nhật tickets.status = CHECKED_IN trong PostgreSQL
export async function syncCheckins(input) {
  return repo.syncCheckins(input);
}
