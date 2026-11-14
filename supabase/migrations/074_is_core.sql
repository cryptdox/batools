-- Migration: 074_is_core.sql
-- Islamic Studio (is_) — the Android app com.cryptdox.islamicstudio is
-- controlled from batools (Islamic Studio menu). This migration adds the core:
--   is_files          every stored file (images, audio, content packs)
--   is_languages      languages the app offers (en / bn / ar)
--   is_features       one row per app feature; the app shows a feature only
--                     when its status allows it AND the installed build has
--                     its code (min_version_code)
--   is_app_settings   single row: force update, maintenance, defaults
--   is_home_sections  the app's home screen blocks, in order
--   is_announcements  messages shown in the app
--   is_feedback       sent from the app (anyone may add, only batools reads)
--
-- Text shown in the app is JSONB per language: {"en": "...", "bn": "...", "ar": "..."}.
-- Arabic scripture (ayah, dua, dhikr) is never translated text: it has its own column.
--
-- Access: the app reads with the anon key and sees only what is switched on;
-- batools writes with its IAM token. batools sends the token in an
-- x-iam-token header on every request, and the policies accept a write only
-- when private.lt_iam_claims() (Late Tracker, 054) finds it valid: signed with
-- Vault's iam_jwt_secret and not expired.

DO $$
BEGIN
  IF to_regprocedure('private.lt_iam_claims()') IS NULL THEN
    RAISE EXCEPTION 'private.lt_iam_claims() is missing: run the Late Tracker organizations migration (054) first.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'iam_jwt_secret') THEN
    RAISE EXCEPTION 'Store the CRYPTDOX realm secret in Vault as ''iam_jwt_secret'' first (Late Tracker uses the same one).';
  END IF;
END $$;

-- Policies run as the caller (anon), so it must reach the checker. The private
-- schema is not exposed by the API: this only lets policies call into it.
GRANT USAGE ON SCHEMA private TO anon, authenticated;

CREATE TYPE is_review_status AS ENUM ('draft', 'in_review', 'approved', 'rejected');
CREATE TYPE is_feature_status AS ENUM ('hidden', 'coming_soon', 'beta', 'active', 'maintenance');

