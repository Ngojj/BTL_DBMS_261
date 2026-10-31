// Client gọi API: gắn JWT, parse lỗi { error: { code, message } }
const rawBase = import.meta.env.VITE_API_URL;
// Nếu VITE_API_URL để trống hoặc undefined thì mặc định dùng '/api' để khớp với proxy Vite
const BASE = rawBase && rawBase.trim().length > 0 ? rawBase.trim() : '/api';
const KEY = 'ticketrush_token';

export const getToken = () => localStorage.getItem(KEY);
export const setToken = (t) => (t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY));

export async function api(path, { method = 'GET', body, query } = {}) {
  const qs = query ? '?' + new URLSearchParams(Object.entries(query).filter(([, v]) => v != null && v !== '')) : '';
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  // Đảm bảo không bị lặp /api/api nếu path đã có /api
  const targetPath = (BASE === '/api' && normalizedPath.startsWith('/api'))
    ? normalizedPath
    : `${BASE}${normalizedPath}`;

  const res = await fetch(targetPath + qs, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() && { Authorization: 'Bearer ' + getToken() }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Nhận dữ liệu không phải JSON (ví dụ HTML error page)
  }

  if (!res.ok) {
    const message = data?.error?.message || `Lỗi yêu cầu máy chủ (Mã: ${res.status})`;
    const err = new Error(message);
    err.code = data?.error?.code || 'SERVER_ERROR';
    err.status = res.status;
    throw err;
  }

  return data;
}
