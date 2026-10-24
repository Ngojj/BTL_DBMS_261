import { api } from './client.js';

export const ticketsApi = {
  mine:   ()         => api('/tickets'),
  cancel: (orderId)  => api(`/orders/${orderId}/cancel`, { method: 'POST' }),
};
