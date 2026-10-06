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

export type MpSong = {
  id: string; title: string; artist: string | null; genre_id: string | null;
  origin: string | null; language: string | null; mood: string | null; release_year: number | null;
  tags: string[]; description: string | null; lyrics: string | null; is_free: boolean;
  audio_file_id: string; cover_file_id: string | null; duration_seconds: number | null;
  play_count: number; uploaded_by: string; created_at: string;
  audio: MpFile | null; cover: MpFile | null; genre: MpGenre | null;
};

export type MpCollection = {
  id: string; kind: 'album' | 'mix'; title: string; artist: string | null; description: string | null;
  release_year: number | null; cover_file_id: string | null; created_by: string; created_at: string;
  cover: MpFile | null; songs: { count: number }[];
};

/** Song row with its audio / cover file and genre, through the named FKs. */
export const SONG_SELECT =
  '*, audio:mp_files!mp_songs_audio_fkey(id, url, provider, bucket, path), cover:mp_files!mp_songs_cover_fkey(id, url, provider, bucket, path), genre:mp_genres!mp_songs_genre_fkey(*)';

export const COLLECTION_SELECT =
  '*, cover:mp_files!mp_collections_cover_fkey(id, url, provider, bucket, path), songs:mp_collection_songs(count)';

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
