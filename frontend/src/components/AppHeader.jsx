import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import NotificationBell from './NotificationBell.jsx';

export function Logo({ className = '' }) {
  return (
    <Link to="/" className={'text-2xl font-extrabold tracking-tight ' + className}>
      Ticket<span className="text-glow">Rush</span>
    </Link>
  );
}

const navClass = ({ isActive }) => (isActive ? 'text-white' : 'text-white/65 hover:text-white');

// Thanh đầu trang màu tối. right: thay thế khối góc phải (mặc định: tài khoản); extra: chèn thêm trước khối tài khoản; nav=false: ẩn menu
export default function AppHeader({ right, extra, nav = true }) {
  const { user, logout } = useAuth();

  const account = user ? (
    <div className="flex items-center gap-3">
      <NotificationBell user={user} />
      <span className="w-9 h-9 rounded-full bg-royal grid place-items-center font-bold">
        {user.fullName?.charAt(0).toUpperCase()}
      </span>
      <span className="text-sm text-white/70 hidden sm:inline">{user.fullName}</span>
      <button onClick={logout} className="text-xs text-white/50 hover:text-white underline">
        Đăng xuất
      </button>
    </div>
  ) : (
    <div className="flex items-center gap-4 text-sm">
      <Link to="/login" className="text-white/80 hover:text-white">Đăng nhập</Link>
      <Link to="/register" className="bg-white text-ink font-bold rounded-lg px-3 py-1.5">Đăng ký</Link>
    </div>
  );

  return (
    <header className="bg-ink text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 min-h-[74px] py-2 flex items-center gap-4 sm:gap-8 flex-wrap">
        <Logo />
        {nav && (
          <nav className="flex gap-5 text-[15px] font-medium">
            <NavLink to="/" end className={navClass}>Sự kiện</NavLink>
            {user && <NavLink to="/my-tickets" className={navClass}>Vé của tôi</NavLink>}
            {user && ['STAFF', 'ADMIN'].includes(user.role) && <NavLink to="/staff/checkin" className={navClass}>Soát vé</NavLink>}
            {user?.role === 'ADMIN' && <NavLink to="/admin" className={navClass}>Quản trị</NavLink>}
          </nav>
        )}
        <div className="ml-auto flex items-center gap-4">
          {extra}
          {right !== undefined ? right : account}
        </div>
      </div>
    </header>
  );
}
