import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout.jsx';
import AdminLayout from './layouts/AdminLayout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import LabPage from './components/LabPage.jsx';
import { labConfigs } from './pages/lab/labConfigs.js';
import EventListPage from './pages/EventListPage.jsx';
import EventDetailPage from './pages/EventDetailPage.jsx';
import WaitingRoomPage from './pages/WaitingRoomPage.jsx';
import CheckoutPage from './pages/CheckoutPage.jsx';
import MyTicketsPage from './pages/MyTicketsPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import CheckinPage from './pages/CheckinPage.jsx';
import AdminEventsPage from './pages/AdminEventsPage.jsx';
import AdminZonesPage from './pages/AdminZonesPage.jsx';
import AdminReportsPage from './pages/AdminReportsPage.jsx';
import AdminSuspiciousPage from './pages/AdminSuspiciousPage.jsx';
import AdminQueuePage from './pages/AdminQueuePage.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<EventListPage />} />
        <Route path="/events/:eventId" element={<EventDetailPage />} />
        <Route path="/events/:eventId/waiting-room" element={<WaitingRoomPage />} />
        <Route path="/my-tickets" element={<ProtectedRoute><MyTicketsPage /></ProtectedRoute>} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      {/* Trang có giao diện riêng, không dùng MainLayout */}
      <Route path="/checkout/:orderId" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
      <Route path="/staff/checkin" element={<ProtectedRoute roles={['STAFF', 'ADMIN']}><CheckinPage /></ProtectedRoute>} />

      <Route path="/admin" element={<ProtectedRoute roles={['ADMIN']}><AdminLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="events" replace />} />
        <Route path="events" element={<AdminEventsPage />} />
        <Route path="zones" element={<AdminZonesPage />} />
        <Route path="reports" element={<AdminReportsPage />} />
        <Route path="suspicious" element={<AdminSuspiciousPage />} />
        <Route path="queue" element={<AdminQueuePage />} />
        {Object.keys(labConfigs).map((topic) => (
          <Route key={topic} path={'labs/' + topic} element={<LabPage topic={topic} />} />
        ))}
        <Route path="labs" element={<Navigate to="concurrency-control" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
