import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: { sitekey: string; callback: (token: string) => void; 'expired-callback'?: () => void; 'error-callback'?: () => void },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

// Same pairing as the IAM frontend: Cloudflare's "always passes" test site key
// for every non-production build, matching the IAM backend which uses the test
// secret for every phase except PROD.
const CLOUDFLARE_TEST_SITE_KEY = '1x00000000000000000000AA';
const TURNSTILE_SITE_KEY = import.meta.env.PROD
  ? ((import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) || CLOUDFLARE_TEST_SITE_KEY)
  : CLOUDFLARE_TEST_SITE_KEY;
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

let scriptLoadingPromise: Promise<void> | null = null;
function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptLoadingPromise) return scriptLoadingPromise;
  scriptLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptLoadingPromise = null;
      reject(new Error('Failed to load Turnstile script'));
    };
    document.head.appendChild(script);
  });
  return scriptLoadingPromise;
}

/** Cloudflare Turnstile widget; reports the captcha token the IAM login
 * endpoint requires. Tokens are single-use — remount (change `key`) to get a
 * fresh one after a failed login. */
export const Turnstile = ({ onVerify, onExpire }: { onVerify: (token: string) => void; onExpire?: () => void }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    loadTurnstileScript()
      .then(() => {
        if (!mounted || !containerRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: onVerify,
          'expired-callback': onExpire,
          'error-callback': onExpire,
        });
      })
      .catch(err => console.error(err));

    return () => {
      mounted = false;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
    };
    // Runs once per mount; callers remount via `key` to reset the widget.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className="flex justify-center" />;
};
