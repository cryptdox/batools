-- Migration: 070_pf_publication_details.sql
-- A paper's details beyond its abstract, like a project's:
--   highlights_*     key findings, one per line
--   contributions_*  what the owner did on the paper, one per line
--   methods          methods & tools (tags), like a project's tech stack

ALTER TABLE pf_publications
  ADD COLUMN IF NOT EXISTS highlights_en TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS highlights_bn TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS contributions_en TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS contributions_bn TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS methods TEXT[] NOT NULL DEFAULT '{}';

NOTIFY pgrst, 'reload schema';
