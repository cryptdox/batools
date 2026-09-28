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
import { LanguageProvider } from './lib/LanguageContext';
import { TaskManagerPage } from './pages/TaskManager/TaskManagerPage';
import { TaskStorePage } from './pages/TaskManager/TaskStorePage';
import { VocabularyPage } from './pages/TaskManager/VocabularyPage';
import { AdministrationPage } from './pages/TaskManager/AdministrationPage';
import { PbDashboard } from './pages/PartnerBusiness/PbDashboard';
import { PbProducts } from './pages/PartnerBusiness/PbProducts';
import { PbBuy } from './pages/PartnerBusiness/PbBuy';
import { PbSell } from './pages/PartnerBusiness/PbSell';
import { PbCosts } from './pages/PartnerBusiness/PbCosts';
import { PbAssets } from './pages/PartnerBusiness/PbAssets';
import { PbShareGroups } from './pages/PartnerBusiness/PbShareGroups';
import { PbPartners } from './pages/PartnerBusiness/PbPartners';
import { PbLedger } from './pages/PartnerBusiness/PbLedger';
import { PbProfitAdjust } from './pages/PartnerBusiness/PbProfitAdjust';

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
  const { userEmail, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-theme-main text-gray-500">Loading...</div>;
  }

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

        <Route path="/task-manager" element={<TaskManagerPage />} />
        <Route path="/task-store" element={<TaskStorePage />} />
        <Route path="/vocabulary" element={<VocabularyPage />} />
        <Route path="/task-administration" element={<AdministrationPage />} />

        <Route path="/pb" element={<PbDashboard />} />
        <Route path="/pb/products" element={<PbProducts />} />
        <Route path="/pb/buy" element={<PbBuy />} />
        <Route path="/pb/sell" element={<PbSell />} />
        <Route path="/pb/costs" element={<PbCosts />} />
        <Route path="/pb/assets" element={<PbAssets />} />
        <Route path="/pb/partners" element={<PbPartners />} />
        <Route path="/pb/share-groups" element={<PbShareGroups />} />
        <Route path="/pb/ledger" element={<PbLedger />} />
        <Route path="/pb/adjust" element={<PbProfitAdjust />} />
      </Routes>
    </AppLayout>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LanguageProvider>
          <AuthGate />
        </LanguageProvider>
      </AuthProvider>
      {/* offset clears the 64px top bar so toasts don't sit on the theme toggle */}
      <ToastContainer position="top-right" theme="colored" newestOnTop style={{ top: '72px' }} />
    </BrowserRouter>
  );
}

export default App
