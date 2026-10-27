-- Migration: 064_pf_artifact_private.sql
-- A released model / dataset can be private (e.g. a Kaggle dataset shared on
-- request). The site still lists it and links it, tags it Private and asks
-- visitors to message the owner for access.

ALTER TABLE pf_research_artifacts
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
