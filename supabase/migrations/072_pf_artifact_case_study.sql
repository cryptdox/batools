-- Migration: 072_pf_artifact_case_study.sql
-- Released models, datasets and code (063) get a case study and challenges &
-- solutions, like projects and publications: the two lists gain artifact_id
-- and each artifact gets its own show switches.

ALTER TABLE pf_case_study_sections
  ADD COLUMN IF NOT EXISTS artifact_id UUID REFERENCES pf_research_artifacts(id) ON DELETE CASCADE;
ALTER TABLE pf_challenges
  ADD COLUMN IF NOT EXISTS artifact_id UUID REFERENCES pf_research_artifacts(id) ON DELETE CASCADE;

-- Still exactly one parent, now out of three.
ALTER TABLE pf_case_study_sections DROP CONSTRAINT IF EXISTS pf_case_study_sections_one_parent;
ALTER TABLE pf_case_study_sections ADD CONSTRAINT pf_case_study_sections_one_parent
  CHECK (num_nonnulls(project_id, publication_id, artifact_id) = 1);
ALTER TABLE pf_challenges DROP CONSTRAINT IF EXISTS pf_challenges_one_parent;
ALTER TABLE pf_challenges ADD CONSTRAINT pf_challenges_one_parent
  CHECK (num_nonnulls(project_id, publication_id, artifact_id) = 1);

CREATE INDEX IF NOT EXISTS idx_pf_case_study_sections_artifact ON pf_case_study_sections(artifact_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_pf_challenges_artifact ON pf_challenges(artifact_id, sort_order);

ALTER TABLE pf_research_artifacts
  ADD COLUMN IF NOT EXISTS show_case_study BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_challenges BOOLEAN NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
