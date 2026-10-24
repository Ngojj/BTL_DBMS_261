import { AppError } from '../../utils/AppError.js';
import * as repo from './booking.repository.js';
import { syncEventSeats } from '../sync/sync.repository.js';

function ensureCustomer(input) {
  if (!input?.user?.userId) throw new AppError(401, 'UNAUTHENTICATED', 'Chưa đăng nhập');
  if (input.user.role !== 'CUSTOMER') throw new AppError(403, 'FORBIDDEN', 'Chỉ khách hàng mới được mua hoặc hủy vé');
}

// Đồng bộ Firestore sau transaction – best-effort, không block response
function bgSync(eventId) {
  if (!eventId) return;
  syncEventSeats(Number(eventId)).catch((err) =>
    console.error('[sync] seat sync failed for event', eventId, err.message),
  );
}

export async function createOrder(input) {
  ensureCustomer(input);
  const result = await repo.createOrder(input);
  bgSync(result.eventId);
  return result;
}

export async function payOrder(input) {
  ensureCustomer(input);
  const result = await repo.payOrder(input);
  // Lấy eventId từ order để sync
  const orders = await repo.listMyOrders(input);
  const order = orders.find((o) => o.orderId === String(result.orderId ?? input.params?.orderId));
  bgSync(order?.eventId);
  return result;
}

export async function cancelOrder(input) {
  ensureCustomer(input);
  const orders = await repo.listMyOrders(input);
  const orderId = String(input.params?.orderId ?? input.body?.orderId);
  const order = orders.find((o) => o.orderId === orderId);
  const result = await repo.cancelOrder(input);
  bgSync(order?.eventId);
  return result;
}

export async function listMyOrders(input) {
  ensureCustomer(input);
  return repo.listMyOrders(input);
}
