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

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login({ email, password });
      navigate(location.state?.from ?? '/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <header><h1 className="text-2xl font-bold text-gray-950">Đăng nhập</h1><p className="mt-1 text-sm text-gray-600">Đăng nhập để tiếp tục đặt vé.</p></header>
      <form onSubmit={submit} className="space-y-4">
        <label className="grid gap-1 text-sm font-medium">Email<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="rounded border border-gray-300 px-3 py-2" /></label>
        <label className="grid gap-1 text-sm font-medium">Mật khẩu<input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="rounded border border-gray-300 px-3 py-2" /></label>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button disabled={busy} className="w-full rounded bg-indigo-700 px-4 py-2.5 font-semibold text-white disabled:opacity-50">{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
      </form>
      <p className="text-sm text-gray-600">Chưa có tài khoản? <Link to="/register" className="font-medium text-indigo-700 underline">Đăng ký</Link></p>
    </div>
  );
}
