import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';
import { errorMessage } from './portfolio';
import { musicStorage, storageFor } from './musicStorage';

// Music player (mp_). A shared library: everyone signed in can browse; only a
// song's uploader edits / deletes it; paid songs (is_free = false) play for
// their uploader only.

export type MpParticle = 'sparks' | 'bubbles' | 'embers' | 'snow' | 'stars' | 'waves' | 'petals' | 'notes';
export const PARTICLES: MpParticle[] = ['sparks', 'bubbles', 'embers', 'snow', 'stars', 'waves', 'petals', 'notes'];
export const MOODS = ['calm', 'happy', 'energetic', 'sad', 'romantic', 'focus', 'party', 'chill', 'spiritual'];

export type MpFile = { id: string; url: string; provider: string; bucket: string | null; path: string | null };
export type MpGenre = { id: string; name: string; particle: MpParticle; color: string; created_by: string | null };

export type MpCountry = { id: string; name: string; code: string | null };
export type MpLanguage = { id: string; name: string; native_name: string | null; code: string | null };
export type MpSinger = { id: string; name: string; country_id: string | null; bio: string | null; created_by: string | null };

export type MpSong = {
  id: string; title: string; genre_id: string | null;
  country_id: string | null; language_id: string | null; mood: string | null; release_year: number | null;
  tags: string[]; description: string | null; lyrics: string | null; is_free: boolean;
  audio_file_id: string; cover_file_id: string | null; duration_seconds: number | null;
  play_count: number; uploaded_by: string; created_at: string;
  audio: MpFile | null; cover: MpFile | null; genre: MpGenre | null;
  country: MpCountry | null; language: MpLanguage | null;
  singers: { position: number; singer: { id: string; name: string } | null }[];
};

export type MpCollection = {
  id: string; kind: 'album' | 'mix'; title: string; singer_id: string | null; description: string | null;
  release_year: number | null; cover_file_id: string | null; created_by: string; created_at: string;
  cover: MpFile | null; singer: { id: string; name: string } | null; songs: { count: number }[];
};

/** Song row with its files, genre, country, language and singers, through the named FKs. */
export const SONG_SELECT =
  '*, audio:mp_files!mp_songs_audio_fkey(id, url, provider, bucket, path), cover:mp_files!mp_songs_cover_fkey(id, url, provider, bucket, path), genre:mp_genres!mp_songs_genre_fkey(*)'
  + ', country:mp_countries!mp_songs_country_fkey(id, name, code), language:mp_languages!mp_songs_language_fkey(id, name, native_name, code)'
  + ', singers:mp_song_singers(position, singer:mp_singers!mp_song_singers_singer_fkey(id, name))';

export const COLLECTION_SELECT =
  '*, cover:mp_files!mp_collections_cover_fkey(id, url, provider, bucket, path), singer:mp_singers!mp_collections_singer_fkey(id, name), songs:mp_collection_songs(count)';

/** The song's singers in order, e.g. "A, B"; null when none is set. */
export const songArtist = (s: Pick<MpSong, 'singers'>) =>
  [...(s.singers ?? [])].sort((a, b) => a.position - b.position).map(x => x.singer?.name).filter(Boolean).join(', ') || null;

export function useMpUserId(): string | null {
  return useAuth().user?.userId ?? null;
}

/** Paid songs play for their uploader only (for now). */
export const canPlay = (song: MpSong, userId: string | null) => song.is_free || song.uploaded_by === userId;

