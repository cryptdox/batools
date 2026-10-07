-- Migration: 044_mp_collection_meta.sql
-- Music player: albums and mixes get several singers (ordered), several
-- languages, one source (any kind: band / movie / concert / ...) and one
-- country. Replaces the single mp_collections.singer_id from 040.

CREATE TABLE IF NOT EXISTS mp_collection_singers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL CONSTRAINT mp_collection_singers_collection_fkey REFERENCES mp_collections(id) ON DELETE CASCADE,
  singer_id UUID NOT NULL CONSTRAINT mp_collection_singers_singer_fkey REFERENCES mp_singers(id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0,
  UNIQUE (collection_id, singer_id)
);
CREATE INDEX IF NOT EXISTS idx_mp_collection_singers_singer ON mp_collection_singers(singer_id);

CREATE TABLE IF NOT EXISTS mp_collection_languages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL CONSTRAINT mp_collection_languages_collection_fkey REFERENCES mp_collections(id) ON DELETE CASCADE,
  language_id UUID NOT NULL CONSTRAINT mp_collection_languages_language_fkey REFERENCES mp_languages(id) ON DELETE CASCADE,
  UNIQUE (collection_id, language_id)
);
CREATE INDEX IF NOT EXISTS idx_mp_collection_languages_language ON mp_collection_languages(language_id);

ALTER TABLE mp_collections
  ADD COLUMN IF NOT EXISTS source_id UUID CONSTRAINT mp_collections_source_fkey REFERENCES mp_sources(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS country_id UUID CONSTRAINT mp_collections_country_fkey REFERENCES mp_countries(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_mp_collections_source ON mp_collections(source_id);

-- Carry over the old single singer, then drop it.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mp_collections' AND column_name = 'singer_id') THEN
    INSERT INTO mp_collection_singers (collection_id, singer_id, position)
      SELECT id, singer_id, 1 FROM mp_collections WHERE singer_id IS NOT NULL
      ON CONFLICT DO NOTHING;
    ALTER TABLE mp_collections DROP COLUMN singer_id;
  END IF;
END $$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['mp_collection_singers', 'mp_collection_languages'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Allow all access" ON %I', t);
    EXECUTE format('CREATE POLICY "Allow all access" ON %I FOR ALL USING (true)', t);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
