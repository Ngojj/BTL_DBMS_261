// [booking.service] Kiểm tra quyền, gọi repository, đồng bộ Firestore SAU khi transaction PostgreSQL đã commit.
// Logic gốc: nhánh Data-Storage (TV4).
import { AppError } from '../../utils/AppError.js';
import * as repo from './booking.repository.js';
import { assertCanBuy } from '../queue/queue.service.js';
import { syncEventSeats, syncOrderTickets, notifyOrder, inBackground } from '../sync/sync.repository.js';

function ensureCustomer(input) {
  if (!input?.user?.userId) throw new AppError(401, 'UNAUTHENTICATED', 'Chưa đăng nhập');
  if (input.user.role !== 'CUSTOMER') throw new AppError(403, 'FORBIDDEN', 'Chỉ khách hàng mới được mua hoặc hủy vé');
}

// Đồng bộ Firestore – best-effort, không chặn phản hồi và không làm hỏng nghiệp vụ đã commit
function bgSync(eventId, orderId) {
  if (eventId) {
    syncEventSeats(Number(eventId)).catch((err) => console.error('[sync] đồng bộ ghế lỗi, sự kiện', eventId, '-', err.message));
  }
  // Vé của đơn → validTickets (soát vé QR): thanh toán thì thêm, hủy thì xóa
  if (orderId) {
    syncOrderTickets(Number(orderId)).catch((err) => console.error('[sync] đồng bộ vé lỗi, đơn', orderId, '-', err.message));
  }
}

export async function createOrder(input) {
  ensureCustomer(input);
  await assertCanBuy(Number(input.body?.eventId), input.user); // phòng chờ ảo (#3)
  const result = await repo.createOrder(input);
  bgSync(result.eventId);
  return result;
}

export async function getOrder(input) {
  ensureCustomer(input);
  return repo.getOrder(input);
}

export async function payOrder(input) {
  ensureCustomer(input);
  const result = await repo.payOrder(input);
  bgSync(result.eventId, result.orderId);
  // Chỉ báo khi vừa thanh toán thật sự (không báo lại khi gọi lần hai, không báo khi đơn đã hết hạn)
  if (result.paid && !result.already) inBackground('thông báo thanh toán', notifyOrder(result.orderId, 'PAID'));
  return result;
}

export async function cancelOrder(input) {
  ensureCustomer(input);
  const result = await repo.cancelOrder(input);
  bgSync(result.eventId, result.orderId);
  if (result.cancelled && !result.already) inBackground('thông báo hủy đơn', notifyOrder(result.orderId, 'CANCELLED'));
  return result;
}

export async function listMyOrders(input) {
  ensureCustomer(input);
  return repo.listMyOrders(input);
}
