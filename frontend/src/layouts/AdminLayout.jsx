import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Logo } from '../components/AppHeader.jsx';

const main = [
  ['/admin/events', 'Sự kiện'],
  ['/admin/zones', 'Khu vực và giá vé'],
  ['/admin/reports', 'Thống kê doanh thu'],
  ['/admin/suspicious', 'Phát hiện gom vé'],
  ['/admin/queue', 'Phòng chờ ảo'],
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
  'block px-3 py-2.5 md:py-2 rounded-lg text-[15px] ' + (isActive ? 'bg-white/10 text-white font-bold' : 'text-white/70 hover:text-white');

export default function AdminLayout() {
  // Điện thoại: thanh trên cùng gọn + nút menu; menu đầy đủ chỉ mở khi bấm. Từ md trở lên: thanh bên cố định.
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]); // chọn trang xong thì đóng menu

  return (
    <div className="min-h-screen md:flex">
      <aside className="bg-ink text-white md:w-64 shrink-0 md:min-h-screen md:sticky md:top-0 md:self-start md:max-h-screen md:overflow-y-auto">
        <div className="flex items-center justify-between gap-2 px-4 py-3 md:px-7 md:pt-6 md:pb-6">
          <div className="flex items-baseline gap-2">
            <Logo />
            <span className="text-xs text-white/50">Quản trị</span>
          </div>
          <button
            type="button"
            className="md:hidden w-11 h-11 -mr-2 rounded-lg grid place-items-center hover:bg-white/10"
            aria-label={open ? 'Đóng menu' : 'Mở menu'}
            aria-expanded={open}
            aria-controls="admin-nav"
            onClick={() => setOpen(!open)}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
        <nav id="admin-nav" className={(open ? 'block' : 'hidden') + ' md:block px-4 pb-4 space-y-1'}>
          {main.map(([to, label]) => (
            <NavLink key={to} to={to} className={item}>{label}</NavLink>
          ))}
          <p className="px-3 pt-5 pb-1 text-[11px] font-bold tracking-widest text-white/40">DBMS LAB</p>
          {labLinks.map(([slug, label]) => (
            <NavLink key={slug} to={'/admin/labs/' + slug} className={item}>{label}</NavLink>
          ))}
          <NavLink to="/" className="block px-3 pt-6 pb-2 text-sm text-white/50 hover:text-white">← Về trang khách</NavLink>
        </nav>
      </aside>
      <main className="flex-1 min-w-0 p-4 sm:p-8">
        <Outlet />
      </main>
    </div>
  );
}
