-- Migration: 062_pf_show_on_home.sql
-- What the portfolio's home page shows. Projects, publications, experiences
-- and posts each get show_on_home: the home page lists only those; "View all"
-- still lists everything (visible). New rows start off.
--
-- Existing rows start as the home page looks today: featured projects, every
-- publication, experience and post. (A project's is_featured now only tags it
-- as a feature-specific build, versus enterprise grade; it no longer picks
-- the home page.)

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['pf_projects', 'pf_publications', 'pf_experiences', 'pf_posts'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'show_on_home'
    ) THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN show_on_home BOOLEAN NOT NULL DEFAULT false', t);
      IF t = 'pf_projects' THEN
        UPDATE pf_projects SET show_on_home = is_featured;
      ELSE
        EXECUTE format('UPDATE %I SET show_on_home = true', t);
      END IF;
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
