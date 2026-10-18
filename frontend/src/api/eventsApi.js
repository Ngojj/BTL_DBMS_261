import { api } from './client.js';

export const eventsApi = {
  list: (query) => api('/events', { query }),
  get: (id) => api('/events/' + id),
  zones: (eventId) => api('/events/' + eventId + '/zones'),
  seats: (zoneId) => api('/zones/' + zoneId + '/seats'),
};
