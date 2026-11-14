-- Migration: 079_is_learn.sql
-- Islamic Studio "Islamic Academy": a game-style learning path.
--   is_learn_units    a unit on the path (reviewed like quizzes: the app shows approved units only)
--   is_learn_lessons  the lesson bubbles of a unit; the last is usually a checkpoint
--   is_learn_items    what a lesson asks, one row per item; `type` says how `data` looks:
--     choice      {"options": [i18n, …], "correct": 0}
--     true_false  {"answer": true}
--     match       {"pairs": [{"left": i18n, "right": i18n}, …]}        (2–6 pairs)
--     order       {"pieces": [i18n, …], "rtl": false}                   (in the right order; the app shuffles)
--     fill        {"before": i18n, "after": i18n, "options": [i18n, …], "correct": 0, "rtl": false}
--     listen      {"surah": 112, "ayah": 1, "options": [i18n, …], "correct": 0}   (played with the default reciter)
--   An i18n value is {"en": "…", "bn": "…"}; Arabic text is {"ar": "…"}.
-- Progress is kept on the phone. XP is a device score (feature 'learn', ref =
-- lesson id), and is_learn_league() ranks this week's XP by display name.

DO $$
BEGIN
  IF to_regclass('public.is_device_scores') IS NULL THEN
    RAISE EXCEPTION 'Run 074–077 first.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS is_learn_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title JSONB NOT NULL,
  description JSONB NOT NULL DEFAULT '{}',
  -- Colour of the unit's banner and bubbles, e.g. #44bd32.
  color TEXT CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  icon TEXT CHECK (char_length(icon) <= 40),
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

CREATE TABLE IF NOT EXISTS is_learn_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES is_learn_units(id) ON DELETE CASCADE,
  title JSONB NOT NULL,
  kind TEXT NOT NULL DEFAULT 'lesson' CHECK (kind IN ('lesson', 'checkpoint')),
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);
CREATE INDEX IF NOT EXISTS is_learn_lessons_unit ON is_learn_lessons (unit_id, sort_order);

-- Whether an item's data has the shape its type needs (so a bad edit can't break the app).
CREATE OR REPLACE FUNCTION private.is_learn_item_ok(p_type TEXT, d JSONB) RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  n INT;
  el JSONB;
BEGIN
  IF jsonb_typeof(d) <> 'object' THEN RETURN false; END IF;
  IF p_type IN ('choice', 'fill', 'listen') THEN
    IF jsonb_typeof(d -> 'options') <> 'array' THEN RETURN false; END IF;
    n := jsonb_array_length(d -> 'options');
    IF n NOT BETWEEN 2 AND 6 OR jsonb_typeof(d -> 'correct') <> 'number'
       OR (d ->> 'correct')::int NOT BETWEEN 0 AND n - 1 THEN RETURN false; END IF;
    FOR el IN SELECT jsonb_array_elements(d -> 'options') LOOP
      IF jsonb_typeof(el) <> 'object' THEN RETURN false; END IF;
    END LOOP;
    IF p_type = 'fill' THEN
      RETURN jsonb_typeof(coalesce(d -> 'before', '{}')) = 'object' AND jsonb_typeof(coalesce(d -> 'after', '{}')) = 'object'
         AND (d ? 'before' OR d ? 'after');
    END IF;
    IF p_type = 'listen' THEN
      RETURN (d ->> 'surah')::int BETWEEN 1 AND 114 AND (d ->> 'ayah')::int BETWEEN 1 AND 286;
    END IF;
    RETURN true;
  ELSIF p_type = 'true_false' THEN
    RETURN jsonb_typeof(d -> 'answer') = 'boolean';
  ELSIF p_type = 'match' THEN
    IF jsonb_typeof(d -> 'pairs') <> 'array' OR jsonb_array_length(d -> 'pairs') NOT BETWEEN 2 AND 6 THEN RETURN false; END IF;
    FOR el IN SELECT jsonb_array_elements(d -> 'pairs') LOOP
      IF jsonb_typeof(el -> 'left') <> 'object' OR jsonb_typeof(el -> 'right') <> 'object' THEN RETURN false; END IF;
    END LOOP;
    RETURN true;
  ELSIF p_type = 'order' THEN
    IF jsonb_typeof(d -> 'pieces') <> 'array' OR jsonb_array_length(d -> 'pieces') NOT BETWEEN 2 AND 10 THEN RETURN false; END IF;
    FOR el IN SELECT jsonb_array_elements(d -> 'pieces') LOOP
      IF jsonb_typeof(el) <> 'object' THEN RETURN false; END IF;
    END LOOP;
    RETURN true;
  END IF;
  RETURN false;
