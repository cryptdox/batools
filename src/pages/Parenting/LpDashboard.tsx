import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ToggleRight, ShieldCheck, MessageSquare, Smartphone, Users, Home, Baby, Flower2, ListChecks, Activity, type LucideIcon } from 'lucide-react';
import { Badge } from '../../components/ui/Button';
import { useLanguage } from '../../lib/LanguageContext';
import { useAccess } from '../../lib/permissions';
import { supabase } from '../../lib/supabase';
import { isText, type IsRow } from '../../lib/islamicStudio';
import { LP_REVIEWED_TABLES } from '../../lib/parenting';
import { PfPageHeader } from '../Portfolio/PfPageHeader';

type Usage = { users: number; accounts?: number; device_only?: number; active_users_7d: number; families: number; children: number; active_pregnancies: number; planning_families: number; tasks_done_7d: number };
type SignIn = { secret: boolean; realm: boolean };
type Stats = { features: IsRow[]; toReview: number; newFeedback: number; settings: IsRow | null; usage: Usage | null; signIn: SignIn | null };

const head = (table: string) => supabase.from(table).select('*', { count: 'exact', head: true });

const Tile = ({ to, icon: Icon, label, value, note }: { to?: string; icon: LucideIcon; label: string; value: string | number; note?: string }) => {
  const body = (
    <>
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400"><Icon size={16} /> {label}</div>
      <div className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">{value}</div>
      {note && <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{note}</div>}
    </>
  );
  const box = 'block bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 shadow-sm';
  return to ? <Link to={to} className={`${box} hover:border-primary/40 transition-colors`}>{body}</Link> : <div className={box}>{body}</div>;
};

/** The parenting app at a glance: features in the app, content waiting for review, feedback, and usage as counts. */
export const LpDashboard = () => {
  const { t, language } = useLanguage();
  const { canOpen } = useAccess();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    void (async () => {
      const [features, settings, feedback, usage, signIn, ...review] = await Promise.all([
        supabase.from('lp_features').select('key, name, status, phase, min_version_code').order('sort_order'),
        supabase.from('lp_app_settings').select('*').maybeSingle(),
        canOpen('/lp/feedback') ? head('lp_feedback').eq('status', 'new') : Promise.resolve({ count: 0 }),
        supabase.rpc('lp_admin_stats'),
        supabase.rpc('lp_sign_in_setup'),
        ...LP_REVIEWED_TABLES.map(s => head(s.table).in('review_status', ['draft', 'in_review'])),
      ]);
      setStats({
        features: (features.data ?? []) as IsRow[],
        settings: (settings.data ?? null) as IsRow | null,
        newFeedback: feedback.count ?? 0,
        usage: usage.error ? null : (usage.data as Usage),
        signIn: signIn.error ? null : (signIn.data as SignIn),
        toReview: review.reduce((sum, r) => sum + (r.count ?? 0), 0),
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = stats?.features.filter(f => f.status === 'active') ?? [];
  const shownSoon = stats?.features.filter(f => f.status === 'coming_soon' || f.status === 'beta') ?? [];
  const u = stats?.usage;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PfPageHeader title="lp.dashboard.pageTitle" subtitle="lp.dashboard.pageSubtitle" />
      {!stats ? (
        <div className="p-8 text-center text-gray-500">{t('pf.common.loading')}</div>
      ) : (
        <>
          {/* App sign-in needs the realm's signing secret in Vault (migrations 095–096). */}
          {stats.signIn && (stats.signIn.secret ? (
            <p className="text-sm text-success">✓ {t('lp.dashboard.signInOk')}</p>
          ) : (
            <div className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-gray-800 dark:text-gray-200 space-y-1">
              <p className="font-semibold text-danger">{t('lp.dashboard.signInOff')}</p>
              <p>{t('lp.dashboard.signInOffText')}</p>
              <code className="block text-xs">node --env-file=.env scripts/iam-life-stage-parenting.mjs --only=app</code>
            </div>
          ))}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Tile to="/lp/features" icon={ToggleRight} label={t('is.dashboard.activeFeatures')} value={`${active.length} / ${stats.features.length}`} />
            <Tile to="/lp/review" icon={ShieldCheck} label={t('is.dashboard.toReview')} value={stats.toReview} />
            <Tile to="/lp/feedback" icon={MessageSquare} label={t('is.dashboard.newFeedback')} value={stats.newFeedback} />
            <Tile
              to="/lp/settings"
              icon={Smartphone}
              label={t('is.dashboard.appVersion')}
              value={String(stats.settings?.latest_version_code ?? '—')}
              note={stats.settings?.maintenance_mode ? t('is.settings.maintenanceOn') : `${t('is.settings.minSupported')}: ${stats.settings?.min_supported_version_code ?? '—'}`}
            />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('lp.dashboard.usage')}</h3>
            {u ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Tile icon={Users} label={t('lp.dashboard.users')} value={u.users}
                  note={[`${t('lp.dashboard.active7d')}: ${u.active_users_7d}`, u.accounts != null ? `${t('lp.dashboard.accounts')}: ${u.accounts} · ${t('lp.dashboard.deviceOnly')}: ${u.device_only}` : ''].filter(Boolean).join(' · ')} />
                <Tile icon={Home} label={t('lp.dashboard.families')} value={u.families} note={`${t('lp.dashboard.planning')}: ${u.planning_families}`} />
                <Tile icon={Baby} label={t('lp.dashboard.children')} value={u.children} />
                <Tile icon={Flower2} label={t('lp.dashboard.pregnancies')} value={u.active_pregnancies} />
                <Tile icon={ListChecks} label={t('lp.dashboard.tasksDone')} value={u.tasks_done_7d} />
                <Tile icon={Activity} label={t('lp.dashboard.privacy')} value="🔒" note={t('lp.dashboard.privacyNote')} />
              </div>
            ) : (
              <p className="text-sm text-gray-500">{t('lp.dashboard.usageUnavailable')}</p>
            )}
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 space-y-3">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('is.dashboard.inTheApp')}</h3>
            <div className="flex flex-wrap gap-2">
              {active.length ? active.map(f => <Badge key={String(f.key)} variant="success">{isText(f.name, language)}</Badge>)
                : <span className="text-sm text-gray-500">{t('is.dashboard.nothingActive')}</span>}
              {shownSoon.map(f => <Badge key={String(f.key)} variant="warning">{isText(f.name, language)} · {t(`is.features.status.${f.status}`)}</Badge>)}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('lp.dashboard.hint')}</p>
          </div>
        </>
      )}
    </div>
  );
};
