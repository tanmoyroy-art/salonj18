import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/common/Sidebar';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Services from './pages/Services';
import Appointments from './pages/Appointments';
import Customers from './pages/Customers';
import Specialists from './pages/Specialists';
import Reports from './pages/Reports';
import StockOverview from './pages/StockOverview';
import Users from './pages/Users';
import Membership from './pages/Membership';
import Loyalty from './pages/Loyalty';
import Offers from './pages/Offers';
import PublicBooking from './pages/PublicBooking';
import { Toaster } from 'react-hot-toast';

function RequireAuth({ children, roles }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function AppLayout({ children }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <div className="page-content">{children}</div>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Public booking — no login needed */}
      <Route path="/appointment" element={<PublicBooking />} />

      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />

      <Route path="/" element={
        <RequireAuth>
          <AppLayout>
            {user?.role === 'super_admin' ? <Dashboard /> :
             user?.role === 'receptionist' ? <Navigate to="/appointments" replace /> :
             <Navigate to="/products" replace />}
          </AppLayout>
        </RequireAuth>
      } />

      <Route path="/appointments" element={
        <RequireAuth roles={['super_admin', 'receptionist']}>
          <AppLayout><Appointments /></AppLayout>
        </RequireAuth>
      } />

      <Route path="/customers" element={
        <RequireAuth roles={['super_admin', 'receptionist']}>
          <AppLayout><Customers /></AppLayout>
        </RequireAuth>
      } />

      <Route path="/products" element={
        <RequireAuth roles={['super_admin', 'stockist']}>
          <AppLayout><Products /></AppLayout>
        </RequireAuth>
      } />

      <Route path="/stock-overview" element={
        <RequireAuth roles={['super_admin', 'stockist']}>
          <AppLayout><StockOverview /></AppLayout>
        </RequireAuth>
      } />

      <Route path="/services" element={
        <RequireAuth roles={['super_admin']}>
          <AppLayout><Services /></AppLayout>
        </RequireAuth>
      } />

      <Route path="/specialists" element={
        <RequireAuth roles={['super_admin']}>
          <AppLayout><Specialists /></AppLayout>
        </RequireAuth>
      } />

      <Route path="/reports" element={
        <RequireAuth roles={['super_admin']}>
          <AppLayout><Reports /></AppLayout>
        </RequireAuth>
      } />

      <Route path="/membership" element={
        <RequireAuth roles={['super_admin']}>
          <AppLayout><Membership /></AppLayout>
        </RequireAuth>
      } />

      <Route path="/loyalty" element={
        <RequireAuth roles={['super_admin']}>
          <AppLayout><Loyalty /></AppLayout>
        </RequireAuth>
      } />

      <Route path="/offers" element={
        <RequireAuth roles={['super_admin']}>
          <AppLayout><Offers /></AppLayout>
        </RequireAuth>
      } />

      <Route path="/users" element={
        <RequireAuth roles={['super_admin']}>
          <AppLayout><Users /></AppLayout>
        </RequireAuth>
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
      <Toaster position="top-center" />
    </BrowserRouter>
  );
}
