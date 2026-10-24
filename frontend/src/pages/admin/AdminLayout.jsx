import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

const NAV = [
  { to: '/admin/events',    label: '📅 Sự kiện' },
  { to: '/admin/revenue',   label: '📊 Doanh thu' },
  { to: '/admin/scalpers',  label: '🚨 Gom vé' },
  { to: '/lab/data-storage', label: '🔬 Lab: Data Storage' },
];

export default function AdminLayout() {
  const { user } = useAuth();
  const { pathname } = useLocation();

  if (user?.role !== 'ADMIN') {
    return <p className="text-red-700 p-8">Bạn không có quyền truy cập trang này.</p>;
  }

  return (
    <div className="flex min-h-[70vh] gap-6">
      <aside className="w-44 shrink-0">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Admin</p>
        <nav className="space-y-1">
          {NAV.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`block rounded-lg px-3 py-2 text-sm font-medium ${pathname.startsWith(to) ? 'bg-indigo-100 text-indigo-800' : 'text-gray-700 hover:bg-gray-100'}`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 min-w-0"><Outlet /></main>
    </div>
  );
}