EXCEPTION WHEN others THEN
  RETURN false;
END $$;
GRANT EXECUTE ON FUNCTION private.is_learn_item_ok(TEXT, JSONB) TO anon, authenticated;

CREATE TABLE IF NOT EXISTS is_learn_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES is_learn_lessons(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('choice', 'true_false', 'match', 'order', 'fill', 'listen')),
  -- The question or instruction; match / order may leave it empty (the app has a default).
  prompt JSONB NOT NULL DEFAULT '{}',
  data JSONB NOT NULL,
  -- Shown after answering.
  explanation JSONB NOT NULL DEFAULT '{}',
  source_ref TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  CONSTRAINT is_learn_items_data_ok CHECK (private.is_learn_item_ok(type, data))
);
CREATE INDEX IF NOT EXISTS is_learn_items_lesson ON is_learn_items (lesson_id, sort_order);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['is_learn_units', 'is_learn_lessons', 'is_learn_items'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_touch', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION is_touch_updated_at()', t || '_touch', t);
  END LOOP;
END $$;

-- Access: the app sees active lessons of active, approved units; batools everything.
DO $$
DECLARE
  batools CONSTANT TEXT := '(SELECT private.lt_iam_claims()) IS NOT NULL';
  unit_visible CONSTANT TEXT := 'EXISTS (SELECT 1 FROM is_learn_units u WHERE u.id = unit_id AND u.is_active AND u.review_status = ''approved'')';
  r RECORD;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('is_learn_units', 'is_active AND review_status = ''approved'''),
    ('is_learn_lessons', 'is_active AND ' || unit_visible),
    ('is_learn_items', 'EXISTS (SELECT 1 FROM is_learn_lessons l WHERE l.id = lesson_id AND l.is_active AND '
                       || replace(unit_visible, 'unit_id', 'l.unit_id') || ')')
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

-- Learning XP is a device score too.
ALTER TABLE is_device_scores DROP CONSTRAINT IF EXISTS is_device_scores_feature_check;
ALTER TABLE is_device_scores ADD CONSTRAINT is_device_scores_feature_check
  CHECK (feature IN ('quiz', 'tracker', 'ramadan', 'quran_audio', 'hadith', 'tasbih', 'learn'));

-- This week's learning XP (weeks start on Monday, UTC), summed per device.
-- Names only (devices without a name show as "Player"); is_me marks the caller.
CREATE OR REPLACE FUNCTION public.is_learn_league(p_limit INT DEFAULT 30)
RETURNS TABLE (rank BIGINT, display_name TEXT, xp NUMERIC, is_me BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  WITH totals AS (
    SELECT device_id, sum(score) AS xp
    FROM is_device_scores
    WHERE feature = 'learn' AND day >= date_trunc('week', (now() AT TIME ZONE 'UTC'))::date
    GROUP BY device_id
  )
  SELECT rank() OVER (ORDER BY t.xp DESC), coalesce(d.display_name, 'Player'), t.xp, t.device_id = private.is_device_id()
  FROM totals t LEFT JOIN is_devices d ON d.device_id = t.device_id
  ORDER BY t.xp DESC
  LIMIT least(greatest(p_limit, 1), 100);
$$;
GRANT EXECUTE ON FUNCTION public.is_learn_league(INT) TO anon, authenticated;

-- The Academy ships in app build 101 (switch it on in batools → App Features).
UPDATE is_features SET min_version_code = 101 WHERE key = 'academy' AND min_version_code IS NULL;

NOTIFY pgrst, 'reload schema';
