import { api } from './client.js';

// TODO TV1/TV2: bổ sung tham số lọc (genreId, city, dateFrom, dateTo, priceMin, priceMax)
export const eventsApi = {
  genres: () => api('/events/genres'),
  list: (query) => api('/events', { query }),
  get: (id) => api('/events/' + id),
  create: (body) => api('/events', { method: 'POST', body }),
  update: (id, body) => api('/events/' + id, { method: 'PUT', body }),
  remove: (id) => api('/events/' + id, { method: 'DELETE' }),
  zones: (eventId) => api('/events/' + eventId + '/zones'),
  reviews: (eventId) => api('/events/' + eventId + '/reviews'),
  reviewSummary: (eventId) => api('/events/' + eventId + '/reviews/summary'),
  addReview: (eventId, body) => api('/events/' + eventId + '/reviews', { method: 'POST', body }),
};
