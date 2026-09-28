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

function AuthGate() {
  const { userEmail, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-theme-main text-gray-500">Loading...</div>;
  }

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
        <Route path="/spend" element={<SpendPage />} />
        <Route path="/settings" element={<SettingsPage />} />
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
      <Routes>
        {/* Read-only page, reachable without signing in. */}
        <Route path="/late-tracker" element={<PublicLateTracker />} />
        <Route
          path="/*"
          element={
            <AuthProvider>
              <LanguageProvider>
                <AuthGate />
              </LanguageProvider>
            </AuthProvider>
          }
        />
      </Routes>
      {/* offset clears the 64px top bar so toasts don't sit on the theme toggle */}
      <ToastContainer position="top-right" theme="colored" newestOnTop style={{ top: '72px' }} />
    </BrowserRouter>
  )
}

export default App
