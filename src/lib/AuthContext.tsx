import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  clearSession,
  getTokenExpiry,
  iamLogin,
  iamLogout,
  iamRefresh,
  loadSession,
  IamError,
  type IamSession,
  type IamUser,
} from './iam';

// Login is delegated to the Identity and Access Management service. Note this
// only gates the UI: data access still goes through Supabase with the anon key.

// Refresh this long before the access token's `exp` so requests never race it.
const REFRESH_LEAD_MS = 60_000;

type AuthContextValue = {
  user: IamUser | null;
  userEmail: string | null;
  loading: boolean;
  signIn: (email: string, password: string, captchaToken: string) => Promise<{ error: string | null }>;
  signOut: () => void;
  /** A non-expired access token, refreshing first if needed; null when signed out. */
  getAccessToken: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const isExpiringSoon = (token: string) => {
  const exp = getTokenExpiry(token);
  return exp === null || exp * 1000 - Date.now() < REFRESH_LEAD_MS;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<IamSession | null>(() => loadSession());
  const [loading, setLoading] = useState(() => {
    const stored = loadSession();
    return !!stored && isExpiringSoon(stored.accessToken);
  });
  const refreshTimer = useRef<number | undefined>(undefined);

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
      // Only a rejected refresh token ends the session; network hiccups keep it.
      if (err instanceof IamError && err.status !== 0) endSession();
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
  }, [session, loading, refresh]);

  // Other tabs rotate the refresh token too; stay in sync with what they store.
  useEffect(() => {
    const onStorage = () => setSession(loadSession());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const signIn = async (email: string, password: string, captchaToken: string) => {
    try {
      setSession(await iamLogin(email, password, captchaToken));
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Login failed.' };
    }
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

  return (
    <AuthContext.Provider value={{ user, userEmail: user?.email ?? null, loading, signIn, signOut, getAccessToken }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
