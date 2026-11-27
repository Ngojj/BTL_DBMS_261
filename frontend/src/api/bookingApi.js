import { api, withMock } from './client.js';
import * as mock from './mock.js';

export const bookingApi = {
  // { eventId, seatIds } → order { orderId, expiresAt, total, items: [{ seatId, seatLabel, zone, price }], ... }
  // seatInfo chỉ dùng cho dữ liệu mẫu: [{ seatId, row, number, zone, price }]
  createOrder: (body, user, seatInfo) => withMock(() => api('/orders', { method: 'POST', body }), () => mock.createOrder(body, user, seatInfo)),
  getOrder: (orderId) => withMock(() => api('/orders/' + orderId), () => mock.getOrder(orderId)),
  // body: { method: 'CARD' | 'E_WALLET' | 'BANK_TRANSFER', buyer: { fullName, phone, email }, simulateFailure? }
  pay: (orderId, body) => withMock(() => api('/orders/' + orderId + '/pay', { method: 'POST', body }), () => mock.payOrder(orderId)),
  cancel: (orderId) => withMock(() => api('/orders/' + orderId + '/cancel', { method: 'POST' }), () => mock.cancelOrder(orderId)),
  mine: () => api('/orders'),
  // [ { ticketId, orderId, qrCode, status, eventId, eventTitle, eventDate, venueName, zone, seatLabel, holderName, gate } ]
  myTickets: () => withMock(() => api('/tickets/mine'), () => mock.myTickets()),
};
