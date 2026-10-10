import { api } from './client.js';

export const labsApi = {
  run: (topic, params) => api('/admin/labs/' + topic + '/run', { method: 'POST', body: { params } }),
  runs: (topic) => api('/admin/labs/' + topic + '/runs'),
};
