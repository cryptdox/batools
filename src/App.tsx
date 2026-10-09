import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
import { AuthCallback } from './pages/Login/AuthCallback';
import { REDIRECT_PATH } from './lib/iam';
import { PublicLateTracker } from './pages/PublicLateTracker/PublicLateTracker';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { PAGE_RESOURCES, resourceOf, useAccess } from './lib/permissions';
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
import { PfProfile } from './pages/Portfolio/PfProfile';
import { PfAbout } from './pages/Portfolio/PfAbout';
import { PfProjects, PfExperience, PfTechStack, PfResearch } from './pages/Portfolio/PfWork';
import { PfLabels } from './pages/Portfolio/PfLabels';
import { PfMessages } from './pages/Portfolio/PfMessages';
import { OrgAbout } from './pages/OrgSite/OrgAbout';
import { OrgServices, OrgProducts, OrgFaqs } from './pages/OrgSite/OrgCatalog';
import { OrgClients } from './pages/OrgSite/OrgClients';
import { OrgBlogs, OrgJobs, OrgProjects } from './pages/OrgSite/OrgContent';
import { OrgTeams, OrgMembers } from './pages/OrgSite/OrgPeople';
import { OrgContacts, OrgApplications } from './pages/OrgSite/OrgInbox';
import { AcDashboard } from './pages/AchievementCycle/AcDashboard';
import { AcBoard } from './pages/AchievementCycle/AcBoard';
import { AcTopics } from './pages/AchievementCycle/AcTopics';
import { AcExplore } from './pages/AchievementCycle/AcExplore';
import { AcMilestones } from './pages/AchievementCycle/AcMilestones';
import { MpLibrary } from './pages/Music/MpLibrary';
import { MpCollections, MpCollectionDetail } from './pages/Music/MpCollections';
import { MpNowPlaying } from './pages/Music/MpNowPlaying';
import { MpGenres } from './pages/Music/MpGenres';
import { MpSingers } from './pages/Music/MpSingers';
import { MpPlaces } from './pages/Music/MpPlaces';
import { MpSources } from './pages/Music/MpSources';
import { MusicPlayerProvider, usePlayer } from './lib/MusicPlayerContext';
import { MpFloatingControls, MpMiniPlayer } from './components/music/MpControls';

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

/** Room under the page so the fixed mini player never covers content. */
function MpBottomSpace() {
  const { current } = usePlayer();
  const { pathname } = useLocation();
  const { musicDetails } = useAccess();
  return current && musicDetails && pathname !== '/mp/player' ? <div className="h-24" aria-hidden="true" /> : null;
}

/** Pages in sidebar order, for sending a user to the first one IAM lets them open. */
const LANDING_ORDER = Object.keys(PAGE_RESOURCES);

/** Landing: the Late Tracker board, or the first page this user may open. */
function Landing() {
  const { canOpen, accessState, reloadAccess } = useAccess();
  if (accessState === 'loading') return <AccessMessage kind="loading" />;
  if (accessState === 'error') return <AccessMessage kind="error" onRetry={reloadAccess} />;
  const first = LANDING_ORDER.find(canOpen);
  return first ? <Navigate to={first} replace /> : <AccessMessage kind="denied" />;
}

const AccessMessage = ({ kind, onRetry }: { kind: 'loading' | 'error' | 'denied'; onRetry?: () => void }) => (
  <div className="max-w-md mx-auto mt-16 text-center space-y-3">
    {kind === 'loading' && <p className="text-gray-500">Checking your access…</p>}
    {kind === 'error' && (
      <>
        <p className="font-semibold text-gray-900 dark:text-gray-100">Couldn&apos;t load your permissions</p>
        <p className="text-sm text-gray-500">This page is managed in IAM; try again in a moment.</p>
        <button onClick={onRetry} className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium">Try again</button>
      </>
    )}
    {kind === 'denied' && (
      <>
        <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">No access</p>
        <p className="text-sm text-gray-500">Your role doesn&apos;t include this page. Ask an administrator to grant it in IAM.</p>
      </>
    )}
  </div>
);

/** Blocks pages managed in IAM (PAGE_RESOURCES) until the user's permissions allow them. */
function PageGate({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const { canOpen, accessState, reloadAccess } = useAccess();
  if (!resourceOf(pathname)) return <>{children}</>;
  if (accessState === 'loading') return <AccessMessage kind="loading" />;
  if (accessState === 'error') return <AccessMessage kind="error" onRetry={reloadAccess} />;
  return canOpen(pathname) ? <>{children}</> : <AccessMessage kind="denied" />;
}

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
        <Route path={REDIRECT_PATH} element={<AuthCallback />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <MusicPlayerProvider>
    <AppLayout>
      <PageGate>
      <Routes>
        {/* Landing goes to the group's own page (the public board), or the first page this user may open. */}
        <Route path="/" element={<Landing />} />
        <Route path={REDIRECT_PATH} element={<Navigate to="/" replace />} />

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

        <Route path="/portfolio" element={<PfProfile />} />
        <Route path="/portfolio/about" element={<PfAbout />} />
        <Route path="/portfolio/projects" element={<PfProjects />} />
        <Route path="/portfolio/experience" element={<PfExperience />} />
        <Route path="/portfolio/tech-stack" element={<PfTechStack />} />
        <Route path="/portfolio/research" element={<PfResearch />} />
        <Route path="/portfolio/labels" element={<PfLabels />} />
        <Route path="/portfolio/messages" element={<PfMessages />} />

        <Route path="/org" element={<OrgAbout />} />
        <Route path="/org/services" element={<OrgServices />} />
        <Route path="/org/products" element={<OrgProducts />} />
        <Route path="/org/projects" element={<OrgProjects />} />
        <Route path="/org/clients" element={<OrgClients />} />
        <Route path="/org/teams" element={<OrgTeams />} />
        <Route path="/org/members" element={<OrgMembers />} />
        <Route path="/org/blog" element={<OrgBlogs />} />
        <Route path="/org/jobs" element={<OrgJobs />} />
        <Route path="/org/faqs" element={<OrgFaqs />} />
        <Route path="/org/applications" element={<OrgApplications />} />
        <Route path="/org/contacts" element={<OrgContacts />} />

        <Route path="/ac" element={<AcDashboard />} />
        <Route path="/ac/board" element={<AcBoard />} />
        <Route path="/ac/topics" element={<AcTopics />} />
        <Route path="/ac/explore" element={<AcExplore />} />
        <Route path="/ac/milestones" element={<AcMilestones />} />
        <Route path="/mp" element={<MpLibrary />} />
        <Route path="/mp/collections" element={<MpCollections />} />
        <Route path="/mp/collections/:id" element={<MpCollectionDetail />} />
        <Route path="/mp/player" element={<MpNowPlaying />} />
        <Route path="/mp/genres" element={<MpGenres />} />
        <Route path="/mp/singers" element={<MpSingers />} />
        <Route path="/mp/places" element={<MpPlaces />} />
        <Route path="/mp/sources" element={<MpSources />} />
        {/* Renamed from Learning Cycle (/lc); keep old links working. */}
        {['', '/board', '/topics', '/explore', '/milestones'].map(sub => (
          <Route key={sub} path={`/lc${sub}`} element={<Navigate to={`/ac${sub}`} replace />} />
        ))}
      </Routes>
      </PageGate>
      <MpBottomSpace />
      <MpMiniPlayer />
      <MpFloatingControls />
    </AppLayout>
    </MusicPlayerProvider>
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
