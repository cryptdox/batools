-- Migration: 040_mp_singers_ratings.sql
-- Music player: countries, languages and singers become their own tables, and
-- one ratings table covers songs, singers and albums.
--
-- MODEL
--   * mp_countries / mp_languages: shared pick lists, seeded with common ones.
--     Songs point at them (country_id, language_id) instead of free text.
--   * mp_singers: shared singer list (name unique, case-insensitive), with an
--     optional country. mp_song_singers links a song to one or more singers
--     (duets), ordered by position. An album names its singer (singer_id).
--   * mp_ratings: one row per (target_type, target_id, user). target_type is
--     the enum mp_rating_target ('song' | 'singer' | 'album'); target_id is
--     the row in mp_songs / mp_singers / mp_collections (kind = 'album').
--     A trigger checks the target exists; deleting a target drops its
--     ratings. mp_rating_stats gives the average and count per target.
--
-- DATA: the existing free-text mp_songs.origin / language / artist and
-- mp_collections.artist are moved into the new tables, then dropped.

-- ------------------------------------------------------------ countries / languages

CREATE TABLE IF NOT EXISTS mp_countries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT,            -- ISO 3166-1 alpha-2, when it is a real country
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_mp_countries_name ON mp_countries (lower(name));

CREATE TABLE IF NOT EXISTS mp_languages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  native_name TEXT,
  code TEXT,            -- ISO 639-1 (or 639-3) code
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_mp_languages_name ON mp_languages (lower(name));

INSERT INTO mp_countries (name, code) VALUES
  ('Bangladesh', 'BD'), ('India', 'IN'), ('Pakistan', 'PK'), ('Nepal', 'NP'), ('Sri Lanka', 'LK'),
  ('Afghanistan', 'AF'), ('Iran', 'IR'), ('Turkey', 'TR'), ('Saudi Arabia', 'SA'), ('United Arab Emirates', 'AE'),
  ('Egypt', 'EG'), ('Morocco', 'MA'), ('Nigeria', 'NG'), ('South Africa', 'ZA'),
  ('China', 'CN'), ('Japan', 'JP'), ('South Korea', 'KR'), ('Indonesia', 'ID'), ('Malaysia', 'MY'),
  ('Thailand', 'TH'), ('Philippines', 'PH'), ('Vietnam', 'VN'),
  ('United Kingdom', 'GB'), ('Ireland', 'IE'), ('France', 'FR'), ('Germany', 'DE'), ('Spain', 'ES'),
  ('Italy', 'IT'), ('Portugal', 'PT'), ('Netherlands', 'NL'), ('Sweden', 'SE'), ('Norway', 'NO'), ('Russia', 'RU'),
  ('United States', 'US'), ('Canada', 'CA'), ('Mexico', 'MX'), ('Brazil', 'BR'), ('Argentina', 'AR'),
  ('Colombia', 'CO'), ('Puerto Rico', 'PR'), ('Jamaica', 'JM'), ('Australia', 'AU'), ('New Zealand', 'NZ')
ON CONFLICT DO NOTHING;

INSERT INTO mp_languages (name, native_name, code) VALUES
  ('Bangla', 'বাংলা', 'bn'), ('English', 'English', 'en'), ('Hindi', 'हिन्दी', 'hi'), ('Urdu', 'اردو', 'ur'),
  ('Arabic', 'العربية', 'ar'), ('Persian', 'فارسی', 'fa'), ('Punjabi', 'ਪੰਜਾਬੀ', 'pa'), ('Tamil', 'தமிழ்', 'ta'),
  ('Telugu', 'తెలుగు', 'te'), ('Nepali', 'नेपाली', 'ne'), ('Sylheti', 'ꠍꠤꠟꠐꠤ', 'syl'), ('Turkish', 'Türkçe', 'tr'),
  ('Korean', '한국어', 'ko'), ('Japanese', '日本語', 'ja'), ('Chinese', '中文', 'zh'), ('Indonesian', 'Bahasa Indonesia', 'id'),
  ('Malay', 'Bahasa Melayu', 'ms'), ('Thai', 'ไทย', 'th'), ('Spanish', 'Español', 'es'), ('French', 'Français', 'fr'),
  ('German', 'Deutsch', 'de'), ('Italian', 'Italiano', 'it'), ('Portuguese', 'Português', 'pt'), ('Russian', 'Русский', 'ru'),
  ('Swahili', 'Kiswahili', 'sw'), ('Instrumental', 'No lyrics', 'zxx')
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------ singers

CREATE TABLE IF NOT EXISTS mp_singers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  country_id UUID CONSTRAINT mp_singers_country_fkey REFERENCES mp_countries(id) ON DELETE SET NULL,
  bio TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_mp_singers_name ON mp_singers (lower(name));

CREATE TABLE IF NOT EXISTS mp_song_singers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL CONSTRAINT mp_song_singers_song_fkey REFERENCES mp_songs(id) ON DELETE CASCADE,
  singer_id UUID NOT NULL CONSTRAINT mp_song_singers_singer_fkey REFERENCES mp_singers(id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0,
  UNIQUE (song_id, singer_id)
);
CREATE INDEX IF NOT EXISTS idx_mp_song_singers_singer ON mp_song_singers(singer_id);

-- ------------------------------------------------------------ songs / albums point at them

ALTER TABLE mp_songs
  ADD COLUMN IF NOT EXISTS country_id UUID CONSTRAINT mp_songs_country_fkey REFERENCES mp_countries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS language_id UUID CONSTRAINT mp_songs_language_fkey REFERENCES mp_languages(id) ON DELETE SET NULL;
