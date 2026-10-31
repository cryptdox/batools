import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { useLanguage } from '../../lib/LanguageContext';
import { pfInputClass } from './PfFieldInput';

type Option = { value: string; label: string };

/**
 * A select for long option lists with long labels (e.g. paper titles): type to
 * filter, labels wrap inside the form instead of running past its edge.
 */
export const PfSearchSelect = ({ value, options, allowEmpty, onChange }: {
  value: string; options: Option[]; allowEmpty?: boolean; onChange: (v: string) => void;
}) => {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const picked = options.find(o => o.value === value);

  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const needle = query.trim().toLowerCase();
  const shown = options.filter(o => !needle || t(o.label).toLowerCase().includes(needle));
  const choose = (v: string) => { onChange(v); setOpen(false); setQuery(''); };

  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className={`${pfInputClass} min-h-10 h-auto flex items-start gap-2 text-left`}>
        <span className={`flex-1 min-w-0 whitespace-normal break-words ${picked ? '' : 'text-gray-400'}`}>{picked ? t(picked.label) : '—'}</span>
        {allowEmpty && picked && (
          <span role="button" tabIndex={0} onClick={e => { e.stopPropagation(); onChange(''); }}
            onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); onChange(''); } }}
            className="mt-0.5 text-gray-400 hover:text-danger" title={t('pf.common.clear')}>
            <X size={15} />
          </span>
        )}
        <ChevronDown size={16} className={`mt-0.5 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg">
          <div className="relative p-2 border-b border-gray-100 dark:border-gray-800">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input ref={search} value={query} onChange={e => setQuery(e.target.value)} placeholder={t('pf.common.search')}
              onKeyDown={e => { if (e.key === 'Escape') setOpen(false); if (e.key === 'Enter' && shown[0]) { e.preventDefault(); choose(shown[0].value); } }}
              className={`${pfInputClass} h-9 pl-8`} />
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {allowEmpty && (
              <li><button type="button" onClick={() => choose('')} className="w-full px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800">—</button></li>
            )}
            {shown.map(o => (
              <li key={o.value}>
                <button type="button" onClick={() => choose(o.value)}
                  className={`w-full flex items-start gap-2 px-3 py-2 text-left text-sm whitespace-normal break-words hover:bg-gray-50 dark:hover:bg-gray-800 ${o.value === value ? 'text-primary font-medium' : 'text-gray-700 dark:text-gray-300'}`}>
                  <span className="flex-1 min-w-0">{t(o.label)}</span>
                  {o.value === value && <Check size={15} className="mt-0.5 shrink-0" />}
                </button>
              </li>
            ))}
            {!shown.length && <li className="px-3 py-3 text-sm text-gray-500">{t('pf.common.empty')}</li>}
          </ul>
        </div>
      )}
    </div>
  );
};
