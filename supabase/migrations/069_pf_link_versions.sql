-- Migration: 069_pf_link_versions.sql
-- Which versions of the portfolio show each profile link (GitHub, LinkedIn,
-- Hugging Face, Google Scholar, …): { "<link column>": [<version id>, …] }.
-- A link missing from the map shows in every version; an empty list hides it
-- everywhere.

ALTER TABLE pf_profile
  ADD COLUMN IF NOT EXISTS link_versions JSONB NOT NULL DEFAULT '{}'::jsonb;

NOTIFY pgrst, 'reload schema';
