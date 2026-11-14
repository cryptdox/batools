-- Migration: 077_is_phase2.sql
-- Islamic Studio phase 2: Quran Audio, Hadith Library, Zakat, Ramadan
-- Companion, Worship Tracker, Quiz & Challenges, and per-device scores.
--   is_hadith_sections    chapters of each hadith book (the text is fetched per chapter)
--   is_quizzes / is_quiz_questions / is_quiz_options / is_challenges
--   is_zakat_settings     single row: nisab, rate, guidance
--   is_metal_prices       gold / silver prices per region and day
--   is_habit_templates    what the Worship Tracker offers
--   is_devices            one row per installation (no sign-in): a random id and a display name
--   is_device_scores      per device, feature, item and day: a score
-- Reciters, hadith books and hadith packs already exist (076).
--
-- Devices: the app sends its installation id in an x-device-id header.
-- A device may read and write only its own rows; batools reads everything.
-- Challenge leaderboards come from is_challenge_leaderboard(), which shows
-- display names only, never device ids.

DO $$
BEGIN
  IF to_regclass('public.is_features') IS NULL THEN
    RAISE EXCEPTION 'Run 074–076 first.';
  END IF;
END $$;

-- The installation id this request carries (x-device-id), or NULL.
CREATE OR REPLACE FUNCTION private.is_device_id() RETURNS uuid
LANGUAGE plpgsql STABLE AS $$
DECLARE
  raw TEXT := nullif(current_setting('request.headers', true)::json ->> 'x-device-id', '');
BEGIN
  RETURN raw::uuid;
EXCEPTION WHEN others THEN
  RETURN NULL;
END $$;
GRANT EXECUTE ON FUNCTION private.is_device_id() TO anon, authenticated;

-- Hadith chapters -----------------------------------------------------------

CREATE TABLE IF NOT EXISTS is_hadith_sections (
  collection_id UUID NOT NULL REFERENCES is_hadith_collections(id) ON DELETE CASCADE,
  number INT NOT NULL,
  name JSONB NOT NULL,
  hadith_first INT NOT NULL,
  hadith_last INT NOT NULL,
  PRIMARY KEY (collection_id, number),
  CHECK (hadith_last >= hadith_first)
);

-- Quiz & challenges ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS is_quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title JSONB NOT NULL,
  description JSONB NOT NULL DEFAULT '{}',
  topic TEXT NOT NULL CHECK (topic IN ('quran', 'prophets', 'pillars', 'seerah', 'history', 'fiqh', 'ramadan', 'general')),
  difficulty TEXT NOT NULL DEFAULT 'easy' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  -- Whole quiz; NULL = no limit.
  time_limit_seconds INT CHECK (time_limit_seconds > 0),
  points_per_question INT NOT NULL DEFAULT 10 CHECK (points_per_question > 0),
  review_status is_review_status NOT NULL DEFAULT 'draft',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS is_quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES is_quizzes(id) ON DELETE CASCADE,
  question JSONB NOT NULL,
  -- Shown after answering.
  explanation JSONB NOT NULL DEFAULT '{}',
  source_ref TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);
CREATE INDEX IF NOT EXISTS is_quiz_questions_quiz ON is_quiz_questions (quiz_id, sort_order);

CREATE TABLE IF NOT EXISTS is_quiz_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES is_quiz_questions(id) ON DELETE CASCADE,
  text JSONB NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS is_quiz_options_question ON is_quiz_options (question_id, sort_order);

-- A challenge = some quizzes and a time window; a device's score is the sum
-- of its best score on each of those quizzes inside the window.
CREATE TABLE IF NOT EXISTS is_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title JSONB NOT NULL,
  description JSONB NOT NULL DEFAULT '{}',
  quiz_ids UUID[] NOT NULL DEFAULT '{}',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  CHECK (ends_at > starts_at)
);

