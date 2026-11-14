import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { Smartphone, Trophy, Activity } from 'lucide-react';
import { useLanguage } from '../../lib/LanguageContext';
import { supabase } from '../../lib/supabase';
import { errorMessage } from '../../lib/portfolio';
import { isText } from '../../lib/islamicStudio';
import { pfInputClass } from '../../components/portfolio/PfFieldInput';
import { PfPageHeader } from '../Portfolio/PfPageHeader';

type Device = { device_id: string; display_name: string | null; platform: string | null; app_version_code: number | null; language: string | null; created_at: string; last_seen_at: string };
type Score = { device_id: string; feature: string; ref: string; day: string; score: number; max_score: number | null };
type Leader = { rank: number; display_name: string; score: number; quizzes: number };

const FEATURES = ['quiz', 'learn', 'tracker', 'ramadan', 'quran_audio', 'hadith', 'tasbih'] as const;
const DAYS = 30;

/** Read-only: devices using the app (no sign-in) and their scores per feature. */
export const IsScores = () => {
  const { t, language } = useLanguage();
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [scores, setScores] = useState<Score[]>([]);
  const [challenges, setChallenges] = useState<{ id: string; title: unknown }[]>([]);
  const [challenge, setChallenge] = useState('');
  const [board, setBoard] = useState<Leader[]>([]);
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

  useEffect(() => {
    if (!challenge) return;
    void supabase.rpc('is_challenge_leaderboard', { p_challenge: challenge, p_limit: 50 }).then(({ data }) => setBoard((data ?? []) as Leader[]));
  }, [challenge]);

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
            <h3 className="mb-2 font-semibold">{t('is.scores.recent')}</h3>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-gray-500"><th className="py-1">{t('is.scores.name')}</th><th>{t('is.scores.lastSeen')}</th><th>{t('is.scores.version')}</th><th className="text-right">{t('is.scores.points')} ({DAYS}d)</th></tr></thead>
              <tbody>
                {devices.slice(0, 100).map(d => (
                  <tr key={d.device_id} className="border-t border-gray-100 dark:border-gray-700">
                    <td className="py-2">{d.display_name ?? <span className="text-gray-400 font-mono text-xs">{d.device_id.slice(0, 8)}</span>}</td>
                    <td>{new Date(d.last_seen_at).toLocaleString()}</td>
                    <td>{d.app_version_code ?? '—'} · {d.language ?? ''}</td>
                    <td className="text-right font-semibold">{Math.round(perDevice(d.device_id))}</td>
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
