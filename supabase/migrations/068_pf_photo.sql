-- Migration: 068_pf_photo.sql
-- A profile photo for the portfolio, with an optional one per version (e.g. a
-- formal photo for the researcher version). The version's photo wins; without
-- either the site shows the owner's initials.

ALTER TABLE pf_profile ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE pf_versions ADD COLUMN IF NOT EXISTS photo_url TEXT;

NOTIFY pgrst, 'reload schema';
