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
export type MpGenre = {
  id: string; name: string; particle: MpParticle; color: string; created_by: string | null;
  cover_file_id: string | null; cover?: MpFile | null;
};

export type MpCountry = { id: string; name: string; code: string | null; is_active: boolean };
export type MpLanguage = { id: string; name: string; native_name: string | null; code: string | null; is_active: boolean };

/** Where songs come from (mp_sources.kind, enum mp_source_kind). */
export type MpSourceKind = 'band' | 'movie' | 'concert' | 'tv_show' | 'drama' | 'other';
export const SOURCE_KINDS: MpSourceKind[] = ['band', 'movie', 'concert', 'tv_show', 'drama', 'other'];
export type MpSource = {
  id: string; kind: MpSourceKind; name: string; release_year: number | null; country_id: string | null;
  description: string | null; created_by: string | null; cover_file_id: string | null;
};
export type MpSinger = { id: string; name: string; country_id: string | null; bio: string | null; created_by: string | null; cover_file_id: string | null };

export type MpSong = {
  id: string; title: string; genre_id: string | null;
  country_id: string | null; language_id: string | null; source_id: string | null; info_pending: boolean;
  mood: string | null; release_year: number | null;
  tags: string[]; description: string | null; lyrics: string | null; is_free: boolean;
  audio_file_id: string; cover_file_id: string | null; duration_seconds: number | null;
  play_count: number; uploaded_by: string; created_at: string;
  audio: MpFile | null; cover: MpFile | null; genre: MpGenre | null;
  country: MpCountry | null; language: MpLanguage | null; source: Pick<MpSource, 'id' | 'kind' | 'name'> | null;
  singers: { position: number; singer: { id: string; name: string } | null }[];
};

export type MpCollection = {
  id: string; kind: 'album' | 'mix'; title: string; description: string | null;
  source_id: string | null; country_id: string | null;
  release_year: number | null; cover_file_id: string | null; created_by: string; created_at: string;
  cover: MpFile | null; songs: { count: number }[];
  singers: { position: number; singer: { id: string; name: string } | null }[];
  languages: { language: { id: string; name: string } | null }[];
  source: Pick<MpSource, 'id' | 'kind' | 'name'> | null;
  country: { id: string; name: string } | null;
};

export const FILE_FIELDS = 'id, url, provider, bucket, path';
export const SINGER_FIELDS = 'id, name, country_id, bio, created_by, cover_file_id';
export const SOURCE_FIELDS = 'id, kind, name, release_year, country_id, description, created_by, cover_file_id';

/**
 * Saves a row's cover change: uploads `file` (if any), runs `write(coverId)`
 * with the cover id to store, then deletes the replaced / removed cover. If
 * `write` fails, the just-uploaded file is removed again and the error rethrown.
 */
export async function withCover<T>(
  opts: { file: File | null; remove: boolean; current: MpFile | null | undefined; userId: string },
  write: (coverId: string | null) => Promise<T>,
): Promise<T> {
  const uploaded = opts.file ? await uploadMusicFile(opts.file, 'image', opts.userId) : null;
  let result: T;
  try {
    result = await write(uploaded ?? (opts.remove ? null : opts.current?.id ?? null));
  } catch (e) {
    await discardUploads([uploaded]);
    throw e;
  }
  if ((uploaded || opts.remove) && opts.current) await deleteMusicFile(opts.current).catch(() => {});
  return result;
}

/** Song row with its files, genre, country, language and singers, through the named FKs. */
/** An album or mix holds at most this many songs (also enforced in the DB: mp_collection_songs_limit). */
export const MP_COLLECTION_MAX = 20;

export const SONG_SELECT =
  '*, audio:mp_files!mp_songs_audio_fkey(id, url, provider, bucket, path), cover:mp_files!mp_songs_cover_fkey(id, url, provider, bucket, path), genre:mp_genres!mp_songs_genre_fkey(*)'
  + ', country:mp_countries!mp_songs_country_fkey(id, name, code), language:mp_languages!mp_songs_language_fkey(id, name, native_name, code)'
  + ', singers:mp_song_singers(position, singer:mp_singers!mp_song_singers_singer_fkey(id, name))'
  + ', source:mp_sources!mp_songs_source_fkey(id, kind, name)';

