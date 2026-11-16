-- Migration: 088_is_sound_styles.sql
-- Islamic Studio sound styles for quizzes, the Academy and the tracker, set in
-- batools → App Settings → Sound styles.
--   key          the style's code, e.g. 'spark'
--   builtin      the sounds built into the app this style starts from
--                ('spark' | 'ertugrul' | 'sufi'); every moment without an
--                uploaded file plays that built-in sound
--   sounds       {moment: https link} — uploaded files that replace built-in
--                moments: correct, wrong, combo, m50, m75, m100, star,
--                complete, tap, laugh
--   is_active    shown in the app's sound-style choice or not
--   is_default   the style for readers who haven't picked one (the first by order if several)
-- The app downloads the files when it opens (only new ones) and keeps them in
-- its private storage, then plays them offline.

DO $$
BEGIN
  IF to_regclass('public.is_features') IS NULL THEN
    RAISE EXCEPTION 'Run 074 first.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS is_sound_styles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE CHECK (key ~ '^[a-z0-9-]{2,30}$'),
  name JSONB NOT NULL,
  description JSONB NOT NULL DEFAULT '{}',
  icon TEXT CHECK (char_length(icon) <= 8),
  builtin TEXT NOT NULL DEFAULT 'spark' CHECK (builtin IN ('spark', 'ertugrul', 'sufi')),
  sounds JSONB NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(sounds) = 'object'),
  is_default BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only known moments, and only https links.
CREATE OR REPLACE FUNCTION private.is_sounds_ok(s JSONB) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM jsonb_each(s) e
    WHERE e.key NOT IN ('correct', 'wrong', 'combo', 'm50', 'm75', 'm100', 'star', 'complete', 'tap', 'laugh')
       OR jsonb_typeof(e.value) <> 'string' OR NOT (e.value #>> '{}') ~ '^https://'
  )
$$;
GRANT EXECUTE ON FUNCTION private.is_sounds_ok(JSONB) TO anon, authenticated;
ALTER TABLE is_sound_styles DROP CONSTRAINT IF EXISTS is_sound_styles_sounds_ok;
ALTER TABLE is_sound_styles ADD CONSTRAINT is_sound_styles_sounds_ok CHECK (private.is_sounds_ok(sounds));

DROP TRIGGER IF EXISTS is_sound_styles_touch ON is_sound_styles;
CREATE TRIGGER is_sound_styles_touch BEFORE UPDATE ON is_sound_styles FOR EACH ROW EXECUTE FUNCTION is_touch_updated_at();

DO $$
DECLARE batools CONSTANT TEXT := '(SELECT private.lt_iam_claims()) IS NOT NULL';
BEGIN
  ALTER TABLE is_sound_styles ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "is read" ON is_sound_styles;
  DROP POLICY IF EXISTS "is insert" ON is_sound_styles;
  DROP POLICY IF EXISTS "is update" ON is_sound_styles;
  DROP POLICY IF EXISTS "is delete" ON is_sound_styles;
  EXECUTE format('CREATE POLICY "is read" ON is_sound_styles FOR SELECT TO anon, authenticated USING (is_active OR %s)', batools);
  EXECUTE format('CREATE POLICY "is insert" ON is_sound_styles FOR INSERT TO anon, authenticated WITH CHECK (%s)', batools);
  EXECUTE format('CREATE POLICY "is update" ON is_sound_styles FOR UPDATE TO anon, authenticated USING (%s) WITH CHECK (%s)', batools, batools);
  EXECUTE format('CREATE POLICY "is delete" ON is_sound_styles FOR DELETE TO anon, authenticated USING (%s)', batools);
END $$;

-- The three styles the app has today, with their built-in sounds (no uploads yet).
INSERT INTO is_sound_styles (key, name, description, icon, builtin, is_default, sort_order) VALUES
  ('spark', '{"en": "Spark", "bn": "স্পার্ক"}', '{"en": "Bright pops, sparkles, kick and clap, a happy \"ta-da\".", "bn": "ঝলমলে পপ, ঝিকিমিকি, ড্রাম আর আনন্দের \"টা-ডা\"।"}', '⚡', 'spark', true, 1),
  ('ertugrul', '{"en": "Ertuğrul", "bn": "আরতুগরুল"}', '{"en": "War drums, a sword, oud, horn and a deep choir. Epic.", "bn": "যুদ্ধের ঢোল, তলোয়ার, উদ, শিঙা আর গভীর কোরাস। মহাকাব্যিক।"}', '⚔️', 'ertugrul', false, 2),
  ('sufi', '{"en": "Sufi", "bn": "সুফি"}', '{"en": "Ney flute, daf drum and a soft humming choir. Calm.", "bn": "নেই বাঁশি, দফ আর মৃদু গুনগুন কোরাস। শান্ত।"}', '🌙', 'sufi', false, 3)
ON CONFLICT (key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
