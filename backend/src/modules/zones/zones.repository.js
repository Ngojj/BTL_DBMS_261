// TODO [zones.repository] Phụ trách: TV2 (#9)
import { notImplemented } from '../../utils/AppError.js';
// import { pool, withTransaction } from '../../config/pg.js';

// SQL thuần, tham số $1,$2…; ghi chú loại truy vấn a–h trong comment.

// [d] #9 – khu vực của sự kiện
export async function listZones(input) {
  throw notImplemented('zones.listZones');
}

// [a] #9 – thêm khu vực + giá vé
export async function createZone(input) {
  throw notImplemented('zones.createZone');
}

// [c] #9 – sửa khu vực / giá
export async function updateZone(input) {
  throw notImplemented('zones.updateZone');
}

// [b] #9 – xóa khu vực
export async function deleteZone(input) {
  throw notImplemented('zones.deleteZone');
}

// [a] #9 – sinh ghế cho khu vực (bulk insert)
export async function generateSeats(input) {
  throw notImplemented('zones.generateSeats');
}
