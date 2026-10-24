-- Migration: 059_pf_profile_display_switches.sql
-- Site-wide switches for the case-study lists (058). Off hides that list on
-- every project and publication at once, whatever each item's own show / hide
-- or its parent's master switch; on (the default) leaves those in charge.

ALTER TABLE pf_profile ADD COLUMN IF NOT EXISTS show_case_studies BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE pf_profile ADD COLUMN IF NOT EXISTS show_challenges BOOLEAN NOT NULL DEFAULT true;

NOTIFY pgrst, 'reload schema';
