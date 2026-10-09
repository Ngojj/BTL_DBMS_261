// TODO [booking.repository] Phụ trách: TV4 (#4, #5)
import { notImplemented } from '../../utils/AppError.js';
// import { pool, withTransaction } from '../../config/pg.js';

// SQL thuần, tham số $1,$2…; ghi chú loại truy vấn a–h trong comment.

// [a] #4 – giữ ghế (SELECT … FOR UPDATE) → tạo đơn + vé PENDING. Khóa users FOR UPDATE trước khi đếm giới hạn vé
export async function createOrder(input) {
  throw notImplemented('booking.createOrder');
}

// [a,c] #4 – thanh toán giả lập: insert payments, update orders/seats/tickets; sau COMMIT gọi sync
export async function payOrder(input) {
  throw notImplemented('booking.payOrder');
}

// [c] #5 – hủy đơn, hoàn vé, trả ghế về AVAILABLE
export async function cancelOrder(input) {
  throw notImplemented('booking.cancelOrder');
}

// [d] Đơn hàng của tôi
export async function listMyOrders(input) {
  throw notImplemented('booking.listMyOrders');
}
// [f] join orders + tickets + seats + zones + events
export async function getOrder(input) {
  throw notImplemented('booking.getOrder');
}

