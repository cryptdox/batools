-- Migration: 039_music_player.sql
-- Music player: a shared library of uploaded songs, grouped into albums and
-- mixes. Namespaced behind `mp_`. Creates new objects only.
--
-- MODEL
--   * mp_files holds every stored file (song audio, cover images) with the
--     provider / bucket / path / url it lives at. Songs and collections only
--     point at file rows, so moving storage (Supabase → S3 → …) means changing
--     those rows, nothing else.
--   * mp_songs: one uploaded track and its classification (genre, origin,
--     language, mood, year, tags). Shared: every signed-in user can browse;
--     `uploaded_by` (IAM user id) is the only one who may edit / delete.
--     is_free = false marks a paid track (the app blocks playback for
--     everyone but its uploader).
--   * mp_genres: the genre list; each genre picks the particle effect and the
--     colour the player animates with.
--   * mp_collections (kind album | mix) + mp_collection_songs (ordered).
--
-- RLS: same permissive policy as the rest of the project (no Supabase Auth;
-- ownership is enforced by the app and the functions below).

CREATE TABLE IF NOT EXISTS mp_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('audio', 'image')),
  -- Where the bytes live: 'supabase' today; 's3' etc. later.
  provider TEXT NOT NULL DEFAULT 'supabase',
  bucket TEXT,
  path TEXT,
  url TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  -- Audio only.
  duration_seconds NUMERIC(10, 2),
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mp_genres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  -- Particle effect the player draws for this kind of music.
  particle TEXT NOT NULL DEFAULT 'sparks'
    CHECK (particle IN ('sparks', 'bubbles', 'embers', 'snow', 'stars', 'waves', 'petals', 'notes')),
  color TEXT NOT NULL DEFAULT '#6c5ce7',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mp_songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  artist TEXT,
  genre_id UUID CONSTRAINT mp_songs_genre_fkey REFERENCES mp_genres(id) ON DELETE SET NULL,
  -- Classification, Spotify-style.
  origin TEXT,          -- country / region / scene, e.g. "Bangladesh", "K-pop"
  language TEXT,
  mood TEXT,            -- e.g. calm, happy, energetic, sad, romantic, focus, party
  release_year INT CHECK (release_year IS NULL OR release_year BETWEEN 1800 AND 2200),
  tags TEXT[] NOT NULL DEFAULT '{}',
  description TEXT,
  lyrics TEXT,
  is_free BOOLEAN NOT NULL DEFAULT true,
  audio_file_id UUID NOT NULL CONSTRAINT mp_songs_audio_fkey REFERENCES mp_files(id),
  cover_file_id UUID CONSTRAINT mp_songs_cover_fkey REFERENCES mp_files(id) ON DELETE SET NULL,
  duration_seconds NUMERIC(10, 2),
  play_count INT NOT NULL DEFAULT 0,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mp_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('album', 'mix')),
  title TEXT NOT NULL,
  artist TEXT,          -- albums
  description TEXT,
  release_year INT CHECK (release_year IS NULL OR release_year BETWEEN 1800 AND 2200),
  cover_file_id UUID CONSTRAINT mp_collections_cover_fkey REFERENCES mp_files(id) ON DELETE SET NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mp_collection_songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL CONSTRAINT mp_collection_songs_collection_fkey REFERENCES mp_collections(id) ON DELETE CASCADE,
  song_id UUID NOT NULL CONSTRAINT mp_collection_songs_song_fkey REFERENCES mp_songs(id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0,
  added_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (collection_id, song_id)
);

CREATE INDEX IF NOT EXISTS idx_mp_songs_created    ON mp_songs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mp_songs_genre      ON mp_songs(genre_id);
CREATE INDEX IF NOT EXISTS idx_mp_songs_uploader   ON mp_songs(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_mp_coll_songs_coll  ON mp_collection_songs(collection_id, position);
CREATE INDEX IF NOT EXISTS idx_mp_coll_songs_song  ON mp_collection_songs(song_id);
CREATE INDEX IF NOT EXISTS idx_mp_collections_kind ON mp_collections(kind, created_at DESC);

-- A play started: bump the counter (no read-modify-write race in the app).
CREATE OR REPLACE FUNCTION mp_count_play(p_song_id UUID)
RETURNS INT
LANGUAGE sql AS $$
  UPDATE mp_songs SET play_count = play_count + 1 WHERE id = p_song_id RETURNING play_count;
$$;

-- Seed genres, each with its own particle effect.
INSERT INTO mp_genres (name, particle, color) VALUES
  ('Pop', 'sparks', '#e87ba4'),
  ('Rock', 'embers', '#eb6834'),
  ('Metal', 'embers', '#e34948'),
  ('Hip-Hop', 'waves', '#eda100'),
  ('Electronic', 'stars', '#2a78d6'),
  ('Lo-fi', 'snow', '#9aa3b2'),
  ('Ambient', 'snow', '#1baf7a'),
  ('Classical', 'notes', '#6c5ce7'),
  ('Jazz', 'bubbles', '#008300'),
  ('Folk', 'petals', '#1baf7a'),
  ('Bangla Folk', 'petals', '#eda100'),
  ('Rabindra Sangeet', 'petals', '#e87ba4'),
  ('Sufi / Qawwali', 'stars', '#4a3aa7'),
  ('Devotional', 'stars', '#eda100'),
  ('Soundtrack', 'notes', '#2a78d6')
ON CONFLICT (name) DO NOTHING;

-- RLS: same permissive policy as every other table in this project (see 001).
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['mp_files', 'mp_genres', 'mp_songs', 'mp_collections', 'mp_collection_songs'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Allow all access" ON %I', t);
    EXECUTE format('CREATE POLICY "Allow all access" ON %I FOR ALL USING (true)', t);
  END LOOP;
END $$;

-- Storage: public `music` bucket (audio under audio/, covers under covers/).
-- 50 MB per file (Supabase's default upload limit).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('music', 'music', true, 52428800, ARRAY[
  'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/wav', 'audio/x-wav',
  'audio/ogg', 'audio/webm', 'audio/flac', 'audio/x-flac',
  'image/png', 'image/jpeg', 'image/webp', 'image/gif'
])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "music read"   ON storage.objects;
DROP POLICY IF EXISTS "music insert" ON storage.objects;
DROP POLICY IF EXISTS "music update" ON storage.objects;
DROP POLICY IF EXISTS "music delete" ON storage.objects;
CREATE POLICY "music read"   ON storage.objects FOR SELECT USING (bucket_id = 'music');
CREATE POLICY "music insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'music');
CREATE POLICY "music update" ON storage.objects FOR UPDATE USING (bucket_id = 'music');
CREATE POLICY "music delete" ON storage.objects FOR DELETE USING (bucket_id = 'music');

NOTIFY pgrst, 'reload schema';
