-- Migration: 084_is_azan.sql
-- Islamic Studio: the azan the app's prayer reminders play, uploaded in
-- batools → Islamic Studio → App Settings (storage bucket islamic-studio).
--   azan_url     public https link to a short audio file (15–30 s, MP3 or OGG).
--                The app downloads it when it opens (again only when the link
--                changes) and plays it from the phone. Empty = the azan built
--                into the app.
--   azan_credit  who recites it and its licence, shown in the app's About.

DO $$
BEGIN
  IF to_regclass('public.is_app_settings') IS NULL THEN
    RAISE EXCEPTION 'Run 074 first.';
  END IF;
END $$;

ALTER TABLE is_app_settings ADD COLUMN IF NOT EXISTS azan_url TEXT;
ALTER TABLE is_app_settings ADD COLUMN IF NOT EXISTS azan_credit TEXT;

ALTER TABLE is_app_settings DROP CONSTRAINT IF EXISTS is_app_settings_azan_url_https;
ALTER TABLE is_app_settings ADD CONSTRAINT is_app_settings_azan_url_https
  CHECK (azan_url IS NULL OR azan_url ~ '^https://');
ALTER TABLE is_app_settings DROP CONSTRAINT IF EXISTS is_app_settings_azan_credit_length;
ALTER TABLE is_app_settings ADD CONSTRAINT is_app_settings_azan_credit_length
  CHECK (azan_credit IS NULL OR char_length(azan_credit) <= 300);

NOTIFY pgrst, 'reload schema';
