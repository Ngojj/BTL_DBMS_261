// Đăng nhập – POST /api/auth/login
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { ErrorBox } from '../components/ui.jsx';
import GoogleAuth, { OrDivider } from '../components/GoogleAuth.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // Quay lại trang đang xem dở; không có thì về trang mặc định theo vai trò
  const goNext = (u) =>
    navigate(location.state?.from ?? (u.role === 'ADMIN' ? '/admin' : u.role === 'STAFF' ? '/staff/checkin' : '/'), { replace: true });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      goNext(await login(form));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-8 max-w-md mx-auto mt-6 space-y-4">
      <h1 className="text-2xl font-extrabold">Đăng nhập</h1>
      <GoogleAuth onDone={goNext} />
      <OrDivider />
      <ErrorBox error={error} />
      <div><label className="label">Email</label><input type="email" required className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
      <div><label className="label">Mật khẩu</label><input type="password" required className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
      <button className="btn-brand w-full py-3" disabled={busy}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
      <p className="text-sm text-gray-600 text-center">Chưa có tài khoản? <Link to="/register" className="font-bold text-brand">Đăng ký</Link></p>
    </form>
  );
}
