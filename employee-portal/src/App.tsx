import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Payslips from './pages/Payslips';
import Profile from './pages/Profile';
import TaxCertificates from './pages/TaxCertificates';
import ChangeRequests from './pages/ChangeRequests';
import Notifications from './pages/Notifications';
import Documents from './pages/Documents';
import TeamDirectory from './pages/TeamDirectory';
import PayCalendar from './pages/PayCalendar';
import Settings from './pages/Settings';
import HelpSupport from './pages/HelpSupport';
import ExportCenter from './pages/ExportCenter';
import MyGoals from './pages/MyGoals';
import ApplyForLoan from './pages/ApplyForLoan';
import CreateExpenseClaim from './pages/CreateExpenseClaim';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="payslips" element={<Payslips />} />
        <Route path="profile" element={<Profile />} />
        <Route path="tax-certificates" element={<TaxCertificates />} />
        <Route path="change-requests" element={<ChangeRequests />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="documents" element={<Documents />} />
        <Route path="team" element={<TeamDirectory />} />
        <Route path="pay-calendar" element={<PayCalendar />} />
        <Route path="settings" element={<Settings />} />
        <Route path="help" element={<HelpSupport />} />
        <Route path="export" element={<ExportCenter />} />
        <Route path="goals" element={<MyGoals />} />
        <Route path="loans/apply" element={<ApplyForLoan />} />
        <Route path="expenses/create" element={<CreateExpenseClaim />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
