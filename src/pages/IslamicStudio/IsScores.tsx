import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { Smartphone, Trophy, Activity, Search, EyeOff, Eye, Trash2 } from 'lucide-react';
import { useLanguage } from '../../lib/LanguageContext';
import { supabase } from '../../lib/supabase';
import { useAccess } from '../../lib/permissions';
import { errorMessage } from '../../lib/portfolio';
import { isText } from '../../lib/islamicStudio';
import { pfInputClass } from '../../components/portfolio/PfFieldInput';
import { PfPageHeader } from '../Portfolio/PfPageHeader';

type Device = { device_id: string; display_name: string | null; name_hidden?: boolean; platform: string | null; app_version_code: number | null; language: string | null; created_at: string; last_seen_at: string };
type Score = { device_id: string; feature: string; ref: string; day: string; score: number; max_score: number | null };
type Leader = { rank: number; display_name: string; score: number; quizzes: number };

const FEATURES = ['quiz', 'learn', 'tracker', 'ramadan', 'quran_audio', 'hadith', 'tasbih'] as const;
const DAYS = 30;

/**
 * Devices using the app (no sign-in) and their scores per feature. With UPDATE a
 * device's name can be hidden from leaderboards; with DELETE a device and all
 * its scores can be removed (a user's deletion request, by installation id).
 */
