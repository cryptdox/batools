-- Migration: 071_pf_publication_detail_switches.sql
-- Show / hide switches for a paper's key findings, contribution and methods
-- (070), like show_case_study / show_challenges. On by default.

ALTER TABLE pf_publications
  ADD COLUMN IF NOT EXISTS show_highlights BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_contributions BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_methods BOOLEAN NOT NULL DEFAULT true;

NOTIFY pgrst, 'reload schema';
