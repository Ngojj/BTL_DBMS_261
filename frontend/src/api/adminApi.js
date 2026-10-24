import { api } from './client.js';

export const adminApi = {
  // Events
  listEvents:  ()              => api('/admin/events'),
  createEvent: (body)          => api('/admin/events', { method: 'POST', body }),
  updateEvent: (id, body)      => api('/admin/events/' + id, { method: 'PATCH', body }),
  deleteEvent: (id)            => api('/admin/events/' + id, { method: 'DELETE' }),
  // Zones
  createZone:  (eventId, body) => api('/admin/events/' + eventId + '/zones', { method: 'POST', body }),
  updateZone:  (zoneId, body)  => api('/admin/zones/' + zoneId, { method: 'PATCH', body }),
  deleteZone:  (zoneId)        => api('/admin/zones/' + zoneId, { method: 'DELETE' }),
  // Lookups
  genres:  () => api('/admin/genres'),
  venues:  () => api('/admin/venues'),
  // Reports
  revenue: (eventId) => api('/reports/revenue', { query: eventId ? { eventId } : {} }),
  scalpers: () => api('/reports/scalpers'),
};