-- Zakat ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS is_zakat_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  rate_percent NUMERIC(5, 3) NOT NULL DEFAULT 2.5,
  gold_nisab_grams NUMERIC(8, 3) NOT NULL DEFAULT 87.48,
  silver_nisab_grams NUMERIC(8, 3) NOT NULL DEFAULT 612.36,
  default_nisab_basis TEXT NOT NULL DEFAULT 'silver' CHECK (default_nisab_basis IN ('gold', 'silver')),
  -- What counts, what doesn't, differences of opinion (shown with the calculator).
  guidance JSONB NOT NULL DEFAULT '{}',
  review_status is_review_status NOT NULL DEFAULT 'draft',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

CREATE TABLE IF NOT EXISTS is_metal_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_code TEXT NOT NULL REFERENCES is_prayer_regions(code) ON DELETE CASCADE,
  currency TEXT NOT NULL DEFAULT 'BDT',
  price_date DATE NOT NULL,
  gold_24k_per_gram NUMERIC(12, 2),
  gold_22k_per_gram NUMERIC(12, 2),
  gold_21k_per_gram NUMERIC(12, 2),
  gold_18k_per_gram NUMERIC(12, 2),
  silver_per_gram NUMERIC(12, 2),
  source TEXT,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (region_code, price_date)
);

-- Worship Tracker -----------------------------------------------------------

