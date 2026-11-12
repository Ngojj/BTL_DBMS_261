import { createContext, useContext, useEffect, useState } from 'react';
import { signInWithCustomToken, signOut } from 'firebase/auth';
import { authApi } from '../api/authApi.js';
import { getToken, setToken } from '../api/client.js';
import { auth as firebaseAuth } from '../lib/firebase.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

// Đăng nhập Firebase bằng custom token (claim role) để Security Rules nhận ra STAFF.
// Trả về true nếu đăng nhập được. Lỗi thì bỏ qua: các trang chỉ đọc Firestore công khai vẫn chạy.
async function connectFirebase() {
  try {
    const { token } = await authApi.firebaseToken();
    await signInWithCustomToken(firebaseAuth, token);
    return true;
  } catch {
    /* Emulator chưa chạy hoặc backend chưa cấp token */
    return false;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // true khi đã đăng nhập Firebase xong (Security Rules cần). Trang đọc dữ liệu theo vai trò (soát vé) phải chờ cờ này.
  const [firebaseReady, setFirebaseReady] = useState(false);

  const connect = () => connectFirebase().then(setFirebaseReady);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then((u) => {
        setUser(u);
        connect();
      })
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  async function authenticate(fn, payload) {
    const { token, user: u } = await fn(payload);
    setToken(token);
    setUser(u);
    connect();
    return u;
  }

  const value = {
    user,
    loading,
    firebaseReady,
    login: (credentials) => authenticate(authApi.login, credentials),
    register: (data) => authenticate(authApi.register, data),
    loginWithGoogle: (payload) => authenticate(authApi.google, payload), // { idToken, phone? }
    logout() {
      setToken(null);
      setUser(null);
      setFirebaseReady(false);
      signOut(firebaseAuth).catch(() => {});
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
