import { api } from './client.js';

// [#3] Phòng chờ ảo
export const queueApi = {
  join: (eventId) => api(`/events/${eventId}/queue/join`, { method: 'POST' }),
  status: (eventId) => api(`/events/${eventId}/queue/status`),
  leave: (eventId) => api(`/events/${eventId}/queue/leave`, { method: 'POST' }),
  // Quản trị
  meta: (eventId) => api(`/events/${eventId}/queue`),
  setEnabled: (eventId, enabled) => api(`/events/${eventId}/queue`, { method: 'PUT', body: { enabled } }),
  admit: (eventId, count) => api(`/events/${eventId}/queue/admit`, { method: 'POST', body: { count } }),
  reset: (eventId) => api(`/events/${eventId}/queue`, { method: 'DELETE' }),
};
