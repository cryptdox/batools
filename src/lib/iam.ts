// Client for the Identity and Access Management backend (login / refresh /
// logout). The IAM resolves which client + realm a login belongs to from the
// x-cr-access-code header, so VITE_IAM_CR_ACCESS_CODE is what actually ties
// this app to the "batools" client; VITE_IAM_CLIENT_ID is kept for reference.
const IAM_API_BASE_URL = (import.meta.env.VITE_IAM_API_BASE_URL as string | undefined) ?? 'https://crypt-iam-latest.onrender.com/api';
const IAM_CR_ACCESS_CODE = import.meta.env.VITE_IAM_CR_ACCESS_CODE as string | undefined;
export const IAM_CLIENT_ID = import.meta.env.VITE_IAM_CLIENT_ID as string | undefined;

// How Sign In works (VITE_IAM_LOGIN_MODE):
//  'embed' (default) shows the IAM frontend's /sso/login page in an iframe here, which
//    posts the session back to this window;
//  'redirect' goes to that page and comes back to REDIRECT_PATH;
//  'direct' keeps the in-app form.
const IAM_FRONTEND_URL = import.meta.env.VITE_IAM_FRONTEND_URL as string | undefined;
const LOGIN_MODES = ['embed', 'redirect', 'direct'] as const;
export const IAM_LOGIN_MODE: (typeof LOGIN_MODES)[number] =
  LOGIN_MODES.find(m => m === import.meta.env.VITE_IAM_LOGIN_MODE) ?? 'embed';
/** Must be registered as a LOGIN_CALLBACK redirect URI on the batools client in IAM. */
export const REDIRECT_PATH = '/auth/callback';

const CR_ACCESS_CODE_HEADER = 'x-cr-access-code';
const STORAGE_KEY = 'batools-iam-session';

export type IamUser = {
  userId: string;
  email: string;
  name?: string;
  isEmailVerified: boolean;
  isMasterRealmUser?: boolean;
};

export type IamSession = {
  accessToken: string;
  refreshToken: string;
  user: IamUser;
  /** Effective role names (direct, via groups and composites), from /auth/me after sign-in. */
  roles?: string[];
  /** Permission strings `CLIENTID:resource:action:type`, the same format the IAM backend caches. */
  permissions?: string[];
};

/** A role as /auth/me returns it (only the fields batools reads). */
type IamMeRole = {
  name: string;
  permissions: { action: string; resource: { name: string; type: string; clientId?: string | null } }[];
};

type ApiResponse<T> = {
  success: boolean;
  status: number;
  message: string;
  data?: T;
};

export class IamError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${IAM_API_BASE_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init.headers },
    });
  } catch {
    throw new IamError('Cannot reach the authentication server.', 0);
  }
  const body = (await res.json().catch(() => null)) as ApiResponse<T> | null;
  if (!res.ok || !body?.success) {
    throw new IamError(body?.message ?? `Request failed (${res.status})`, res.status);
  }
  return body.data as T;
}

// ---------------- session storage ----------------

export function loadSession(): IamSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as IamSession) : null;
  } catch {
    return null;
  }
}

/** Fired in this tab whenever the stored session changes (other tabs get `storage`). */
export const SESSION_EVENT = 'batools-iam-session-change';

export function saveSession(session: IamSession) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event(SESSION_EVENT));
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(SESSION_EVENT));
}

/** The JWT's payload, or null if it can't be read. */
function getTokenClaims(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Seconds-since-epoch `exp` claim of a JWT, or null if it can't be read. */
export function getTokenExpiry(token: string): number | null {
  const exp = getTokenClaims(token)?.exp;
  return typeof exp === 'number' ? exp : null;
}

/** Refresh this long before the access token's `exp` so requests never race it. */
export const REFRESH_LEAD_MS = 60_000;

export const isExpiringSoon = (token: string) => {
  const exp = getTokenExpiry(token);
  return exp === null || exp * 1000 - Date.now() < REFRESH_LEAD_MS;
};

/** The IAM realm the token was issued in (`realmId` claim), or null. */
export function getTokenRealmId(token: string): string | null {
  const realmId = getTokenClaims(token)?.realmId;
  return typeof realmId === 'string' && realmId ? realmId : null;
}

// ---------------- API calls ----------------

export async function iamLogin(email: string, password: string, captchaToken: string): Promise<IamSession> {
  if (!IAM_CR_ACCESS_CODE) {
    throw new IamError('VITE_IAM_CR_ACCESS_CODE is not configured in .env.', 0);
  }
  const data = await request<IamSession>('/auth/login', {
    method: 'POST',
    headers: { [CR_ACCESS_CODE_HEADER]: IAM_CR_ACCESS_CODE },
    body: JSON.stringify({ email, password, captchaToken }),
  });
  saveSession(data);
  return data;
}

/** URL of the IAM frontend's /sso/login page for this client. The backend only
 * accepts redirectUri if it is one of the client's LOGIN_CALLBACK URIs — embed mode
 * relies on that too, since the session is posted only to that URI's origin. */
export function iamSsoLoginUrl({ embed, theme }: { embed: boolean; theme?: 'light' | 'dark' }): string {
  if (!IAM_CR_ACCESS_CODE) {
    throw new IamError('VITE_IAM_CR_ACCESS_CODE is not configured in .env.', 0);
  }
  if (!IAM_FRONTEND_URL) {
    throw new IamError('VITE_IAM_FRONTEND_URL is not configured in .env.', 0);
  }
  const url = new URL('/sso/login', IAM_FRONTEND_URL);
  url.search = new URLSearchParams({
    crAccessCode: IAM_CR_ACCESS_CODE,
    redirectUri: `${window.location.origin}${REDIRECT_PATH}`,
    ...(embed ? { embed: 'true' } : {}),
    ...(theme ? { theme } : {}),
  }).toString();
  return url.toString();
}

/** Leaves the app for the IAM frontend's /sso/login page. */
export function iamRedirectLogin() {
  window.location.assign(iamSsoLoginUrl({ embed: false }));
}

/** Accepts the session the embedded /sso/login iframe posts on success — only from
 * the IAM frontend's own origin — and stores it. Null for any other message. */
export function acceptEmbeddedLogin(event: MessageEvent): IamSession | null {
  if (!IAM_FRONTEND_URL || event.origin !== new URL(IAM_FRONTEND_URL).origin) return null;
  const data = event.data as { type?: string; session?: Partial<IamSession> } | null;
  if (data?.type !== 'iam:login') return null;
  const { accessToken, refreshToken, user } = data.session ?? {};
  if (typeof accessToken !== 'string' || typeof refreshToken !== 'string' || !user?.userId) return null;
  const session: IamSession = { accessToken, refreshToken, user };
  saveSession(session);
  return session;
}

/** Height the embedded /sso/login iframe reports for its content, or null. */
export function embeddedLoginHeight(event: MessageEvent): number | null {
  if (!IAM_FRONTEND_URL || event.origin !== new URL(IAM_FRONTEND_URL).origin) return null;
  const data = event.data as { type?: string; height?: unknown } | null;
  return data?.type === 'iam:resize' && typeof data.height === 'number' ? data.height : null;
}

/** Reads the session the IAM frontend put in the URL fragment after a redirect
 * login, and stores it. Returns null if the fragment doesn't carry one. */
export function completeRedirectLogin(hash: string): IamSession | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  const rawUser = params.get('user');
  if (!accessToken || !refreshToken || !rawUser) return null;
  try {
    const session: IamSession = { accessToken, refreshToken, user: JSON.parse(rawUser) as IamUser };
    saveSession(session);
    return session;
  } catch {
    return null;
  }
}

