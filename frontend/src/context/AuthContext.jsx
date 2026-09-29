import { createContext, useContext, useEffect, useState } from 'react';
import { authApi } from '../api/authApi.js';
import { setToken, getToken } from '../api/client.js';
// TODO [AuthContext] TV5: sau khi đăng nhập, gọi authApi.firebaseToken() rồi signInWithCustomToken (lib/firebase.js)

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) return setLoading(false);
    authApi.me().then(setUser).catch(() => setToken(null)).finally(() => setLoading(false));
  }, []);

  async function login(credentials) {
    const { token, user: u } = await authApi.login(credentials);
    setToken(token);
    setUser(u);
    return u;
  }
  async function register(data) {
    const { token, user: u } = await authApi.register(data);
    setToken(token);
    setUser(u);
    return u;
  }
  function logout() {
    setToken(null);
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>;
}
