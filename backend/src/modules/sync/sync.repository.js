// TODO [sync.repository] Phụ trách: TV5 (đồng bộ PostgreSQL → Firestore)
import { notImplemented } from '../../utils/AppError.js';
import { firestore } from '../../config/firebase.js';
// import { pool, withTransaction } from '../../config/pg.js';

// SQL thuần, tham số $1,$2…; ghi chú loại truy vấn a–h trong comment.

// [-] Đồng bộ lại toàn bộ trạng thái ghế của một sự kiện
export async function resyncEvent(input) {
  throw notImplemented('sync.resyncEvent');
}

// [-] Đồng bộ lại toàn bộ (events, seats, validTickets)
export async function resyncAll(input) {
  throw notImplemented('sync.resyncAll');
}
