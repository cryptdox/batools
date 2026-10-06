import { supabase } from './supabase';

// Where music files (audio, covers) are stored. mp_files keeps provider /
// bucket / path / url per file, so switching provider later means writing new
// rows (or rewriting urls) — songs and collections only point at file rows.
//
// VITE_MUSIC_STORAGE picks the provider for new uploads: 'supabase' (default)
// or 's3' (sample only, see below).

export type StoredFile = { provider: string; bucket: string | null; path: string; url: string };

export interface MusicStorageProvider {
  readonly name: string;
  upload(file: File, path: string): Promise<StoredFile>;
  remove(file: { bucket: string | null; path: string | null }): Promise<void>;
}

const SUPABASE_BUCKET = 'music';

/** Public Supabase Storage bucket from migration 039. */
export const supabaseMusicStorage: MusicStorageProvider = {
  name: 'supabase',
  async upload(file, path) {
    const { error } = await supabase.storage.from(SUPABASE_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    const { data } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(path);
    return { provider: 'supabase', bucket: SUPABASE_BUCKET, path, url: data.publicUrl };
  },
  async remove({ bucket, path }) {
    if (!path) return;
    await supabase.storage.from(bucket ?? SUPABASE_BUCKET).remove([path]);
  },
};

/**
 * SAMPLE ONLY — not wired to a real backend yet.
 *
 * The intended flow: the browser asks our backend for a pre-signed S3 upload
 * (POST {VITE_MUSIC_UPLOAD_API}/uploads { path, contentType }), PUTs the file
 * straight to S3 with it, and stores the returned public / CDN url. Keeping
 * AWS credentials on the backend is the point; the browser never sees them.
 */
export const s3MusicStorage: MusicStorageProvider = {
  name: 's3',
  async upload(file, path) {
    const api = import.meta.env.VITE_MUSIC_UPLOAD_API as string | undefined;
    if (!api) throw new Error('S3 upload needs VITE_MUSIC_UPLOAD_API (backend not built yet).');
    const presign = await fetch(`${api}/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, contentType: file.type }),
    });
    if (!presign.ok) throw new Error(`Upload API failed (${presign.status})`);
    const { uploadUrl, publicUrl, bucket } = (await presign.json()) as { uploadUrl: string; publicUrl: string; bucket: string };
    const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
    if (!put.ok) throw new Error(`S3 upload failed (${put.status})`);
    return { provider: 's3', bucket, path, url: publicUrl };
  },
  async remove({ path }) {
    const api = import.meta.env.VITE_MUSIC_UPLOAD_API as string | undefined;
    if (!api || !path) return;
    await fetch(`${api}/uploads?path=${encodeURIComponent(path)}`, { method: 'DELETE' });
  },
};

const PROVIDERS: Record<string, MusicStorageProvider> = { supabase: supabaseMusicStorage, s3: s3MusicStorage };

/** Provider for new uploads. */
export const musicStorage: MusicStorageProvider =
  PROVIDERS[(import.meta.env.VITE_MUSIC_STORAGE as string | undefined) ?? 'supabase'] ?? supabaseMusicStorage;

/** Provider that owns an existing file (by its recorded name). */
export const storageFor = (provider: string): MusicStorageProvider => PROVIDERS[provider] ?? supabaseMusicStorage;
