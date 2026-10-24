import { useState, type ReactNode } from 'react';
import { useLanguage } from '../../lib/LanguageContext';
import { cycleKey, cycleLabel, percent, STATUSES, type CycleRef, type CycleStatus } from '../../lib/achievementCycle';
import { pfInputClass } from '../portfolio/PfFieldInput';

/** pfInputClass without w-full, for inline toolbar selects. */
export const acSelectClass = pfInputClass.replace('w-full ', '');

export const acCard = 'bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700';

/** Completion bar: one sequential hue, rounded data end, value as text beside it. */
export const AcProgress = ({ achieved, total, size = 'md', showPoints = true }: { achieved: number; total: number; size?: 'sm' | 'md'; showPoints?: boolean }) => {
  const pct = percent(achieved, total);
  return (
    <div className="flex items-center gap-2 min-w-0" title={`${achieved} / ${total} (${pct}%)`}>
      <div className={`flex-1 rounded-full overflow-hidden ${size === 'sm' ? 'h-1.5' : 'h-2'}`} style={{ background: 'var(--ac-seq-track)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'var(--ac-seq)' }} />
      </div>
      <span className="shrink-0 text-xs tabular-nums text-gray-600 dark:text-gray-300">
        {pct}%{showPoints && <span className="text-gray-400"> · {achieved}/{total}</span>}
      </span>
    </div>
  );
};

/** Which cycle (New, Revise 2, …) every % on the page is about. */
export const AcCyclePicker = ({ refs, value, onChange }: { refs: CycleRef[]; value: string; onChange: (key: string) => void }) => {
  const { t } = useLanguage();
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="font-medium text-gray-600 dark:text-gray-300">{t('ac.cycle')}</span>
      <select value={value} onChange={e => onChange(e.target.value)} className={`${acSelectClass} h-9`}>
        {refs.map(r => <option key={cycleKey(r)} value={cycleKey(r)}>{cycleLabel(r, t)}</option>)}
      </select>
    </label>
  );
};

export const statusColor = (s: CycleStatus) => `var(--ac-status-${s})`;

export const AcStatusDot = ({ status }: { status: CycleStatus }) => (
  <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: statusColor(status) }} />
);

/** Status breakdown: a stacked bar with 2px gaps, plus a labelled legend (colour never alone). */
export const AcStatusBreakdown = ({ counts }: { counts: Record<CycleStatus, number> }) => {
  const { t } = useLanguage();
  const total = STATUSES.reduce((a, s) => a + counts[s], 0);
  const [hover, setHover] = useState<CycleStatus | null>(null);
  return (
    <div className="space-y-3">
      <div className="flex h-3 w-full gap-[2px]" role="img" aria-label={STATUSES.map(s => `${t(`ac.status.${s}`)} ${counts[s]}`).join(', ')}>
        {total === 0
          ? <div className="flex-1 rounded-full" style={{ background: 'var(--ac-seq-track)' }} />
          : STATUSES.filter(s => counts[s] > 0).map(s => (
            <div
              key={s}
              className="h-full first:rounded-l-full last:rounded-r-full transition-opacity"
              style={{ width: `${(counts[s] / total) * 100}%`, background: statusColor(s), opacity: hover && hover !== s ? 0.35 : 1 }}
              onMouseEnter={() => setHover(s)}
              onMouseLeave={() => setHover(null)}
              title={`${t(`ac.status.${s}`)}: ${counts[s]} (${Math.round((counts[s] / total) * 100)}%)`}
            />
          ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {STATUSES.map(s => (
          <span key={s} className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-300" onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(null)}>
            <AcStatusDot status={s} /> {t(`ac.status.${s}`)} <span className="tabular-nums font-semibold text-gray-900 dark:text-gray-100">{counts[s]}</span>
          </span>
        ))}
      </div>
    </div>
  );
};

/** A headline number with its label. */
export const AcStat = ({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) => (
  <div className={`${acCard} p-4`}>
    <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">{value}</div>
    <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
    {hint && <div className="mt-1 text-[11px] text-gray-400">{hint}</div>}
  </div>
);

// The rich text pieces now live in components/ui/RichText (shared with the
// portfolio editors); these names stay for the Achievement Cycle pages.
export { asRichHtml, RichView as AcRichView, RichEditor as AcRichEditor } from '../ui/RichText';

export const AcLevelBadge = ({ level }: { level: 'subject' | 'general' | 'area' | 'mixed' }) => {
  const { t } = useLanguage();
  const style = {
    subject: 'bg-primary/10 text-primary border-primary/20',
    general: 'bg-secondary/10 text-secondary border-secondary/20',
    area: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
    mixed: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
  }[level];
  return <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${style}`}>{t(`ac.level.${level}`)}</span>;
};

/** "Show archived" switch, shown at the top of every Achievement Cycle page. */
export const AcArchiveToggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => {
  const { t } = useLanguage();
  return (
    <label className="inline-flex items-center gap-2 text-sm cursor-pointer select-none">
      <span className="font-medium text-gray-600 dark:text-gray-300">{t('ac.archive.show')}</span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${value ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </button>
    </label>
  );
};

export const AcArchivedBadge = () => {
  const { t } = useLanguage();
  return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600">{t('ac.archive.archived')}</span>;
};