export const formatDuration = (seconds: number | null | undefined) => {
  if (!seconds || !Number.isFinite(seconds)) return '0:00';
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** The genre list (shared), sorted by name. */
export function useMpGenres() {
  const [genres, setGenres] = useState<MpGenre[]>([]);
  const reload = useCallback(async () => {
    const { data, error } = await supabase.from('mp_genres').select('*').order('name');
    if (error) toast.error(errorMessage(error, 'Could not load genres'));
    setGenres((data ?? []) as MpGenre[]);
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  return { genres, reload };
}

/** The shared pick lists: countries, languages, singers (each sorted by name). */
export function useMpLookups() {
  const [countries, setCountries] = useState<MpCountry[]>([]);
  const [languages, setLanguages] = useState<MpLanguage[]>([]);
  const [singers, setSingers] = useState<MpSinger[]>([]);
  const reload = useCallback(async () => {
    const [c, l, s] = await Promise.all([
      supabase.from('mp_countries').select('id, name, code').order('name'),
      supabase.from('mp_languages').select('id, name, native_name, code').order('name'),
      supabase.from('mp_singers').select('id, name, country_id, bio, created_by').order('name'),
    ]);
    const error = c.error ?? l.error ?? s.error;
    if (error) toast.error(errorMessage(error, 'Could not load countries, languages and singers'));
    setCountries((c.data ?? []) as MpCountry[]);
    setLanguages((l.data ?? []) as MpLanguage[]);
    setSingers((s.data ?? []) as MpSinger[]);
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  return { countries, languages, singers, setSingers, reload };
}

// ------------------------------------------------------------ ratings

/** What a rating is about (mp_ratings.target_type, enum mp_rating_target). */
export type MpRatingTarget = 'song' | 'singer' | 'album';
export type MpRatingStat = { avg: number; count: number };

/**
 * Average / count for each id, plus the signed-in user's own rating.
 * rate(id, n) sets it; rating the same value again clears it.
 */
export function useMpRatings(target: MpRatingTarget, ids: string[], userId: string | null) {
  const [stats, setStats] = useState<Record<string, MpRatingStat>>({});
  const [mine, setMine] = useState<Record<string, number>>({});
  const key = [...ids].sort().join(',');

  const reload = useCallback(async () => {
    const list = key ? key.split(',') : [];
    if (!list.length) { setStats({}); setMine({}); return; }
    const [s, m] = await Promise.all([
      supabase.from('mp_rating_stats').select('target_id, avg_rating, rating_count').eq('target_type', target).in('target_id', list),
      userId
        ? supabase.from('mp_ratings').select('target_id, rating').eq('target_type', target).eq('user_id', userId).in('target_id', list)
        : Promise.resolve({ data: [], error: null }),
    ]);
    setStats(Object.fromEntries((s.data ?? []).map(r => [r.target_id as string, { avg: Number(r.avg_rating), count: r.rating_count as number }])));
    setMine(Object.fromEntries((m.data ?? []).map(r => [r.target_id as string, r.rating as number])));
  }, [target, key, userId]);

  useEffect(() => { void reload(); }, [reload]);

  const rate = useCallback(async (id: string, rating: number) => {
    if (!userId) return;
    const { error } = mine[id] === rating
      ? await supabase.from('mp_ratings').delete().eq('target_type', target).eq('target_id', id).eq('user_id', userId)
      : await supabase.from('mp_ratings').upsert(
        [{ target_type: target, target_id: id, user_id: userId, rating, updated_at: new Date().toISOString() }],
        { onConflict: 'target_type,target_id,user_id' },
      );
    if (error) return toast.error(errorMessage(error, 'Could not save the rating'));
    await reload();
  }, [target, userId, mine, reload]);

  return { stats, mine, rate, reload };
}

/** Reads an audio file's length in the browser before upload. */
export const readDuration = (file: File) => new Promise<number | null>(resolve => {
  const url = URL.createObjectURL(file);
  const a = new Audio();
  a.preload = 'metadata';
  a.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(Number.isFinite(a.duration) ? a.duration : null); };
  a.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
  a.src = url;
});

/**
 * Uploads a file with the configured provider and records it in mp_files.
 * `folder` is 'audio' or 'covers'; names are unique per upload.
 */
export async function uploadMusicFile(file: File, kind: 'audio' | 'image', userId: string, durationSeconds?: number | null): Promise<string> {
  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : 'bin';
  const path = `${kind === 'audio' ? 'audio' : 'covers'}/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const stored = await musicStorage.upload(file, path);
  const { data, error } = await supabase.from('mp_files').insert([{
    kind, provider: stored.provider, bucket: stored.bucket, path: stored.path, url: stored.url,
    mime_type: file.type || null, size_bytes: file.size, duration_seconds: durationSeconds ?? null, uploaded_by: userId,
  }]).select('id').single();
  if (error) {
    // Don't leave an orphan object behind if the row could not be written.
    await musicStorage.remove({ bucket: stored.bucket, path: stored.path }).catch(() => {});
    throw error;
  }
  return data.id as string;
}

/** Deletes a file row and its stored object (best effort on the object). */
export async function deleteMusicFile(file: MpFile | null) {
  if (!file) return;
  await supabase.from('mp_files').delete().eq('id', file.id);
  await storageFor(file.provider).remove({ bucket: file.bucket, path: file.path }).catch(() => {});
}
