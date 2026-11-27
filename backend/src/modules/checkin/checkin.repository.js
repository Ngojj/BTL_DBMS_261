// TODO [checkin.repository] Phụ trách: TV5 (#7)
import { notImplemented } from '../../utils/AppError.js';
// import { pool, withTransaction } from '../../config/pg.js';

// SQL thuần, tham số $1,$2…; ghi chú loại truy vấn a–h trong comment.

// [d] #7 – danh sách vé hợp lệ (nạp/đối chiếu với Firestore validTickets)
export async function listValidTickets(input) {
  throw notImplemented('checkin.listValidTickets');
}

// [c] #7 – nhận danh sách checkedIn từ cổng, cập nhật tickets.status = CHECKED_IN trong PostgreSQL
export async function syncCheckins(input) {
  throw notImplemented('checkin.syncCheckins');
}
