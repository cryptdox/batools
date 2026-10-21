import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { useLanguage } from '../../lib/LanguageContext';
import { pfInputClass } from '../portfolio/PfFieldInput';
import { EMPTY_ITEM, type CvData, type CvListKey } from '../../lib/cvMaker';

// Editing widgets for the CV editor. Labels are translation keys under `cv.`.

type FieldType = 'text' | 'textarea' | 'checkbox';
export type CvField = { key: string; label: string; type?: FieldType; placeholder?: string; hint?: string; wide?: boolean };

/** The fields of one item in each list section. */
const LIST_FIELDS: Record<CvListKey, CvField[]> = {
  experience: [
    { key: 'role', label: 'fields.role' },
    { key: 'company', label: 'fields.company' },
    { key: 'location', label: 'fields.location' },
    { key: 'current', label: 'fields.current', type: 'checkbox' },
    { key: 'start', label: 'fields.start', placeholder: 'Jan 2022' },
    { key: 'end', label: 'fields.end', placeholder: 'Dec 2024' },
    { key: 'details', label: 'fields.details', type: 'textarea', hint: 'hints.bullets', wide: true },
  ],
  education: [
    { key: 'degree', label: 'fields.degree' },
    { key: 'school', label: 'fields.school' },
    { key: 'location', label: 'fields.location', wide: true },
    { key: 'start', label: 'fields.start', placeholder: '2016' },
    { key: 'end', label: 'fields.end', placeholder: '2020' },
    { key: 'details', label: 'fields.details', type: 'textarea', hint: 'hints.bullets', wide: true },
  ],
  projects: [
    { key: 'name', label: 'fields.projectName' },
    { key: 'link', label: 'fields.link', placeholder: 'https://' },
    { key: 'tech', label: 'fields.tech', placeholder: 'React, Node.js, PostgreSQL', wide: true },
    { key: 'details', label: 'fields.details', type: 'textarea', hint: 'hints.bullets', wide: true },
  ],
  skills: [
    { key: 'name', label: 'fields.skillGroup', placeholder: 'Frontend' },
    { key: 'items', label: 'fields.skillItems', placeholder: 'React, TypeScript, Tailwind', hint: 'hints.commas' },
  ],
  certifications: [
    { key: 'name', label: 'fields.certName' },
    { key: 'issuer', label: 'fields.issuer' },
    { key: 'date', label: 'fields.date', placeholder: '2023' },
  ],
  languages: [
    { key: 'name', label: 'fields.language', placeholder: 'English' },
    { key: 'level', label: 'fields.level', placeholder: 'Fluent' },
  ],
};

const labelClass = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1';
const iconBtn = 'p-1.5 rounded-md text-gray-500 hover:text-primary hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:pointer-events-none';

export function CvFieldInput({ field, value, onChange }: { field: CvField; value: unknown; onChange: (v: string | boolean) => void }) {
  const { t } = useLanguage();
  const label = t(`cv.${field.label}`);
  if (field.type === 'checkbox') {
    return (
      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 self-end h-10">
        <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} className="w-4 h-4 accent-primary" />
        {label}
      </label>
    );
  }
  return (
    <div className={field.wide || field.type === 'textarea' ? 'sm:col-span-2' : ''}>
      <label className={labelClass}>{label}</label>
      {field.type === 'textarea' ? (
        <textarea rows={4} value={String(value ?? '')} placeholder={field.placeholder} onChange={e => onChange(e.target.value)} className={pfInputClass} />
      ) : (
        <input value={String(value ?? '')} placeholder={field.placeholder} onChange={e => onChange(e.target.value)} className={`${pfInputClass} h-10`} />
      )}
      {field.hint && <p className="text-[11px] text-gray-400 mt-1">{t(`cv.${field.hint}`)}</p>}
    </div>
  );
}

/** A section card with its reorder / hide controls. */
export function CvSectionCard({ title, hidden, onToggleHidden, onUp, onDown, children }: {
  title: string; hidden?: boolean; onToggleHidden?: () => void; onUp?: () => void; onDown?: () => void; children: ReactNode;
}) {
  const { t } = useLanguage();
  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex items-center gap-1 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <h3 className={`font-semibold flex-1 ${hidden ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-gray-100'}`}>{title}</h3>
        {onUp && <button onClick={onUp} className={iconBtn} title={t('pf.common.moveUp')}><ArrowUp size={15} /></button>}
        {onDown && <button onClick={onDown} className={iconBtn} title={t('pf.common.moveDown')}><ArrowDown size={15} /></button>}
        {onToggleHidden && (
          <button onClick={onToggleHidden} className={iconBtn} title={hidden ? t('cv.editor.showSection') : t('cv.editor.hideSection')}>
            {hidden ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        )}
      </div>
      <div className={`p-4 ${hidden ? 'opacity-60' : ''}`}>{children}</div>
    </section>
  );
}

const move = <T,>(list: T[], from: number, to: number) => {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x);
  return next;
};

/** Items of one list section: edit, add, reorder, remove. */
export function CvListEditor<K extends CvListKey>({ section, items, onChange }: { section: K; items: CvData[K]; onChange: (items: CvData[K]) => void }) {
  const { t } = useLanguage();
  const list = items as unknown as Record<string, unknown>[];
  const set = (next: Record<string, unknown>[]) => onChange(next as unknown as CvData[K]);
  const fields = LIST_FIELDS[section];

  return (
    <div className="space-y-3">
      {list.map((item, i) => (
        <div key={String(item.id)} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="flex items-center gap-1 mb-2">
            <span className="text-xs font-semibold text-gray-500 flex-1 truncate">{String(item[fields[0].key] || '') || `#${i + 1}`}</span>
            <button onClick={() => set(move(list, i, i - 1))} disabled={i === 0} className={iconBtn} title={t('pf.common.moveUp')}><ArrowUp size={14} /></button>
            <button onClick={() => set(move(list, i, i + 1))} disabled={i === list.length - 1} className={iconBtn} title={t('pf.common.moveDown')}><ArrowDown size={14} /></button>
            <button onClick={() => set(list.filter((_, j) => j !== i))} className={`${iconBtn} hover:!text-danger`} title={t('pf.common.delete')}><Trash2 size={14} /></button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {fields
              // An ongoing job has no end date.
              .filter(f => !(section === 'experience' && f.key === 'end' && item.current))
              .map(f => (
                <CvFieldInput key={f.key} field={f} value={item[f.key]} onChange={v => set(list.map((x, j) => (j === i ? { ...x, [f.key]: v } : x)))} />
              ))}
          </div>
        </div>
      ))}
      <button
        onClick={() => set([...list, EMPTY_ITEM[section]() as unknown as Record<string, unknown>])}
        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:border-primary hover:text-primary"
      >
        <Plus size={15} />{t('cv.editor.addItem')}
      </button>
    </div>
  );
}
