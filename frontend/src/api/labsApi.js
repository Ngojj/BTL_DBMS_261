import { api } from './client.js';

// DBMS Lab luôn gọi API thật – không có dữ liệu mẫu (số liệu giả sẽ làm sai báo cáo)
export const labsApi = {
  run: (topic, params) => api('/admin/labs/' + topic + '/run', { method: 'POST', body: { params } }),
  runs: (topic) => api('/admin/labs/' + topic + '/runs'),
};
