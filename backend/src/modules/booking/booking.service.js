// TODO [booking.service] Phụ trách: TV4 (#4, #5)
import * as repo from './booking.repository.js';

// Nghiệp vụ + điều phối transaction. Không viết SQL ở đây (SQL nằm trong repository).

// TODO [a] #4 – giữ ghế (SELECT … FOR UPDATE) → tạo đơn + vé PENDING. Khóa users FOR UPDATE trước khi đếm giới hạn vé
export async function createOrder(input) {
  return repo.createOrder(input);
}

// TODO [a,c] #4 – thanh toán giả lập: insert payments, update orders/seats/tickets; sau COMMIT gọi sync
export async function payOrder(input) {
  return repo.payOrder(input);
}

// TODO [c] #5 – hủy đơn, hoàn vé, trả ghế về AVAILABLE
export async function cancelOrder(input) {
  return repo.cancelOrder(input);
}

// TODO [d] Đơn hàng của tôi
export async function listMyOrders(input) {
  return repo.listMyOrders(input);
}
// TODO [f] chi tiết đơn của chính người dùng (kiểm tra order.user_id = user.userId)
export async function getOrder(input) {
  return repo.getOrder(input);
}

