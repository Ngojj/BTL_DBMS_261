// Nút "Tiếp tục với Google" dùng chung cho đăng nhập và đăng ký (cùng một luồng: có tài khoản thì đăng nhập, chưa có thì tạo).
// Luồng: popup Google (Firebase Auth) → POST /api/auth/google. Email mới cần thêm số điện thoại (bảng users bắt buộc có phone).
import { useState } from 'react';
import { pickGoogleAccount } from '../lib/firebase.js';
import { useAuth } from '../context/AuthContext.jsx';
import { ErrorBox } from './ui.jsx';

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

// onDone(user): gọi sau khi đăng nhập thành công (trang cha chuyển hướng)
export default function GoogleAuth({ onDone, label = 'Tiếp tục với Google' }) {
  const { loginWithGoogle } = useAuth();
  const [pending, setPending] = useState(null); // { idToken, profile } khi cần hỏi số điện thoại
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function run(fn) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      // Người dùng tự đóng popup không phải lỗi đáng báo
      if (!['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(e.code)) setError(e);
    } finally {
      setBusy(false);
    }
  }

  const start = () =>
    run(async () => {
      const picked = await pickGoogleAccount();
      try {
        onDone(await loginWithGoogle({ idToken: picked.idToken }));
      } catch (e) {
        if (e.code !== 'PHONE_REQUIRED') throw e;
        setPending(picked); // email chưa có trong hệ thống → hỏi số điện thoại
      }
    });

  // Không dùng <form> vì component này nằm trong form đăng nhập/đăng ký (form không được lồng nhau)
  const finish = () => {
    if (!/^[0-9]{9,15}$/.test(phone)) return setError({ message: 'Số điện thoại phải gồm 9–15 chữ số' });
    run(async () => onDone(await loginWithGoogle({ idToken: pending.idToken, phone })));
  };

  if (pending)
    return (
      <div className="space-y-3 rounded-xl border border-black/10 bg-paper p-4">
        <p className="text-sm">
          Xin chào <b>{pending.profile.name ?? pending.profile.email}</b>! Nhập số điện thoại để hoàn tất tạo tài khoản
          <span className="text-gray-500"> ({pending.profile.email}).</span>
        </p>
        <ErrorBox error={error} />
        <input
          autoFocus
          inputMode="numeric"
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), finish())}
          placeholder="Số điện thoại (9–15 chữ số)"
          className="input"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <div className="flex gap-2">
          <button type="button" onClick={finish} className="btn-brand flex-1" disabled={busy}>{busy ? 'Đang tạo…' : 'Hoàn tất đăng ký'}</button>
          <button type="button" className="btn-ghost" onClick={() => { setPending(null); setError(null); }}>Hủy</button>
        </div>
      </div>
    );

  return (
    <div className="space-y-3">
      <ErrorBox error={error} />
      <button type="button" onClick={start} disabled={busy} className="btn-ghost w-full py-3 gap-3 text-base">
        <GoogleLogo /> {busy ? 'Đang mở Google…' : label}
      </button>
    </div>
  );
}

export function OrDivider() {
  return (
    <div className="flex items-center gap-3 text-xs text-gray-400">
      <span className="flex-1 border-t border-black/10" /> hoặc <span className="flex-1 border-t border-black/10" />
    </div>
  );
}
