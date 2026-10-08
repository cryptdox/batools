import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Search, Star, X } from 'lucide-react';
import { useLanguage } from '../../lib/LanguageContext';
import type { AcTopic } from '../../lib/achievementCycle';
import { pfInputClass } from '../portfolio/PfFieldInput';

const MAX_SHOWN = 50;
const PANEL_PX = 320;

/** Searchable checkbox dropdown for picking several topics at once. */
export const AcTopicMultiPicker = ({ topics, value, onChange, placeholder }: {
  topics: AcTopic[]; value: Set<string>; onChange: (ids: Set<string>) => void; placeholder: string;
}) => {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const box = useRef<HTMLDivElement>(null);
  // Opens to the right unless that would run past the window; then it hangs from the right edge.
  const [alignRight, setAlignRight] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const needle = search.trim().toLowerCase();
  const matches = topics.filter(x => !needle || x.name.toLowerCase().includes(needle));
  const shown = matches.slice(0, MAX_SHOWN);

  const toggle = (id: string) => {
    const next = new Set(value);
    if (!next.delete(id)) next.add(id);
    onChange(next);
  };
  const selectShown = () => onChange(new Set([...value, ...shown.map(x => x.id)]));

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => {
          const rect = box.current?.getBoundingClientRect();
          setAlignRight(!!rect && rect.left + PANEL_PX > document.documentElement.clientWidth - 8);
          setOpen(o => !o);
        }}
        className={`${pfInputClass.replace('w-full ', '')} h-8 py-0 w-56 text-xs inline-flex items-center gap-2`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="flex-1 truncate text-left">
          {value.size === 0 ? placeholder : t('ac.detail.nSelected').replace('{n}', String(value.size))}
        </span>
        {value.size > 0
          ? <X size={14} className="text-gray-400 hover:text-gray-600 shrink-0" onClick={e => { e.stopPropagation(); onChange(new Set()); }} />
          : <ChevronDown size={14} className="text-gray-400 shrink-0" />}
      </button>
      {open && (
        <div
          className={`absolute z-30 mt-1 max-w-[calc(100vw-2rem)] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg ${alignRight ? 'right-0' : 'left-0'}`}
          style={{ width: PANEL_PX }}
        >
          <div className="relative p-2 border-b border-gray-100 dark:border-gray-700">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('pf.common.search')}
              className={`${pfInputClass} h-8 pl-7`}
            />
          </div>
          {shown.length > 0 && (
            <div className="flex items-center justify-between px-3 pt-1.5 text-xs">
              <button type="button" className="text-primary hover:underline" onClick={selectShown}>{t('ac.detail.selectShown')}</button>
              {value.size > 0 && <button type="button" className="text-gray-500 hover:underline" onClick={() => onChange(new Set())}>{t('ac.detail.clearSelection')}</button>}
            </div>
          )}
          <ul role="listbox" aria-multiselectable className="max-h-72 overflow-y-auto py-1 text-sm">
            {shown.map(x => (
              <li key={x.id}>
                <label className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200">
                  <input type="checkbox" checked={value.has(x.id)} onChange={() => toggle(x.id)} className="w-4 h-4 text-primary rounded border-gray-300 shrink-0" />
                  {x.is_milestone && <Star size={12} className="fill-warning text-warning shrink-0" />}
                  <span className="truncate">{x.name}</span>
                </label>
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
