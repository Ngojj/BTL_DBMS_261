// TODO [events.repository] Phụ trách: TV1 (#1, #8) + TV2 (#2)
import { notImplemented } from '../../utils/AppError.js';
// import { pool, withTransaction } from '../../config/pg.js';

// SQL thuần, tham số $1,$2…; ghi chú loại truy vấn a–h trong comment.

// [d] #1 – danh sách thể loại
export async function listGenres(input) {
  throw notImplemented('events.listGenres');
}

// [d,e] #1 lọc theo thể loại [d]; #2 lọc thành phố + khoảng ngày + khoảng giá [e]
export async function listEvents(input) {
  throw notImplemented('events.listEvents');
}

// [d] Chi tiết sự kiện + các khu vực
export async function getEvent(input) {
  throw notImplemented('events.getEvent');
}

// [a] #8 – thêm sự kiện
export async function createEvent(input) {
  throw notImplemented('events.createEvent');
}

// [c] #8 – sửa sự kiện
export async function updateEvent(input) {
  throw notImplemented('events.updateEvent');
}

// [b] #8 – xóa sự kiện
export async function deleteEvent(input) {
  throw notImplemented('events.deleteEvent');
}
