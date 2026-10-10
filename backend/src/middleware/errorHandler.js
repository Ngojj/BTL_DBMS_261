import { AppError } from '../utils/AppError.js';

export function notFound(req, _res, next) {
  next(new AppError(404, 'NOT_FOUND', 'Không tìm thấy ' + req.method + ' ' + req.originalUrl));
}

// Lỗi trả về thống nhất: { error: { code, message } }
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }
  // Lỗi PostgreSQL thường gặp → mã HTTP có nghĩa
  const pgMap = { '23505': [409, 'CONFLICT'], '23503': [409, 'FK_VIOLATION'], '23514': [400, 'CHECK_VIOLATION'], 'P0001': [409, 'RULE_VIOLATION'] };
  if (err.code && pgMap[err.code]) {
    const [status, code] = pgMap[err.code];
    return res.status(status).json({ error: { code, message: err.message } });
  }
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Lỗi hệ thống' } });
}
