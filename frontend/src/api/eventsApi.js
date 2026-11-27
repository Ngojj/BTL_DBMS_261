import { api, withMock } from './client.js';
import * as mock from './mock.js';

// query: { genreId, city, dateFrom, dateTo, priceMax }  (#1 lọc thể loại, #2 lọc kết hợp)
export const eventsApi = {
  genres: () => withMock(() => api('/events/genres'), () => mock.genres),
  list: (query) => withMock(() => api('/events', { query }), () => mock.listEvents(query)),
  get: (id) => withMock(() => api('/events/' + id), () => mock.getEvent(id)),
  create: (body) => api('/events', { method: 'POST', body }),
  update: (id, body) => api('/events/' + id, { method: 'PUT', body }),
  remove: (id) => api('/events/' + id, { method: 'DELETE' }),

  zones: (eventId) => withMock(() => api('/events/' + eventId + '/zones'), () => mock.getEvent(eventId).zones),
  createZone: (eventId, body) => api('/events/' + eventId + '/zones', { method: 'POST', body }),
  updateZone: (zoneId, body) => api('/zones/' + zoneId, { method: 'PUT', body }),
  removeZone: (zoneId) => api('/zones/' + zoneId, { method: 'DELETE' }),
  generateSeats: (zoneId, body) => api('/zones/' + zoneId + '/generate-seats', { method: 'POST', body }),

  // [{ reviewId, userName, rating, comment, createdAt }]
  reviews: (eventId) => withMock(() => api('/events/' + eventId + '/reviews'), () => mock.listReviews(eventId)),
  // { average, count }
  reviewSummary: (eventId) => withMock(() => api('/events/' + eventId + '/reviews/summary'), () => mock.reviewSummary(eventId)),
  // body { rating: 1–5, comment } – mỗi người một đánh giá / sự kiện (trùng → 409)
  addReview: (eventId, body, user) => withMock(() => api('/events/' + eventId + '/reviews', { method: 'POST', body }), () => mock.addReview(eventId, body, user)),
};
