import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import {
  Shuffle, SkipBack, SkipForward, Play, Pause, Repeat, Repeat1, RotateCcw, RotateCw, Volume2, VolumeX, Maximize2, Gauge, Square, Music, X,
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

/** Shared by the top bar and the phone's floating button: who may use them, and what Play does. */
function useQuickPlay() {
  const p = usePlayer();
  const { musicQuickPlay, musicDetails } = useAccess();
  const [starting, setStarting] = useState(false);
  // Something loaded (paused, or restored after a reload): resume it. Nothing: the whole library.
  const play = async () => {
    if (p.current) { p.toggle(); return; }
    setStarting(true);
    try { await p.playLibrary(); } finally { setStarting(false); }
  };
  return { p, visible: musicQuickPlay, details: musicDetails, play, starting };
}

/** The playing song's name: a link to the player for people with a music page, plain text otherwise. */
const SongName = ({ className }: { className: string }) => {
  const { current } = usePlayer();
  const { musicDetails } = useAccess();
  if (!current) return null;
  return musicDetails
    ? <Link to="/mp/player" className={`${className} hover:underline`} title={current.title}>{current.title}</Link>
    : <span className={className} title={current.title}>{current.title}</span>;
};

/**
 * Music buttons in the top bar (tablet / desktop), for anyone with MUSIC_QUICK_PLAY
 * or a music page. Not playing: one Play button (resumes what is loaded, else the
 * whole library on shuffle + repeat all). Playing: the song's name · previous ·
 * −10 s · pause · +10 s · next · stop. Phones get MpFloatingControls instead.
 */
export const MpHeaderControls = () => {
  const { t } = useLanguage();
  const { p, visible, play, starting } = useQuickPlay();
  if (!visible) return null;
  const btn = 'p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40';
  if (!p.playing) {
    return (
      <div className="hidden md:flex items-center gap-1 mr-1">
        {p.current && <SongName className="max-w-40 truncate text-xs text-white/60" />}
        <button onClick={() => void play()} disabled={starting} className={btn} title={t('mp.play')} aria-label={t('mp.play')}>
          <Play size={18} fill="currentColor" />
        </button>
      </div>
    );
  }
  return (
    <div className="hidden md:flex items-center gap-0.5 mr-1">
      <SongName className="max-w-48 truncate text-xs text-white/80 mr-1" />
      <button onClick={p.prev} className={btn} title={t('mp.prev')} aria-label={t('mp.prev')}><SkipBack size={16} /></button>
      <button onClick={() => p.skip(-10)} className={btn} title={t('mp.back10')} aria-label={t('mp.back10')}><RotateCcw size={15} /></button>
      <button onClick={p.toggle} className={btn} title={t('mp.pause')} aria-label={t('mp.pause')}><Pause size={18} fill="currentColor" /></button>
      <button onClick={() => p.skip(10)} className={btn} title={t('mp.forward10')} aria-label={t('mp.forward10')}><RotateCw size={15} /></button>
      <button onClick={p.next} className={btn} title={t('mp.next')} aria-label={t('mp.next')}><SkipForward size={16} /></button>
      <button onClick={p.stop} className={btn} title={t('mp.stop')} aria-label={t('mp.stop')}><Square size={13} fill="currentColor" /></button>
    </div>
  );
};

const FAB = 56; // floating button size (px)
const EDGE = 16; // gap to the screen edges when snapped to a corner
const FAB_POS_KEY = 'mp-fab-pos';
type Point = { x: number; y: number };
const clampPoint = (pt: Point): Point => ({
  x: Math.min(Math.max(pt.x, 8), window.innerWidth - FAB - 8),
  y: Math.min(Math.max(pt.y, 8), window.innerHeight - FAB - 8),
});

/**
 * Phones: a floating round button, fixed on screen (stays put while the page
 * scrolls). Drag it anywhere; where it was dropped is remembered. Tapping it
 * moves it to the nearest corner and stacks the controls vertically toward the
 * middle of the screen; closing (tap again, or anywhere else) sends it back.
 */
export const MpFloatingControls = () => {
  const { t } = useLanguage();
  const { p, visible, details, play, starting } = useQuickPlay();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  // Sit above the bottom mini player when it shows (people with a music page).
  const bottomGap = details && p.current ? 96 : EDGE;
  const [pos, setPos] = useState<Point>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(FAB_POS_KEY) ?? 'null') as Point | null;
      if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) return clampPoint(saved);
    } catch { /* default below */ }
    return { x: window.innerWidth - FAB - EDGE, y: window.innerHeight - FAB - bottomGap };
  });
  const drag = useRef<{ dx: number; dy: number; startX: number; startY: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  // Keep it on screen when the window changes size (rotation, keyboard).
  useEffect(() => {
    const onResize = () => setPos(pt => clampPoint(pt));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (!visible || pathname === '/mp/player') return null;

  // Open: snapped to the nearest corner; closed: where the user left it.
  const right = pos.x + FAB / 2 >= window.innerWidth / 2;
  const bottom = pos.y + FAB / 2 >= window.innerHeight / 2;
  const at: Point = open
    ? { x: right ? window.innerWidth - FAB - EDGE : EDGE, y: bottom ? window.innerHeight - FAB - bottomGap : EDGE + 64 }
    : pos;

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (open) return; // open: a tap just closes it
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y, startX: e.clientX, startY: e.clientY, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 6) return;
    if (!d.moved) { d.moved = true; setDragging(true); }
    setPos(clampPoint({ x: e.clientX - d.dx, y: e.clientY - d.dy }));
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.moved) {
      setDragging(false);
      setPos(pt => { try { localStorage.setItem(FAB_POS_KEY, JSON.stringify(pt)); } catch { /* convenience only */ } return pt; });
      return;
    }
    setOpen(o => !o);
  };

  const item = 'w-11 h-11 rounded-full flex items-center justify-center bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 shadow-lg border border-gray-200 dark:border-gray-700 active:scale-95 transition disabled:opacity-40';
  // Rendered on <body>: inside the animated page area "fixed" would scroll with the content.
  return createPortal(
    <div
      ref={box}
      className={`md:hidden fixed z-50 ${dragging ? '' : 'transition-[left,top] duration-300 ease-out'}`}
      style={{ left: at.x, top: at.y, width: FAB, height: FAB }}
    >
      {open && (
        // Stacked toward the middle of the screen: above when snapped low, below when high.
        <div className={`absolute flex gap-2 animate-fade-in-scale ${bottom ? 'bottom-full mb-2 flex-col' : 'top-full mt-2 flex-col-reverse'} ${right ? 'right-1.5 items-end' : 'left-1.5 items-start'}`}>
          {p.current && (
            <SongName className="max-w-[70vw] truncate rounded-full px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 shadow border border-gray-200 dark:border-gray-700" />
          )}
          {p.playing ? (
            <>
              <button onClick={p.next} className={item} aria-label={t('mp.next')}><SkipForward size={18} /></button>
              <button onClick={() => p.skip(10)} className={item} aria-label={t('mp.forward10')}><RotateCw size={17} /></button>
              <button onClick={p.toggle} className={`${item} !bg-primary !text-white !border-primary`} aria-label={t('mp.pause')}><Pause size={20} fill="currentColor" /></button>
              <button onClick={() => p.skip(-10)} className={item} aria-label={t('mp.back10')}><RotateCcw size={17} /></button>
              <button onClick={p.prev} className={item} aria-label={t('mp.prev')}><SkipBack size={18} /></button>
              <button onClick={() => { p.stop(); setOpen(false); }} className={item} aria-label={t('mp.stop')}><Square size={14} fill="currentColor" /></button>
            </>
          ) : (
            <button onClick={() => void play()} disabled={starting} className={`${item} !bg-primary !text-white !border-primary`} aria-label={t('mp.play')}>
              <Play size={20} fill="currentColor" className="ml-0.5" />
            </button>
          )}
        </div>
      )}
      <button
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { drag.current = null; setDragging(false); }}
        aria-expanded={open}
        aria-label={open ? t('mp.close') : t('mp.nowPlaying')}
        className={`relative w-14 h-14 rounded-full flex items-center justify-center text-white shadow-xl bg-gradient-to-br from-primary to-secondary touch-none select-none ${dragging ? 'scale-110 cursor-grabbing' : 'active:scale-95 cursor-grab'} transition-transform`}
      >
        {p.playing && !open && !dragging && <span className="absolute inset-0 rounded-full bg-primary/40 animate-ping" aria-hidden="true" />}
        {open ? <X size={22} /> : <Music size={22} />}
      </button>
    </div>,
    document.body,
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
