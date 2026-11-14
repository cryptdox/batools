-- Migration: 076_is_quran_hadith.sql
-- Islamic Studio Quran and hadith sources, edited in batools:
--   is_content_packs       translations, tafsir, hadith books, audio timings
--   is_reciters            Qaris for Quran audio
--   is_hadith_collections  Bukhari, Muslim, ...
--   is_daily_items         ayah / hadith / dua of the day
--
-- The Quran and hadith text is NOT stored here row by row. The Arabic Quran
-- ships inside the app (offline). A pack is either a file we host (file_url,
-- downloaded once by the app) or an alquran.cloud edition (api_edition, e.g.
-- 'bn.bengali'), fetched once per surah and kept on the phone.
-- A pack reaches the app only when active, approved AND its licence is filled in.

CREATE TABLE IF NOT EXISTS is_hadith_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name JSONB NOT NULL,
  compiler JSONB NOT NULL DEFAULT '{}',
  hadith_count INT,
  description JSONB NOT NULL DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

CREATE TABLE IF NOT EXISTS is_content_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('quran_translation', 'tafsir', 'word_by_word', 'transliteration', 'hadith', 'audio_timings')),
  slug TEXT NOT NULL,
  language TEXT REFERENCES is_languages(code),
  name JSONB NOT NULL,
  author TEXT,
  source_url TEXT,
  -- Must be filled before the app may see the pack.
  license TEXT,
  version INT NOT NULL DEFAULT 1,
  file_url TEXT,
  file_size_bytes BIGINT,
  sha256 TEXT,
  api_edition TEXT,
  hadith_collection_id UUID REFERENCES is_hadith_collections(id) ON DELETE CASCADE,
  min_version_code INT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  review_status is_review_status NOT NULL DEFAULT 'draft',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (slug, version),
  CHECK (file_url IS NOT NULL OR api_edition IS NOT NULL),
  CHECK (kind <> 'hadith' OR hadith_collection_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS is_reciters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name JSONB NOT NULL,
  style TEXT CHECK (style IN ('murattal', 'mujawwad', 'muallim')),
  -- Per-ayah audio: {surah} {ayah} {surah3} {ayah3} {global} are replaced, e.g. https://…/{surah3}{ayah3}.mp3
  audio_url_template TEXT NOT NULL,
  timings_pack_id UUID REFERENCES is_content_packs(id) ON DELETE SET NULL,
  photo_url TEXT,
  license TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

-- A fixed date wins; otherwise the app rotates through the rows by sort_order (one per day).
CREATE TABLE IF NOT EXISTS is_daily_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('ayah', 'hadith', 'dua')),
  -- 'ayah': '2:255'; 'hadith': 'bukhari:1'; 'dua': the is_duas id.
  ref TEXT NOT NULL,
  show_on DATE,
  note JSONB NOT NULL DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  CHECK (kind <> 'ayah' OR ref ~ '^\d{1,3}:\d{1,3}$')
);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['is_hadith_collections', 'is_content_packs', 'is_reciters', 'is_daily_items'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_touch', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION is_touch_updated_at()', t || '_touch', t);
  END LOOP;
END $$;

DO $$
DECLARE
  batools CONSTANT TEXT := '(SELECT private.lt_iam_claims()) IS NOT NULL';
  r RECORD;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('is_hadith_collections', 'is_active'),
    ('is_content_packs', 'is_active AND review_status = ''approved'' AND coalesce(trim(license), '''') <> '''''),
    ('is_reciters', 'is_active'),
    ('is_daily_items', 'is_active')
  ) AS v(tbl, app_reads) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', r.tbl);
    EXECUTE format('CREATE POLICY "is read" ON %I FOR SELECT TO anon, authenticated USING ((%s) OR %s)', r.tbl, r.app_reads, batools);
    EXECUTE format('CREATE POLICY "is insert" ON %I FOR INSERT TO anon, authenticated WITH CHECK (%s)', r.tbl, batools);
    EXECUTE format('CREATE POLICY "is update" ON %I FOR UPDATE TO anon, authenticated USING (%s) WITH CHECK (%s)', r.tbl, batools, batools);
    EXECUTE format('CREATE POLICY "is delete" ON %I FOR DELETE TO anon, authenticated USING (%s)', r.tbl, batools);
  END LOOP;
END $$;

-- Starting data ------------------------------------------------------------

-- Two translations the old app's source (alquran.cloud) offers. Drafts with no
-- licence: they stay invisible until someone confirms the licence and approves them.
INSERT INTO is_content_packs (kind, slug, language, name, author, source_url, api_edition, is_default, sort_order) VALUES
  ('quran_translation', 'bn-muhiuddin-khan', 'bn', '{"en":"Bangla — Muhiuddin Khan","bn":"বাংলা — মুহিউদ্দীন খান"}',
   'Muhiuddin Khan', 'https://alquran.cloud/translations', 'bn.bengali', true, 1),
  ('quran_translation', 'en-sahih-international', 'en', '{"en":"English — Saheeh International","bn":"ইংরেজি — সহীহ ইন্টারন্যাশনাল"}',
   'Saheeh International', 'https://alquran.cloud/translations', 'en.sahih', false, 2)
ON CONFLICT (slug, version) DO NOTHING;

INSERT INTO is_daily_items (kind, ref, sort_order) VALUES
  ('ayah', '2:255', 1), ('ayah', '2:286', 2), ('ayah', '3:8', 3), ('ayah', '13:28', 4), ('ayah', '94:5', 5),
  ('ayah', '2:152', 6), ('ayah', '39:53', 7), ('ayah', '65:3', 8), ('ayah', '2:186', 9), ('ayah', '20:114', 10);

NOTIFY pgrst, 'reload schema';
