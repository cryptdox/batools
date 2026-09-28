import { useState, type FormEvent } from 'react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../lib/AuthContext';
import { Turnstile } from '../../components/ui/Turnstile';
import { LogIn } from 'lucide-react';

export const Login = () => {
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
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 space-y-5 animate-fade-in-scale"
      >
        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-bold text-white text-xl shadow-lg">
            B
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Bangla Tools</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Sign in to continue</p>
        </div>

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
