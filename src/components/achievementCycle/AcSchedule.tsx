import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarDays, Plus, X } from 'lucide-react';
import { useLanguage } from '../../lib/LanguageContext';
import { Button } from '../ui/Button';
import { pfInputClass } from '../portfolio/PfFieldInput';

// Week starts on Saturday in Bangladesh; show the chips in that order.
const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5];

const formatDay = (day: string) => format(new Date(`${day}T00:00:00`), 'dd MMM yyyy');

/** Pick the weekdays (every week) and / or specific dates a milestone is worked on. */
export const AcScheduleEditor = ({ weekdays, dates, onChange }: {
  weekdays: number[];
  dates: string[];
  onChange: (weekdays: number[], dates: string[]) => void;
}) => {
  const { t } = useLanguage();
  const [day, setDay] = useState('');

  const toggleWeekday = (d: number) =>
    onChange(weekdays.includes(d) ? weekdays.filter(x => x !== d) : [...weekdays, d].sort(), dates);
  const addDate = () => {
    if (!day || dates.includes(day)) return;
    onChange(weekdays, [...dates, day].sort());
    setDay('');
  };

  return (
    <div className="space-y-2 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        <CalendarDays size={15} />{t('ac.schedule.title')}
      </div>
      <div>
        <span className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t('ac.schedule.everyWeek')}</span>
        <div className="flex flex-wrap gap-1.5">
          {WEEK_ORDER.map(d => {
            const on = weekdays.includes(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => toggleWeekday(d)}
                aria-pressed={on}
                className={`w-11 h-8 rounded-md text-xs font-medium border transition-colors ${on
                  ? 'bg-primary text-white border-primary'
                  : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
              >
                {t(`ac.days.${d}`)}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <span className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t('ac.schedule.onDates')}</span>
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={day} onChange={e => setDay(e.target.value)} className={`${pfInputClass.replace('w-full ', '')} h-9 w-44`} />
          <Button type="button" size="sm" variant="outline" onClick={addDate} disabled={!day || dates.includes(day)}><Plus size={14} className="mr-1" />{t('ac.schedule.addDate')}</Button>
          {dates.map(d => (
            <span key={d} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
              {formatDay(d)}
              <button type="button" onClick={() => onChange(weekdays, dates.filter(x => x !== d))} className="p-0.5 rounded-full hover:bg-black/10" aria-label={`Remove ${d}`}><X size={12} /></button>
            </span>
          ))}
        </div>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{t('ac.schedule.hint')}</p>
    </div>
  );
};

/** "Sat, Mon · 12 Oct 2026" — or nothing when unscheduled. */
export const AcScheduleSummary = ({ weekdays, dates }: { weekdays: number[]; dates: string[] }) => {
  const { t } = useLanguage();
  if (!weekdays.length && !dates.length) return null;
  const parts = [
    ...WEEK_ORDER.filter(d => weekdays.includes(d)).map(d => t(`ac.days.${d}`)),
    ...dates.map(formatDay),
  ];
  return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
      <CalendarDays size={12} />{parts.join(', ')}
    </span>
  );
};
