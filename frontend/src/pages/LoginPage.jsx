import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function performLogin(loginEmail, loginPassword) {
    setBusy(true);
    setError('');
    try {
      await login({ email: loginEmail, password: loginPassword });
      navigate(location.state?.from ?? '/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function submit(event) {
    event.preventDefault();
    performLogin(email, password);
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-950">Đăng nhập</h1>
        <p className="mt-1 text-sm text-gray-600">Đăng nhập để đặt vé hoặc quản trị hệ thống.</p>
      </header>

      {/* Đăng nhập nhanh 1 chạm */}
      <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-900">
            ⚡ Đăng nhập nhanh (Mật khẩu: 123456)
          </p>
          <span className="text-[11px] bg-indigo-200/70 text-indigo-800 px-2 py-0.5 rounded-full font-medium">1 chạm</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setEmail('admin@ticketrush.vn');
              setPassword('123456');
              performLogin('admin@ticketrush.vn', '123456');
            }}
            className="flex flex-col items-center justify-center p-2 rounded-lg border border-indigo-200 bg-white hover:bg-indigo-50 hover:border-indigo-400 transition text-center shadow-sm disabled:opacity-50"
          >
            <span className="text-xs font-bold text-gray-900">👑 Admin</span>
            <span className="text-[10px] text-gray-500 truncate w-full">admin</span>
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setEmail('alice@example.com');
              setPassword('123456');
              performLogin('alice@example.com', '123456');
            }}
            className="flex flex-col items-center justify-center p-2 rounded-lg border border-indigo-200 bg-white hover:bg-indigo-50 hover:border-indigo-400 transition text-center shadow-sm disabled:opacity-50"
          >
            <span className="text-xs font-bold text-gray-900">🎫 Khách hàng</span>
            <span className="text-[10px] text-gray-500 truncate w-full">alice</span>
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setEmail('staff@ticketrush.vn');
              setPassword('123456');
              performLogin('staff@ticketrush.vn', '123456');
            }}
            className="flex flex-col items-center justify-center p-2 rounded-lg border border-indigo-200 bg-white hover:bg-indigo-50 hover:border-indigo-400 transition text-center shadow-sm disabled:opacity-50"
          >
            <span className="text-xs font-bold text-gray-900">👮 Soát vé</span>
            <span className="text-[10px] text-gray-500 truncate w-full">staff</span>
          </button>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <label className="grid gap-1 text-sm font-medium">
          Email
          <input
            required
            type="email"
            placeholder="admin@ticketrush.vn hoặc alice@example.com"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Mật khẩu
          <input
            required
            type="password"
            placeholder="123456"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none"
          />
          <span className="text-[11px] text-gray-500 font-normal">
            💡 Mật khẩu mặc định của tất cả tài khoản mẫu: <strong>123456</strong>
          </span>
        </label>
        {error && <p role="alert" className="text-sm text-red-700 bg-red-50 p-2.5 rounded border border-red-200">{error}</p>}
        <button
          disabled={busy}
          className="w-full rounded-lg bg-indigo-700 px-4 py-2.5 font-semibold text-white hover:bg-indigo-800 disabled:opacity-50 shadow-sm transition"
        >
          {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </button>
      </form>
      <p className="text-sm text-gray-600">
        Chưa có tài khoản?{' '}
        <Link to="/register" className="font-medium text-indigo-700 underline">
          Đăng ký ngay
        </Link>
      </p>
    </div>
  );
}
