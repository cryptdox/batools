-- Migration: 059_pf_profile_display_switches.sql
-- Site-wide show / hide for each portfolio section. The portfolio leaves out
-- every section whose key is listed (and its menu / footer links):
--
--   about, projects, experience, research, techStack, contact, summary,
--   caseStudies, challenges
--
-- caseStudies / challenges hide those lists (058) on every project and
-- publication at once, whatever each parent's master switch or item's own
-- show / hide. Empty (the default) shows everything.

ALTER TABLE pf_profile ADD COLUMN IF NOT EXISTS hidden_sections TEXT[] NOT NULL DEFAULT '{}';

NOTIFY pgrst, 'reload schema';
