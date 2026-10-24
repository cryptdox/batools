-- Migration: 057_pf_project_case_study.sql
-- A case study per project: the broad story (overview) and the challenges met
-- along the way, each with how it was solved and what came of it.
--
--   pf_projects.overview_en/_bn       broad details of the project
--   pf_projects.show_case_study       whether the portfolio offers it (off by
--                                     default, so nothing appears until it is
--                                     written and switched on)
--   pf_project_challenges             challenge / solution / result rows,
--                                     ordered and individually hideable like
--                                     the other pf_ lists
--
-- Same RLS as the rest of the pf_ tables (see 025).

ALTER TABLE pf_projects ADD COLUMN IF NOT EXISTS overview_en TEXT;
ALTER TABLE pf_projects ADD COLUMN IF NOT EXISTS overview_bn TEXT;
ALTER TABLE pf_projects ADD COLUMN IF NOT EXISTS show_case_study BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS pf_project_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES pf_projects(id) ON DELETE CASCADE,
  challenge_en TEXT NOT NULL,
  challenge_bn TEXT NOT NULL DEFAULT '',
  solution_en TEXT,
  solution_bn TEXT,
  -- What the solution achieved (numbers welcome); optional.
  result_en TEXT,
  result_bn TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pf_project_challenges_project ON pf_project_challenges(project_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_pf_project_challenges_user ON pf_project_challenges(user_id, sort_order);

ALTER TABLE pf_project_challenges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access" ON pf_project_challenges;
CREATE POLICY "Allow all access" ON pf_project_challenges FOR ALL USING (true);

NOTIFY pgrst, 'reload schema';