// Refresh tokens are single-use (the backend rotates them and rejects the old one
// with a 401), so every caller — in this tab and in other tabs — must share one
// refresh: in-tab through `refreshInFlight`, across tabs through a Web Lock, and
// whoever gets the lock second re-reads storage and uses the tab-mate's result.
let refreshInFlight: Promise<IamSession> | null = null;

const REFRESH_LOCK = 'batools-iam-refresh';

const withRefreshLock = <T,>(fn: () => Promise<T>): Promise<T> =>
  typeof navigator !== 'undefined' && navigator.locks
    ? navigator.locks.request(REFRESH_LOCK, fn)
    : fn();

/** A fresh session: the stored one if another tab already refreshed it, else a new one. */
export function iamRefresh(): Promise<IamSession> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = withRefreshLock(async () => {
    const current = loadSession();
    if (!current?.refreshToken) throw new IamError('No refresh token', 401);
    if (!isExpiringSoon(current.accessToken)) return current;
    try {
      const tokens = await request<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      });
      const next: IamSession = { ...current, ...tokens };
      saveSession(next);
      return next;
    } catch (err) {
      // Rejected, but someone (e.g. a tab without Web Locks) rotated it meanwhile: use theirs.
      const now = loadSession();
      if (now && now.refreshToken !== current.refreshToken) return now;
      throw err;
    }
  }).finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

/** Whether a refresh failure means the session is really gone (vs. a hiccup worth retrying). */
export const isSessionRejected = (err: unknown) =>
  err instanceof IamError && (err.status === 400 || err.status === 401 || err.status === 403);

/** The signed-in user's roles and permissions (GET /auth/me). */
export async function iamFetchAccess(accessToken: string): Promise<{ roles: string[]; permissions: string[] }> {
  const me = await request<{ roles?: IamMeRole[] }>('/auth/me', {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const roles = me.roles ?? [];
  const permissions = roles.flatMap(r => r.permissions.map(p =>
    `${(p.resource.clientId ?? '').toUpperCase()}:${p.resource.name}:${p.action}:${p.resource.type}`));
  return { roles: [...new Set(roles.map(r => r.name))], permissions: [...new Set(permissions)] };
}

/** Fetches roles / permissions for the stored session and saves them with it; null on failure. */
export async function loadSessionAccess(): Promise<IamSession | null> {
  const current = loadSession();
  if (!current) return null;
  try {
    const access = await iamFetchAccess(current.accessToken);
    // The session may have been refreshed or ended meanwhile: write onto the latest one.
    const latest = loadSession();
    if (!latest || latest.user.userId !== current.user.userId) return null;
    const next: IamSession = { ...latest, ...access };
    saveSession(next);
    return next;
  } catch {
    return null;
  }
}

// One /auth/me at a time, shared by AuthContext and the data guard (lib/supabase.ts).
let accessInFlight: Promise<IamSession | null> | null = null;

/** The stored session with its roles / permissions, loading them first if needed; null when signed out or they can't load. */
export function ensureSessionAccess(): Promise<IamSession | null> {
  const current = loadSession();
  if (!current) return Promise.resolve(null);
  if (current.permissions) return Promise.resolve(current);
  accessInFlight ??= loadSessionAccess().finally(() => { accessInFlight = null; });
  return accessInFlight;
}

export async function iamLogout(accessToken: string) {
  await request<null>('/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
