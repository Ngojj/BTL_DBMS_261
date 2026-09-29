// Chuyển lỗi của handler async vào errorHandler tập trung
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
