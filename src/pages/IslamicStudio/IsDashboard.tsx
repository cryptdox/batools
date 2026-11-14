import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ToggleRight, ShieldCheck, MessageSquare, Smartphone, type LucideIcon } from 'lucide-react';
import { Badge } from '../../components/ui/Button';
import { useLanguage } from '../../lib/LanguageContext';
import { useAccess } from '../../lib/permissions';
import { supabase } from '../../lib/supabase';
import { IS_REVIEWED_TABLES, isText, type IsRow } from '../../lib/islamicStudio';
import { PfPageHeader } from '../Portfolio/PfPageHeader';

type Stats = { features: IsRow[]; toReview: number; newFeedback: number; settings: IsRow | null };

const count = async (table: string, build: (q: ReturnType<typeof head>) => ReturnType<typeof head>) => {
  const { count: n } = await build(head(table));
  return n ?? 0;
};
const head = (table: string) => supabase.from(table).select('*', { count: 'exact', head: true });

const Tile = ({ to, icon: Icon, label, value, note }: { to: string; icon: LucideIcon; label: string; value: string | number; note?: string }) => (
  <Link to={to} className="block bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 shadow-sm hover:border-primary/40 transition-colors">
    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400"><Icon size={16} /> {label}</div>
    <div className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">{value}</div>
    {note && <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{note}</div>}
  </Link>
);

/** Islamic Studio at a glance: which features the app shows, what waits for review, new feedback. */
export const IsDashboard = () => {
  const { t, language } = useLanguage();
  const { canOpen } = useAccess();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    void (async () => {
      const [features, settings, newFeedback, ...review] = await Promise.all([
        supabase.from('is_features').select('key, name, status, phase, min_version_code').order('sort_order'),
        supabase.from('is_app_settings').select('*').maybeSingle(),
        canOpen('/is/feedback') ? count('is_feedback', q => q.eq('status', 'new')) : Promise.resolve(0),
        ...IS_REVIEWED_TABLES.map(table => count(table, q => q.in('review_status', ['draft', 'in_review']))),
      ]);
      setStats({
        features: (features.data ?? []) as IsRow[],
        settings: (settings.data ?? null) as IsRow | null,
        newFeedback,
        toReview: (review as number[]).reduce((a, b) => a + b, 0),
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = stats?.features.filter(f => f.status === 'active') ?? [];
  const shownSoon = stats?.features.filter(f => f.status === 'coming_soon' || f.status === 'beta') ?? [];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PfPageHeader title="is.dashboard.pageTitle" subtitle="is.dashboard.pageSubtitle" />
      {!stats ? (
        <div className="p-8 text-center text-gray-500">{t('pf.common.loading')}</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Tile to="/is/features" icon={ToggleRight} label={t('is.dashboard.activeFeatures')} value={`${active.length} / ${stats.features.length}`} />
            <Tile to="/is/review" icon={ShieldCheck} label={t('is.dashboard.toReview')} value={stats.toReview} />
            <Tile to="/is/feedback" icon={MessageSquare} label={t('is.dashboard.newFeedback')} value={stats.newFeedback} />
            <Tile
              to="/is/settings"
              icon={Smartphone}
              label={t('is.dashboard.appVersion')}
              value={String(stats.settings?.latest_version_code ?? '—')}
              note={stats.settings?.maintenance_mode ? t('is.settings.maintenanceOn') : `${t('is.settings.minSupported')}: ${stats.settings?.min_supported_version_code ?? '—'}`}
            />
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 space-y-3">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('is.dashboard.inTheApp')}</h3>
            <div className="flex flex-wrap gap-2">
              {active.length ? active.map(f => <Badge key={String(f.key)} variant="success">{isText(f.name, language)}</Badge>)
                : <span className="text-sm text-gray-500">{t('is.dashboard.nothingActive')}</span>}
              {shownSoon.map(f => <Badge key={String(f.key)} variant="warning">{isText(f.name, language)} · {t(`is.features.status.${f.status}`)}</Badge>)}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('is.dashboard.hint')}</p>
          </div>
        </>
      )}
    </div>
  );
};
