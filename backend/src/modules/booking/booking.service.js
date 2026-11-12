// [booking.service] Kiểm tra quyền, gọi repository, đồng bộ Firestore SAU khi transaction PostgreSQL đã commit.
// Logic gốc: nhánh Data-Storage (TV4).
import { AppError } from '../../utils/AppError.js';
import * as repo from './booking.repository.js';
import { syncEventSeats } from '../sync/sync.repository.js';

function ensureCustomer(input) {
  if (!input?.user?.userId) throw new AppError(401, 'UNAUTHENTICATED', 'Chưa đăng nhập');
  if (input.user.role !== 'CUSTOMER') throw new AppError(403, 'FORBIDDEN', 'Chỉ khách hàng mới được mua hoặc hủy vé');
}

// Đồng bộ Firestore – best-effort, không chặn phản hồi và không làm hỏng nghiệp vụ đã commit
function bgSync(eventId) {
  if (!eventId) return;
  syncEventSeats(Number(eventId)).catch((err) => console.error('[sync] đồng bộ ghế lỗi, sự kiện', eventId, '-', err.message));
}

export async function createOrder(input) {
  ensureCustomer(input);
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
  bgSync(result.eventId);
  return result;
}

export async function cancelOrder(input) {
  ensureCustomer(input);
  const result = await repo.cancelOrder(input);
  bgSync(result.eventId);
  return result;
}

export async function listMyOrders(input) {
  ensureCustomer(input);
  return repo.listMyOrders(input);
}
