import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  acceptEmbeddedLogin,
  clearSession,
  completeRedirectLogin,
  getTokenExpiry,
  getTokenRealmId,
  isExpiringSoon,
  isSessionRejected,
  iamLogin,
  iamRedirectLogin,
  iamLogout,
  iamRefresh,
  loadSession,
  ensureSessionAccess,
  REFRESH_LEAD_MS,
  SESSION_EVENT,
  type IamSession,
  type IamUser,
} from './iam';
import { isRecentlyActive, trackActivity } from './activity';

// Login is delegated to the Identity and Access Management service. Note this
// only gates the UI: data access still goes through Supabase with the anon key.

// After a refresh that failed for a non-auth reason (offline, 429, 5xx), try again this soon.
const RETRY_MS = 30_000;

type AuthContextValue = {
  user: IamUser | null;
  userEmail: string | null;
  /** The signed-in user's IAM realm id; each realm is one organization (org_ tables). */
  orgId: string | null;
  loading: boolean;
  signIn: (email: string, password: string, captchaToken: string) => Promise<{ error: string | null }>;
  /** Leaves for the IAM frontend's /sso/login page; returns an error only if it can't. */
  signInWithRedirect: () => { error: string | null };
  /** Finishes a redirect login from the callback URL's fragment; false if it carried no session. */
  completeRedirectSignIn: (hash: string) => boolean;
  /** Finishes an embedded login from the IAM iframe's message; false for any other message. */
  completeEmbeddedSignIn: (event: MessageEvent) => boolean;
  signOut: () => void;
  /** Role names from IAM (/auth/me), loaded right after sign-in; empty until then. */
  roles: string[];
  /** Permission strings `CLIENTID:resource:action:type` from IAM, loaded right after sign-in. */
  permissions: string[];
  /** Whether the user has a permission (exact `CLIENTID:resource:action:type` string). */
  hasPermission: (permission: string) => boolean;
  /** 'loading' until roles / permissions arrive, 'error' if /auth/me failed (see reloadAccess). */
  accessState: 'loading' | 'ready' | 'error';
  reloadAccess: () => void;
  /** A non-expired access token, refreshing first if needed; null when signed out. */
  getAccessToken: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<IamSession | null>(() => loadSession());
  const [loading, setLoading] = useState(() => {
    const stored = loadSession();
    return !!stored && isExpiringSoon(stored.accessToken);
  });
  const refreshTimer = useRef<number | undefined>(undefined);
  // Bumped after a failed (but not rejected) refresh, to schedule a retry.
  const [retryTick, setRetryTick] = useState(0);

  const endSession = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const next = await iamRefresh();
      setSession(next);
      return next;
    } catch (err) {
      // Only a rejected refresh token ends the session; offline / rate limit / server
      // errors keep it and try again shortly.
      if (isSessionRejected(err)) endSession();
      else window.setTimeout(() => setRetryTick(n => n + 1), RETRY_MS);
      return null;
    }
  }, [endSession]);

  // On load: if the stored access token is stale, refresh before rendering the app.
  useEffect(() => {
    if (!loading) return;
    refresh().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the access token fresh while the person is using batools: a minute
  // before it expires, refresh it, but only if they were active in the last
  // 15 minutes. After a longer break nothing is refreshed in the background;
  // the next activity (below) refreshes it then (the refresh token lasts days).
  useEffect(() => {
    window.clearTimeout(refreshTimer.current);
    if (!session || loading) return;
    const exp = getTokenExpiry(session.accessToken);
    const delay = exp === null ? 0 : Math.max(exp * 1000 - Date.now() - REFRESH_LEAD_MS, 0);
    refreshTimer.current = window.setTimeout(() => { if (isRecentlyActive()) void refresh(); }, delay);
    return () => window.clearTimeout(refreshTimer.current);
  }, [session, loading, refresh, retryTick]);

  // Activity (or coming back to the tab, or the network returning) refreshes a
  // token that is about to expire or already has: covers the idle case above,
  // and timers that were throttled or stopped while the computer slept.
  useEffect(() => {
    const check = () => {
      const current = loadSession();
      if (document.visibilityState === 'visible' && current && isExpiringSoon(current.accessToken)) void refresh();
    };
    const stop = trackActivity(check);
    window.addEventListener('online', check);
    return () => {
      stop();
      window.removeEventListener('online', check);
    };
  }, [refresh]);

  // Stay in sync with the stored session: other tabs (storage) and refreshes made
  // outside this context, e.g. by the Supabase client (SESSION_EVENT).
  useEffect(() => {
    const sync = () => setSession(loadSession());
    window.addEventListener('storage', sync);
    window.addEventListener(SESSION_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(SESSION_EVENT, sync);
    };
  }, []);

  // Roles / permissions come from /auth/me, fetched as soon as a sign-in succeeds
  // (and once for a stored session that predates this, e.g. after an upgrade).
  const accessLoading = useRef(false);
  const [accessFailed, setAccessFailed] = useState(false);
  const loadAccess = useCallback(() => {
    if (accessLoading.current) return;
    accessLoading.current = true;
    setAccessFailed(false);
    void ensureSessionAccess()
      .then(next => { if (next) setSession(next); else if (loadSession()) setAccessFailed(true); })
      .finally(() => { accessLoading.current = false; });
  }, []);

  useEffect(() => {
    if (!loading && session && !session.permissions) loadAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session?.user.userId]);

  const signIn = async (email: string, password: string, captchaToken: string) => {
    try {
      setSession(await iamLogin(email, password, captchaToken));
      loadAccess();
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Login failed.' };
    }
  };

  const signInWithRedirect = () => {
    try {
      iamRedirectLogin();
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Login failed.' };
    }
  };

  const completeRedirectSignIn = (hash: string) => {
    const next = completeRedirectLogin(hash);
    if (next) { setSession(next); loadAccess(); }
    return !!next;
  };

  const completeEmbeddedSignIn = (event: MessageEvent) => {
    const next = acceptEmbeddedLogin(event);
    if (next) { setSession(next); loadAccess(); }
    return !!next;
  };

  const signOut = () => {
    const token = session?.accessToken;
    endSession();
    if (token) iamLogout(token).catch(() => { /* session already cleared locally */ });
  };

  const getAccessToken = useCallback(async () => {
    const current = loadSession();
    if (!current) return null;
    if (!isExpiringSoon(current.accessToken)) return current.accessToken;
    return (await refresh())?.accessToken ?? null;
  }, [refresh]);

  const user = session?.user ?? null;
  const orgId = session ? getTokenRealmId(session.accessToken) : null;
  const roles = session?.roles ?? [];
  const permissions = session?.permissions ?? [];
  const hasPermission = (permission: string) => permissions.includes(permission);
  const accessState = session?.permissions ? 'ready' : accessFailed ? 'error' : 'loading';

  return (
    <AuthContext.Provider value={{ user, userEmail: user?.email ?? null, orgId, loading, signIn, signInWithRedirect, completeRedirectSignIn, completeEmbeddedSignIn, signOut, getAccessToken, roles, permissions, hasPermission, accessState, reloadAccess: loadAccess }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
