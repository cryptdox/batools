import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';
import { useLanguage } from '../../lib/LanguageContext';
import { countUnknown, UNKNOWN } from './MpSongFilters';

const PARAM = { singer: 'singer', source: 'source', album: 'collection' } as const;

/**
 * "Unknown singer / source / album": songs with none, shown as the first card
 * of the Singers / Sources / Albums & Mixes lists; opens the library filtered
 * to them (where a singer, source or album can then be given). Hidden when none.
 */
export const MpUnknownCard = ({ what, className = '' }: { what: 'singer' | 'source' | 'album'; className?: string }) => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => { void countUnknown(what).then(setCount).catch(() => setCount(null)); }, [what]);
  if (!count) return null;
  return (
    <button
      type="button"
      onClick={() => navigate(`/mp?${PARAM[what]}=${UNKNOWN}`)}
      className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-dashed border-gray-300 dark:border-gray-600 p-4 flex items-center gap-3 text-left hover:shadow-md hover:border-primary transition ${className}`}
    >
      <span className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-400 flex items-center justify-center shrink-0"><HelpCircle size={22} /></span>
      <span className="min-w-0">
        <span className="block font-semibold text-gray-900 dark:text-gray-100 truncate">{t(`mp.unknown.${what}`)}</span>
        <span className="block text-xs text-gray-500">{count} {t('mp.songs')} · {t('mp.unknown.hint')}</span>
      </span>
    </button>
  );
};
