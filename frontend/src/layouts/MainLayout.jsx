import { Outlet, useMatch } from 'react-router-dom';
import AppHeader from '../components/AppHeader.jsx';

export default function MainLayout() {
  // Trang sơ đồ ghế hiện nhãn "Cập nhật trực tiếp" ở góc phải header (như mockup)
  const onSeatMap = useMatch('/events/:eventId');
  const live = onSeatMap ? (
    <span className="flex items-center gap-2 text-sm text-white/80">
      <span className="w-2 h-2 rounded-full bg-green-400" /> Cập nhật trực tiếp
    </span>
  ) : undefined;

  return (
    <div className="min-h-screen">
      <AppHeader extra={live} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
