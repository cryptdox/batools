import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';

/** Landing page for the IAM frontend's redirect login: the session arrives in the
 * URL fragment, which is stripped from history right away so tokens don't linger.
 * Once stored, AuthGate switches to the signed-in routes, where this path
 * redirects home. */
export const AuthCallback = () => {
  const { completeRedirectSignIn } = useAuth();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    window.history.replaceState(null, '', window.location.pathname);
    if (!completeRedirectSignIn(hash)) setFailed(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-theme-main text-gray-500">
      {failed ? (
        <>
          <p className="text-sm text-danger">Sign-in could not be completed.</p>
          <Link to="/" className="text-sm text-primary hover:underline">Back to sign in</Link>
        </>
      ) : (
        'Signing in...'
      )}
    </div>
  );
};
