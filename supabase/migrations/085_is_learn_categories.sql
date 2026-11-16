-- Migration: 085_is_learn_categories.sql
-- Islamic Academy: categories and sections above the units.
--   is_learn_categories  what the reader picks first (Iman, Salah, Quran …)
--   is_learn_sections    parts of a category; each holds a path of units
--   is_learn_units.section_id  the section a unit belongs to (units without
--                        one are not shown in the app)
-- Category → section → unit → lesson → item. The reader can start any section;
-- inside a section, lessons open one after another. Units stay reviewed
-- (079); categories and sections are only titles and order, so they are not.

DO $$
BEGIN
  IF to_regclass('public.is_learn_units') IS NULL THEN
    RAISE EXCEPTION 'Run 079 first.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS is_learn_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title JSONB NOT NULL,
  description JSONB NOT NULL DEFAULT '{}',
  -- Colour of the category's card, sections and bubbles, e.g. #44bd32.
  color TEXT CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  icon TEXT CHECK (char_length(icon) <= 40),
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS is_learn_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES is_learn_categories(id) ON DELETE CASCADE,
  title JSONB NOT NULL,
  description JSONB NOT NULL DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS is_learn_sections_category ON is_learn_sections (category_id, sort_order);

ALTER TABLE is_learn_units ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES is_learn_sections(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS is_learn_units_section ON is_learn_units (section_id, sort_order);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['is_learn_categories', 'is_learn_sections'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_touch', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION is_touch_updated_at()', t || '_touch', t);
  END LOOP;
END $$;

-- Access: the app sees active categories and their active sections; batools everything.
DO $$
DECLARE
  batools CONSTANT TEXT := '(SELECT private.lt_iam_claims()) IS NOT NULL';
  r RECORD;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('is_learn_categories', 'is_active'),
    ('is_learn_sections', 'is_active AND EXISTS (SELECT 1 FROM is_learn_categories c WHERE c.id = category_id AND c.is_active)')
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

NOTIFY pgrst, 'reload schema';
