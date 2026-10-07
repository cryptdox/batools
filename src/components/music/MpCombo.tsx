import { useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { useLanguage } from '../../lib/LanguageContext';
import { pfInputClass } from '../portfolio/PfFieldInput';

export type ComboItem = { id: string; label: string; hint?: string | null };

const LIMIT = 5;

/**
 * Searchable picker: focus shows the first `limit` items (default 5), typing narrows them
 * (names starting with the text come first). Shows the picked item's label
 * while closed. With `multi`, the box empties after each pick (the caller
 * shows the picked items, and passes them in `exclude`). With `onCreate`,
 * an unknown name can be added on the spot.
 */
export const MpCombo = ({ items, value, onChange, placeholder, onCreate, createLabel, exclude = [], multi = false, limit = LIMIT, className = '' }: {
  items: ComboItem[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  onCreate?: (name: string) => Promise<string | null | void>;
  createLabel?: (name: string) => string;
  exclude?: string[];
  multi?: boolean;
  limit?: number;
  className?: string;
}) => {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [active, setActive] = useState(0);
  const [creating, setCreating] = useState(false);

  const picked = items.find(i => i.id === value);
  const needle = text.trim().toLowerCase();
  const pool = items.filter(i => !exclude.includes(i.id));
  const matches = (needle
    ? [...pool.filter(i => i.label.toLowerCase().startsWith(needle)), ...pool.filter(i => !i.label.toLowerCase().startsWith(needle) && i.label.toLowerCase().includes(needle))]
    : pool
  ).slice(0, limit);
  const exact = items.some(i => i.label.toLowerCase() === needle);
  const canCreate = !!onCreate && !!needle && !exact;
  const total = matches.length + (canCreate ? 1 : 0);

  const close = () => { setOpen(false); setText(''); setActive(0); };
  const pick = (id: string) => { onChange(id); close(); };
  const create = async () => {
    if (!onCreate || creating) return;
    setCreating(true);
    const id = await onCreate(text.trim());
    setCreating(false);
    if (id) pick(id);
  };
  const choose = (i: number) => {
    if (i < matches.length) pick(matches[i].id);
    else if (canCreate) void create();
  };

  return (
    <div className={`relative ${className}`}>
      <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      <input
        value={open ? text : multi ? '' : picked?.label ?? ''}
        onChange={e => { setText(e.target.value); setActive(0); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={close}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(total - 1, a + 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)); }
          else if (e.key === 'Enter') { e.preventDefault(); if (total) choose(active); }
          else if (e.key === 'Escape') (e.target as HTMLInputElement).blur();
        }}
        placeholder={picked && !multi ? picked.label : placeholder ?? t('pf.common.search')}
        className={`${pfInputClass} h-10 pl-8 ${value && !multi ? 'pr-8' : ''}`}
      />
      {value && !multi && !open && (
        <button type="button" onClick={() => onChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-gray-400 hover:text-gray-600" aria-label={t('mp.combo.clear')}>
          <X size={14} />
        </button>
      )}
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg overflow-hidden">
          {total === 0 && <div className="px-3 py-2 text-sm text-gray-500">{t('pf.common.empty')}</div>}
          {matches.map((m, i) => (
            <button key={m.id} type="button" onMouseDown={e => e.preventDefault()} onClick={() => pick(m.id)} onMouseEnter={() => setActive(i)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left ${i === active ? 'bg-gray-100 dark:bg-gray-700' : ''}`}>
              <span className="flex-1 min-w-0 truncate text-gray-800 dark:text-gray-200">{m.label}</span>
              {m.hint && <span className="text-[11px] text-gray-400 shrink-0">{m.hint}</span>}
            </button>
          ))}
          {canCreate && (
            <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => void create()} onMouseEnter={() => setActive(matches.length)}
              disabled={creating}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left text-primary ${active === matches.length ? 'bg-gray-100 dark:bg-gray-700' : ''}`}>
              <Plus size={14} className="shrink-0" /><span className="truncate">{createLabel ? createLabel(text.trim()) : text.trim()}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

/** Several items as removable chips, plus a 5-match search box to add more. */
export const MpMultiPick = ({ items, value, onChange, placeholder }: {
  items: ComboItem[];
  value: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
}) => (
  <div>
    {value.length > 0 && (
      <div className="flex flex-wrap gap-1.5 mb-2">
        {value.map(id => {
          const it = items.find(x => x.id === id);
          return it && (
            <span key={id} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary max-w-full">
              <span className="truncate">{it.label}</span>
              <button type="button" onClick={() => onChange(value.filter(x => x !== id))} className="p-0.5 rounded-full hover:bg-black/10" aria-label={`Remove ${it.label}`}><X size={12} /></button>
            </span>
          );
        })}
      </div>
    )}
    <MpCombo multi items={items} value="" exclude={value} onChange={id => onChange([...value, id])} placeholder={placeholder} />
  </div>
);
