import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout.jsx';
import AdminLayout from './layouts/AdminLayout.jsx';
import LabLayout from './layouts/LabLayout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
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
import DataStorageLabPage from './pages/lab/DataStorageLabPage.jsx';
import IndexingLabPage from './pages/lab/IndexingLabPage.jsx';
import QueryProcessingLabPage from './pages/lab/QueryProcessingLabPage.jsx';
import TransactionLabPage from './pages/lab/TransactionLabPage.jsx';
import ConcurrencyControlLabPage from './pages/lab/ConcurrencyControlLabPage.jsx';
import BackupRecoveryLabPage from './pages/lab/BackupRecoveryLabPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
          <Route path="/" element={<EventListPage />} />
          <Route path="/events/:eventId" element={<EventDetailPage />} />
          <Route path="/events/:eventId/waiting-room" element={<WaitingRoomPage />} />
          <Route path="/checkout/:orderId" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
          <Route path="/my-tickets" element={<ProtectedRoute><MyTicketsPage /></ProtectedRoute>} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/staff/checkin" element={<ProtectedRoute roles={['STAFF', 'ADMIN']}><CheckinPage /></ProtectedRoute>} />
      </Route>

      <Route path="/admin" element={<ProtectedRoute roles={['ADMIN']}><AdminLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="events" replace />} />
        <Route path="events" element={<AdminEventsPage />} />
        <Route path="zones" element={<AdminZonesPage />} />
        <Route path="reports" element={<AdminReportsPage />} />
        <Route path="suspicious" element={<AdminSuspiciousPage />} />
        <Route path="labs" element={<LabLayout />}>
          <Route index element={<Navigate to="data-storage" replace />} />
          <Route path="data-storage" element={<DataStorageLabPage />} />
          <Route path="indexing" element={<IndexingLabPage />} />
          <Route path="query-processing" element={<QueryProcessingLabPage />} />
          <Route path="transaction" element={<TransactionLabPage />} />
          <Route path="concurrency-control" element={<ConcurrencyControlLabPage />} />
          <Route path="backup-recovery" element={<BackupRecoveryLabPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
