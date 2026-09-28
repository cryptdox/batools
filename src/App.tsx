import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AppLayout } from './components/layout/AppLayout';
import { TeamMembers } from './pages/TeamMembers/TeamMembers';

import { LateTracker } from './pages/LateTracker/LateTracker';
import { PunishmentPage } from './pages/Punishment/Punishment';
import { ReportsPage } from './pages/Reports/Reports';
import { AttendanceReportPage } from './pages/AttendanceReport/AttendanceReport';
import { SettingsPage } from './pages/Settings/Settings';
import { SpendPage } from './pages/Spend/Spend';
import { Login } from './pages/Login/Login';
import { PublicLateTracker } from './pages/PublicLateTracker/PublicLateTracker';
import { AuthProvider, useAuth } from './lib/AuthContext';

/** Every Late Tracker page lives under this prefix. */
const LT = '/late-tracker';

/** Old top-level links, kept working so bookmarks do not break. */
const MOVED: Record<string, string> = {
  '/team': `${LT}/team`,
  '/punishment': `${LT}/punishment`,
  '/reports': `${LT}/reports`,
  '/attendance-report': `${LT}/attendance-report`,
  '/spend': `${LT}/spend`,
  '/settings': `${LT}/settings`,
};

function AuthGate() {
  const { userEmail } = useAuth();

  // The read-only board stays reachable without signing in.
  if (!userEmail) {
    return (
      <Routes>
        <Route path={LT} element={<PublicLateTracker />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <AppLayout>
      <Routes>
        {/* Landing goes to the group's own page, which is the public board. */}
        <Route path="/" element={<Navigate to={LT} replace />} />

        <Route path={LT} element={<PublicLateTracker embedded />} />
        <Route path={`${LT}/daily-tracker`} element={<LateTracker />} />
        <Route path={`${LT}/team`} element={<TeamMembers />} />
        <Route path={`${LT}/punishment`} element={<PunishmentPage />} />
        <Route path={`${LT}/reports`} element={<ReportsPage />} />
        <Route path={`${LT}/attendance-report`} element={<AttendanceReportPage />} />
        <Route path={`${LT}/spend`} element={<SpendPage />} />
        <Route path={`${LT}/settings`} element={<SettingsPage />} />

        {Object.entries(MOVED).map(([from, to]) => (
          <Route key={from} path={from} element={<Navigate to={to} replace />} />
        ))}

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
      {/* offset clears the 64px top bar so toasts don't sit on the theme toggle */}
      <ToastContainer position="top-right" theme="colored" newestOnTop style={{ top: '72px' }} />
    </BrowserRouter>
  );
}

export default App
