import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

const ADMIN_NAV = [
  { to: '/admin/events',    label: '📅 Quản lý Sự kiện' },
  { to: '/admin/revenue',   label: '📊 Thống kê Doanh thu' },
  { to: '/admin/scalpers',  label: '🚨 Phát hiện Gom vé' },
];

const LAB_NAV = [
  { to: '/lab',                     label: '🔬 Tổng quan DBMS Lab' },
  { to: '/lab/data-storage',        label: '💾 1. Data Storage' },
  { to: '/lab/indexing',            label: '⚡ 2. Indexing' },
  { to: '/lab/query-processing',    label: '📈 3. Query Processing' },
  { to: '/lab/transaction',         label: '🔄 4. Transaction (ACID)' },
  { to: '/lab/concurrency-control', label: '⏱️ 5. Concurrency (Giờ G)' },
  { to: '/lab/backup-recovery',     label: '🛡️ 6. Backup & Recovery' },
];

export default function AdminLayout() {
  const { user } = useAuth();
  const { pathname } = useLocation();

  if (user?.role !== 'ADMIN') {
    return <p className="text-red-700 p-8">Bạn không có quyền truy cập trang này.</p>;
  }

  return (
    <div className="flex min-h-[70vh] gap-6">
      <aside className="w-52 shrink-0 space-y-5">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Nghiệp vụ Quản trị</p>
          <nav className="space-y-1">
            {ADMIN_NAV.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`block rounded-lg px-3 py-2 text-xs font-medium ${pathname === to ? 'bg-indigo-100 text-indigo-800 font-bold' : 'text-gray-700 hover:bg-gray-100'}`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-indigo-600">Thực nghiệm DBMS Lab</p>
          <nav className="space-y-1">
            {LAB_NAV.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`block rounded-lg px-3 py-1.5 text-xs font-medium ${pathname === to ? 'bg-indigo-100 text-indigo-800 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
