import { NavLink, Outlet } from 'react-router-dom';

const topics = [
  ['data-storage', 'Data storage'],
  ['indexing', 'Indexing'],
  ['query-processing', 'Query processing'],
  ['transaction', 'Transaction'],
  ['concurrency-control', 'Concurrency control'],
  ['backup-recovery', 'Backup & recovery'],
];

export default function LabLayout() {
  return (
    <div>
      <h1 className="text-xl font-bold mb-3">DBMS Lab: PostgreSQL vs Firestore</h1>
      <nav className="flex flex-wrap gap-2 mb-6">
        {topics.map(([slug, label]) => (
          <NavLink key={slug} to={'/admin/labs/' + slug} className={({ isActive }) => 'px-3 py-1 rounded border ' + (isActive ? 'bg-indigo-600 text-white' : 'bg-white')}>
            {label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
