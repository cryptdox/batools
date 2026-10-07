-- Migration: 041_mp_sources_bulk.sql
-- Music player: where a song comes from (band / movie / concert / ...),
-- songs waiting for their info (bulk uploads), and inactive countries /
-- languages.
--
-- MODEL
--   * mp_sources: a band, movie, concert, TV show, drama or other source of
--     songs (kind = enum mp_source_kind), with its own info. Name is unique
--     per kind (case-insensitive). A song has at most one source (source_id).
--   * mp_source_singers: singers who belong to / appear in a source (band
--     members, a movie's playback singers, a concert's line-up).
--   * mp_songs.info_pending: true for songs uploaded in bulk whose details
--     are still to be filled in. They are visible and playable like any
--     other song; the library can filter on it.
--   * mp_countries / mp_languages.is_active: inactive entries stay on the
--     songs that use them but are not offered in the pickers.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mp_source_kind') THEN
    CREATE TYPE mp_source_kind AS ENUM ('band', 'movie', 'concert', 'tv_show', 'drama', 'other');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS mp_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind mp_source_kind NOT NULL,
  name TEXT NOT NULL,
  release_year INT CHECK (release_year IS NULL OR release_year BETWEEN 1800 AND 2200),
  country_id UUID CONSTRAINT mp_sources_country_fkey REFERENCES mp_countries(id) ON DELETE SET NULL,
  description TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_mp_sources_kind_name ON mp_sources (kind, lower(name));

CREATE TABLE IF NOT EXISTS mp_source_singers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL CONSTRAINT mp_source_singers_source_fkey REFERENCES mp_sources(id) ON DELETE CASCADE,
  singer_id UUID NOT NULL CONSTRAINT mp_source_singers_singer_fkey REFERENCES mp_singers(id) ON DELETE CASCADE,
  UNIQUE (source_id, singer_id)
);
CREATE INDEX IF NOT EXISTS idx_mp_source_singers_singer ON mp_source_singers(singer_id);

ALTER TABLE mp_songs
  ADD COLUMN IF NOT EXISTS source_id UUID CONSTRAINT mp_songs_source_fkey REFERENCES mp_sources(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS info_pending BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_mp_songs_source ON mp_songs(source_id);
CREATE INDEX IF NOT EXISTS idx_mp_songs_info_pending ON mp_songs(created_at DESC) WHERE info_pending;

ALTER TABLE mp_countries ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE mp_languages ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['mp_sources', 'mp_source_singers'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Allow all access" ON %I', t);
    EXECUTE format('CREATE POLICY "Allow all access" ON %I FOR ALL USING (true)', t);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