CREATE TABLE IF NOT EXISTS is_habit_templates (
  key TEXT PRIMARY KEY,
  name JSONB NOT NULL,
  description JSONB NOT NULL DEFAULT '{}',
  kind TEXT NOT NULL CHECK (kind IN ('salah', 'quran', 'fasting', 'dhikr', 'charity', 'learning', 'other')),
  unit JSONB NOT NULL DEFAULT '{}',
  default_target INT NOT NULL DEFAULT 1 CHECK (default_target > 0),
  frequency TEXT NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly')),
  -- Offered switched on to new users.
  is_default BOOLEAN NOT NULL DEFAULT false,
  icon TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

-- Devices and scores (no sign-in) -------------------------------------------

CREATE TABLE IF NOT EXISTS is_devices (
  device_id UUID PRIMARY KEY,
  display_name TEXT CHECK (char_length(display_name) BETWEEN 2 AND 30),
  platform TEXT CHECK (char_length(platform) <= 40),
  app_version_code INT,
  language TEXT CHECK (char_length(language) <= 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS is_device_scores (
  device_id UUID NOT NULL REFERENCES is_devices(device_id) ON DELETE CASCADE,
  -- quiz (ref = quiz id), tracker, ramadan (ref = Hijri year), quran_audio, hadith, tasbih
  feature TEXT NOT NULL CHECK (feature IN ('quiz', 'tracker', 'ramadan', 'quran_audio', 'hadith', 'tasbih')),
  ref TEXT NOT NULL DEFAULT '' CHECK (char_length(ref) <= 80),
  day DATE NOT NULL,
  score NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (score >= 0),
  max_score NUMERIC(12, 2) CHECK (max_score >= 0),
  details JSONB NOT NULL DEFAULT '{}' CHECK (pg_column_size(details) <= 4000),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (device_id, feature, ref, day)
);
CREATE INDEX IF NOT EXISTS is_device_scores_feature ON is_device_scores (feature, ref, day);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['is_quizzes', 'is_quiz_questions', 'is_challenges', 'is_zakat_settings', 'is_metal_prices',
                           'is_habit_templates', 'is_device_scores'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_touch', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION is_touch_updated_at()', t || '_touch', t);
  END LOOP;
END $$;

-- Access --------------------------------------------------------------------
DO $$
DECLARE
  batools CONSTANT TEXT := '(SELECT private.lt_iam_claims()) IS NOT NULL';
  quiz_visible CONSTANT TEXT := 'EXISTS (SELECT 1 FROM is_quizzes q WHERE q.id = quiz_id AND q.is_active AND q.review_status = ''approved'')';
  r RECORD;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('is_hadith_sections', 'true'),
    ('is_quizzes', 'is_active AND review_status = ''approved'''),
    ('is_quiz_questions', quiz_visible),
    ('is_quiz_options', 'EXISTS (SELECT 1 FROM is_quiz_questions qq WHERE qq.id = question_id AND '
                        || replace(quiz_visible, 'quiz_id', 'qq.quiz_id') || ')'),
    ('is_challenges', 'is_active'),
    ('is_zakat_settings', 'review_status = ''approved'''),
    ('is_metal_prices', 'true'),
    ('is_habit_templates', 'is_active')
  ) AS v(tbl, app_reads) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', r.tbl);
    EXECUTE format('CREATE POLICY "is read" ON %I FOR SELECT TO anon, authenticated USING ((%s) OR %s)', r.tbl, r.app_reads, batools);
    EXECUTE format('CREATE POLICY "is insert" ON %I FOR INSERT TO anon, authenticated WITH CHECK (%s)', r.tbl, batools);
    EXECUTE format('CREATE POLICY "is update" ON %I FOR UPDATE TO anon, authenticated USING (%s) WITH CHECK (%s)', r.tbl, batools, batools);
    EXECUTE format('CREATE POLICY "is delete" ON %I FOR DELETE TO anon, authenticated USING (%s)', r.tbl, batools);
  END LOOP;

  -- Devices and scores: each device only its own rows; batools reads all and may delete.
  FOR r IN SELECT unnest(ARRAY['is_devices', 'is_device_scores']) AS tbl LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', r.tbl);
    EXECUTE format('CREATE POLICY "is device read" ON %I FOR SELECT TO anon, authenticated USING (device_id = (SELECT private.is_device_id()) OR %s)', r.tbl, batools);
    EXECUTE format('CREATE POLICY "is device insert" ON %I FOR INSERT TO anon, authenticated WITH CHECK (device_id = (SELECT private.is_device_id()))', r.tbl);
    EXECUTE format('CREATE POLICY "is device update" ON %I FOR UPDATE TO anon, authenticated USING (device_id = (SELECT private.is_device_id())) WITH CHECK (device_id = (SELECT private.is_device_id()))', r.tbl);
    EXECUTE format('CREATE POLICY "is delete" ON %I FOR DELETE TO anon, authenticated USING (%s)', r.tbl, batools);
  END LOOP;
END $$;

-- Challenge leaderboard: best score per quiz inside the window, summed per device.
-- Names only (devices without a name show as "Player"); is_me marks the caller.
CREATE OR REPLACE FUNCTION public.is_challenge_leaderboard(p_challenge UUID, p_limit INT DEFAULT 20)
RETURNS TABLE (rank BIGINT, display_name TEXT, score NUMERIC, quizzes BIGINT, is_me BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  WITH c AS (
    SELECT quiz_ids, starts_at, ends_at FROM is_challenges WHERE id = p_challenge AND is_active
  ), best AS (
    SELECT s.device_id, s.ref, max(s.score) AS score
    FROM is_device_scores s, c
    WHERE s.feature = 'quiz' AND s.ref = ANY (SELECT unnest(c.quiz_ids)::text)
      AND s.day BETWEEN (c.starts_at AT TIME ZONE 'UTC')::date - 1 AND (c.ends_at AT TIME ZONE 'UTC')::date + 1
    GROUP BY s.device_id, s.ref
  ), totals AS (
    SELECT device_id, sum(score) AS score, count(*) AS quizzes FROM best GROUP BY device_id
  )
  SELECT rank() OVER (ORDER BY t.score DESC), coalesce(d.display_name, 'Player'), t.score, t.quizzes,
         t.device_id = private.is_device_id()
  FROM totals t LEFT JOIN is_devices d ON d.device_id = t.device_id
  ORDER BY t.score DESC
  LIMIT least(greatest(p_limit, 1), 100);
$$;
GRANT EXECUTE ON FUNCTION public.is_challenge_leaderboard(UUID, INT) TO anon, authenticated;

-- The six phase-2 features ship in app build 100 too (switch them on in batools → App Features).
UPDATE is_features SET min_version_code = 100
WHERE key IN ('quran_audio', 'hadith', 'zakat', 'ramadan', 'habits', 'quiz') AND min_version_code IS NULL;

NOTIFY pgrst, 'reload schema';
