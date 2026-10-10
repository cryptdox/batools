// When the person last used batools (any tab): pointer, keys, wheel / scroll,
// touch, or coming back to the tab. AuthContext only refreshes the IAM token in
// the background while this is recent; after a longer break it waits for them
// to come back and refreshes then.

/** Idle longer than this and background token refreshes stop. */
export const IDLE_LIMIT_MS = 15 * 60 * 1000;

const KEY = 'batools-last-activity';
const WRITE_EVERY_MS = 15_000;
let last = Date.now();
let written = 0;

/** Last activity in this or any other tab. */
export function lastActivity(): number {
  let shared = 0;
  try { shared = Number(localStorage.getItem(KEY)) || 0; } catch { /* this tab only */ }
  return Math.max(last, shared);
}

export const isRecentlyActive = () => Date.now() - lastActivity() < IDLE_LIMIT_MS;

function markActive() {
  last = Date.now();
  if (last - written < WRITE_EVERY_MS) return;
  written = last;
  try { localStorage.setItem(KEY, String(last)); } catch { /* this tab only */ }
}

const EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;

/** Tracks activity; `onActive` runs (at most every few seconds) whenever the person does something. */
export function trackActivity(onActive: () => void): () => void {
  let lastCall = 0;
  const handler = () => {
    if (document.visibilityState !== 'visible') return;
    markActive();
    const now = Date.now();
    if (now - lastCall < 5000) return;
    lastCall = now;
    onActive();
  };
  for (const e of EVENTS) window.addEventListener(e, handler, { capture: true, passive: true });
  document.addEventListener('visibilitychange', handler);
  markActive();
  return () => {
    for (const e of EVENTS) window.removeEventListener(e, handler, { capture: true });
    document.removeEventListener('visibilitychange', handler);
  };
}
