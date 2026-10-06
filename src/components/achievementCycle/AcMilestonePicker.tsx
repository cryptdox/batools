import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Search, Star, X } from 'lucide-react';
import { useLanguage } from '../../lib/LanguageContext';
import type { AcTopic } from '../../lib/achievementCycle';
import { pfInputClass } from '../portfolio/PfFieldInput';

const MAX_SHOWN = 10;

/** Searchable milestone dropdown: shows up to 10 matches; '' = all milestones. */
export const AcMilestonePicker = ({ milestones, value, onChange }: { milestones: AcTopic[]; value: string; onChange: (id: string) => void }) => {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const selected = milestones.find(m => m.id === value) ?? null;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const needle = search.trim().toLowerCase();
  const matches = milestones.filter(m => !needle || m.name.toLowerCase().includes(needle));
  const shown = matches.slice(0, MAX_SHOWN);

  const pick = (id: string) => { onChange(id); setOpen(false); setSearch(''); };

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`${pfInputClass.replace('w-full ', '')} h-9 inline-flex items-center gap-2 max-w-60`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('ac.board.milestone')}
      >
        <Star size={14} className={selected ? 'fill-warning text-warning shrink-0' : 'text-gray-400 shrink-0'} />
        <span className="truncate">{selected ? selected.name : t('ac.board.allMilestones')}</span>
        {selected
          ? <X size={14} className="text-gray-400 hover:text-gray-600 shrink-0" onClick={e => { e.stopPropagation(); pick(''); }} />
          : <ChevronDown size={14} className="text-gray-400 shrink-0" />}
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-72 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
          <div className="relative p-2 border-b border-gray-100 dark:border-gray-700">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('ac.board.searchMilestones')}
              className={`${pfInputClass} h-8 pl-7`}
            />
          </div>
          <ul role="listbox" className="max-h-72 overflow-y-auto py-1 text-sm">
            <li>
              <button type="button" onClick={() => pick('')} className={`w-full text-left px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 ${!value ? 'font-semibold text-primary' : 'text-gray-700 dark:text-gray-200'}`}>
                {t('ac.board.allMilestones')}
              </button>
            </li>
            {shown.map(m => (
              <li key={m.id}>
                <button type="button" onClick={() => pick(m.id)} className={`w-full text-left px-3 py-1.5 truncate hover:bg-gray-50 dark:hover:bg-gray-700 ${m.id === value ? 'font-semibold text-primary' : 'text-gray-700 dark:text-gray-200'}`}>
                  {m.name}
                </button>
              </li>
            ))}
            {matches.length === 0 && <li className="px-3 py-2 text-gray-500">{t('pf.common.empty')}</li>}
            {matches.length > MAX_SHOWN && (
              <li className="px-3 py-1.5 text-xs text-gray-500">{t('ac.board.moreMilestones').replace('{n}', String(matches.length - MAX_SHOWN))}</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};
