-- Migration: 058_pf_case_study_lists.sql
-- Case studies become lists, for projects and for publications alike.
--
--   pf_case_study_sections   heading + rich text, one row per section
--                            ("Problem", "Architecture", "My role", …)
--   pf_challenges            challenge / solution / result (was
--                            pf_project_challenges, renamed; rows kept)
--
-- Each row belongs to exactly one project or one publication. Rows are
-- ordered and individually hideable (is_visible) like every pf_ list, and a
-- master switch on the parent (show_case_study, now also on publications)
-- shows or hides all of its details on the portfolio at once.
--
-- The single overview field from 057 is moved into the new list as an
-- "Overview" section; the overview_en/_bn columns stay (no data dropped) but
-- are no longer edited or read.

-- 1. Challenges: rename, and let them belong to a publication too
ALTER TABLE IF EXISTS pf_project_challenges RENAME TO pf_challenges;
ALTER INDEX IF EXISTS idx_pf_project_challenges_project RENAME TO idx_pf_challenges_project;
ALTER INDEX IF EXISTS idx_pf_project_challenges_user RENAME TO idx_pf_challenges_user;

ALTER TABLE pf_challenges ALTER COLUMN project_id DROP NOT NULL;
ALTER TABLE pf_challenges ADD COLUMN IF NOT EXISTS publication_id UUID REFERENCES pf_publications(id) ON DELETE CASCADE;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pf_challenges_one_parent') THEN
    ALTER TABLE pf_challenges ADD CONSTRAINT pf_challenges_one_parent CHECK (num_nonnulls(project_id, publication_id) = 1);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_pf_challenges_publication ON pf_challenges(publication_id, sort_order);

-- 2. Case-study sections
CREATE TABLE IF NOT EXISTS pf_case_study_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID REFERENCES pf_projects(id) ON DELETE CASCADE,
  publication_id UUID REFERENCES pf_publications(id) ON DELETE CASCADE,
  heading_en TEXT NOT NULL,
  heading_bn TEXT NOT NULL DEFAULT '',
  body_en TEXT,
  body_bn TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pf_case_study_sections_one_parent CHECK (num_nonnulls(project_id, publication_id) = 1)
);
CREATE INDEX IF NOT EXISTS idx_pf_case_study_sections_project ON pf_case_study_sections(project_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_pf_case_study_sections_publication ON pf_case_study_sections(publication_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_pf_case_study_sections_user ON pf_case_study_sections(user_id, sort_order);

ALTER TABLE pf_case_study_sections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access" ON pf_case_study_sections;
CREATE POLICY "Allow all access" ON pf_case_study_sections FOR ALL USING (true);

-- 3. Master switch on publications too (projects have it since 057)
ALTER TABLE pf_publications ADD COLUMN IF NOT EXISTS show_case_study BOOLEAN NOT NULL DEFAULT false;

-- 4. Existing overviews become the first section (once)
INSERT INTO pf_case_study_sections (user_id, project_id, heading_en, heading_bn, body_en, body_bn, sort_order)
SELECT p.user_id, p.id, 'Overview', 'বিস্তারিত', p.overview_en, p.overview_bn, 1
FROM pf_projects p
WHERE coalesce(btrim(p.overview_en), '') <> ''
  AND NOT EXISTS (SELECT 1 FROM pf_case_study_sections s WHERE s.project_id = p.id);

NOTIFY pgrst, 'reload schema';
