import { api } from './client.js';

export const authApi = {
  login: (body) => api('/auth/login', { method: 'POST', body }),
  register: (body) => api('/auth/register', { method: 'POST', body }),
  // body: { idToken, phone? } – lần đầu (email chưa có) backend trả 409 PHONE_REQUIRED, gọi lại kèm phone
  google: (body) => api('/auth/google', { method: 'POST', body }),
  me: () => api('/auth/me'),
  firebaseToken: () => api('/auth/firebase-token', { method: 'POST' }),
};
