import { api } from './client.js';

export const adminApi = {
  revenue: (query) => api('/admin/reports/revenue', { query }),
  occupancy: (query) => api('/admin/reports/occupancy', { query }),
  suspicious: () => api('/admin/reports/suspicious-accounts'),
  resyncEvent: (eventId) => api('/admin/sync/events/' + eventId, { method: 'POST' }),
  resyncAll: () => api('/admin/sync/all', { method: 'POST' }),
};
