-- Migration: 097_is_guides.sql
-- Islamic Studio, app 2.3.0 (versionCode 105): three new tiles in the Learn tab.
--   * Guide (feature 'guides'): step-by-step learning by topic — taharah, salah
--     (niyyah, every recitation, steps), special prayers, kalima, fasting, zakat,
--     hajj, umrah, qurbani, janazah, virtues (fazilat). A guide is a list of
--     blocks (heading, text, step, arabic with pronunciation and meaning, list,
--     table, note, "scholars differ" with each view's evidence, reference).
--   * 99 Names of Allah (feature 'allah_names').
--   * Islamic names (feature 'islamic_names'): boys' and girls' names with meaning.
-- Content shows in the app only when is_active AND review_status = 'approved';
-- seeded content arrives as 'in_review' and is approved in batools.
-- The app loads topics with the other tables and the rest when a screen opens.

DO $$
BEGIN
  IF to_regclass('public.is_features') IS NULL OR to_regprocedure('public.is_sync_manifest(text[])') IS NULL THEN
    RAISE EXCEPTION 'Run 074–081 first.';
  END IF;
END $$;

-- Guide -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS is_guide_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9_-]{2,40}$'),
  title JSONB NOT NULL,
  description JSONB NOT NULL DEFAULT '{}',
  icon TEXT CHECK (char_length(icon) <= 40),
  color TEXT CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

CREATE TABLE IF NOT EXISTS is_guides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES is_guide_topics(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{2,80}$'),
  title JSONB NOT NULL,
  summary JSONB NOT NULL DEFAULT '{}',
  level TEXT NOT NULL DEFAULT 'basic' CHECK (level IN ('basic', 'detail')),
  -- [{type: heading|text|step|arabic|list|table|note|differ|ref, …}] (see supabase/data/guides/FORMAT.md).
  blocks JSONB NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(blocks) = 'array'),
  -- True while any block is marked "check": a reference a scholar should confirm.
  needs_check BOOLEAN NOT NULL DEFAULT false,
  review_status is_review_status NOT NULL DEFAULT 'draft',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);
CREATE INDEX IF NOT EXISTS is_guides_list ON is_guides (topic_id, sort_order);

-- 99 Names of Allah -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS is_allah_names (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  n INT NOT NULL UNIQUE CHECK (n BETWEEN 1 AND 99),
  ar TEXT NOT NULL,
  pron JSONB NOT NULL,
  meaning JSONB NOT NULL,
  note JSONB NOT NULL DEFAULT '{}',
  ref JSONB NOT NULL DEFAULT '{}',
  review_status is_review_status NOT NULL DEFAULT 'draft',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

-- Islamic names ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS is_islamic_names (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gender TEXT NOT NULL CHECK (gender IN ('boy', 'girl')),
  bn TEXT NOT NULL,
  en TEXT NOT NULL,
  ar TEXT,
  meaning JSONB NOT NULL,
  note JSONB NOT NULL DEFAULT '{}',
  review_status is_review_status NOT NULL DEFAULT 'draft',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  UNIQUE (en, gender)
);
CREATE INDEX IF NOT EXISTS is_islamic_names_list ON is_islamic_names (gender, en);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['is_guide_topics', 'is_guides', 'is_allah_names', 'is_islamic_names'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_touch', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION is_touch_updated_at()', t || '_touch', t);
  END LOOP;
END $$;

-- needs_check follows the blocks, so batools always shows what is still to confirm.
CREATE OR REPLACE FUNCTION private.is_guide_needs_check() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.needs_check := EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.blocks) b WHERE b->>'check' = 'true');
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS is_guides_needs_check ON is_guides;
CREATE TRIGGER is_guides_needs_check BEFORE INSERT OR UPDATE OF blocks ON is_guides
  FOR EACH ROW EXECUTE FUNCTION private.is_guide_needs_check();

-- batools edits; the app reads what is switched on and approved.
DO $$
DECLARE
  batools CONSTANT TEXT := '(SELECT private.lt_iam_claims()) IS NOT NULL';
  r RECORD;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('is_guide_topics', 'is_active'),
    ('is_guides', 'is_active AND review_status = ''approved'''),
    ('is_allah_names', 'is_active AND review_status = ''approved'''),
    ('is_islamic_names', 'is_active AND review_status = ''approved''')
  ) AS v(tbl, app_reads) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', r.tbl);
    EXECUTE format('DROP POLICY IF EXISTS "is read" ON %I', r.tbl);
    EXECUTE format('DROP POLICY IF EXISTS "is insert" ON %I', r.tbl);
    EXECUTE format('DROP POLICY IF EXISTS "is update" ON %I', r.tbl);
    EXECUTE format('DROP POLICY IF EXISTS "is delete" ON %I', r.tbl);
    EXECUTE format('CREATE POLICY "is read" ON %I FOR SELECT TO anon, authenticated USING ((%s) OR %s)', r.tbl, r.app_reads, batools);
    EXECUTE format('CREATE POLICY "is insert" ON %I FOR INSERT TO anon, authenticated WITH CHECK (%s)', r.tbl, batools);
    EXECUTE format('CREATE POLICY "is update" ON %I FOR UPDATE TO anon, authenticated USING (%s) WITH CHECK (%s)', r.tbl, batools, batools);
    EXECUTE format('CREATE POLICY "is delete" ON %I FOR DELETE TO anon, authenticated USING (%s)', r.tbl, batools);
  END LOOP;
