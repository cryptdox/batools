-- Migration: 087_is_study_links.sql
-- Islamic Studio: study resources for an Academy section or a quiz — a blog
-- post, a book, or an audio talk / video (is_media_items). The app lists them
-- on the section's path and under a quiz's result.
--   target_type   'section' (is_learn_sections) | 'quiz' (is_quizzes)
--   resource_type 'blog' (is_blog_posts) | 'book' (is_books) | 'media' (is_media_items)
-- The resource's own rules decide what the app sees (only approved, active
-- books, posts and media load), so a link to a hidden one simply doesn't show.
-- Deleting a section, quiz, post, book or media item removes its links.

DO $$
BEGIN
  IF to_regclass('public.is_learn_sections') IS NULL OR to_regclass('public.is_books') IS NULL THEN
    RAISE EXCEPTION 'Run 081 and 085 first.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS is_study_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type TEXT NOT NULL CHECK (target_type IN ('section', 'quiz')),
  target_id UUID NOT NULL,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('blog', 'book', 'media')),
  resource_id UUID NOT NULL,
  -- Optional line under the resource, e.g. "Read before Unit 2".
  note JSONB NOT NULL DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (target_type, target_id, resource_type, resource_id)
);
CREATE INDEX IF NOT EXISTS is_study_links_target ON is_study_links (target_type, target_id, sort_order);
CREATE INDEX IF NOT EXISTS is_study_links_resource ON is_study_links (resource_type, resource_id);

DROP TRIGGER IF EXISTS is_study_links_touch ON is_study_links;
CREATE TRIGGER is_study_links_touch BEFORE UPDATE ON is_study_links FOR EACH ROW EXECUTE FUNCTION is_touch_updated_at();

-- Links go when their section, quiz or resource goes (they have no foreign keys: one column, several tables).
CREATE OR REPLACE FUNCTION private.is_study_links_cleanup() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_ARGV[0] = 'target' THEN
    DELETE FROM is_study_links WHERE target_type = TG_ARGV[1] AND target_id = OLD.id;
  ELSE
    DELETE FROM is_study_links WHERE resource_type = TG_ARGV[1] AND resource_id = OLD.id;
  END IF;
  RETURN OLD;
END $$;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('is_learn_sections', 'target', 'section'), ('is_quizzes', 'target', 'quiz'),
    ('is_blog_posts', 'resource', 'blog'), ('is_books', 'resource', 'book'), ('is_media_items', 'resource', 'media')
  ) AS v(tbl, side, kind) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS is_study_links_cleanup ON %I', r.tbl);
    EXECUTE format('CREATE TRIGGER is_study_links_cleanup AFTER DELETE ON %I FOR EACH ROW EXECUTE FUNCTION private.is_study_links_cleanup(%L, %L)', r.tbl, r.side, r.kind);
  END LOOP;
END $$;

-- Access: the app reads active links; batools writes.
DO $$
DECLARE batools CONSTANT TEXT := '(SELECT private.lt_iam_claims()) IS NOT NULL';
BEGIN
  ALTER TABLE is_study_links ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "is read" ON is_study_links;
  DROP POLICY IF EXISTS "is insert" ON is_study_links;
  DROP POLICY IF EXISTS "is update" ON is_study_links;
  DROP POLICY IF EXISTS "is delete" ON is_study_links;
  EXECUTE format('CREATE POLICY "is read" ON is_study_links FOR SELECT TO anon, authenticated USING (is_active OR %s)', batools);
  EXECUTE format('CREATE POLICY "is insert" ON is_study_links FOR INSERT TO anon, authenticated WITH CHECK (%s)', batools);
  EXECUTE format('CREATE POLICY "is update" ON is_study_links FOR UPDATE TO anon, authenticated USING (%s) WITH CHECK (%s)', batools, batools);
  EXECUTE format('CREATE POLICY "is delete" ON is_study_links FOR DELETE TO anon, authenticated USING (%s)', batools);
END $$;

NOTIFY pgrst, 'reload schema';
