import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useLanguage } from '../../lib/LanguageContext';
import { usePfUserId } from '../../lib/portfolio';
import { loadSkillCategories, skillKey, type SkillCategory } from '../../lib/techSkills';
import { pfInputClass } from './PfFieldInput';

// Picks a project's tech stack from the Tech Stack skills. Typing filters the
// suggestions (grouped by category); a name that matches a skill takes the
// skill's spelling; anything else is added as new (and joins Tech Stack →
// Others when the project is saved). The value stays a comma-separated string.

const split = (v: string) => v.split(',').map(s => s.trim()).filter(Boolean);

export const PfSkillPicker = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => {
  const { t } = useLanguage();
  const userId = usePfUserId();
  const [categories, setCategories] = useState<SkillCategory[]>([]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (userId) loadSkillCategories(userId).then(setCategories).catch(() => setCategories([]));
  }, [userId]);

  const selected = split(value);
  const selectedKeys = new Set(selected.map(skillKey));
  /** Skill name by key, in the Tech Stack's spelling. */
  const canonical = useMemo(() => new Map(categories.flatMap(c => c.skills.map(s => [skillKey(s), s] as const))), [categories]);

  const q = skillKey(query);
  const groups = categories
    .map(c => ({ title: c.title_en, skills: c.skills.filter(s => !selectedKeys.has(skillKey(s)) && (!q || skillKey(s).includes(q))) }))
    .filter(g => g.skills.length);
  const isNew = !!q && !canonical.has(q) && !selectedKeys.has(q);

  const add = (name: string) => {
    const clean = name.trim().replace(/,/g, ' ');
    if (!clean) return;
    const key = skillKey(clean);
    if (!selectedKeys.has(key)) onChange([...selected, canonical.get(key) ?? clean].join(', '));
    setQuery('');
    input.current?.focus();
  };
  const remove = (name: string) => onChange(selected.filter(s => s !== name).join(', '));

  return (
    <div className="relative">
      <div
        className={`${pfInputClass} flex flex-wrap items-center gap-1.5 min-h-10 py-1.5 cursor-text`}
        onClick={() => input.current?.focus()}
      >
        {selected.map(s => (
          <span key={s} className={`inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md text-xs font-medium ${
            canonical.has(skillKey(s)) ? 'bg-primary/10 text-primary' : 'bg-warning/15 text-[#b07d0b] dark:text-warning'
          }`} title={canonical.has(skillKey(s)) ? undefined : t('pf.skills.newHint')}>
            {s}
            <button type="button" onClick={e => { e.stopPropagation(); remove(s); }} className="p-0.5 rounded hover:bg-black/10" aria-label={`Remove ${s}`}>
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          ref={input}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={e => {
            if ((e.key === 'Enter' || e.key === ',') && query.trim()) { e.preventDefault(); add(query); }
            else if (e.key === 'Backspace' && !query && selected.length) remove(selected[selected.length - 1]);
            else if (e.key === 'Escape') setOpen(false);
          }}
          placeholder={selected.length ? '' : t('pf.skills.placeholder')}
          className="flex-1 min-w-[8rem] bg-transparent outline-none text-sm"
        />
      </div>
      {open && (groups.length > 0 || isNew) && (
        <div className="absolute z-10 mt-1 w-full max-h-64 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg p-1">
          {isNew && (
            <button type="button" onMouseDown={e => { e.preventDefault(); add(query); }} className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-800">
              <Plus size={14} className="text-warning" />
              <span>{t('pf.skills.addNew').replace('{name}', query.trim())}</span>
            </button>
          )}
          {groups.map(g => (
            <div key={g.title} className="py-1">
              <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">{g.title}</div>
              <div className="flex flex-wrap gap-1 px-1">
                {g.skills.map(s => (
                  <button key={s} type="button" onMouseDown={e => { e.preventDefault(); add(s); }}
                    className="px-2 py-0.5 rounded-md text-xs border border-gray-200 dark:border-gray-700 hover:border-primary hover:text-primary">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
