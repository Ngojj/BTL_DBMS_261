import { api } from './client.js';

export const queueApi = {
  join:   (eventId)        => api(`/events/${eventId}/queue/join`, { method: 'POST' }),
  status: (eventId)        => api(`/events/${eventId}/queue/status`),
  leave:  (eventId)        => api(`/events/${eventId}/queue/leave`, { method: 'POST' }),
  admit:  (eventId, count) => api(`/events/${eventId}/queue/admit`, { method: 'POST', body: { count } }),
};

