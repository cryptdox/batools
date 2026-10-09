import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { toast } from 'react-toastify';
import { supabase } from './supabase';
import { canPlay, useMpUserId, type MpSong } from './music';

// One <audio> for the whole app, so music keeps playing across pages.
// Holds the queue and every control the player / mini player use.

export type RepeatMode = 'off' | 'all' | 'one';

type PlayerContextValue = {
  queue: MpSong[];
  /** Position of the current song in `queue`. */
  index: number;
  current: MpSong | null;
  playing: boolean;
  time: number;
  duration: number;
  shuffle: boolean;
  repeat: RepeatMode;
  rate: number;
  volume: number;
  muted: boolean;
  /** Replace the queue with `songs` and start at `start`. */
  playList: (songs: MpSong[], start?: number) => void;
  /** Play one song now, keeping the rest of the queue after it. */
  playNow: (song: MpSong) => void;
  /** Put a song right after the current one. */
  playNext: (song: MpSong) => void;
  addToQueue: (song: MpSong) => void;
  removeFromQueue: (index: number) => void;
  jumpTo: (index: number) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (seconds: number) => void;
  skip: (delta: number) => void;
  setShuffle: (v: boolean) => void;
  cycleRepeat: () => void;
  setRate: (v: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  /** 0..1 loudness right now (for animations); 0 when unavailable. */
  level: () => number;
  /** Frequency bands 0..1 (for visualisers); empty when unavailable. */
  bands: (count: number) => number[];
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

const read = (key: string, fallback: number) => {
  try { const v = Number(localStorage.getItem(key)); return Number.isFinite(v) && localStorage.getItem(key) !== null ? v : fallback; } catch { return fallback; }
};
const write = (key: string, v: number) => { try { localStorage.setItem(key, String(v)); } catch { /* convenience only */ } };
// Shuffle and repeat start on (shuffle, repeat all) and remember the listener's choice in this browser.
const readShuffle = () => { try { return localStorage.getItem('mp-shuffle') !== 'false'; } catch { return true; } };
const readRepeat = (): RepeatMode => {
  try { const v = localStorage.getItem('mp-repeat'); return v === 'off' || v === 'all' || v === 'one' ? v : 'all'; } catch { return 'all'; }
};
const writeText = (key: string, v: string) => { try { localStorage.setItem(key, v); } catch { /* convenience only */ } };

export function MusicPlayerProvider({ children }: { children: ReactNode }) {
  const userId = useMpUserId();
  const audio = useRef<HTMLAudioElement | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const freq = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const counted = useRef<string | null>(null);

  const [queue, setQueue] = useState<MpSong[]>([]);
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shuffle, setShuffleState] = useState(readShuffle);
  // Play order when shuffling: positions into `queue`.
  const [order, setOrder] = useState<number[]>([]);
  const [repeat, setRepeat] = useState<RepeatMode>(readRepeat);
  useEffect(() => { writeText('mp-shuffle', String(shuffle)); }, [shuffle]);
  useEffect(() => { writeText('mp-repeat', repeat); }, [repeat]);
  const [rate, setRateState] = useState(() => read('mp-rate', 1));
  const [volume, setVolumeState] = useState(() => read('mp-volume', 0.9));
  const [muted, setMuted] = useState(false);

  const current = index >= 0 ? queue[index] ?? null : null;

  if (!audio.current && typeof Audio !== 'undefined') {
    audio.current = new Audio();
    // Public storage urls send CORS headers; this lets the analyser read samples.
    audio.current.crossOrigin = 'anonymous';
    audio.current.preload = 'auto';
  }

  // Analyser is created on the first play (browsers need a user gesture).
  const ensureAnalyser = useCallback(() => {
    if (analyser.current || !audio.current) return;
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const src = ctx.createMediaElementSource(audio.current);
      const node = ctx.createAnalyser();
      node.fftSize = 256;
      src.connect(node);
      node.connect(ctx.destination);
      analyser.current = node;
      freq.current = new Uint8Array(new ArrayBuffer(node.frequencyBinCount));
      void ctx.resume();
    } catch {
      // Visuals fall back to a gentle pulse; playback is unaffected.
    }
  }, []);

  // Load the current song.
  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    if (!current?.audio?.url) { a.pause(); a.removeAttribute('src'); return; }
    if (a.src !== current.audio.url) {
      a.src = current.audio.url;
      a.playbackRate = rate;
      setTime(0);
      setDuration(current.duration_seconds ?? 0);
    }
    if (playing) void a.play().catch(() => setPlaying(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  useEffect(() => { if (audio.current) audio.current.playbackRate = rate; write('mp-rate', rate); }, [rate]);
  useEffect(() => { if (audio.current) audio.current.volume = volume; write('mp-volume', volume); }, [volume]);
  useEffect(() => { if (audio.current) audio.current.muted = muted; }, [muted]);

  const next = useCallback(() => {
    if (!queue.length) return;
    const pos = (shuffle ? order.indexOf(index) : index) + 1;
    if (pos < queue.length) { setIndex(shuffle ? order[pos] : pos); setPlaying(true); return; }
    if (repeat === 'all') { setIndex(shuffle ? order[0] : 0); setPlaying(true); return; }
    setPlaying(false);
    audio.current?.pause();
  }, [queue.length, shuffle, order, index, repeat]);

  const prev = useCallback(() => {
    const a = audio.current;
    // Like most players: past 3 s, "previous" restarts the song.
    if (a && a.currentTime > 3) { a.currentTime = 0; return; }
    const pos = (shuffle ? order.indexOf(index) : index) - 1;
    if (pos >= 0) { setIndex(shuffle ? order[pos] : pos); setPlaying(true); }
    else if (repeat === 'all' && queue.length) { setIndex(shuffle ? order[queue.length - 1] : queue.length - 1); setPlaying(true); }
    else if (a) a.currentTime = 0;
  }, [shuffle, order, index, repeat, queue.length]);

  // Audio element events.
  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const onTime = () => setTime(a.currentTime);
    const onMeta = () => setDuration(Number.isFinite(a.duration) ? a.duration : 0);
    const onPlay = () => {
      setPlaying(true);
      // Count each song once per load.
      if (current && counted.current !== current.id) {
        counted.current = current.id;
        void supabase.rpc('mp_count_play', { p_song_id: current.id });
      }
    };
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      if (repeat === 'one') { a.currentTime = 0; void a.play(); return; }
      next();
    };
    const onError = () => { if (current) toast.error(`Could not play "${current.title}"`); setPlaying(false); };
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    a.addEventListener('ended', onEnded);
    a.addEventListener('error', onError);
    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onPause);
      a.removeEventListener('ended', onEnded);
      a.removeEventListener('error', onError);
    };
  }, [current, repeat, next]);

  const shuffled = (n: number, first: number) => {
    const rest = Array.from({ length: n }, (_, i) => i).filter(i => i !== first);
    for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
    return first >= 0 ? [first, ...rest] : rest;
  };

  const guard = (song: MpSong) => {
    if (canPlay(song, userId)) return true;
    toast.info(`"${song.title}" is a paid song.`);
    return false;
  };

  const start = (songs: MpSong[], at: number) => {
    ensureAnalyser();
    setQueue(songs);
    setIndex(at);
    setOrder(shuffled(songs.length, at));
    setPlaying(true);
    const a = audio.current;
    // Same song again: restart it (the load effect won't run).
    if (a && songs[at]?.audio?.url && a.src === songs[at].audio!.url) { a.currentTime = 0; void a.play(); }
  };

  const playList = (songs: MpSong[], startAt = 0) => {
    const playable = songs.filter(s => canPlay(s, userId));
    if (!playable.length) { toast.info('Nothing playable here (paid songs are locked).'); return; }
    const first = songs[startAt] && canPlay(songs[startAt], userId) ? playable.indexOf(songs[startAt]) : 0;
    start(playable, Math.max(0, first));
  };

  const playNow = (song: MpSong) => {
    if (!guard(song)) return;
    if (current?.id === song.id) { toggle(); return; }
    const rest = queue.filter((s, i) => i > index && s.id !== song.id);
    start([song, ...rest], 0);
  };

  const playNext = (song: MpSong) => {
    if (!guard(song)) return;
    if (!current) { start([song], 0); return; }
    const q = queue.filter(s => s.id !== song.id);
    const at = q.findIndex(s => s.id === current.id);
    q.splice(at + 1, 0, song);
    setQueue(q);
    setIndex(at);
    setOrder(shuffled(q.length, at));
    toast.success(`"${song.title}" plays next`);
  };

  const addToQueue = (song: MpSong) => {
    if (!guard(song)) return;
    if (!current) { start([song], 0); return; }
    if (queue.some(s => s.id === song.id)) { toast.info('Already in the queue'); return; }
    setQueue(q => [...q, song]);
    setOrder(o => [...o, queue.length]);
    toast.success(`Added "${song.title}" to the queue`);
  };

  const removeFromQueue = (i: number) => {
    if (i === index) return;
    setQueue(q => q.filter((_, k) => k !== i));
    setOrder(o => o.filter(k => k !== i).map(k => (k > i ? k - 1 : k)));
    if (i < index) setIndex(x => x - 1);
  };

  const jumpTo = (i: number) => { if (queue[i]) { ensureAnalyser(); setIndex(i); setPlaying(true); } };

  const toggle = () => {
    const a = audio.current;
    if (!a || !current) return;
    ensureAnalyser();
    if (a.paused) void a.play().catch(() => {}); else a.pause();
  };

  const seek = (s: number) => { if (audio.current) audio.current.currentTime = Math.max(0, Math.min(s, duration || s)); };
  const skip = (d: number) => seek((audio.current?.currentTime ?? 0) + d);

  const setShuffle = (v: boolean) => {
    setShuffleState(v);
    if (v) setOrder(shuffled(queue.length, index));
  };
  const cycleRepeat = () => setRepeat(r => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off'));

  const level = useCallback(() => {
    const node = analyser.current, buf = freq.current;
    if (!node || !buf) return 0;
    node.getByteFrequencyData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i];
    return sum / (buf.length * 255);
  }, []);

  const bands = useCallback((count: number) => {
    const node = analyser.current, buf = freq.current;
    if (!node || !buf) return [];
    node.getByteFrequencyData(buf);
    const size = Math.floor(buf.length / count);
    return Array.from({ length: count }, (_, b) => {
      let s = 0;
      for (let i = b * size; i < (b + 1) * size; i++) s += buf[i];
      return s / (size * 255);
    });
  }, []);

  const value = useMemo<PlayerContextValue>(() => ({
    queue, index, current, playing, time, duration, shuffle, repeat, rate, volume, muted,
    playList, playNow, playNext, addToQueue, removeFromQueue, jumpTo, toggle, next, prev, seek, skip,
    setShuffle, cycleRepeat, setRate: setRateState, setVolume: setVolumeState, toggleMute: () => setMuted(m => !m),
    level, bands,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [queue, current, playing, time, duration, shuffle, repeat, rate, volume, muted, index, order, userId, next, prev, level, bands]);

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within MusicPlayerProvider');
  return ctx;
}
