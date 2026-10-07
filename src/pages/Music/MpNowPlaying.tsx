import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { X, Music } from 'lucide-react';
import { useLanguage } from '../../lib/LanguageContext';
import { usePlayer } from '../../lib/MusicPlayerContext';
import { formatDuration, songArtist, useMpRatings, useMpUserId } from '../../lib/music';
import { Badge, Button } from '../../components/ui/Button';
import { MpCover, MpPlayingBars, MpStars } from '../../components/music/MpUi';
import { MpExtras, MpSeekBar, MpTransport } from '../../components/music/MpControls';
import { MpParticles } from '../../components/music/MpParticles';
import { PfTabs } from '../Portfolio/PfPageHeader';

type Tab = 'queue' | 'lyrics' | 'info';
const BARS = 32;

/** Glow ring + frequency bars driven by the analyser (one rAF loop). */
const Pulse = ({ color }: { color: string }) => {
  const { level, bands, playing } = usePlayer();
  const ring = useRef<HTMLDivElement>(null);
  const bars = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0, smooth = 0;
    const tick = () => {
      const l = playing ? level() : 0;
      smooth += (l - smooth) * 0.2;
      if (ring.current) {
        ring.current.style.transform = `scale(${1 + smooth * 0.35})`;
        ring.current.style.opacity = String(0.35 + smooth * 0.9);
      }
      const b = bands(BARS);
      if (bars.current) {
        const kids = bars.current.children;
        for (let i = 0; i < kids.length; i++) {
          const v = b.length ? b[i] : playing ? 0.15 + 0.1 * Math.abs(Math.sin(Date.now() / 300 + i)) : 0.06;
          (kids[i] as HTMLElement).style.transform = `scaleY(${Math.max(0.06, v)})`;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [level, bands, playing]);
  return (
    <>
      <div ref={ring} className="absolute inset-[-18px] rounded-full blur-2xl pointer-events-none transition-[opacity] mp-motion" style={{ background: color }} />
      <div ref={bars} className="absolute -bottom-14 left-1/2 -translate-x-1/2 flex items-end gap-[3px] h-10 w-72" aria-hidden="true">
        {Array.from({ length: BARS }, (_, i) => (
          <span key={i} className="flex-1 rounded-t-sm origin-bottom h-full" style={{ background: color, opacity: 0.8 }} />
        ))}
      </div>
    </>
  );
};

/** Full player: big cover, particles for the genre, every control, queue / lyrics / info. */
export const MpNowPlaying = () => {
  const { t } = useLanguage();
  const p = usePlayer();
  const [tab, setTab] = useState<Tab>('queue');
  const s = p.current;
  const userId = useMpUserId();
  const rating = useMpRatings('song', s ? [s.id] : [], userId);
  const color = s?.genre?.color ?? '#6c5ce7';

  if (!s) {
    return (
      <div className="max-w-xl mx-auto mt-16 text-center space-y-4">
        <Music size={44} className="mx-auto text-gray-400" />
        <p className="text-gray-600 dark:text-gray-300">{t('mp.player.nothing')}</p>
        <Link to="/mp"><Button>{t('mp.library.pageTitle')}</Button></Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div
        className="relative overflow-hidden rounded-2xl p-6 sm:p-10 flex flex-col items-center gap-8 min-h-[34rem] text-white"
        style={{ background: `radial-gradient(120% 80% at 50% 0%, ${color}66, transparent 60%), linear-gradient(160deg, #131d3d, #0a0c10)` }}
      >
        <MpParticles kind={s.genre?.particle ?? 'sparks'} color={color} playing={p.playing} level={p.level} className="absolute inset-0 w-full h-full" />

        <div className="relative mt-6 mb-10">
          <Pulse color={color} />
          {/* Vinyl: the cover spins while playing and stops where it is when paused. */}
          <div
            className="relative w-56 h-56 sm:w-72 sm:h-72 rounded-full p-3 shadow-2xl mp-motion"
            style={{ background: 'repeating-radial-gradient(circle, #111 0 2px, #1d1d1d 2px 4px)', animation: 'mp-spin 18s linear infinite', animationPlayState: p.playing ? 'running' : 'paused' }}
          >
            <MpCover url={s.cover?.url} color={color} className="w-full h-full" rounded="rounded-full" alt={s.title} />
            <span className="absolute inset-0 m-auto w-6 h-6 rounded-full bg-[#0a0c10] border-2 border-white/30" />
          </div>
        </div>

        <div className="relative text-center space-y-1 max-w-full">
          <h2 className="text-2xl sm:text-3xl font-bold truncate">{s.title}</h2>
          <p className="text-white/70 truncate">{songArtist(s) || t('mp.unknownArtist')}</p>
          <MpStars className="justify-center [&_.text-gray-500]:text-white/70" stat={rating.stats[s.id]} mine={rating.mine[s.id]} onRate={n => void rating.rate(s.id, n)} size={18} />
          <div className="flex flex-wrap justify-center gap-1.5 pt-1">
            {s.genre && <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: `${color}55` }}>{s.genre.name}</span>}
            {s.mood && <span className="px-2 py-0.5 rounded-full text-[11px] bg-white/10">{t(`mp.moods.${s.mood}`)}</span>}
            {!s.is_free && <span className="px-2 py-0.5 rounded-full text-[11px] bg-warning/30">{t('mp.paid')}</span>}
          </div>
        </div>

        <div className="relative w-full max-w-xl space-y-3 rounded-2xl bg-black/30 backdrop-blur p-4 [&_button]:text-white/90 [&_.text-gray-500]:text-white/60 [&_select]:text-white [&_select]:bg-transparent">
          <MpSeekBar />
          <MpTransport big />
          <div className="flex justify-center"><MpExtras /></div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 flex flex-col min-h-[34rem]">
        <PfTabs tabs={[{ key: 'queue' as Tab, label: 'mp.player.queue' }, { key: 'lyrics' as Tab, label: 'mp.lyrics' }, { key: 'info' as Tab, label: 'mp.player.info' }]} active={tab} onChange={setTab} />
        <div className="mt-4 flex-1 overflow-y-auto">
          {tab === 'queue' && (
            <ul className="space-y-1">
              {p.queue.map((q, i) => {
                const isCurrent = i === p.index;
                return (
                  <li key={`${q.id}-${i}`} className={`flex items-center gap-3 rounded-lg px-2 py-1.5 ${isCurrent ? 'bg-primary/10' : 'hover:bg-gray-50 dark:hover:bg-gray-700/40'}`}>
                    <button className="flex items-center gap-3 flex-1 min-w-0 text-left" onClick={() => p.jumpTo(i)}>
                      <MpCover url={q.cover?.url} color={q.genre?.color} className="w-9 h-9" rounded="rounded" />
                      <span className="min-w-0">
                        <span className={`block text-sm font-medium truncate ${isCurrent ? 'text-primary' : 'text-gray-900 dark:text-gray-100'}`}>{q.title}</span>
                        <span className="block text-xs text-gray-500 truncate">{songArtist(q) || t('mp.unknownArtist')}</span>
                      </span>
                    </button>
                    {isCurrent
                      ? <MpPlayingBars active={p.playing} />
                      : <button className="p-1 rounded text-gray-400 hover:text-danger" onClick={() => p.removeFromQueue(i)} title={t('mp.player.removeFromQueue')}><X size={14} /></button>}
                    <span className="text-xs tabular-nums text-gray-400 w-10 text-right">{formatDuration(q.duration_seconds)}</span>
                  </li>
                );
              })}
            </ul>
          )}
          {tab === 'lyrics' && (
            s.lyrics
              ? <p className="whitespace-pre-line text-sm leading-7 text-gray-700 dark:text-gray-300">{s.lyrics}</p>
              : <p className="text-sm text-gray-500">{t('mp.player.noLyrics')}</p>
          )}
          {tab === 'info' && (
            <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
              {[
                [t('mp.singers'), songArtist(s)],
                [t('mp.source'), s.source && `${t(`mp.sourceKinds.${s.source.kind}`)}: ${s.source.name}`],
                [t('mp.genre'), s.genre?.name],
                [t('mp.country'), s.country?.name],
                [t('mp.language'), s.language?.name],
                [t('mp.mood'), s.mood && t(`mp.moods.${s.mood}`)],
                [t('mp.year'), s.release_year],
                [t('mp.player.length'), formatDuration(s.duration_seconds)],
                [t('mp.plays'), s.play_count],
              ].filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => (
                <div key={String(k)} className="contents">
                  <dt className="text-gray-500">{k}</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{String(v)}</dd>
                </div>
              ))}
              {s.tags.length > 0 && (
                <div className="contents">
                  <dt className="text-gray-500">{t('mp.tags')}</dt>
                  <dd className="flex flex-wrap gap-1">{s.tags.map(x => <Badge key={x} variant="muted">{x}</Badge>)}</dd>
                </div>
              )}
              {s.description && <p className="col-span-2 mt-2 text-gray-700 dark:text-gray-300 whitespace-pre-line">{s.description}</p>}
            </dl>
          )}
        </div>
      </div>
    </div>
  );
};
