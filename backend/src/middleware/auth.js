import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

// Đọc "Authorization: Bearer <jwt>" → req.user = { userId, role }
export function authenticate(req, _res, next) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new AppError(401, 'UNAUTHENTICATED', 'Chưa đăng nhập'));
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.user = { userId: payload.userId, role: payload.role };
    next();
  } catch {
    next(new AppError(401, 'INVALID_TOKEN', 'Token không hợp lệ hoặc đã hết hạn'));
  }
}

// Phân quyền theo role: authorize('ADMIN'), authorize('STAFF', 'ADMIN')
export const authorize = (...roles) => (req, _res, next) =>
  roles.includes(req.user?.role)
    ? next()
    : next(new AppError(403, 'FORBIDDEN', 'Không đủ quyền truy cập'));
