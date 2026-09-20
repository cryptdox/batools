import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AppLayout } from './components/layout/AppLayout';
import { TeamMembers } from './pages/TeamMembers/TeamMembers';

import { LateTracker } from './pages/LateTracker/LateTracker';
import { PunishmentPage } from './pages/Punishment/Punishment';
import { ReportsPage } from './pages/Reports/Reports';
import { AttendanceReportPage } from './pages/AttendanceReport/AttendanceReport';
import { SettingsPage } from './pages/Settings/Settings';
import { Login } from './pages/Login/Login';
import { AuthProvider, useAuth } from './lib/AuthContext';

function AuthGate() {
  const { userEmail } = useAuth();

  if (!userEmail) {
    return <Login />;
  }

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<LateTracker />} />
        <Route path="/team" element={<TeamMembers />} />
        <Route path="/punishment" element={<PunishmentPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/attendance-report" element={<AttendanceReportPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </AppLayout>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
      <ToastContainer position="bottom-right" theme="colored" newestOnTop />
    </BrowserRouter>
  )
}

export default App