ALTER TABLE mp_collections
  ADD COLUMN IF NOT EXISTS singer_id UUID CONSTRAINT mp_collections_singer_fkey REFERENCES mp_singers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mp_songs_country  ON mp_songs(country_id);
CREATE INDEX IF NOT EXISTS idx_mp_songs_language ON mp_songs(language_id);

-- Move the old free text over (only while those columns still exist).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mp_songs' AND column_name = 'origin') THEN
    INSERT INTO mp_countries (name)
      SELECT DISTINCT btrim(origin) FROM mp_songs WHERE btrim(coalesce(origin, '')) <> ''
      ON CONFLICT DO NOTHING;
    INSERT INTO mp_languages (name)
      SELECT DISTINCT btrim(language) FROM mp_songs WHERE btrim(coalesce(language, '')) <> ''
      ON CONFLICT DO NOTHING;
    UPDATE mp_songs s SET country_id = c.id FROM mp_countries c WHERE lower(c.name) = lower(btrim(s.origin));
    UPDATE mp_songs s SET language_id = l.id FROM mp_languages l WHERE lower(l.name) = lower(btrim(s.language));

    INSERT INTO mp_singers (name, created_by)
      SELECT DISTINCT ON (lower(btrim(artist))) btrim(artist), uploaded_by
      FROM mp_songs WHERE btrim(coalesce(artist, '')) <> ''
      ORDER BY lower(btrim(artist)), created_at
      ON CONFLICT DO NOTHING;
    INSERT INTO mp_singers (name, created_by)
      SELECT DISTINCT ON (lower(btrim(artist))) btrim(artist), created_by
      FROM mp_collections WHERE btrim(coalesce(artist, '')) <> ''
      ORDER BY lower(btrim(artist)), created_at
      ON CONFLICT DO NOTHING;
    INSERT INTO mp_song_singers (song_id, singer_id, position)
      SELECT s.id, g.id, 1 FROM mp_songs s JOIN mp_singers g ON lower(g.name) = lower(btrim(s.artist))
      ON CONFLICT DO NOTHING;
    UPDATE mp_collections c SET singer_id = g.id FROM mp_singers g WHERE lower(g.name) = lower(btrim(c.artist));

    ALTER TABLE mp_songs DROP COLUMN origin, DROP COLUMN language, DROP COLUMN artist;
    ALTER TABLE mp_collections DROP COLUMN artist;
  END IF;
END $$;

-- ------------------------------------------------------------ ratings

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mp_rating_target') THEN
    CREATE TYPE mp_rating_target AS ENUM ('song', 'singer', 'album');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS mp_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type mp_rating_target NOT NULL,
  target_id UUID NOT NULL,
  user_id UUID NOT NULL,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (target_type, target_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_mp_ratings_user ON mp_ratings(user_id);

-- target_id is polymorphic, so check it by hand: it must exist, and an
-- 'album' must be an album (not a mix).
CREATE OR REPLACE FUNCTION mp_ratings_check_target()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE found BOOLEAN;
BEGIN
  found := CASE NEW.target_type
    WHEN 'song'   THEN EXISTS (SELECT 1 FROM mp_songs WHERE id = NEW.target_id)
    WHEN 'singer' THEN EXISTS (SELECT 1 FROM mp_singers WHERE id = NEW.target_id)
    WHEN 'album'  THEN EXISTS (SELECT 1 FROM mp_collections WHERE id = NEW.target_id AND kind = 'album')
  END;
  IF NOT found THEN
    RAISE EXCEPTION 'mp_ratings: no % with id %', NEW.target_type, NEW.target_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_mp_ratings_check_target ON mp_ratings;
CREATE TRIGGER trg_mp_ratings_check_target BEFORE INSERT OR UPDATE OF target_type, target_id ON mp_ratings
  FOR EACH ROW EXECUTE FUNCTION mp_ratings_check_target();

-- Deleting a song / singer / album drops its ratings (TG_ARGV[0] = target type).
CREATE OR REPLACE FUNCTION mp_ratings_drop_for_target()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM mp_ratings WHERE target_type = TG_ARGV[0]::mp_rating_target AND target_id = OLD.id;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_mp_songs_drop_ratings ON mp_songs;
CREATE TRIGGER trg_mp_songs_drop_ratings AFTER DELETE ON mp_songs
  FOR EACH ROW EXECUTE FUNCTION mp_ratings_drop_for_target('song');
DROP TRIGGER IF EXISTS trg_mp_singers_drop_ratings ON mp_singers;
CREATE TRIGGER trg_mp_singers_drop_ratings AFTER DELETE ON mp_singers
  FOR EACH ROW EXECUTE FUNCTION mp_ratings_drop_for_target('singer');
DROP TRIGGER IF EXISTS trg_mp_collections_drop_ratings ON mp_collections;
CREATE TRIGGER trg_mp_collections_drop_ratings AFTER DELETE ON mp_collections
  FOR EACH ROW EXECUTE FUNCTION mp_ratings_drop_for_target('album');

CREATE OR REPLACE VIEW mp_rating_stats WITH (security_invoker = on) AS
  SELECT target_type, target_id, round(avg(rating), 2)::float8 AS avg_rating, count(*)::int AS rating_count
  FROM mp_ratings
  GROUP BY target_type, target_id;

-- ------------------------------------------------------------ RLS

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['mp_countries', 'mp_languages', 'mp_singers', 'mp_song_singers', 'mp_ratings'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Allow all access" ON %I', t);
    EXECUTE format('CREATE POLICY "Allow all access" ON %I FOR ALL USING (true)', t);
  END LOOP;
END $$;

GRANT SELECT ON mp_rating_stats TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
