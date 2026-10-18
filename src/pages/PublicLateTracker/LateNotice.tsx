import { useEffect, useState } from 'react';
import { format, parse, subMinutes } from 'date-fns';
import { Clock, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatTaka } from '../../components/ui/SummaryBar';
import { getDhakaDateString } from '../../lib/dhakaTime';

// The notice is shown once per page load for this long, then fades out.
const SHOW_MS = 30_000;
// Closing the notice hides it for the rest of the browser session.
const DISMISSED_KEY = 'lateNoticeDismissed';

const wasDismissed = () => {
  try {
    return sessionStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
};

type CurrentSetting = { late_threshold: string; punishment_amount: number; effective_from: string };

// Last on-time minute, since arriving at the threshold itself counts as late:
// "10:00:00" -> "9:59 AM"
const formatLastOnTime = (t: string) =>
  format(subMinutes(parse(t, 'HH:mm:ss', new Date()), 1), 'h:mm a');

/**
 * Banner reminding everyone of the current late time and late fee. It fades in
 * on load and out after a while; closing it hides it for the whole session.
 */
export const LateNotice = () => {
  const [setting, setSetting] = useState<CurrentSetting | null>(null);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(wasDismissed);

  useEffect(() => {
    if (dismissed) return;
    const load = async () => {
      // Settings are versioned; the current one is the latest already in effect.
      const { data, error } = await supabase
        .from('lt_attendance_settings')
        .select('late_threshold, punishment_amount, effective_from')
        .lte('effective_from', new Date().toISOString())
        .order('effective_from', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) console.error(error);
      else if (data) setSetting({
        late_threshold: data.late_threshold,
        punishment_amount: Number(data.punishment_amount),
        effective_from: data.effective_from,
      });
    };
    void load();
    // Only the first mount matters: once dismissed there is nothing to load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!setting) return;
    // Mount hidden, then show on the next tick so the fade-in transition runs.
    const showId = setTimeout(() => setVisible(true), 50);
    const hideId = setTimeout(() => setVisible(false), SHOW_MS);
    return () => {
      clearTimeout(showId);
      clearTimeout(hideId);
    };
  }, [setting]);

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Storage unavailable: it still stays hidden until the page reloads.
    }
  };

  if (!setting || dismissed) return null;

  return (
    <div
      role="status"
      aria-hidden={!visible}
      className={`fixed top-20 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-xl transition-opacity duration-1000 ${
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div className="flex items-center gap-3 rounded-xl border border-warning/40 bg-white dark:bg-gray-800 shadow-lg px-4 py-3">
        <Clock size={20} className="text-[#d49a15] dark:text-warning shrink-0" />
        <p className="flex-1 text-sm text-gray-700 dark:text-gray-200">
          Please arrive by{' '}
          <span className="font-bold text-gray-900 dark:text-gray-100">{formatLastOnTime(setting.late_threshold)}</span>.
          Arriving after this time adds a late fee of{' '}
          <span className="font-bold text-danger">{formatTaka(setting.punishment_amount)}</span>.
          <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            In effect since {format(parse(getDhakaDateString(new Date(setting.effective_from)), 'yyyy-MM-dd', new Date()), 'MMMM d, yyyy')}
          </span>
        </p>
        <button
          onClick={dismiss}
          className="p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors"
          aria-label="Dismiss notice"
          tabIndex={visible ? 0 : -1}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};
