import { AppError } from '../../utils/AppError.js';
import * as repo from './booking.repository.js';
import { publishZonesSummary } from '../sync/sync.publisher.js';

function ensureCustomer(input) {
  if (!input?.user?.userId) throw new AppError(401, 'UNAUTHENTICATED', 'Chưa đăng nhập');
  if (input.user.role !== 'CUSTOMER') throw new AppError(403, 'FORBIDDEN', 'Chỉ khách hàng mới được mua hoặc hủy vé');
}

function bgSync(eventId) {
  if (!eventId) return;
  publishZonesSummary(Number(eventId)).catch((err) =>
    console.error('[sync] publishZonesSummary failed:', err.message),
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

export async function getOrder(input) {
  ensureCustomer(input);
  return repo.getOrder(input);
}
