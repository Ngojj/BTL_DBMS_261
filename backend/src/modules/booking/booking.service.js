import { AppError } from '../../utils/AppError.js';
import * as repo from './booking.repository.js';

const ensureCustomer = (input) => {
  if (!input?.user?.userId) throw new AppError(401, 'UNAUTHENTICATED', 'Chưa đăng nhập');
  if (input.user.role && input.user.role !== 'CUSTOMER') {
    throw new AppError(403, 'FORBIDDEN', 'Chỉ khách hàng mới được mua hoặc hủy vé');
  }
};

export async function createOrder(input) {
  ensureCustomer(input);
  return repo.createOrder(input);
}

export async function payOrder(input) {
  ensureCustomer(input);
  return repo.payOrder(input);
}

export async function cancelOrder(input) {
  ensureCustomer(input);
  return repo.cancelOrder(input);
}

export async function listMyOrders(input) {
  ensureCustomer(input);
  return repo.listMyOrders(input);
}
