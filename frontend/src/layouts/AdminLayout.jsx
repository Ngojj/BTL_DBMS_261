import { NavLink, Outlet, Link } from 'react-router-dom';

const links = [
  ['/admin/events', 'Sự kiện'],
  ['/admin/zones', 'Khu vực & giá'],
  ['/admin/reports', 'Thống kê'],
  ['/admin/suspicious', 'Gom vé'],
  ['/admin/labs', 'DBMS Lab'],
];

export default function AdminLayout() {
  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside className="w-56 bg-white border-r p-4 space-y-2">
        <Link to="/" className="font-bold text-indigo-600 block mb-4">TicketRush · Admin</Link>
        {links.map(([to, label]) => (
          <NavLink key={to} to={to} className={({ isActive }) => 'block px-3 py-2 rounded ' + (isActive ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-100')}>
            {label}
          </NavLink>
        ))}
      </aside>
      <main className="flex-1 p-6"><Outlet /></main>
    </div>
  );
}
