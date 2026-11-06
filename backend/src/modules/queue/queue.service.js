import * as repo from './queue.repository.js';
import * as eventsRepo from '../events/events.repository.js';
import { AppError } from '../../utils/AppError.js';

export async function joinQueue({ eventId, user }) {
  if (!user?.userId) throw new AppError(401, 'UNAUTHENTICATED', 'Cần đăng nhập để vào phòng chờ');
  // Đảm bảo sự kiện tồn tại
  const event = await eventsRepo.getEvent({ params: { eventId } });
  if (!event) throw new AppError(404, 'NOT_FOUND', 'Sự kiện không tồn tại');

  return repo.joinQueue({
    eventId,
    userId: user.userId,
    fullName: user.fullName || user.email,
  });
}

export async function getQueueStatus({ eventId, user }) {
  if (!user?.userId) throw new AppError(401, 'UNAUTHENTICATED', 'Cần đăng nhập');
  return repo.getQueueStatus({ eventId, userId: user.userId });
}

export async function admitUsers({ eventId, count, user }) {
  if (user?.role !== 'ADMIN') throw new AppError(403, 'FORBIDDEN', 'Chỉ Admin mới có quyền mở cổng hàng đợi');
  const admitCount = Math.max(1, Math.min(Number(count) || 5, 50));
  return repo.admitUsers({ eventId, count: admitCount });
}

export async function leaveQueue({ eventId, user }) {
  if (!user?.userId) throw new AppError(401, 'UNAUTHENTICATED', 'Cần đăng nhập');
  return repo.leaveQueue({ eventId, userId: user.userId });
}

