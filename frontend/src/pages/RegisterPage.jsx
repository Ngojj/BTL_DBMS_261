import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '' });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function update(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    if (form.password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await register(form);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <header><h1 className="text-2xl font-bold text-gray-950">Tạo tài khoản</h1><p className="mt-1 text-sm text-gray-600">Tài khoản mới có vai trò khách hàng.</p></header>
      <form onSubmit={submit} className="space-y-4">
        <label className="grid gap-1 text-sm font-medium">Họ và tên<input required maxLength="100" autoComplete="name" value={form.fullName} onChange={(event) => update('fullName', event.target.value)} className="rounded border border-gray-300 px-3 py-2" /></label>
        <label className="grid gap-1 text-sm font-medium">Email<input required type="email" maxLength="255" autoComplete="email" value={form.email} onChange={(event) => update('email', event.target.value)} className="rounded border border-gray-300 px-3 py-2" /></label>
        <label className="grid gap-1 text-sm font-medium">Số điện thoại<input required inputMode="numeric" pattern="[0-9]{9,15}" maxLength="15" autoComplete="tel" value={form.phone} onChange={(event) => update('phone', event.target.value)} className="rounded border border-gray-300 px-3 py-2" /></label>
        <label className="grid gap-1 text-sm font-medium">Mật khẩu<input required type="password" minLength="8" autoComplete="new-password" value={form.password} onChange={(event) => update('password', event.target.value)} className="rounded border border-gray-300 px-3 py-2" /></label>
        <label className="grid gap-1 text-sm font-medium">Nhập lại mật khẩu<input required type="password" minLength="8" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="rounded border border-gray-300 px-3 py-2" /></label>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button disabled={busy} className="w-full rounded bg-indigo-700 px-4 py-2.5 font-semibold text-white disabled:opacity-50">{busy ? 'Đang tạo tài khoản…' : 'Đăng ký'}</button>
      </form>
      <p className="text-sm text-gray-600">Đã có tài khoản? <Link to="/login" className="font-medium text-indigo-700 underline">Đăng nhập</Link></p>
    </div>
  );
}
