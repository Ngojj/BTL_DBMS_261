import { AppError } from '../../utils/AppError.js';

// Trần 2.000: mỗi lần chạy ghi khoảng 2N document vào Firestore (gói miễn phí chỉ có 20.000 lượt ghi/ngày) và cách A cần hàng trăm truy vấn nối tiếp.
export const TICKET_OPTIONS = [500, 1000, 2000];
export const APPROACHES = ['A', 'B', 'C', 'D'];

// Dùng chung cho HTTP, PostgreSQL và Firestore. Trả 400 trước khi chạm vào CSDL.
export function parseParams(params = {}) {
  if (params === null || typeof params !== 'object' || Array.isArray(params)) {
    throw new AppError(400, 'VALIDATION', 'params phải là một object');
  }
  const tickets = params.tickets === undefined || params.tickets === '' ? 1000 : Number(params.tickets);
  if (!TICKET_OPTIONS.includes(tickets)) {
    throw new AppError(400, 'VALIDATION', 'tickets phải là một trong ' + TICKET_OPTIONS.join(', '));
  }
  const approach = params.approach === undefined || params.approach === '' ? 'C' : String(params.approach).toUpperCase();
  if (!APPROACHES.includes(approach)) {
    throw new AppError(400, 'VALIDATION', 'approach phải là một trong ' + APPROACHES.join(', '));
  }
  return { tickets, approach };
}
