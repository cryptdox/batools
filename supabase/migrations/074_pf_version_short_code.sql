-- Migration: 074_pf_version_short_code.sql
-- A short address per version: ?v=<short_code> (e.g. ?v=rch, ?v=dev). The
-- long ?version=<slug> keeps working, so links already shared still open the
-- right version. Empty = the site uses the slug.

ALTER TABLE pf_versions ADD COLUMN IF NOT EXISTS short_code TEXT
  CHECK (short_code IS NULL OR (short_code ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND short_code <> 'all'));

CREATE UNIQUE INDEX IF NOT EXISTS pf_versions_user_short_code_key
  ON pf_versions (user_id, short_code) WHERE short_code IS NOT NULL;

-- The two versions that exist today.
UPDATE pf_versions SET short_code = 'rch'
  WHERE user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60' AND slug = 'researcher' AND short_code IS NULL;
UPDATE pf_versions SET short_code = 'dev'
  WHERE user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60' AND slug = 'developer' AND short_code IS NULL;

NOTIFY pgrst, 'reload schema';
