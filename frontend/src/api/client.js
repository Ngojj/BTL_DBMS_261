// Client gọi API: gắn JWT, parse lỗi { error: { code, message } }
const BASE = import.meta.env.VITE_API_URL || '/api';
const KEY = 'ticketrush_token';

// VITE_USE_MOCK=true: khi API trả 501 NOT_IMPLEMENTED (hoặc backend không chạy) thì dùng dữ liệu mẫu
// trong api/mock.js để xem giao diện. Backend làm xong chức năng nào thì chức năng đó tự dùng API thật.
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

export const getToken = () => localStorage.getItem(KEY);
export const setToken = (t) => (t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY));

export async function api(path, { method = 'GET', body, query } = {}) {
  const qs = query
    ? '?' + new URLSearchParams(Object.entries(query).filter(([, v]) => v != null && v !== ''))
    : '';
  let res;
  try {
    res = await fetch(BASE + path + qs, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(getToken() && { Authorization: 'Bearer ' + getToken() }),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    const err = new Error('Không kết nối được máy chủ');
    err.code = 'NETWORK';
    throw err;
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.error?.message ?? 'Lỗi ' + res.status);
    err.code = data?.error?.code;
    err.status = res.status;
    throw err;
  }
  return data;
}

// Thử gọi API thật; nếu chưa hiện thực / mất kết nối và đang bật USE_MOCK thì dùng dữ liệu mẫu
export async function withMock(real, mock) {
  try {
    return await real();
  } catch (e) {
    if (USE_MOCK && (e.code === 'NOT_IMPLEMENTED' || e.code === 'NETWORK')) return mock();
    throw e;
  }
}
