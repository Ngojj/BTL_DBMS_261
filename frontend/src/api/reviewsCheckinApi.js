import { api } from './client.js';

export const reviewsApi = {
  list:   (eventId)          => api('/events/' + eventId + '/reviews'),
  create: (eventId, body)    => api('/events/' + eventId + '/reviews', { method: 'POST', body }),
};

export const checkinApi = {
  lookup:  (qrCode) => api('/checkin/' + encodeURIComponent(qrCode)),
  checkin: (qrCode) => api('/checkin/' + encodeURIComponent(qrCode), { method: 'POST' }),
};
