// Dùng chung cho hai DBMS: kiểm tra tham số và sinh cùng một bộ dữ liệu thử.
import { randomUUID } from 'node:crypto';
import { AppError } from '../../utils/AppError.js';

// model chỉ ảnh hưởng phía Firestore; PostgreSQL luôn lưu chuẩn hóa.
//   current      – như TicketRush hiện tại: validTickets/{qr} + events/{id}, "vé của tôi" đọc 2N document (mục 3.1.5)
//   denormalized – users/{uid}/myTickets/{ticketId} chép sẵn tên sự kiện, nhà thi đấu, khu, ghế: một truy vấn, N document
export const MODELS = ['current', 'denormalized'];

export function parseParams(params = {}) {
  if (params === null || typeof params !== 'object' || Array.isArray(params)) {
    throw new AppError(400, 'VALIDATION', 'params phải là một object');
  }
  const num = (v, d) => (v === undefined || v === '' ? d : Number(v));
  const tickets = num(params.tickets, 1000);
  const myTickets = num(params.myTickets, 4);
  if (!Number.isInteger(tickets) || tickets < 10 || tickets > 5000) throw new AppError(400, 'VALIDATION', 'tickets phải từ 10 đến 5000');
  if (!Number.isInteger(myTickets) || myTickets < 1 || myTickets > 50 || myTickets > tickets) {
    throw new AppError(400, 'VALIDATION', 'myTickets phải từ 1 đến 50 và không lớn hơn tickets');
  }
  const model = params.model === undefined || params.model === '' ? 'current' : String(params.model);
  if (!MODELS.includes(model)) throw new AppError(400, 'VALIDATION', 'model phải là current hoặc denormalized');
  return { tickets, myTickets, model };
}

// Một sự kiện, 4 khu, N ghế đã bán hết thành N vé. Khách số 1 giữ `myTickets` vé đầu, những người khác mỗi người 2 vé.
export function makeFixture(n, myTickets) {
  const zones = [['VIP', 3500000], ['CAT 1', 2500000], ['CAT 2', 1800000], ['CAT 3', 1200000]]
    .map(([name, price], i) => ({ id: i + 1, name, price }));
  const event = { id: 1, title: 'TicketRush Lab – Đêm nhạc Data Storage', date: '2026-12-31T20:00:00+07:00', venue: 'Nhà thi đấu Phú Thọ', city: 'TP.HCM' };
  const seats = []; const tickets = []; const users = new Map(); const orders = new Map();
  for (let i = 1; i <= n; i++) {
    const zi = Math.min(3, Math.floor(((i - 1) * 4) / n));
    const zone = zones[zi];
    const k = i - 1 - Math.ceil((zi * n) / 4); // thứ tự ghế trong khu, mỗi hàng 30 ghế: A, B, …, Z, AA, AB, …
    const r = Math.floor(k / 30);
    const row = (r >= 26 ? String.fromCharCode(64 + Math.floor(r / 26)) : '') + String.fromCharCode(65 + (r % 26));
    const seat = { id: i, zoneId: zone.id, row, no: (k % 30) + 1 };
    const userId = i <= myTickets ? 1 : 2 + Math.floor((i - myTickets - 1) / 2);
    if (!users.has(userId)) users.set(userId, { id: userId, fullName: userId === 1 ? 'Nguyễn Văn An' : `Khách ${userId}`, email: `khach${userId}@example.com` });
    if (!orders.has(userId)) orders.set(userId, { id: userId, userId });
    seats.push(seat);
    tickets.push({ id: i, orderId: userId, seatId: i, userId, qr: randomUUID(), price: zone.price, zone: zone.name, seatLabel: `${zone.name} – ${row}${seat.no}` });
  }
  return { event, zones, seats, tickets, users: [...users.values()], orders: [...orders.values()] };
}

// Giá Firestore bản Standard (tham khảo, tháng 11/2026): 0,06 USD / 100.000 lượt đọc.
export const USD_PER_READ = 0.06 / 100000;
export const PAGE_VIEWS = 100000;
export const fmtUsd = (x) => '$' + (Math.round(x * 100) / 100).toFixed(2);

// Dung lượng một document theo công thức của Firestore: https://firebase.google.com/docs/firestore/storage-size
const strSize = (s) => Buffer.byteLength(String(s), 'utf8') + 1;
function valueSize(v) {
  if (v === null || v === undefined) return 1;
  if (typeof v === 'boolean') return 1;
  if (typeof v === 'number') return 8;
  if (typeof v === 'string') return strSize(v);
  if (v instanceof Date) return 8;
  if (Array.isArray(v)) return v.reduce((s, x) => s + valueSize(x), 0);
  return Object.entries(v).reduce((s, [k, x]) => s + strSize(k) + valueSize(x), 0);
}
export const docSize = (path, data) =>
  path.split('/').reduce((s, seg) => s + strSize(seg), 0) + 16 + valueSize(data) + 32;

