import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { Check, X, Inbox } from 'lucide-react';
import { Button, Badge } from '../../components/ui/Button';
import { pfInputClass } from '../../components/portfolio/PfFieldInput';
import { useLanguage } from '../../lib/LanguageContext';
import { supabase } from '../../lib/supabase';
import { errorMessage } from '../../lib/portfolio';
import { isText, useIsReviewer, useIsUserId, type IsRow } from '../../lib/islamicStudio';
import { LP_REVIEWED_TABLES, LpScope, lpDayLabel, lpRangeLabel } from '../../lib/parenting';
import { PfPageHeader } from '../Portfolio/PfPageHeader';

type Reviewed = (typeof LP_REVIEWED_TABLES)[number];
type Item = { spec: Reviewed; row: IsRow };

/** A section value: text per language, or a list per language. */
const SectionValue = ({ value, language }: { value: unknown; language: string }) => {
  const map = (value ?? {}) as Record<string, unknown>;
  const v = map[language] ?? map.en ?? map.bn;
  if (Array.isArray(v)) return <ul className="list-disc pl-5 space-y-0.5">{v.map((x, i) => <li key={i}>{String(x)}</li>)}</ul>;
  return <p className="whitespace-pre-line">{String(v ?? '')}</p>;
};

const Details = ({ item }: { item: Item }) => {
  const { t, language } = useLanguage();
  const r = item.row;
  const text = (v: unknown) => isText(v, language);
  const line = 'text-sm text-gray-700 dark:text-gray-300';
  switch (item.spec.table) {
    case 'lp_resources': {
      const sections = (r.sections ?? {}) as Record<string, unknown>;
      return (
        <div className="space-y-2">
          {text(r.summary) && <p className={line}>{text(r.summary)}</p>}
          {text(r.body) && <p className={`${line} whitespace-pre-line`}>{text(r.body)}</p>}
          {Object.entries(sections).map(([name, value]) => (
            <div key={name} className={line}>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t(`lp.review.sections.${name}`)}</p>
              <SectionValue value={value} language={language} />
            </div>
          ))}
        </div>
      );
    }
    case 'lp_task_templates':
      return (
        <div className={`${line} space-y-1`}>
          <p><b>{t('lp.tasks.why')}:</b> {text(r.why)}</p>
          <p><b>{t('lp.tasks.benefit')}:</b> {text(r.benefit)}</p>
          {Array.isArray(r.steps) && r.steps.length > 0 && <ol className="list-decimal pl-5">{(r.steps as unknown[]).map((s, i) => <li key={i}>{text(s)}</li>)}</ol>}
          {text(r.safety_note) && <p className="text-danger"><b>{t('lp.tasks.safetyNote')}:</b> {text(r.safety_note)}</p>}
        </div>
      );
    case 'lp_milestones':
      return <p className={line}>{[lpDayLabel(r.typical_day, t), t(`lp.milestones.areas.${r.area}`), text(r.description)].filter(Boolean).join(' · ')}</p>;
    default:
      return <p className={line}>{[r.country, t(`lp.vaccines.scheduleKinds.${r.kind}`), text(r.notes)].filter(Boolean).join(' · ')}</p>;
  }
};

/**
 * Medical, Islamic and cultural content waiting for a reviewer: guides and
 * emergency pages, tasks, milestones and vaccine schedules. The app shows a
 * row only once it is approved (until then it keeps its own built-in copy).
 */
export const LpReview = () => {
  const { t, language } = useLanguage();
  const userId = useIsUserId();
  return (
    <LpScope>
      <ReviewQueue t={t} language={language} userId={userId} />
    </LpScope>
  );
};

/** Inside LpScope, so useIsReviewer checks PARENTING_REVIEW. */
const ReviewQueue = ({ t, language, userId }: { t: (k: string) => string; language: string; userId: string | null }) => {
  const isReviewer = useIsReviewer();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [only, setOnly] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const lists = await Promise.all(LP_REVIEWED_TABLES.map(async spec => {
        const { data, error } = await supabase.from(spec.table).select('*').in('review_status', ['draft', 'in_review']).order('updated_at', { ascending: false });
        if (error) throw error;
        return (data ?? []).map(row => ({ spec, row: row as IsRow }));
      }));
      setItems(lists.flat());
    } catch (e) {
      console.error(e);
      toast.error(errorMessage(e, t('pf.common.loadError')));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  const id = (item: Item) => `${item.spec.table}:${item.row[item.spec.key]}`;

  const decide = async (item: Item, status: 'approved' | 'rejected') => {
    setBusy(id(item));
    try {
      const { error } = await supabase.from(item.spec.table)
        .update({ review_status: status, reviewed_by: userId, reviewed_at: new Date().toISOString(), updated_by: userId })
        .eq(item.spec.key, item.row[item.spec.key]);
      if (error) throw error;
      setItems(prev => prev.filter(i => i !== item));
      toast.success(t(status === 'approved' ? 'is.review.approvedToast' : 'is.review.rejectedToast'));
    } catch (e) {
      console.error(e);
      toast.error(errorMessage(e, t('pf.common.saveError')));
    } finally {
      setBusy(null);
    }
  };

  const shown = only ? items.filter(i => i.spec.table === only) : items;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PfPageHeader title="lp.review.pageTitle" subtitle="lp.review.pageSubtitle" />
      {!isReviewer && (
        <p className="text-sm rounded-lg bg-warning/10 border border-warning/20 p-3 text-gray-700 dark:text-gray-300">{t('lp.review.notReviewer')}</p>
      )}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-gray-100 dark:border-gray-700">
          <span className="text-sm text-gray-500">{t('lp.review.waiting').replace('{n}', String(shown.length))}</span>
          <select value={only} onChange={e => setOnly(e.target.value)} className={`${pfInputClass} h-9 w-auto`}>
            <option value="">{t('lp.review.allKinds')}</option>
            {LP_REVIEWED_TABLES.map(s => (
              <option key={s.table} value={s.table}>{t(`lp.review.tables.${s.table}`)} ({items.filter(i => i.spec.table === s.table).length})</option>
            ))}
          </select>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-500">{t('pf.common.loading')}</div>
        ) : shown.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Inbox size={28} className="mx-auto mb-2 text-gray-400" />
            {t('lp.review.empty')}
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {shown.map(item => {
              const r = item.row;
              return (
                <li key={id(item)} className="p-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="default">{t(`lp.review.tables.${item.spec.table}`)}</Badge>
                    <Badge variant="warning">{t(`is.review.${r.review_status}`)}</Badge>
                    {r.perspective ? <Badge variant="muted">{t(`lp.common.perspectives.${r.perspective}`)}</Badge> : null}
                    {r.urgency === 'emergency' && <Badge variant="danger">{t('lp.library.urgencies.emergency')}</Badge>}
                    <span className="font-medium text-gray-900 dark:text-gray-100">{r.emoji ? `${r.emoji} ` : ''}{isText(r.title ?? r.name, language)}</span>
                  </div>
                  {'min_day' in r && <p className="text-xs text-gray-500">{lpRangeLabel(r, t)}</p>}
                  <Details item={item} />
                  {isReviewer && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => void decide(item, 'approved')} disabled={busy === id(item)}>
                        <Check size={14} className="mr-1" /> {t('is.review.approve')}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void decide(item, 'rejected')} disabled={busy === id(item)}>
                        <X size={14} className="mr-1" /> {t('is.review.reject')}
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};
