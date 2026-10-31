import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function MainLayout() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b shadow-sm">
        <nav className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-4">
          <Link to="/" className="font-bold text-indigo-600 text-lg tracking-tight">
            🎫 TicketRush
          </Link>

          {user && (
            <span className="flex items-center gap-3 text-sm">
              <Link to="/my-tickets" className="text-gray-600 hover:text-indigo-700 font-medium">Vé của tôi</Link>
              {(user.role === 'STAFF' || user.role === 'ADMIN') && (
                <Link to="/checkin" className="text-gray-600 hover:text-indigo-700 font-medium">Soát vé</Link>
              )}
              {user.role === 'ADMIN' && (
                <>
                  <Link to="/admin" className="text-gray-600 hover:text-indigo-700 font-medium">Quản trị</Link>
                  <Link to="/lab" className="text-gray-600 hover:text-indigo-700 font-medium">🔬 DBMS Lab</Link>
                </>
              )}
            </span>
          )}

          <span className="ml-auto flex items-center gap-3 text-sm">
            {user ? (
              <>
                <span className="text-gray-600 hidden sm:inline">
                  {user.fullName ?? user.email}
                  <span className="ml-1 rounded-full bg-indigo-100 text-indigo-700 px-2 py-0.5 text-xs font-semibold">{user.role}</span>
                </span>
                <button onClick={logout} className="rounded border border-gray-300 px-3 py-1 text-gray-600 hover:bg-gray-100">Đăng xuất</button>
              </>
            ) : (
              <>
                <Link to="/login" className="font-medium text-indigo-700 hover:underline">Đăng nhập</Link>
                <Link to="/register" className="rounded bg-indigo-700 px-3 py-1 text-white font-semibold hover:bg-indigo-800">Đăng ký</Link>
              </>
            )}
          </span>
        </nav>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
