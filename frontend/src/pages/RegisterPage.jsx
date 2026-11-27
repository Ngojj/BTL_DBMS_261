// Đăng ký – POST /api/auth/register (tài khoản mới luôn là CUSTOMER)
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { ErrorBox } from '../components/ui.jsx';
import GoogleAuth, { OrDivider } from '../components/GoogleAuth.jsx';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register(form);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-8 max-w-md mx-auto mt-6 space-y-4">
      <h1 className="text-2xl font-extrabold">Đăng ký</h1>
      <GoogleAuth label="Đăng ký bằng Google" onDone={() => navigate('/', { replace: true })} />
      <OrDivider />
      <ErrorBox error={error} />
      <div><label className="label">Họ và tên</label><input required className="input" value={form.fullName} onChange={set('fullName')} /></div>
      <div><label className="label">Email</label><input type="email" required className="input" value={form.email} onChange={set('email')} /></div>
      <div><label className="label">Số điện thoại (9–15 chữ số)</label><input required pattern="[0-9]{9,15}" className="input" value={form.phone} onChange={set('phone')} /></div>
      <div><label className="label">Mật khẩu</label><input type="password" required minLength={6} className="input" value={form.password} onChange={set('password')} /></div>
      <button className="btn-brand w-full py-3" disabled={busy}>{busy ? 'Đang tạo tài khoản…' : 'Tạo tài khoản'}</button>
      <p className="text-sm text-gray-600 text-center">Đã có tài khoản? <Link to="/login" className="font-bold text-brand">Đăng nhập</Link></p>
    </form>
  );
}
