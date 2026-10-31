-- Migration: 065_pf_profile_location.sql
-- Where the owner is based, shown on the portfolio (the researcher version's
-- sidebar). Before this the site took the current job's location ("Dhaka, BD").

ALTER TABLE pf_profile
  ADD COLUMN IF NOT EXISTS location_en TEXT,
  ADD COLUMN IF NOT EXISTS location_bn TEXT;

UPDATE pf_profile SET location_en = 'Dhaka, Bangladesh', location_bn = 'ঢাকা, বাংলাদেশ'
WHERE user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60' AND location_en IS NULL;

NOTIFY pgrst, 'reload schema';
