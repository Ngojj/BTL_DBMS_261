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
import WaitingRoomPage  from './pages/WaitingRoomPage.jsx';

// Admin
import AdminLayout      from './pages/admin/AdminLayout.jsx';
import AdminEventsPage  from './pages/admin/AdminEventsPage.jsx';
import AdminRevenuePage from './pages/admin/AdminRevenuePage.jsx';
import AdminScalpersPage from './pages/admin/AdminScalpersPage.jsx';

// DBMS Lab Pages
import LabHubPage                from './pages/lab/LabHubPage.jsx';
import LabDataStoragePage        from './pages/lab/LabDataStoragePage.jsx';
import LabIndexingPage           from './pages/lab/LabIndexingPage.jsx';
import LabQueryProcessingPage    from './pages/lab/LabQueryProcessingPage.jsx';
import LabTransactionPage        from './pages/lab/LabTransactionPage.jsx';
import LabConcurrencyControlPage from './pages/lab/LabConcurrencyControlPage.jsx';
import LabBackupRecoveryPage     from './pages/lab/LabBackupRecoveryPage.jsx';

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
        <Route path="/events/:eventId/waiting-room" element={<ProtectedRoute><WaitingRoomPage /></ProtectedRoute>} />
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

        {/* DBMS Lab - 6 Topics */}
        <Route path="/lab"                     element={<ProtectedRoute roles={['ADMIN']}><LabHubPage /></ProtectedRoute>} />
        <Route path="/lab/data-storage"        element={<ProtectedRoute roles={['ADMIN']}><LabDataStoragePage /></ProtectedRoute>} />
        <Route path="/lab/indexing"            element={<ProtectedRoute roles={['ADMIN']}><LabIndexingPage /></ProtectedRoute>} />
        <Route path="/lab/query-processing"    element={<ProtectedRoute roles={['ADMIN']}><LabQueryProcessingPage /></ProtectedRoute>} />
        <Route path="/lab/transaction"         element={<ProtectedRoute roles={['ADMIN']}><LabTransactionPage /></ProtectedRoute>} />
        <Route path="/lab/concurrency-control" element={<ProtectedRoute roles={['ADMIN']}><LabConcurrencyControlPage /></ProtectedRoute>} />
        <Route path="/lab/backup-recovery"     element={<ProtectedRoute roles={['ADMIN']}><LabBackupRecoveryPage /></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
