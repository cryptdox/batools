import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Clock, Users, ShieldAlert, FileText, ClipboardList, Wallet, Settings, Moon, Sun, Menu, X, LogOut,
  ChevronDown, type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';

const APP_NAME = 'Bangla Tools';

type NavChild = { to: string; label: string; icon: LucideIcon };
type NavGroup = { key: string; label: string; icon: LucideIcon; children: NavChild[] };

const NAV_TREE: NavGroup[] = [
  {
    key: 'late-tracker',
    label: 'Late Tracker',
    icon: Clock,
    children: [
      { to: '/', label: 'Daily Tracker', icon: Clock },
      { to: '/team', label: 'Team Members', icon: Users },
      { to: '/punishment', label: 'Punishment', icon: ShieldAlert },
      { to: '/reports', label: 'Collection Report', icon: FileText },
      { to: '/attendance-report', label: 'Attendance Report', icon: ClipboardList },
      { to: '/spend', label: 'Spend', icon: Wallet },
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

const EXPANDED_STORAGE_KEY = 'sidebar-expanded-groups';
const COLLAPSED_STORAGE_KEY = 'sidebar-collapsed';

// Shared shell surface for the top bar and sidebar: the original navy, with a
// subtle fade to a darker shade of itself rather than a full-colour gradient.
const SHELL_BG = 'bg-gradient-to-b from-[#1e3162] to-[#131d3d]';

const SidebarChildLink = ({ to, icon: Icon, label, onClick, collapsed }: NavChild & { onClick: () => void; collapsed: boolean }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link
      to={to}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`flex items-center gap-3 pl-9 pr-4 py-2.5 rounded-lg transition-colors text-sm ${collapsed ? 'md:justify-center md:pl-0 md:pr-0' : ''} ${
        isActive
          ? 'bg-primary text-white font-semibold'
          : 'text-white/70 hover:text-white hover:bg-white/10'
      }`}
    >
      <Icon size={16} />
      <span className={`font-medium ${collapsed ? 'md:hidden' : ''}`}>{label}</span>
      {isActive && <div className={`ml-auto w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] ${collapsed ? 'md:hidden' : ''}`} />}
    </Link>
  );
};

const findActiveGroup = (pathname: string) =>
  NAV_TREE.find(group => group.children.some(child => child.to === pathname));

export const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [topBarHidden, setTopBarHidden] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_STORAGE_KEY) === 'true');
  const lastScrollTop = useRef(0);
  const location = useLocation();
  const { userEmail, signOut } = useAuth();
  const userInitials = (userEmail ?? '').slice(0, 2).toUpperCase() || '?';

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem(EXPANDED_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore malformed storage
    }
    return Object.fromEntries(NAV_TREE.map(g => [g.key, true]));
  });

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(EXPANDED_STORAGE_KEY, JSON.stringify(expandedGroups));
  }, [expandedGroups]);

  useEffect(() => {
    localStorage.setItem(COLLAPSED_STORAGE_KEY, String(collapsed));
  }, [collapsed]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');
  const toggleGroup = (key: string) => setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  const toggleSidebar = () => {
    setIsMobileMenuOpen(prev => !prev);
    setCollapsed(prev => !prev);
  };

  const activeGroup = findActiveGroup(location.pathname);
  const activeChild = activeGroup?.children.find(child => child.to === location.pathname);
  const pageTitle = activeChild?.label ?? 'Late Tracker';

  useEffect(() => {
    document.title = `${pageTitle} · ${APP_NAME}`;
  }, [pageTitle]);

  const handleContentScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    if (scrollTop > lastScrollTop.current && scrollTop > 40) {
      setTopBarHidden(true);
    } else if (scrollTop < lastScrollTop.current) {
      setTopBarHidden(false);
    }
    lastScrollTop.current = scrollTop;
  };

  return (
    <div className="flex flex-col h-screen bg-theme-main text-theme-main overflow-hidden font-sans">
      {/* Top Bar — full width, spans left to right above the sidebar and content */}
      <header
        className={`flex-shrink-0 w-full ${SHELL_BG} text-white flex items-center justify-between px-4 sm:px-6 overflow-hidden transition-[height,opacity] duration-300 ${
          topBarHidden ? 'h-0 opacity-0' : 'h-16 opacity-100'
        }`}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSidebar}
            title={collapsed ? 'Expand menu' : 'Collapse menu'}
            className="text-white/80 hover:text-white p-1.5 -ml-1.5 rounded-md hover:bg-white/10 transition-colors"
          >
            <Menu size={22} />
          </button>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-bold shadow-lg shrink-0">
            B
          </div>
          <span className="text-lg font-bold tracking-tight whitespace-nowrap">{APP_NAME}</span>
        </div>
        <button
          onClick={toggleTheme}
          className="p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Toggle dark mode"
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Mobile Overlay */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden animate-fade-in-scale"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar — sits below the top bar */}
        <aside className={`fixed inset-y-0 left-0 z-50 w-64 ${collapsed ? 'md:w-20' : 'md:w-64'} ${SHELL_BG} text-white flex flex-col transform transition-[transform,width] duration-300 md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="p-4 flex justify-end md:hidden">
            <button className="text-white/70 hover:text-white" onClick={() => setIsMobileMenuOpen(false)}>
              <X size={22} />
            </button>
          </div>

          <nav className="flex-1 px-4 py-2 space-y-2 overflow-y-auto mt-2">
            {NAV_TREE.map(group => {
              const GroupIcon = group.icon;
              const isExpanded = collapsed || (expandedGroups[group.key] ?? true);
              const isGroupActive = group.children.some(child => child.to === location.pathname);
              return (
                <div key={group.key}>
                  <button
                    onClick={() => { if (!collapsed) toggleGroup(group.key); }}
                    title={collapsed ? group.label : undefined}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${collapsed ? 'md:justify-center md:px-0' : ''} ${
                      isGroupActive ? 'text-white' : 'text-white/80 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <GroupIcon size={20} />
                    <span className={`font-semibold flex-1 text-left ${collapsed ? 'md:hidden' : ''}`}>{group.label}</span>
                    <ChevronDown size={16} className={`transition-transform ${isExpanded ? 'rotate-180' : ''} ${collapsed ? 'md:hidden' : ''}`} />
                  </button>
                  {isExpanded && (
                    <div className="mt-1 space-y-1">
                      {group.children.map(child => (
                        <SidebarChildLink key={child.to} {...child} collapsed={collapsed} onClick={() => setIsMobileMenuOpen(false)} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          <div className="p-4 border-t border-white/10 flex flex-col items-center gap-2">
              <div className={`w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors group ${collapsed ? 'md:justify-center' : ''}`}>
                 <div className="w-10 h-10 rounded-full bg-secondary text-white flex items-center justify-center font-bold shrink-0" title={collapsed ? (userEmail ?? undefined) : undefined}>
                   {userInitials}
                 </div>
                 <div className={`min-w-0 flex-1 ${collapsed ? 'md:hidden' : ''}`}>
                    <div className="font-medium text-sm truncate">{userEmail}</div>
                    <div className="text-xs text-white/60">Admin</div>
                 </div>
                 <button
                   onClick={signOut}
                   title="Sign out"
                   className={`text-white/70 hover:text-white p-1.5 rounded-md hover:bg-white/10 transition-colors shrink-0 ${collapsed ? 'md:hidden' : ''}`}
                 >
                   <LogOut size={16} />
                 </button>
              </div>
              {collapsed && (
                <button
                  onClick={signOut}
                  title="Sign out"
                  className="hidden md:flex text-white/70 hover:text-white p-1.5 rounded-md hover:bg-white/10 transition-colors"
                >
                  <LogOut size={16} />
                </button>
              )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-0">
          <div
            className="flex-1 overflow-auto bg-theme-main p-[25px] relative"
            onScroll={handleContentScroll}
          >
             <div className="animate-fade-in-scale">
                {children}
             </div>
          </div>
        </main>
      </div>
    </div>
  );
};
