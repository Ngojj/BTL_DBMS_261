export class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Dùng trong các hàm chưa hiện thực (placeholder) – trả 501 thay vì crash
export const notImplemented = (what) =>
  new AppError(501, 'NOT_IMPLEMENTED', 'Chưa hiện thực: ' + what);
