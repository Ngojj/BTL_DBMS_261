import * as repo from './queue.repository.js';
import { AppError } from '../../utils/AppError.js';
import { pool } from '../../config/pg.js';

async function ensureEvent(eventId) {
  const id = Number(eventId);
  if (!Number.isSafeInteger(id) || id <= 0) throw new AppError(400, 'VALIDATION', 'eventId không hợp lệ');
  const { rowCount } = await pool.query('SELECT 1 FROM events WHERE event_id = $1', [id]);
  if (!rowCount) throw new AppError(404, 'NOT_FOUND', 'Sự kiện không tồn tại');
  return id;
}

export async function join({ eventId, user }) {
  const id = await ensureEvent(eventId);
  if (user.role !== 'CUSTOMER') throw new AppError(403, 'FORBIDDEN', 'Chỉ khách hàng mới vào phòng chờ');
  await repo.join(id, user.userId);
  return repo.status(id, user.userId);
}

export async function status({ eventId, user }) {
  return repo.status(await ensureEvent(eventId), user.userId);
}

export async function leave({ eventId, user }) {
  await repo.leave(await ensureEvent(eventId), user.userId);
  return { left: true };
}

export async function admit({ eventId, count }) {
  const n = Number(count ?? 5);
  if (!Number.isInteger(n) || n < 1 || n > 500) throw new AppError(400, 'VALIDATION', 'count phải là số nguyên từ 1 đến 500');
  return repo.admit(await ensureEvent(eventId), n);
}

export async function meta(eventId) {
  return repo.getMeta(await ensureEvent(eventId));
}

export async function reset(eventId) {
  await repo.reset(await ensureEvent(eventId));
  return { reset: true };
}

export async function setEnabled({ eventId, enabled }) {
  if (typeof enabled !== 'boolean') throw new AppError(400, 'VALIDATION', 'enabled phải là true hoặc false');
  return repo.setEnabled(await ensureEvent(eventId), enabled);
}

// Dùng khi tạo đơn: nếu sự kiện bật phòng chờ thì phải đã được cho vào. Firestore lỗi → cho qua (không chặn bán vé).
export async function assertCanBuy(eventId, user) {
  let s;
  try {
    const meta = await repo.getMeta(eventId);
    if (!meta.enabled) return;
    s = await repo.status(eventId, user.userId);
  } catch (err) {
    console.error('[queue] không kiểm tra được phòng chờ, cho qua:', err.message);
    return;
  }
  if (!s.admitted) throw new AppError(403, 'QUEUE_REQUIRED', 'Sự kiện đang dùng phòng chờ ảo, bạn cần xếp hàng và chờ được cho vào');
}
