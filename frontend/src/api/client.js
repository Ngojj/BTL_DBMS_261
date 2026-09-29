// Client gọi API: gắn JWT, parse lỗi { error: { code, message } }
const BASE = import.meta.env.VITE_API_URL ?? '/api';
const KEY = 'ticketrush_token';

export const getToken = () => localStorage.getItem(KEY);
export const setToken = (t) => (t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY));

export async function api(path, { method = 'GET', body, query } = {}) {
  const qs = query ? '?' + new URLSearchParams(Object.entries(query).filter(([, v]) => v != null && v !== '')) : '';
  const res = await fetch(BASE + path + qs, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() && { Authorization: 'Bearer ' + getToken() }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.error?.message ?? 'Lỗi ' + res.status);
    err.code = data?.error?.code;
    err.status = res.status;
    throw err;
  }
  return data;
}
