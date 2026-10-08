import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../lib/AuthContext';
import { Turnstile } from '../../components/ui/Turnstile';
import { Link } from 'react-router-dom';
import { Briefcase, Clock, ExternalLink, Globe, GraduationCap, ListTodo, LogIn, Music, RotateCw, UserCircle, WifiOff } from 'lucide-react';
import { cn } from '../../components/ui/Button';
import { IAM_LOGIN_MODE, embeddedLoginHeight, iamSsoLoginUrl } from '../../lib/iam';

const Brand = () => (
  <div className="flex flex-col items-center text-center gap-2">
    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-bold text-white text-xl shadow-lg">
      B
    </div>
    <h1 className="text-xl font-bold text-gray-900 dark:text-white">Bangla Tools</h1>
    <p className="text-sm text-gray-500 dark:text-gray-400">Sign in to continue</p>
  </div>
);

const cardClass = 'w-full max-w-sm bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 space-y-5 animate-fade-in-scale';

/** VITE_IAM_LOGIN_MODE picks the flow — see lib/iam.ts. */
export const Login = () =>
  IAM_LOGIN_MODE === 'direct' ? <DirectLogin /> : IAM_LOGIN_MODE === 'redirect' ? <RedirectLogin /> : <EmbeddedLogin />;

/** Same key AppLayout persists the theme toggle under. */
const loginTheme = (): 'light' | 'dark' => {
  try {
    const stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // storage unavailable — fall through to the OS preference
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

/** Same modules (and icons) as the sidebar. */
const MODULES = [
  { icon: Clock, label: 'Late Tracker', hint: 'Attendance, fines and reports' },
  { icon: ListTodo, label: 'Task Manager', hint: 'Daily tasks and vocabulary' },
  { icon: GraduationCap, label: 'Achievement Cycle', hint: 'Topics, milestones and Kanban' },
  { icon: Briefcase, label: 'Partner Business', hint: 'Buy, sell, costs and ledger' },
  { icon: Music, label: 'Music', hint: 'Library, albums and player' },
  { icon: UserCircle, label: 'Portfolio', hint: 'Profile, projects and messages' },
  { icon: Globe, label: 'Organization Site', hint: 'Services, blog, jobs and team' },
];

/** If the form hasn't reported in by then, assume it can't load (offline, blocked, misconfigured). */
const EMBED_LOAD_TIMEOUT_MS = 15_000;

const FormSkeleton = () => (
  <div className="space-y-4 animate-pulse" aria-hidden>
    {[0, 1].map(i => (
      <div key={i} className="space-y-2">
        <div className="h-3.5 w-16 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-10 rounded-lg bg-gray-100 dark:bg-gray-700/60" />
      </div>
    ))}
    <div className="h-16 rounded-lg bg-gray-100 dark:bg-gray-700/60" />
    <div className="h-10 rounded-lg bg-primary/30" />
  </div>
);

/** Shows the IAM frontend's /sso/login page in place; it posts the session back on success. */
const EmbeddedLogin = () => {
  const { completeEmbeddedSignIn, signInWithRedirect } = useAuth();
  const [theme] = useState(loginTheme);
  const [height, setHeight] = useState(360);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  // Bumped by Retry to remount the iframe and start a fresh load.
  const [attempt, setAttempt] = useState(0);

  const src = useMemo(() => {
    try {
      return { url: iamSsoLoginUrl({ embed: true, theme }), error: null };
    } catch (err) {
      return { url: null, error: err instanceof Error ? err.message : 'Login is not configured.' };
    }
  }, [theme]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const h = embeddedLoginHeight(event);
      if (h !== null) {
        setHeight(h);
        setStatus('ready');
      } else {
        completeEmbeddedSignIn(event);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!src.url) return;
    setStatus('loading');
    const timer = window.setTimeout(() => setStatus(s => (s === 'loading' ? 'failed' : s)), EMBED_LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [src.url, attempt]);

  return (
    <div className="min-h-screen flex bg-theme-main">
      {/* Brand panel — large screens only; small screens get the compact header below. */}
      <aside className="hidden lg:flex relative w-[44%] flex-col justify-between overflow-hidden bg-gradient-to-br from-primary to-secondary p-12 text-white">
        <div className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-white/10 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 text-xl font-bold backdrop-blur">B</div>
          <span className="text-lg font-semibold">Bangla Tools</span>
        </div>

        <div className="relative space-y-8">
          <div className="space-y-3">
            <h2 className="text-3xl font-bold leading-tight">Your team&apos;s everyday tools, in one place.</h2>
            <p className="max-w-md text-white/80">One sign-in for attendance, tasks, learning goals, business books, music and your sites.</p>
          </div>
          <ul className="grid max-w-xl grid-cols-2 gap-2.5">
            {MODULES.map(({ icon: Icon, label, hint }) => (
              <li key={label} className="flex items-center gap-3 rounded-xl bg-white/10 px-3.5 py-2.5 backdrop-blur-sm min-w-0">
                <Icon size={20} className="shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-tight">{label}</p>
                  <p className="hidden xl:block mt-0.5 text-xs text-white/70 truncate">{hint}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/60">© {new Date().getFullYear()} Bangla Tools</p>
      </aside>

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm animate-fade-in-scale">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary text-xl font-bold text-white shadow-lg">B</div>
            <span className="text-lg font-semibold text-gray-900 dark:text-white">Bangla Tools</span>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome back</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Sign in with your Crypt account to continue.</p>

          <div className="mt-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            {!src.url ? (
              <p className="text-sm text-danger">{src.error}</p>
            ) : status === 'failed' ? (
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-danger">
                  <WifiOff size={22} />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Couldn&apos;t load the sign-in form</p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Check your connection and try again.</p>
                </div>
                <div className="flex w-full flex-col gap-2">
                  <Button type="button" className="w-full" onClick={() => setAttempt(a => a + 1)}>
                    <RotateCw size={16} className="mr-2" /> Try again
                  </Button>
                  <Button type="button" variant="outline" className="w-full" onClick={() => signInWithRedirect()}>
                    <ExternalLink size={16} className="mr-2" /> Open sign-in page
                  </Button>
                </div>
              </div>
            ) : (
              <div className="relative">
                {status === 'loading' && <FormSkeleton />}
                <iframe
                  key={attempt}
                  title="Sign in to Bangla Tools"
                  src={src.url}
                  className={cn(
                    'block w-full border-0 transition-opacity duration-300',
                    status === 'ready' ? 'opacity-100' : 'pointer-events-none absolute inset-0 opacity-0',
                  )}
                  // Matching color-scheme keeps the browser from painting an opaque
                  // backdrop behind the iframe's transparent page.
                  style={{ height, colorScheme: theme }}
                />
              </div>
            )}
          </div>

          <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
            Just checking today&apos;s board?{' '}
            <Link to="/late-tracker" className="font-medium text-primary hover:underline">
              View the public late tracker
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
};

/** Signs in on the IAM frontend, which redirects back to /auth/callback. */
const RedirectLogin = () => {
  const { signInWithRedirect } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  const handleClick = () => {
    setError(null);
    const { error } = signInWithRedirect();
    if (error) setError(error);
    else setLeaving(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-theme-main px-4">
      <div className={cardClass}>
        <Brand />
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="button" className="w-full" onClick={handleClick} disabled={leaving}>
          <LogIn size={18} className="mr-2" /> {leaving ? 'Redirecting...' : 'Sign In'}
        </Button>
      </div>
    </div>
  );
};

const DirectLogin = () => {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  // Captcha tokens are single-use; bumping this remounts the widget for a new one.
  const [captchaKey, setCaptchaKey] = useState(0);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!captchaToken) return;
    setSubmitting(true);
    setError(null);
    const { error } = await signIn(email, password, captchaToken);
    if (error) {
      setError(error);
      setCaptchaToken(null);
      setCaptchaKey(k => k + 1);
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-theme-main px-4">
      <form onSubmit={handleSubmit} className={cardClass}>
        <Brand />

        <Input
          label="Email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@company.com"
          autoFocus
          required
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="••••••••"
          required
        />

        <Turnstile key={captchaKey} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} />

        {error && <p className="text-sm text-danger">{error}</p>}

        <Button type="submit" className="w-full" disabled={submitting || !captchaToken}>
          <LogIn size={18} className="mr-2" /> {submitting ? 'Signing in...' : 'Sign In'}
        </Button>
      </form>
    </div>
  );
};