CREATE OR REPLACE FUNCTION is_touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TABLE IF NOT EXISTS is_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('image', 'audio', 'pack', 'other')),
  -- Where the bytes live: 'supabase' today; another provider later means new rows only.
  provider TEXT NOT NULL DEFAULT 'supabase',
  bucket TEXT DEFAULT 'islamic-studio',
  path TEXT,
  url TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  -- Packs: the app checks the download against it.
  sha256 TEXT,
  duration_seconds NUMERIC(10, 2),
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS is_languages (
  code TEXT PRIMARY KEY,
  -- In its own script: English, বাংলা, العربية.
  name TEXT NOT NULL,
  is_rtl BOOLEAN NOT NULL DEFAULT false,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS is_features (
  key TEXT PRIMARY KEY,
  name JSONB NOT NULL,
  description JSONB NOT NULL DEFAULT '{}',
  feature_group TEXT NOT NULL CHECK (feature_group IN ('worship', 'quran_learning', 'lifestyle', 'ai', 'community_media')),
  tab TEXT NOT NULL CHECK (tab IN ('home', 'quran', 'worship', 'learn', 'profile')),
  phase SMALLINT NOT NULL CHECK (phase BETWEEN 1 AND 4),
  status is_feature_status NOT NULL DEFAULT 'hidden',
  -- First app build (versionCode) that contains the feature; NULL = not built yet.
  min_version_code INT,
  icon TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  -- Shown for coming_soon / maintenance.
  status_message JSONB,
  -- Installation ids that see a 'beta' feature (shown in the app's About screen).
  beta_testers TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  -- A switch can't turn on code the app doesn't have yet.
  CONSTRAINT is_features_built CHECK (status IN ('hidden', 'coming_soon') OR min_version_code IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS is_app_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  latest_version_code INT NOT NULL DEFAULT 1,
  -- Older builds get a blocking "please update" screen.
  min_supported_version_code INT NOT NULL DEFAULT 1,
  update_message JSONB NOT NULL DEFAULT '{}',
  maintenance_mode BOOLEAN NOT NULL DEFAULT false,
  maintenance_message JSONB NOT NULL DEFAULT '{}',
  default_language TEXT NOT NULL DEFAULT 'bn' REFERENCES is_languages(code),
  default_region TEXT NOT NULL DEFAULT 'BD',
  play_store_url TEXT,
  support_email TEXT,
  privacy_url TEXT,
  share_text JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

CREATE TABLE IF NOT EXISTS is_home_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('greeting', 'next_prayer', 'quick_actions', 'daily_ayah', 'daily_hadith',
                                     'daily_dua', 'announcements', 'ramadan', 'continue_reading', 'continue_course', 'hijri_date')),
  -- The app skips the block while this feature is off.
  feature_key TEXT REFERENCES is_features(key),
  title JSONB,
  -- quick_actions: {"features": ["quran", "qibla", "tasbih", "duas"]}
  config JSONB NOT NULL DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

CREATE TABLE IF NOT EXISTS is_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title JSONB NOT NULL,
  body JSONB NOT NULL DEFAULT '{}',
  image_url TEXT,
  -- A web link, or an in-app route such as app://quran/2/255.
  link_url TEXT,
  placement TEXT NOT NULL DEFAULT 'home' CHECK (placement IN ('home', 'popup', 'banner')),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  min_version_code INT,
  -- Empty = everywhere.
  regions TEXT[] NOT NULL DEFAULT '{}',
  priority INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS is_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL DEFAULT 'general' CHECK (kind IN ('general', 'bug', 'content_error', 'feature_request')),
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 3 AND 2000),
  contact TEXT CHECK (char_length(contact) <= 200),
  -- What it is about, e.g. 'dua:<id>' or 'quran:2:255'.
  content_ref TEXT CHECK (char_length(content_ref) <= 200),
  app_version_code INT,
  device TEXT CHECK (char_length(device) <= 200),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'seen', 'done', 'spam')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS is_feedback_created ON is_feedback (created_at DESC);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['is_features', 'is_app_settings', 'is_home_sections', 'is_announcements'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_touch', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION is_touch_updated_at()', t || '_touch', t);
  END LOOP;
END $$;

-- Access -------------------------------------------------------------------
-- `batools` = a request carrying a valid IAM token from batools.
DO $$
DECLARE
  batools CONSTANT TEXT := '(SELECT private.lt_iam_claims()) IS NOT NULL';
  r RECORD;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    -- table, what the app may read
    ('is_files', 'true'),
    ('is_languages', 'is_active'),
    ('is_features', 'true'),
    ('is_app_settings', 'true'),
    ('is_home_sections', 'is_active'),
    ('is_announcements', 'is_active AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now())')
  ) AS v(tbl, app_reads) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', r.tbl);
    EXECUTE format('CREATE POLICY "is read" ON %I FOR SELECT TO anon, authenticated USING ((%s) OR %s)', r.tbl, r.app_reads, batools);
    EXECUTE format('CREATE POLICY "is insert" ON %I FOR INSERT TO anon, authenticated WITH CHECK (%s)', r.tbl, batools);
    EXECUTE format('CREATE POLICY "is update" ON %I FOR UPDATE TO anon, authenticated USING (%s) WITH CHECK (%s)', r.tbl, batools, batools);
    EXECUTE format('CREATE POLICY "is delete" ON %I FOR DELETE TO anon, authenticated USING (%s)', r.tbl, batools);
  END LOOP;

  -- Feedback: the app may only add (a new row, nothing else); batools reads and handles it.
  ALTER TABLE is_feedback ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "is feedback send" ON is_feedback FOR INSERT TO anon, authenticated WITH CHECK (status = 'new');
  EXECUTE format('CREATE POLICY "is read" ON is_feedback FOR SELECT TO anon, authenticated USING (%s)', batools);
  EXECUTE format('CREATE POLICY "is update" ON is_feedback FOR UPDATE TO anon, authenticated USING (%s) WITH CHECK (%s)', batools, batools);
  EXECUTE format('CREATE POLICY "is delete" ON is_feedback FOR DELETE TO anon, authenticated USING (%s)', batools);
END $$;

