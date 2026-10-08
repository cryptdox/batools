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
  REFRESH_LEAD_MS,
  SESSION_EVENT,
  type IamSession,
  type IamUser,
} from './iam';

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

  // Keep the access token fresh while signed in.
  useEffect(() => {
    window.clearTimeout(refreshTimer.current);
    if (!session || loading) return;
    const exp = getTokenExpiry(session.accessToken);
    const delay = exp === null ? 0 : Math.max(exp * 1000 - Date.now() - REFRESH_LEAD_MS, 0);
    refreshTimer.current = window.setTimeout(() => { void refresh(); }, delay);
    return () => window.clearTimeout(refreshTimer.current);
  }, [session, loading, refresh, retryTick]);

  // Timers are throttled in background tabs and stop while the computer sleeps:
  // check again when the tab comes back or the network returns.
  useEffect(() => {
    const check = () => {
      const current = loadSession();
      if (document.visibilityState === 'visible' && current && isExpiringSoon(current.accessToken)) void refresh();
    };
    document.addEventListener('visibilitychange', check);
    window.addEventListener('online', check);
    return () => {
      document.removeEventListener('visibilitychange', check);
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

  const signIn = async (email: string, password: string, captchaToken: string) => {
    try {
      setSession(await iamLogin(email, password, captchaToken));
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
    if (next) setSession(next);
    return !!next;
  };

  const completeEmbeddedSignIn = (event: MessageEvent) => {
    const next = acceptEmbeddedLogin(event);
    if (next) setSession(next);
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

  return (
    <AuthContext.Provider value={{ user, userEmail: user?.email ?? null, orgId, loading, signIn, signInWithRedirect, completeRedirectSignIn, completeEmbeddedSignIn, signOut, getAccessToken }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
