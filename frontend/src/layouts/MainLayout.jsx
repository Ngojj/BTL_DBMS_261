import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function MainLayout() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <nav className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link to="/" className="font-bold text-indigo-600">TicketRush</Link>
          <span className="ml-auto flex items-center gap-3">
            {user ? (
              <>
                <span className="text-sm text-gray-600">{user.fullName}</span>
                <button onClick={logout} className="text-sm underline">Đăng xuất</button>
              </>
            ) : (
              <>
                <Link to="/login">Đăng nhập</Link>
                <Link to="/register">Đăng ký</Link>
              </>
            )}
          </span>
        </nav>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6"><Outlet /></main>
    </div>
  );
}