export const COLLECTION_SELECT =
  '*, cover:mp_files!mp_collections_cover_fkey(id, url, provider, bucket, path), songs:mp_collection_songs(count)'
  + ', singers:mp_collection_singers(position, singer:mp_singers!mp_collection_singers_singer_fkey(id, name))'
  + ', languages:mp_collection_languages(language:mp_languages!mp_collection_languages_language_fkey(id, name))'
  + ', source:mp_sources!mp_collections_source_fkey(id, kind, name), country:mp_countries!mp_collections_country_fkey(id, name)';

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
    const { data, error } = await supabase.from('mp_genres').select(`*, cover:mp_files!mp_genres_cover_fkey(${FILE_FIELDS})`).order('name');
    if (error) toast.error(errorMessage(error, 'Could not load genres'));
    setGenres((data ?? []) as MpGenre[]);
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  return { genres, reload };
}

/**
 * The shared pick lists: countries, languages, singers, sources (each sorted
 * by name). Countries / languages include inactive ones; pickers hide them.
 */
export function useMpLookups() {
  const [countries, setCountries] = useState<MpCountry[]>([]);
  const [languages, setLanguages] = useState<MpLanguage[]>([]);
  const [singers, setSingers] = useState<MpSinger[]>([]);
  const [sources, setSources] = useState<MpSource[]>([]);
  const reload = useCallback(async () => {
    const [c, l, s, o] = await Promise.all([
      supabase.from('mp_countries').select('id, name, code, is_active').order('name'),
      supabase.from('mp_languages').select('id, name, native_name, code, is_active').order('name'),
      supabase.from('mp_singers').select(SINGER_FIELDS).order('name'),
      supabase.from('mp_sources').select(SOURCE_FIELDS).order('name'),
    ]);
    const error = c.error ?? l.error ?? s.error ?? o.error;
    if (error) toast.error(errorMessage(error, 'Could not load countries, languages, singers and sources'));
    setCountries((c.data ?? []) as MpCountry[]);
    setLanguages((l.data ?? []) as MpLanguage[]);
    setSingers((s.data ?? []) as MpSinger[]);
    setSources((o.data ?? []) as MpSource[]);
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  return { countries, languages, singers, setSingers, sources, setSources, reload };
}

/**
 * At or above this title score a new song counts as a duplicate: it cannot
 * be uploaded (the DB trigger mp_songs_block_duplicate enforces the same).
 */
export const DUPLICATE_SCORE = 0.78;

export type MpSimilarSong = MpSong & { score: number };

/** Songs whose title looks like `title` (pg_trgm score 0..1), best match first. */
export async function findSimilarSongs(title: string, limit = 5): Promise<MpSimilarSong[]> {
  if (title.trim().length < 3) return [];
  const { data: hits, error } = await supabase.rpc('mp_similar_song_scores', { p_title: title.trim(), p_limit: limit });
  if (error) { console.error(error); return []; }
  const scores = new Map<string, number>(((hits ?? []) as { song_id: string; score: number }[]).map(h => [h.song_id, Number(h.score)]));
  if (!scores.size) return [];
  const { data } = await supabase.from('mp_songs').select(SONG_SELECT).in('id', [...scores.keys()]);
  return ((data ?? []) as unknown as MpSong[])
    .map(s => ({ ...s, score: scores.get(s.id) ?? 0 }))
    .sort((a, b) => b.score - a.score);
}

export const isDuplicate = (s: { score: number } | null | undefined) => !!s && s.score >= DUPLICATE_SCORE;

/** Deletes one of your songs, then its audio and cover files. */
export async function deleteSong(song: MpSong, userId: string) {
  const { error } = await supabase.from('mp_songs').delete().eq('id', song.id).eq('uploaded_by', userId);
  if (error) throw error;
  await deleteMusicFile(song.audio);
  await deleteMusicFile(song.cover);
}

/** Title from a file name: drop the extension, underscores / dashes to spaces. */
export const titleFromFile = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();

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

/**
 * Removes files uploaded during a save that then failed, so a half-finished
 * upload leaves no mp_files row or stored object behind.
 */
export async function discardUploads(ids: (string | null | undefined)[]) {
  const list = ids.filter(Boolean) as string[];
  if (!list.length) return;
  const { data } = await supabase.from('mp_files').select('id, url, provider, bucket, path').in('id', list);
  for (const f of (data ?? []) as MpFile[]) await deleteMusicFile(f).catch(() => {});
}

/** Deletes a file row and its stored object (best effort on the object). */
export async function deleteMusicFile(file: MpFile | null) {
  if (!file) return;
  await supabase.from('mp_files').delete().eq('id', file.id);
  await storageFor(file.provider).remove({ bucket: file.bucket, path: file.path }).catch(() => {});
}