export const IsScores = () => {
  const { t, language } = useLanguage();
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [scores, setScores] = useState<Score[]>([]);
  const [challenges, setChallenges] = useState<{ id: string; title: unknown }[]>([]);
  const [challenge, setChallenge] = useState('');
  const [board, setBoard] = useState<Leader[]>([]);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState('');
  const { has } = useAccess();
  const canHide = has('ISLAMIC_STUDIO_SCORES', 'UPDATE');
  const canDelete = has('ISLAMIC_STUDIO_SCORES', 'DELETE');
  const [since, week] = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - DAYS);
    return [d.toISOString().slice(0, 10), new Date(new Date().getTime() - 7 * 86_400_000).toISOString()];
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const [d, s, c] = await Promise.all([
          supabase.from('is_devices').select('*').order('last_seen_at', { ascending: false }).limit(1000),
          supabase.from('is_device_scores').select('device_id, feature, ref, day, score, max_score').gte('day', since).limit(10000),
          supabase.from('is_challenges').select('id, title').order('starts_at', { ascending: false }),
        ]);
        if (d.error) throw d.error;
        if (s.error) throw s.error;
        setDevices((d.data ?? []) as Device[]);
        setScores((s.data ?? []) as Score[]);
        setChallenges(c.data ?? []);
        if (c.data?.[0]) setChallenge(String(c.data[0].id));
      } catch (e) {
        console.error(e);
        toast.error(errorMessage(e, t('pf.common.loadError')));
        setDevices([]);
      }
    })();
  }, [since, t]);

  const loadBoard = (id: string) =>
    void supabase.rpc('is_challenge_leaderboard', { p_challenge: id, p_limit: 50 }).then(({ data }) => setBoard((data ?? []) as Leader[]));

  useEffect(() => {
    if (challenge) loadBoard(challenge);
  }, [challenge]);

  /** Hides (or shows again) a name; while hidden the app can't set one. */
  const setHidden = async (d: Device, hidden: boolean) => {
    setBusy(d.device_id);
    const { data, error } = await supabase.from('is_devices').update({ name_hidden: hidden }).eq('device_id', d.device_id).select('*').single();
    setBusy('');
    if (error) return toast.error(errorMessage(error, t('pf.common.saveError')));
    setDevices(list => list?.map(x => (x.device_id === d.device_id ? (data as Device) : x)) ?? null);
    if (challenge) loadBoard(challenge);
    toast.success(t(hidden ? 'is.scores.nameHidden' : 'is.scores.nameShown'));
  };

  /** Deletes a device and (cascade) all its scores. */
  const remove = async (d: Device) => {
    if (!window.confirm(t('is.scores.deleteConfirm').replace('{id}', d.device_id))) return;
    setBusy(d.device_id);
    const { error } = await supabase.from('is_devices').delete().eq('device_id', d.device_id);
    setBusy('');
    if (error) return toast.error(errorMessage(error, t('pf.common.deleteError')));
    setDevices(list => list?.filter(x => x.device_id !== d.device_id) ?? null);
    setScores(list => list.filter(x => x.device_id !== d.device_id));
    if (challenge) loadBoard(challenge);
    toast.success(t('is.scores.deleted'));
  };

  const q = query.trim().toLowerCase();
  const shown = (devices ?? []).filter(d => !q || d.device_id.startsWith(q) || (d.display_name ?? '').toLowerCase().includes(q));

  const active = devices?.filter(d => d.last_seen_at >= week).length ?? 0;
  const byFeature = FEATURES.map(f => {
    const rows = scores.filter(s => s.feature === f);
    return { f, devices: new Set(rows.map(r => r.device_id)).size, total: rows.reduce((a, r) => a + Number(r.score), 0) };
  });
  const perDevice = (id: string) => scores.filter(s => s.device_id === id).reduce((a, s) => a + Number(s.score), 0);

  const tile = 'bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 shadow-sm';
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PfPageHeader title="is.scores.pageTitle" subtitle="is.scores.pageSubtitle" />
      {!devices ? <div className="p-8 text-center text-gray-500">{t('pf.common.loading')}</div> : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className={tile}><div className="flex items-center gap-2 text-sm text-gray-500"><Smartphone size={16} /> {t('is.scores.devices')}</div><div className="mt-2 text-3xl font-bold">{devices.length}</div></div>
            <div className={tile}><div className="flex items-center gap-2 text-sm text-gray-500"><Activity size={16} /> {t('is.scores.active')}</div><div className="mt-2 text-3xl font-bold">{active}</div></div>
          </div>

          <div className={`${tile} space-y-3`}>
            <h3 className="font-semibold">{t('is.scores.byFeature')}</h3>
            <div className="grid gap-2 sm:grid-cols-3">
              {byFeature.map(x => (
                <div key={x.f} className="rounded-lg bg-gray-50 dark:bg-gray-900 p-3 text-sm">
                  <div className="font-medium">{t(`is.scores.features.${x.f}`)}</div>
                  <div className="text-gray-500">{x.devices} {t('is.scores.devicesShort')} · {Math.round(x.total)} {t('is.scores.points')}</div>
                </div>
              ))}
            </div>
          </div>

          {challenges.length > 0 && (
            <div className={`${tile} space-y-3`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 font-semibold"><Trophy size={18} className="text-amber-500" /> {t('is.scores.leaderboard')}</h3>
                <select value={challenge} onChange={e => setChallenge(e.target.value)} className={`${pfInputClass} h-9 w-auto`}>
                  {challenges.map(c => <option key={c.id} value={c.id}>{isText(c.title, language)}</option>)}
                </select>
              </div>
              {board.length === 0 ? <p className="text-sm text-gray-500">—</p> : (
                <table className="w-full text-sm">
                  <tbody>
                    {board.map(r => (
                      <tr key={`${r.rank}-${r.display_name}`} className="border-t border-gray-100 dark:border-gray-700">
                        <td className="py-2 w-10 font-bold">{r.rank}</td><td>{r.display_name}</td><td className="text-right">{r.quizzes} {t('is.quiz.quizzes')}</td><td className="text-right font-semibold">{Number(r.score)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          <div className={`${tile} overflow-x-auto`}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">{t('is.scores.recent')}</h3>
              <label className="relative w-full sm:w-72">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('is.scores.search')} className={`${pfInputClass} h-9 pl-9`} />
              </label>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-gray-500"><th className="py-1">{t('is.scores.name')}</th><th>{t('is.scores.lastSeen')}</th><th>{t('is.scores.version')}</th><th className="text-right">{t('is.scores.points')} ({DAYS}d)</th>{(canHide || canDelete) && <th />}</tr></thead>
              <tbody>
                {shown.slice(0, 100).map(d => (
                  <tr key={d.device_id} className="border-t border-gray-100 dark:border-gray-700">
                    <td className="py-2">
                      {d.display_name ?? <span className="text-gray-400 font-mono text-xs">{d.device_id.slice(0, 8)}</span>}
                      {d.name_hidden && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">{t('is.scores.hiddenBadge')}</span>}
                    </td>
                    <td>{new Date(d.last_seen_at).toLocaleString()}</td>
                    <td>{d.app_version_code ?? '—'} · {d.language ?? ''}</td>
                    <td className="text-right font-semibold">{Math.round(perDevice(d.device_id))}</td>
                    {(canHide || canDelete) && (
                      <td className="whitespace-nowrap text-right">
                        {canHide && (d.display_name || d.name_hidden) && (
                          <button disabled={busy === d.device_id} onClick={() => void setHidden(d, !d.name_hidden)} title={t(d.name_hidden ? 'is.scores.showName' : 'is.scores.hideName')} className="p-1.5 text-gray-500 hover:text-amber-600 disabled:opacity-40">
                            {d.name_hidden ? <Eye size={16} /> : <EyeOff size={16} />}
                          </button>
                        )}
                        {canDelete && (
                          <button disabled={busy === d.device_id} onClick={() => void remove(d)} title={t('is.scores.delete')} className="p-1.5 text-gray-500 hover:text-red-600 disabled:opacity-40">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
