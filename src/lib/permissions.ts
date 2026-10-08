import { useAuth } from './AuthContext';

// Page access comes from IAM: each batools page is a UI_PAGE resource of the
// "batools" client, and a page is shown when the user holds READ or READ_ALL on
// it (permission strings `BATOOLS:<resource>:<action>:UI_PAGE`, see /auth/me).
// Every page of every module has a resource, so a user sees only what their
// roles grant; the batools ADMIN role holds them all (IAM adds a new resource's
// permissions to ADMIN automatically). Like the sign-in, this only gates the UI.

const CLIENT = 'BATOOLS';
const TYPE = 'UI_PAGE';

/** IAM resource of each page (path → resource name, spelled as in IAM). */
export const PAGE_RESOURCES: Record<string, string> = {
  '/late-tracker': 'LATE_TRACKER',
  '/late-tracker/daily-tracker': 'LATE_TRACKER_DAILY',
  '/late-tracker/team': 'LATE_TRACKER_MEMBER',
  '/late-tracker/punishment': 'LATE_TRACKER_PUNISHMENT',
  '/late-tracker/reports': 'LATE_TRACKER_COLLECTION_REPORT',
  '/late-tracker/attendance-report': 'LATE_TRACKER_ATTENDANCE_REPORT',
  '/late-tracker/spend': 'LATE_TRACKER_SPEND',
  '/late-tracker/settings': 'LATE_TRACKER_SETTINGS',
  '/ac': 'ACHIVEMENT_CYCLE_DASHBOARD',
  '/ac/board': 'ACHIVEMENT_CYCLE_KANBAN',
  '/ac/topics': 'ACHIVEMENT_CYCLE_TOPICS',
  '/ac/explore': 'ACHIVEMENT_CYCLE_EXPLORE',
  '/ac/milestones': 'ACHIVEMENT_CYCLE_MILESTONE',
  '/task-manager': 'TASK_MANAGER_DAILY',
  '/task-store': 'TASK_MANAGER_STORE',
  '/vocabulary': 'TASK_MANAGER_VOCABULARY',
  '/task-administration': 'TASK_MANAGER_ADMINISTRATION',
  '/pb': 'PARTNER_BUSINESS_DASHBOARD',
  '/pb/products': 'PARTNER_BUSINESS_PRODUCTS',
  '/pb/buy': 'PARTNER_BUSINESS_BUY',
  '/pb/sell': 'PARTNER_BUSINESS_SELL',
  '/pb/costs': 'PARTNER_BUSINESS_COSTS',
  '/pb/assets': 'PARTNER_BUSINESS_ASSETS',
  '/pb/partners': 'PARTNER_BUSINESS_PARTNERS',
  '/pb/share-groups': 'PARTNER_BUSINESS_SHARE_GROUPS',
  '/pb/ledger': 'PARTNER_BUSINESS_LEDGER',
  '/pb/adjust': 'PARTNER_BUSINESS_PROFIT_ADJUST',
  '/portfolio': 'PORTFOLIO_PROFILE',
  '/portfolio/about': 'PORTFOLIO_ABOUT',
  '/portfolio/projects': 'PORTFOLIO_PROJECTS',
  '/portfolio/experience': 'PORTFOLIO_EXPERIENCE',
  '/portfolio/tech-stack': 'PORTFOLIO_TECH_STACK',
  '/portfolio/research': 'PORTFOLIO_RESEARCH',
  '/portfolio/labels': 'PORTFOLIO_LABELS',
  '/portfolio/messages': 'PORTFOLIO_MESSAGES',
  '/org': 'ORG_SITE_ABOUT',
  '/org/services': 'ORG_SITE_SERVICES',
  '/org/products': 'ORG_SITE_PRODUCTS',
  '/org/projects': 'ORG_SITE_PROJECTS',
  '/org/clients': 'ORG_SITE_CLIENTS',
  '/org/teams': 'ORG_SITE_TEAMS',
  '/org/members': 'ORG_SITE_MEMBERS',
  '/org/blog': 'ORG_SITE_BLOG',
  '/org/jobs': 'ORG_SITE_JOBS',
  '/org/faqs': 'ORG_SITE_FAQS',
  '/org/applications': 'ORG_SITE_APPLICATIONS',
  '/org/contacts': 'ORG_SITE_CONTACTS',
  '/mp': 'MUSIC_LIBRARY',
  '/mp/collections': 'MUSIC_COLLECTIONS',
  '/mp/player': 'MUSIC_PLAYER',
  '/mp/singers': 'MUSIC_SINGERS',
  '/mp/sources': 'MUSIC_SOURCES',
  '/mp/genres': 'MUSIC_GENRES',
  '/mp/places': 'MUSIC_PLACES',
};

/** Pages under a path (e.g. one album) use that path's resource. */
const PREFIX_RESOURCES: [string, string][] = [['/mp/collections/', 'MUSIC_COLLECTIONS']];

/** The IAM resource guarding a path, or null for paths that are not pages (redirects, callback). */
export const resourceOf = (path: string): string | null =>
  PAGE_RESOURCES[path] ?? PREFIX_RESOURCES.find(([prefix]) => path.startsWith(prefix))?.[1] ?? null;

/** Sections inside a page that have their own resource. */
export const SECTION_RESOURCES = {
  acDomains: 'ACHIVEMENT_CYCLE_DOMAIN',
  acDomainTypes: 'ACHIVEMENT_CYCLE_DOMAIN_TYPE',
} as const;

export type Action = 'READ' | 'READ_ALL' | 'CREATE' | 'UPDATE' | 'UPDATE_ALL' | 'DELETE' | 'DELETE_ALL';

export const permissionKey = (resource: string, action: Action) => `${CLIENT}:${resource}:${action}:${TYPE}`;

/** Access checks for the signed-in user. Before permissions load, nothing gated is allowed. */
export function useAccess() {
  const { permissions, accessState, reloadAccess } = useAuth();
  const has = (resource: string, action: Action) => permissions.includes(permissionKey(resource, action));
  const canRead = (resource: string) => has(resource, 'READ') || has(resource, 'READ_ALL');
  /** Whether a page (path) may be opened: needs READ / READ_ALL on its resource. */
  const canOpen = (path: string) => {
    const resource = resourceOf(path);
    return !resource || canRead(resource);
  };
  return { has, canRead, canOpen, accessState, reloadAccess };
}
