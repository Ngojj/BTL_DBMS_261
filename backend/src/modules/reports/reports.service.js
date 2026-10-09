// [reports.service] Kiểm tra tham số lọc, đổi dữ liệu từ SQL sang JSON camelCase (số là number). Phụ trách: TV3 (#10, #11)
import { AppError } from '../../utils/AppError.js';
import * as repo from './reports.repository.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// Ngày có thật không: 2026-02-31 qua được regex nhưng không tồn tại, nên đổi sang Date rồi đổi ngược phải ra đúng chuỗi cũ
const isRealDate = (v) => DATE_RE.test(v) && new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) === v;
const MAX_DAYS = 366;
const num = (v) => Number(v ?? 0);
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0); // % làm tròn 1 chữ số

// Ngày hôm nay theo giờ Việt Nam, dạng YYYY-MM-DD
const todayVN = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const addDays = (ymd, n) => {
  const d = new Date(ymd + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000);

// query: eventId (số nguyên dương), from, to (YYYY-MM-DD). Thiếu thì không lọc.
function parseFilters(query = {}) {
  const { eventId, from, to } = query;
  if (eventId != null && eventId !== '' && !/^[1-9]\d*$/.test(String(eventId))) throw new AppError(400, 'VALIDATION', 'eventId không hợp lệ');
  for (const [k, v] of [['from', from], ['to', to]])
    if (v && !isRealDate(v)) throw new AppError(400, 'VALIDATION', k + ' phải có dạng YYYY-MM-DD');
  if (from && to && from > to) throw new AppError(400, 'VALIDATION', '"Từ ngày" phải trước hoặc bằng "Đến ngày"');
  return { eventId: eventId ? Number(eventId) : null, from: from || null, to: to || null };
}

// [h] doanh thu theo sự kiện × khu vực
export async function revenueByZone({ query }) {
  const rows = await repo.revenueByZone({ filters: parseFilters(query) });
  return rows.map((r) => ({ eventId: String(r.event_id), eventTitle: r.event_title, zone: r.zone, ticketsSold: num(r.tickets_sold), revenue: num(r.revenue) }));
}

// [h] doanh thu từng ngày (mặc định 30 ngày gần nhất)
export async function revenueDaily({ query }) {
  const f = parseFilters(query);
  const to = f.to ?? todayVN();
  const from = f.from ?? addDays(to, -29);
  if (daysBetween(from, to) + 1 > MAX_DAYS) throw new AppError(400, 'VALIDATION', 'Khoảng thời gian tối đa ' + MAX_DAYS + ' ngày');
  const rows = await repo.revenueDaily({ filters: { ...f, from, to } });
  return rows.map((r) => ({ day: r.day, orders: num(r.orders), tickets: num(r.tickets), revenue: num(r.revenue) }));
}

// [h] tỷ lệ lấp đầy theo khu vực
export async function occupancyByZone({ query }) {
  const rows = await repo.occupancyByZone({ filters: parseFilters(query) });
  return rows.map((r) => {
    const capacity = num(r.capacity);
    const sold = num(r.sold);
    return { eventId: String(r.event_id), eventTitle: r.event_title, zone: r.zone, capacity, sold, held: num(r.held), rate: pct(sold, capacity) };
  });
}

// Tổng quan: doanh thu, vé, đơn, tỷ lệ hủy, lấp đầy, check-in, top sự kiện
export async function overview({ query }) {
  const { totals, orders, seats, topEvents } = await repo.overview({ filters: parseFilters(query) });
  const byStatus = Object.fromEntries(orders.map((o) => [o.status, num(o.n)]));
  const paid = byStatus.PAID ?? 0;
  const cancelled = byStatus.CANCELLED ?? 0;
  const revenue = num(totals.revenue);
  const tickets = num(totals.tickets);
  return {
    revenue,
    ticketsSold: tickets,
    paidOrders: num(totals.paid_orders),
    avgOrderValue: paid ? Math.round(revenue / paid) : 0,
    avgTicketPrice: tickets ? Math.round(revenue / tickets) : 0,
    orders: { paid, cancelled, expired: byStatus.EXPIRED ?? 0, pending: byStatus.PENDING ?? 0 },
    cancelRate: pct(cancelled, paid + cancelled), // hủy / (đã thanh toán + đã hủy)
    seatCapacity: num(seats.capacity),
    seatsSold: num(seats.sold),
    occupancyRate: pct(num(seats.sold), num(seats.capacity)),
    checkedIn: num(totals.checked_in),
    checkInRate: pct(num(totals.checked_in), tickets),
    topEvents: topEvents.map((e) => ({
      eventId: String(e.event_id), title: e.title, revenue: num(e.revenue), tickets: num(e.tickets),
      share: pct(num(e.revenue), revenue), aboveAverage: e.above_average === true,
    })),
  };
}

// [g] #11 – chưa hiện thực
export async function suspiciousAccounts(input) {
  return repo.suspiciousAccounts(input);
}
