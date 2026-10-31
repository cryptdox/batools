-- Migration: 066_pf_message_version.sql
-- Which version of the portfolio (pf_versions.slug, e.g. researcher) a
-- contact message was sent from. Empty for older messages and for a site
-- without versions.

ALTER TABLE pf_messages
  ADD COLUMN IF NOT EXISTS version TEXT;

NOTIFY pgrst, 'reload schema';
