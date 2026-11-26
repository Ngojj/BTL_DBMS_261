import { AppError } from '../../utils/AppError.js';

// Bốn chiến lược, mỗi chiến lược có cách làm tương ứng trên hai DBMS:
//   none        – đọc ghế trống rồi ghi, không khóa / không transaction (để thấy bán trùng)
//   pessimistic – PostgreSQL SELECT … FOR UPDATE; Firestore runTransaction (Admin SDK dùng khóa bi quan)
//   optimistic  – PostgreSQL cột version + UPDATE … WHERE version = v; Firestore ghi có điều kiện lastUpdateTime
//   skip        – PostgreSQL FOR UPDATE SKIP LOCKED; Firestore runTransaction chọn ngẫu nhiên 1 trong 20 ghế trống
export const STRATEGIES = ['none', 'pessimistic', 'optimistic', 'skip'];

// Giới hạn để một lần chạy không vượt hạn mức miễn phí của Firestore và không chiếm hết kết nối PostgreSQL.
export function parseParams(params = {}) {
  if (params === null || typeof params !== 'object' || Array.isArray(params)) {
    throw new AppError(400, 'VALIDATION', 'params phải là một object');
  }
  const num = (v, d) => (v === undefined || v === '' ? d : Number(v));
  const users = num(params.users, 200);
  const seats = num(params.seats, 50);
  if (!Number.isInteger(users) || users < 2 || users > 1000) throw new AppError(400, 'VALIDATION', 'users phải từ 2 đến 1000');
  if (!Number.isInteger(seats) || seats < 1 || seats > 200) throw new AppError(400, 'VALIDATION', 'seats phải từ 1 đến 200');
  const strategy = params.strategy === undefined || params.strategy === '' ? 'pessimistic' : String(params.strategy);
  if (!STRATEGIES.includes(strategy)) throw new AppError(400, 'VALIDATION', 'strategy phải là một trong ' + STRATEGIES.join(', '));
  return { users, seats, strategy, thinkMs: 5, concurrency: 50 };
}

// Chạy fn cho từng người mua, tối đa `limit` người cùng lúc (giống pool 50 kết nối).
export async function runBuyers(n, limit, fn) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, n) }, async () => {
    while (next < n) { const i = next++; await fn(i + 1); }
  });
  await Promise.all(workers);
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const p95 = (arr) => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); return Math.round(s[Math.ceil(0.95 * s.length) - 1]); };
