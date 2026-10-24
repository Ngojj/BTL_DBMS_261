import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import EventListPage    from './pages/EventListPage.jsx';
import EventDetailPage  from './pages/EventDetailPage.jsx';
import CheckoutPage     from './pages/CheckoutPage.jsx';
import LoginPage        from './pages/LoginPage.jsx';
import RegisterPage     from './pages/RegisterPage.jsx';
import MyTicketsPage    from './pages/MyTicketsPage.jsx';
import CheckinPage      from './pages/CheckinPage.jsx';
// Admin
import AdminLayout      from './pages/admin/AdminLayout.jsx';
import AdminEventsPage  from './pages/admin/AdminEventsPage.jsx';
import AdminRevenuePage from './pages/admin/AdminRevenuePage.jsx';
import AdminScalpersPage from './pages/admin/AdminScalpersPage.jsx';
// DBMS Lab
import LabDataStoragePage from './pages/lab/LabDataStoragePage.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        {/* Public */}
        <Route path="/" element={<EventListPage />} />
        <Route path="/events/:eventId" element={<EventDetailPage />} />
        <Route path="/login"    element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Customer */}
        <Route path="/checkout/:orderId" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
        <Route path="/my-tickets"        element={<ProtectedRoute><MyTicketsPage /></ProtectedRoute>} />

        {/* Staff */}
        <Route path="/checkin" element={<ProtectedRoute roles={['STAFF','ADMIN']}><CheckinPage /></ProtectedRoute>} />

        {/* Admin */}
        <Route path="/admin" element={<ProtectedRoute roles={['ADMIN']}><AdminLayout /></ProtectedRoute>}>
          <Route index          element={<AdminEventsPage />} />
          <Route path="events"  element={<AdminEventsPage />} />
          <Route path="revenue" element={<AdminRevenuePage />} />
          <Route path="scalpers" element={<AdminScalpersPage />} />
        </Route>

        {/* DBMS Lab */}
        <Route path="/lab/data-storage" element={<ProtectedRoute roles={['ADMIN']}><LabDataStoragePage /></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
