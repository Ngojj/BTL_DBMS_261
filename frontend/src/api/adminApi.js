import { api, withMock } from './client.js';
import * as mock from './mock.js';

export const adminApi = {
  // Tham số lọc chung: { eventId, from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' }
  // { revenue, ticketsSold, paidOrders, avgOrderValue, avgTicketPrice, orders: { paid, cancelled, expired, pending },
  //   cancelRate, seatCapacity, seatsSold, occupancyRate, checkedIn, checkInRate,
  //   topEvents: [{ eventId, title, revenue, tickets, share, aboveAverage }] }
  overview: (query) => withMock(() => api('/admin/reports/overview', { query }), () => mock.overview(query)),
  // [{ eventId, eventTitle, zone, ticketsSold, revenue }]
  revenue: (query) => withMock(() => api('/admin/reports/revenue', { query }), () => mock.revenue(query)),
  // [{ day: 'YYYY-MM-DD', orders, tickets, revenue }] – đủ mọi ngày trong khoảng, mặc định 30 ngày gần nhất
  revenueDaily: (query) => withMock(() => api('/admin/reports/revenue/daily', { query }), () => mock.revenueDaily(query)),
  // [{ eventId, eventTitle, zone, capacity, sold, held, rate }]
  occupancy: (query) => withMock(() => api('/admin/reports/occupancy', { query }), () => mock.occupancy(query)),
  // [{ userId, email, fullName, phone, ticketCount, sharedPhoneAccounts, atLimitEvents, level: 'HIGH'|'MEDIUM',
  //    signals: [{ type: OVER_LIMIT|GROUP_OVER_LIMIT|SHARED_PHONE|REPEAT_AT_LIMIT, text }], reason }]
  suspicious: () => withMock(() => api('/admin/reports/suspicious-accounts'), () => mock.suspicious()),
  resyncEvent: (eventId) => api('/admin/sync/events/' + eventId, { method: 'POST' }),
  resyncAll: () => api('/admin/sync/all', { method: 'POST' }),
};