END $$;

-- Topics -------------------------------------------------------------------------
INSERT INTO is_guide_topics (slug, title, description, icon, color, sort_order) VALUES
  ('taharah', '{"en":"Purification","bn":"পবিত্রতা"}', '{"en":"Wudu, ghusl and tayammum","bn":"ওযু, গোসল ও তায়াম্মুম"}', 'droplets', '#0097e6', 10),
  ('salah', '{"en":"Salah","bn":"নামাজ"}', '{"en":"Niyyah, every recitation and each step","bn":"নিয়ত, প্রতিটি দোয়া-কালাম ও ধাপে ধাপে নিয়ম"}', 'clock', '#44bd32', 20),
  ('special_salah', '{"en":"Special prayers","bn":"বিশেষ নামাজ"}', '{"en":"Jumu''ah, Eid, witr, tahajjud, istikharah and more","bn":"জুমা, ঈদ, বিতর, তাহাজ্জুদ, ইস্তিখারা ও আরও"}', 'sparkles', '#8c7ae6', 30),
  ('kalima', '{"en":"Kalima and iman","bn":"কালিমা ও ঈমান"}', '{"en":"The kalimas, articles of faith and pillars of Islam","bn":"কালিমা, ঈমানের রুকন ও ইসলামের স্তম্ভ"}', 'book-open', '#0E5A41', 40),
  ('sawm', '{"en":"Fasting","bn":"রোজা"}', '{"en":"Sehri, iftar, what breaks the fast, nafl fasts","bn":"সেহরি, ইফতার, যা রোজা ভাঙে, নফল রোজা"}', 'moon', '#273c75', 50),
  ('zakat', '{"en":"Zakat and sadaqah","bn":"যাকাত ও সদকা"}', '{"en":"Nisab, what is zakatable, who receives it","bn":"নিসাব, কোন সম্পদে যাকাত, কারা পাবে"}', 'coins', '#e1b12c', 60),
  ('hajj', '{"en":"Hajj","bn":"হজ"}', '{"en":"Day by day, with the duas","bn":"দিন অনুযায়ী নিয়ম ও দোয়া"}', 'landmark', '#192a56', 70),
  ('umrah', '{"en":"Umrah","bn":"উমরাহ"}', '{"en":"Ihram, tawaf, sa''i, step by step","bn":"ইহরাম, তাওয়াফ, সাঈ — ধাপে ধাপে"}', 'map-pin', '#40739e', 80),
  ('qurbani', '{"en":"Qurbani and aqiqah","bn":"কুরবানি ও আকিকা"}', '{"en":"Animals, shares, method and distribution","bn":"পশু, ভাগ, জবাইয়ের নিয়ম ও বণ্টন"}', 'hand-heart', '#c23616', 90),
  ('janazah', '{"en":"Death and janazah","bn":"মৃত্যু ও জানাযা"}', '{"en":"Ghusl, kafan, janazah prayer and burial","bn":"গোসল, কাফন, জানাযার নামাজ ও দাফন"}', 'flower', '#718093', 100),
  ('fazilat', '{"en":"Virtues","bn":"ফজিলত"}', '{"en":"Rewards of deeds from the Quran and sahih hadith","bn":"কুরআন ও সহিহ হাদিসে আমলের ফজিলত"}', 'star', '#fbc531', 110)
ON CONFLICT (slug) DO NOTHING;

-- Features ----------------------------------------------------------------------
INSERT INTO is_features (key, name, description, feature_group, tab, phase, min_version_code, icon, sort_order) VALUES
  ('guides', '{"en":"Islamic guide","bn":"দ্বীন শিক্ষা","ar":"الدليل"}',
   '{"en":"Salah, wudu, fasting, zakat, hajj, qurbani, janazah — step by step.","bn":"নামাজ, ওযু, রোজা, যাকাত, হজ, কুরবানি, জানাযা — ধাপে ধাপে।"}', 'quran_learning', 'learn', 3, 105, 'book-marked', 5),
  ('allah_names', '{"en":"99 Names of Allah","bn":"আল্লাহর ৯৯ নাম","ar":"أسماء الله الحسنى"}',
   '{"en":"Each name with its meaning.","bn":"প্রতিটি নামের অর্থ ও ব্যাখ্যা।"}', 'quran_learning', 'learn', 3, 105, 'star', 6),
  ('islamic_names', '{"en":"Islamic names","bn":"ইসলামিক নাম","ar":"الأسماء الإسلامية"}',
   '{"en":"Boys'' and girls'' names with meanings.","bn":"ছেলে ও মেয়েদের নাম, অর্থসহ।"}', 'quran_learning', 'learn', 3, 105, 'baby', 7)
ON CONFLICT (key) DO NOTHING;
