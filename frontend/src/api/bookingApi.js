import { api } from './client.js';

export const bookingApi = {
  createOrder: (body) => api('/orders', { method: 'POST', body }), // { eventId, seatIds }
  pay: (orderId, body) => api('/orders/' + orderId + '/pay', { method: 'POST', body }),
  cancel: (orderId) => api('/orders/' + orderId + '/cancel', { method: 'POST' }),
  mine: () => api('/orders'),
};
