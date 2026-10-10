import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HelpCircle, ListPlus } from 'lucide-react';
import { useLanguage } from '../../lib/LanguageContext';
import { useMpUserId } from '../../lib/music';
import { countUnknown, UNKNOWN } from './MpSongFilters';
import { MpAssignUnknown } from './MpAssignUnknown';

const PARAM = { singer: 'singer', source: 'source', album: 'collection' } as const;

/**
 * "Unknown singer / source / album": songs with none, shown as the first card
 * of the Singers / Sources / Albums & Mixes lists; opens the library filtered
 * to them; Assign gives many of them a singer / source / album at once. Hidden when none.
 */
export const MpUnknownCard = ({ what, className = '' }: { what: 'singer' | 'source' | 'album'; className?: string }) => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const userId = useMpUserId();
  const [count, setCount] = useState<number | null>(null);
  const [assigning, setAssigning] = useState(false);
  const reload = () => { void countUnknown(what).then(setCount).catch(() => setCount(null)); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(reload, [what]);
  if (!count) return null;
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-dashed border-gray-300 dark:border-gray-600 p-4 flex items-center gap-3 hover:shadow-md hover:border-primary transition ${className}`}>
      <button type="button" onClick={() => navigate(`/mp?${PARAM[what]}=${UNKNOWN}`)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
        <span className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-400 flex items-center justify-center shrink-0"><HelpCircle size={22} /></span>
        <span className="min-w-0">
          <span className="block font-semibold text-gray-900 dark:text-gray-100 truncate">{t(`mp.unknown.${what}`)}</span>
          <span className="block text-xs text-gray-500">{count} {t('mp.songs')} · {t('mp.unknown.hint')}</span>
        </span>
      </button>
      {userId && (
        <button type="button" onClick={() => setAssigning(true)} title={t('mp.unknown.assign')} aria-label={t('mp.unknown.assign')}
          className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium border border-primary/30 text-primary hover:bg-primary/10">
          <ListPlus size={14} />{t('mp.unknown.assign')}
        </button>
      )}
      {assigning && userId && (
        <MpAssignUnknown what={what} userId={userId} onClose={() => setAssigning(false)} onDone={() => { setAssigning(false); reload(); }} />
      )}
    </div>
  );
};
