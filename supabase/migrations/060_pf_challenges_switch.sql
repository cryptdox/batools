-- Migration: 060_pf_challenges_switch.sql
-- Each project / publication gets two switches instead of one:
--   show_case_study   its case-study sections (058)
--   show_challenges   its challenges & solutions (058), new here
-- each showing or hiding that whole list at once; every item keeps its own
-- show / hide. show_challenges starts as the current show_case_study, so the
-- portfolio looks the same right after this runs.
--
-- The profile-wide switches from 059 (pf_profile.show_case_studies /
-- show_challenges) are no longer used; the columns are left in place.

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['pf_projects', 'pf_publications'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'show_challenges'
    ) THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN show_challenges BOOLEAN NOT NULL DEFAULT false', t);
      EXECUTE format('UPDATE %I SET show_challenges = show_case_study', t);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
