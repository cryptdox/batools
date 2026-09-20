import { createContext, useContext, useState, type ReactNode } from 'react';

// Static, env-based login gate. This is a UI convenience only, not real
// database security: the anon key still grants full access to the
// database (RLS stays permissive), and any VITE_-prefixed value here is
// bundled in plaintext into the client JS. Do not rely on this for
// anything beyond keeping casual visitors out of the UI.
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD;
const STORAGE_KEY = 'late-tracker-auth';

type AuthContextValue = {
  userEmail: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [userEmail, setUserEmail] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));

  const signIn = async (email: string, password: string) => {
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      return { error: 'VITE_ADMIN_EMAIL / VITE_ADMIN_PASSWORD are not configured in .env.' };
    }
    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
      return { error: 'Invalid email or password.' };
    }
    localStorage.setItem(STORAGE_KEY, email);
    setUserEmail(email);
    return { error: null };
  };

  const signOut = () => {
    localStorage.removeItem(STORAGE_KEY);
    setUserEmail(null);
  };

  return (
    <AuthContext.Provider value={{ userEmail, loading: false, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
