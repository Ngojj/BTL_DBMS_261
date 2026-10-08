import { NavLink, Outlet } from 'react-router-dom';
import { Logo } from '../components/AppHeader.jsx';

const main = [
  ['/admin/events', 'Sự kiện'],
  ['/admin/zones', 'Khu vực và giá vé'],
  ['/admin/reports', 'Thống kê doanh thu'],
  ['/admin/suspicious', 'Phát hiện gom vé'],
];
export const labLinks = [
  ['data-storage', 'Data storage'],
  ['indexing', 'Indexing'],
  ['query-processing', 'Query processing'],
  ['transaction', 'Transaction'],
  ['concurrency-control', 'Concurrency control'],
  ['backup-recovery', 'Backup và recovery'],
];

const item = ({ isActive }) =>
  'block px-3 py-2 rounded-lg text-[15px] ' + (isActive ? 'bg-white/10 text-white font-bold' : 'text-white/70 hover:text-white');

export default function AdminLayout() {
  return (
    <div className="min-h-screen md:flex">
      <aside className="bg-ink text-white md:w-64 shrink-0 p-4 md:min-h-screen">
        <div className="flex items-baseline gap-2 px-3 pt-2 pb-6">
          <Logo />
          <span className="text-xs text-white/50">Quản trị</span>
        </div>
        <nav className="flex md:block flex-wrap gap-1 space-y-0 md:space-y-1">
          {main.map(([to, label]) => (
            <NavLink key={to} to={to} className={item}>{label}</NavLink>
          ))}
          <p className="w-full px-3 pt-5 pb-1 text-[11px] font-bold tracking-widest text-white/40">DBMS LAB</p>
          {labLinks.map(([slug, label]) => (
            <NavLink key={slug} to={'/admin/labs/' + slug} className={item}>{label}</NavLink>
          ))}
          <NavLink to="/" className="block px-3 pt-6 text-xs text-white/40 hover:text-white">← Về trang khách</NavLink>
        </nav>
      </aside>
      <main className="flex-1 min-w-0 p-4 sm:p-8">
        <Outlet />
      </main>
    </div>
  );
}
