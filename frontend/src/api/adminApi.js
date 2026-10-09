import { api, withMock } from './client.js';
import * as mock from './mock.js';

export const adminApi = {
  revenue: (query) => withMock(() => api('/admin/reports/revenue', { query }), () => mock.revenue()),
  occupancy: (query) => withMock(() => api('/admin/reports/occupancy', { query }), () => mock.occupancy()),
  suspicious: () => withMock(() => api('/admin/reports/suspicious-accounts'), () => mock.suspicious()),
  resyncEvent: (eventId) => api('/admin/sync/events/' + eventId, { method: 'POST' }),
  resyncAll: () => api('/admin/sync/all', { method: 'POST' }),
};
