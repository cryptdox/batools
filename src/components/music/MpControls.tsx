import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Shuffle, SkipBack, SkipForward, Play, Pause, Repeat, Repeat1, RotateCcw, RotateCw, Volume2, VolumeX, Maximize2, Gauge, Square,
} from 'lucide-react';
import { useLanguage } from '../../lib/LanguageContext';
import { usePlayer } from '../../lib/MusicPlayerContext';
import { useAccess } from '../../lib/permissions';
import { formatDuration, songArtist } from '../../lib/music';
import { MpCover } from './MpUi';

export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

const iconBtn = (on = false) =>
  `inline-flex items-center justify-center rounded-full p-2 transition-colors ${on ? 'text-primary bg-primary/10' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'} disabled:opacity-30`;

/** Shuffle · prev · −10 s · play · +10 s · next · repeat · stop. */
export const MpTransport = ({ big = false }: { big?: boolean }) => {
  const { t } = useLanguage();
  const p = usePlayer();
  const s = big ? 22 : 18;
  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2">
      <button className={iconBtn(p.shuffle)} onClick={() => p.setShuffle(!p.shuffle)} title={t('mp.shuffle')} aria-pressed={p.shuffle}><Shuffle size={s - 2} /></button>
      <button className={iconBtn()} onClick={p.prev} disabled={!p.current} title={t('mp.prev')}><SkipBack size={s} /></button>
      <button className={iconBtn()} onClick={() => p.skip(-10)} disabled={!p.current} title={t('mp.back10')}><RotateCcw size={s - 2} /></button>
      <button
        onClick={p.toggle}
        disabled={!p.current}
        title={p.playing ? t('mp.pause') : t('mp.play')}
        className={`inline-flex items-center justify-center rounded-full bg-primary text-white shadow-lg hover:scale-105 transition-transform disabled:opacity-40 ${big ? 'w-16 h-16' : 'w-10 h-10'}`}
      >
        {p.playing ? <Pause size={big ? 28 : 18} fill="currentColor" /> : <Play size={big ? 28 : 18} fill="currentColor" className="ml-0.5" />}
      </button>
      <button className={iconBtn()} onClick={() => p.skip(10)} disabled={!p.current} title={t('mp.forward10')}><RotateCw size={s - 2} /></button>
      <button className={iconBtn()} onClick={p.next} disabled={!p.current} title={t('mp.next')}><SkipForward size={s} /></button>
      <button className={iconBtn(p.repeat !== 'off')} onClick={p.cycleRepeat} title={t(`mp.repeat.${p.repeat}`)} aria-label={t(`mp.repeat.${p.repeat}`)}>
        {p.repeat === 'one' ? <Repeat1 size={s - 2} /> : <Repeat size={s - 2} />}
      </button>
      <button className={iconBtn()} onClick={p.stop} disabled={!p.current} title={t('mp.stop')} aria-label={t('mp.stop')}><Square size={s - 4} fill="currentColor" /></button>
    </div>
  );
};

/** Elapsed · seek slider · total. */
export const MpSeekBar = () => {
  const { time, duration, seek, current } = usePlayer();
  const pct = duration ? (time / duration) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
      <span className="w-9 text-right">{formatDuration(time)}</span>
      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.1}
        value={time}
        disabled={!current}
        onChange={e => seek(Number(e.target.value))}
        className="flex-1 h-1.5 accent-[var(--color-primary)] cursor-pointer"
        style={{ background: `linear-gradient(to right, var(--color-primary) ${pct}%, rgba(127,127,127,0.25) ${pct}%)`, borderRadius: 999 }}
        aria-label="Seek"
      />
      <span className="w-9">{formatDuration(duration)}</span>
    </div>
  );
};

