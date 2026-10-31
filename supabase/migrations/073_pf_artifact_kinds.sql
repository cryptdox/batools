-- Migration: 073_pf_artifact_kinds.sql
-- A released item can be several things at once (a model with its dataset,
-- code and demo) instead of one row per kind:
--   kinds          model / dataset / code / demo, any combination
--   model_url, dataset_url, code_url   one link per kind (demo_url exists)
--   private_kinds  which of those links are private (access on request)
-- and publications get private_links (pdf / code / paper), see the end.
-- Existing rows are converted from kind + url + is_private. kind and url stay
-- (optional now) and are kept in step with the first kind and its link.

ALTER TABLE pf_research_artifacts
  ADD COLUMN IF NOT EXISTS kinds TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS model_url TEXT,
  ADD COLUMN IF NOT EXISTS dataset_url TEXT,
  ADD COLUMN IF NOT EXISTS code_url TEXT,
  ADD COLUMN IF NOT EXISTS private_kinds TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE pf_research_artifacts ALTER COLUMN url DROP NOT NULL;

UPDATE pf_research_artifacts SET
  kinds = ARRAY[kind],
  model_url = CASE WHEN kind = 'model' THEN url ELSE model_url END,
  dataset_url = CASE WHEN kind = 'dataset' THEN url ELSE dataset_url END,
  code_url = CASE WHEN kind = 'code' THEN url ELSE code_url END,
  demo_url = CASE WHEN kind = 'demo' THEN COALESCE(demo_url, url) ELSE demo_url END,
  private_kinds = CASE WHEN is_private THEN ARRAY[kind] ELSE '{}' END
WHERE kinds = '{}';

-- Publications get the same per-link privacy: private_links lists which of
-- pdf / code / paper are shared on request. pdf_public = false becomes 'pdf';
-- pdf_public stays and is kept in step.
ALTER TABLE pf_publications
  ADD COLUMN IF NOT EXISTS private_links TEXT[] NOT NULL DEFAULT '{}';

UPDATE pf_publications SET private_links = ARRAY['pdf']
WHERE pdf_public = false AND private_links = '{}';

NOTIFY pgrst, 'reload schema';
