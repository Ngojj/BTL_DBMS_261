// Dùng chung cho pg.mjs và fs.mjs: kết nối, đo thời gian, in bảng.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '..', '..'); // thư mục gốc BTL_DBMS

// ---------- Tham số dòng lệnh: --n=500 --seats=50 --think=5 ... ----------
export const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
  const [k, v] = a.slice(2).split('=');
  return [k, v === undefined ? true : (Number.isNaN(Number(v)) ? v : Number(v))];
}));
export const cmd = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'help';

// ---------- PostgreSQL: database riêng ticketrush_cc trong container ticketrush-postgres ----------
export const PG_DB = process.env.PGDATABASE ?? 'ticketrush_cc';
export const pgConfig = (database = PG_DB) => ({
  host: process.env.PGHOST ?? 'localhost',
  port: Number(process.env.PGPORT ?? 5433),
  user: process.env.PGUSER ?? 'ticketrush',
  password: process.env.PGPASSWORD ?? 'ticketrush',
  database,
});
export const newPool = (max = 50) => new pg.Pool({ ...pgConfig(), max });

// ---------- Tiện ích ----------
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const now = () => performance.now();
export const fmt = (x, d = 0) => (typeof x === 'number' ? x.toLocaleString('vi-VN', { maximumFractionDigits: d }) : x);
export function pct(arr, p) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
}
export const median = (arr) => pct(arr, 50);

// Rào chắn cho 2 giao dịch: cả hai đến điểm hẹn rồi mới đi tiếp. Nếu một bên bị chặn (đang chờ khóa)
// thì bên kia không chờ mãi: sau `timeout` ms vẫn đi tiếp – chính khoảng chờ đó cho thấy có khóa.
export function barrier(parties = 2, timeout = 300) {
  let arrived = 0; let release;
  const all = new Promise((r) => { release = r; });
  return async () => {
    if (++arrived >= parties) release();
    await Promise.race([all, sleep(timeout)]);
  };
}

// Mã lỗi PostgreSQL hay gặp trong mục này
export const PG_ERR = { '40001': 'serialization_failure', '40P01': 'deadlock_detected', '23505': 'unique_violation', '55P03': 'lock_not_available' };

export function table(title, rows) {
  console.log(`\n${title}`);
  console.table(rows);
}

// Đọc một biến trong backend/.env.cloud (chỉ lấy đúng biến cần, không in ra màn hình)
export function readEnvVar(file, key) {
  try {
    const line = fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(`${key}=`));
    return line ? line.slice(key.length + 1).trim().replace(/^["']|["']$/g, '') : undefined;
  } catch { return undefined; }
}
