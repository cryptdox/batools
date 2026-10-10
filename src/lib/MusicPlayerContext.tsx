import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { toast } from 'react-toastify';
import { supabase } from './supabase';
import { canPlay, SONG_SELECT, useMpUserId, type MpSong } from './music';

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
  /** Play the whole library (everything this user may play), with shuffle and repeat all on. */
  playLibrary: () => Promise<void>;
  /** Play one song now, keeping the rest of the queue after it. */
  playNow: (song: MpSong) => void;
  /** Put a song right after the current one. */
  playNext: (song: MpSong) => void;
  addToQueue: (song: MpSong) => void;
  removeFromQueue: (index: number) => void;
  jumpTo: (index: number) => void;
  toggle: () => void;
  /** Stop playback and close the player (forgets the saved queue too). */
  stop: () => void;
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

// What is playing (queue, song, position), kept in this browser so a reload
// brings the player back on the same song, paused where it was.
const SESSION_KEY = 'mp-session';
// Saved per user: someone else signing in on this browser starts with an empty player.
type SavedSession = { userId: string | null; queue: MpSong[]; index: number; order: number[]; time: number };
const readSession = (userId?: string | null): SavedSession | null => {
  try {
    const v = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null') as SavedSession | null;
    if (!v || !Array.isArray(v.queue) || !v.queue[v.index]) return null;
    return userId === undefined || v.userId === userId ? v : null;
  } catch { return null; }
};
/** Updates just the saved position (on pause), without touching the rest. */
const writeSessionTime = (time: number) => {
  const v = readSession();
  if (v) writeSession({ ...v, time });
};
const writeSession = (v: SavedSession | null) => {
  try { if (v) localStorage.setItem(SESSION_KEY, JSON.stringify(v)); else localStorage.removeItem(SESSION_KEY); } catch { /* convenience only */ }
};

export function MusicPlayerProvider({ children }: { children: ReactNode }) {
  const userId = useMpUserId();
  const audio = useRef<HTMLAudioElement | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const freq = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const counted = useRef<string | null>(null);
  const unmountStop = useRef<number | undefined>(undefined);

  const saved = useRef(readSession(userId));
  // Where to resume the restored song once its audio has loaded.
  const resumeAt = useRef(saved.current?.time ?? 0);
  const [queue, setQueue] = useState<MpSong[]>(() => saved.current?.queue ?? []);
  const [index, setIndex] = useState(() => saved.current?.index ?? -1);
  // A restored session starts paused.
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(() => saved.current?.time ?? 0);
  const [duration, setDuration] = useState(0);
  const [shuffle, setShuffleState] = useState(readShuffle);
  // Play order when shuffling: positions into `queue`.
  const [order, setOrder] = useState<number[]>(() => saved.current?.order ?? []);
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
      setDuration(current.duration_seconds ?? 0);
      if (resumeAt.current > 0) {
        // Restored after a reload: back to the saved position (still paused).
        const at = resumeAt.current;
        resumeAt.current = 0;
        setTime(at);
        a.addEventListener('loadedmetadata', () => { a.currentTime = at; }, { once: true });
      } else {
        setTime(0);
      }
    }
    if (playing) void a.play().catch(() => setPlaying(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  // Keep the session saved: on every queue / song change, every few seconds of
  // playback, and when the page is closed or reloaded.
  const timeRef = useRef(time);
  timeRef.current = time;
  const saveSession = useCallback(() => {
    writeSession(index >= 0 && queue[index] ? { userId, queue, index, order, time: audio.current?.currentTime || timeRef.current } : null);
  }, [queue, index, order, userId]);
  useEffect(() => { saveSession(); }, [saveSession]);
  useEffect(() => {
    const id = window.setInterval(() => { if (!audio.current?.paused) saveSession(); }, 5000);
    window.addEventListener('pagehide', saveSession);
    return () => { window.clearInterval(id); window.removeEventListener('pagehide', saveSession); };
  }, [saveSession]);

  // Signing out (or the session ending) removes the player: stop the music with it.
  // The saved session stays, so the same person gets their song back (paused) after
  // signing in again. Deferred a tick so React's dev double-mount doesn't stop it.
  useEffect(() => {
    window.clearTimeout(unmountStop.current);
    return () => {
      unmountStop.current = window.setTimeout(() => {
        const a = audio.current;
        if (a) { a.pause(); a.removeAttribute('src'); a.load(); }
      }, 0);
    };
  }, []);

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
    const onPause = () => { setPlaying(false); writeSessionTime(a.currentTime); };
    const onEnded = () => {
      if (repeat === 'one') { a.currentTime = 0; void a.play(); return; }
      next();
    };
    // A stopped player has no source: that "error" is expected.
    const onError = () => { if (!a.getAttribute('src')) return; if (current) toast.error(`Could not play "${current.title}"`); setPlaying(false); };
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

  const playLibrary = async () => {
    // Fetched in the click, so playback starts inside the user's gesture as far as browsers care.
    const { data, error } = await supabase.from('mp_songs').select(SONG_SELECT).order('created_at', { ascending: false }).limit(1000);
    if (error) { toast.error(error.message); return; }
    const songs = ((data ?? []) as unknown as MpSong[]).filter(s => canPlay(s, userId) && s.audio?.url);
    if (!songs.length) { toast.info('Nothing to play yet.'); return; }
    setShuffleState(true);
    setRepeat('all');
    start(songs, Math.floor(Math.random() * songs.length));
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

  const stop = () => {
    const a = audio.current;
    if (a) { a.pause(); a.removeAttribute('src'); a.load(); }
    resumeAt.current = 0;
    setPlaying(false);
    setQueue([]);
    setIndex(-1);
    setOrder([]);
    setTime(0);
    setDuration(0);
    writeSession(null);
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
    playList, playLibrary, playNow, playNext, addToQueue, removeFromQueue, jumpTo, toggle, stop, next, prev, seek, skip,
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