-- Storage: public bucket; only batools uploads, replaces or deletes.
INSERT INTO storage.buckets (id, name, public) VALUES ('islamic-studio', 'islamic-studio', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "islamic-studio read" ON storage.objects;
DROP POLICY IF EXISTS "islamic-studio insert" ON storage.objects;
DROP POLICY IF EXISTS "islamic-studio update" ON storage.objects;
DROP POLICY IF EXISTS "islamic-studio delete" ON storage.objects;
CREATE POLICY "islamic-studio read" ON storage.objects FOR SELECT TO public USING (bucket_id = 'islamic-studio');
CREATE POLICY "islamic-studio insert" ON storage.objects FOR INSERT TO public
  WITH CHECK (bucket_id = 'islamic-studio' AND (SELECT private.lt_iam_claims()) IS NOT NULL);
CREATE POLICY "islamic-studio update" ON storage.objects FOR UPDATE TO public
  USING (bucket_id = 'islamic-studio' AND (SELECT private.lt_iam_claims()) IS NOT NULL);
CREATE POLICY "islamic-studio delete" ON storage.objects FOR DELETE TO public
  USING (bucket_id = 'islamic-studio' AND (SELECT private.lt_iam_claims()) IS NOT NULL);

-- Starting data ------------------------------------------------------------

INSERT INTO is_languages (code, name, is_rtl, is_default, sort_order) VALUES
  ('bn', 'বাংলা', false, true, 1),
  ('en', 'English', false, false, 2),
  ('ar', 'العربية', true, false, 3)
ON CONFLICT (code) DO NOTHING;

-- All 20 features. The six built in app versionCode 100
-- (2.0.0, the first Capacitor build: 100 leaves room above the old native
-- builds) are marked as built so batools can switch them on.
INSERT INTO is_features (key, name, description, feature_group, tab, phase, min_version_code, icon, sort_order) VALUES
  ('prayer_times', '{"en":"Prayer Times","bn":"নামাজের সময়","ar":"مواقيت الصلاة"}',
   '{"en":"Fajr to Isha for your location, with adhan reminders.","bn":"আপনার এলাকার ফজর থেকে ইশা, আজানের রিমাইন্ডারসহ।"}',
   'worship', 'worship', 1, 100, 'clock', 10),
  ('qibla', '{"en":"Qibla Finder","bn":"কিবলা","ar":"القبلة"}',
   '{"en":"Compass pointing to the Kaaba.","bn":"কাবার দিক দেখানো কম্পাস।"}',
   'worship', 'worship', 1, 100, 'compass', 20),
  ('tasbih', '{"en":"Digital Tasbih","bn":"তাসবিহ","ar":"المسبحة"}',
   '{"en":"Count dhikr with targets and daily totals.","bn":"লক্ষ্য ও দৈনিক হিসাবসহ যিকির গণনা।"}',
   'worship', 'worship', 1, 100, 'circle-dot', 30),
  ('duas', '{"en":"Daily Adhkar & Duas","bn":"দোয়া ও যিকির","ar":"الأذكار والأدعية"}',
   '{"en":"Authentic duas with Arabic, pronunciation and meaning.","bn":"আরবি, উচ্চারণ ও অর্থসহ সহিহ দোয়া।"}',
   'worship', 'worship', 1, 100, 'hand-heart', 40),
  ('quran', '{"en":"Al-Quran","bn":"আল-কুরআন","ar":"القرآن الكريم"}',
   '{"en":"The full Quran, offline, with translations and bookmarks.","bn":"অফলাইনে পূর্ণ কুরআন, অনুবাদ ও বুকমার্কসহ।"}',
   'quran_learning', 'quran', 1, 100, 'book-open', 50),
  ('quran_audio', '{"en":"Quran Audio","bn":"কুরআন তিলাওয়াত","ar":"تلاوات"}', '{}', 'quran_learning', 'quran', 2, NULL, 'headphones', 60),
  ('hadith', '{"en":"Hadith Library","bn":"হাদিস","ar":"الحديث"}', '{}', 'quran_learning', 'learn', 2, NULL, 'library', 70),
  ('academy', '{"en":"Islamic Academy","bn":"ইসলামিক একাডেমি","ar":"الأكاديمية"}', '{}', 'quran_learning', 'learn', 2, NULL, 'graduation-cap', 80),
  ('quiz', '{"en":"Quiz & Challenges","bn":"কুইজ","ar":"مسابقات"}', '{}', 'quran_learning', 'learn', 2, NULL, 'trophy', 90),
  ('hijri_calendar', '{"en":"Hijri Calendar","bn":"হিজরি ক্যালেন্ডার","ar":"التقويم الهجري"}',
   '{"en":"Hijri dates and Islamic events.","bn":"হিজরি তারিখ ও ইসলামি দিবস।"}',
   'lifestyle', 'worship', 1, 100, 'calendar', 100),
  ('zakat', '{"en":"Zakat Calculator","bn":"যাকাত ক্যালকুলেটর","ar":"حاسبة الزكاة"}', '{}', 'lifestyle', 'worship', 2, NULL, 'calculator', 110),
  ('ramadan', '{"en":"Ramadan Companion","bn":"রমজান","ar":"رمضان"}', '{}', 'lifestyle', 'worship', 2, NULL, 'moon', 120),
  ('places', '{"en":"Mosque & Halal Finder","bn":"মসজিদ ও হালাল","ar":"المساجد والحلال"}', '{}', 'lifestyle', 'worship', 4, NULL, 'map-pin', 130),
  ('habits', '{"en":"Worship Tracker","bn":"ইবাদত ট্র্যাকার","ar":"متابعة العبادات"}', '{}', 'lifestyle', 'profile', 2, NULL, 'list-checks', 140),
  ('ai_assistant', '{"en":"AI Islamic Assistant","bn":"এআই সহকারী","ar":"المساعد الذكي"}', '{}', 'ai', 'learn', 3, NULL, 'sparkles', 150),
  ('recitation_check', '{"en":"Recitation Assistant","bn":"তিলাওয়াত সহকারী","ar":"مساعد التلاوة"}', '{}', 'ai', 'quran', 3, NULL, 'mic', 160),
  ('planner', '{"en":"Islamic Planner","bn":"ইসলামিক প্ল্যানার","ar":"المخطط"}', '{}', 'ai', 'profile', 3, NULL, 'calendar-check', 170),
  ('community', '{"en":"Community","bn":"কমিউনিটি","ar":"المجتمع"}', '{}', 'community_media', 'learn', 4, NULL, 'users', 180),
  ('media', '{"en":"Audio & Video","bn":"অডিও ও ভিডিও","ar":"صوتيات ومرئيات"}', '{}', 'community_media', 'learn', 3, NULL, 'play-circle', 190),
  ('creative_studio', '{"en":"Creative Studio","bn":"ক্রিয়েটিভ স্টুডিও","ar":"الاستوديو الإبداعي"}', '{}', 'community_media', 'home', 4, NULL, 'palette', 200)
ON CONFLICT (key) DO NOTHING;

-- The MVP: the six features of build 100 are on from the start. Everything else stays hidden.
UPDATE is_features SET status = 'active'
WHERE key IN ('prayer_times', 'qibla', 'tasbih', 'duas', 'quran', 'hijri_calendar') AND status = 'hidden';

INSERT INTO is_app_settings (id, latest_version_code, min_supported_version_code, update_message, play_store_url, share_text)
VALUES (true, 100, 1,
  '{"en":"A new version of Islamic Studio is available.","bn":"ইসলামিক স্টুডিওর নতুন সংস্করণ এসেছে।"}',
  'https://play.google.com/store/apps/details?id=com.cryptdox.islamicstudio',
  '{"en":"Islamic Studio: prayer times, Quran, duas and more.","bn":"ইসলামিক স্টুডিও: নামাজের সময়, কুরআন, দোয়া ও আরও অনেক কিছু।"}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO is_home_sections (kind, feature_key, config, sort_order) VALUES
  ('greeting', NULL, '{}', 1),
  ('hijri_date', 'hijri_calendar', '{}', 2),
  ('next_prayer', 'prayer_times', '{}', 3),
  ('quick_actions', NULL, '{"features":["quran","qibla","tasbih","duas"]}', 4),
  ('announcements', NULL, '{}', 5),
  ('daily_ayah', 'quran', '{}', 6),
  ('continue_reading', 'quran', '{}', 7);

NOTIFY pgrst, 'reload schema';