/** Volume + speed. */
export const MpExtras = () => {
  const { t } = useLanguage();
  const p = usePlayer();
  return (
    <div className="flex items-center gap-2">
      <label className="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300" title={t('mp.speed')}>
        <Gauge size={15} />
        <select value={p.rate} onChange={e => p.setRate(Number(e.target.value))} className="bg-transparent text-xs rounded border border-gray-200 dark:border-gray-600 px-1 py-0.5">
          {SPEEDS.map(r => <option key={r} value={r}>{r}×</option>)}
        </select>
      </label>
      <button className={iconBtn()} onClick={p.toggleMute} title={p.muted ? t('mp.unmute') : t('mp.mute')}>
        {p.muted || p.volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
      </button>
      <input type="range" min={0} max={1} step={0.01} value={p.muted ? 0 : p.volume} onChange={e => p.setVolume(Number(e.target.value))} className="w-20 accent-[var(--color-primary)]" aria-label={t('mp.volume')} />
    </div>
  );
};

/**
 * Music buttons in the top bar, for anyone with MUSIC_QUICK_PLAY or a music page.
 * Stopped / paused: one Play button (resumes, or starts the whole library on
 * shuffle + repeat all). Playing: previous · pause · next · stop. The song's
 * name (linking to the player) shows only with access to a music page.
 */
export const MpHeaderControls = () => {
  const { t } = useLanguage();
  const p = usePlayer();
  const { musicQuickPlay, musicDetails } = useAccess();
  const [starting, setStarting] = useState(false);
  if (!musicQuickPlay) return null;
  const btn = 'p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40';
  if (!p.playing) {
    const play = async () => {
      if (p.current) { p.toggle(); return; }
      setStarting(true);
      try { await p.playLibrary(); } finally { setStarting(false); }
    };
    return (
      <button onClick={() => void play()} disabled={starting} className={btn} title={t('mp.play')} aria-label={t('mp.play')}>
        <Play size={18} fill="currentColor" />
      </button>
    );
  }
  return (
    <div className="flex items-center gap-0.5 mr-1">
      {musicDetails && p.current && (
        <Link to="/mp/player" className="hidden sm:block max-w-40 truncate text-xs text-white/80 hover:text-white mr-1" title={p.current.title}>{p.current.title}</Link>
      )}
      <button onClick={p.prev} className={btn} title={t('mp.prev')} aria-label={t('mp.prev')}><SkipBack size={16} /></button>
      <button onClick={p.toggle} className={btn} title={t('mp.pause')} aria-label={t('mp.pause')}><Pause size={18} fill="currentColor" /></button>
      <button onClick={p.next} className={btn} title={t('mp.next')} aria-label={t('mp.next')}><SkipForward size={16} /></button>
      <button onClick={p.stop} className={btn} title={t('mp.stop')} aria-label={t('mp.stop')}><Square size={13} fill="currentColor" /></button>
    </div>
  );
};

/** Bottom bar on every page while something is queued (only with access to a music page: it shows song details). */
export const MpMiniPlayer = () => {
  const { t } = useLanguage();
  const { current, playing } = usePlayer();
  const { pathname } = useLocation();
  const { musicDetails } = useAccess();
  // The full player has its own controls.
  if (!current || pathname === '/mp/player' || !musicDetails) return null;
  return (
    <div className="fixed bottom-0 inset-x-0 z-40 border-t border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 backdrop-blur shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.35)]">
      <div className="max-w-6xl mx-auto px-3 py-2 grid grid-cols-[1fr_auto] md:grid-cols-[1fr_minmax(0,2fr)_1fr] items-center gap-3">
        <Link to="/mp/player" className="flex items-center gap-3 min-w-0">
          <div className="relative">
            <MpCover url={current.cover?.url} color={current.genre?.color} className={`w-11 h-11 ${playing ? 'mp-motion' : ''}`} rounded="rounded-md" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{current.title}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{songArtist(current) || t('mp.unknownArtist')}</div>
          </div>
        </Link>
        <div className="hidden md:block space-y-1">
          <MpTransport />
          <MpSeekBar />
        </div>
        <div className="flex items-center justify-end gap-2">
          <div className="md:hidden"><MpTransportCompact /></div>
          <div className="hidden lg:block"><MpExtras /></div>
          <Link to="/mp/player" className={iconBtn()} title={t('mp.nowPlaying')}><Maximize2 size={16} /></Link>
        </div>
      </div>
    </div>
  );
};

/** Phone-size controls: prev · play · next. */
const MpTransportCompact = () => {
  const { t } = useLanguage();
  const p = usePlayer();
  return (
    <div className="flex items-center gap-1">
      <button className={iconBtn()} onClick={p.prev}><SkipBack size={16} /></button>
      <button onClick={p.toggle} className="inline-flex items-center justify-center rounded-full bg-primary text-white w-9 h-9">
        {p.playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
      </button>
      <button className={iconBtn()} onClick={p.next}><SkipForward size={16} /></button>
      <button className={iconBtn()} onClick={p.stop} title={t('mp.stop')} aria-label={t('mp.stop')}><Square size={13} fill="currentColor" /></button>
    </div>
  );
};
