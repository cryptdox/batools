-- Migration: 049_ac_hibernate_default.sql
-- Topics start hibernated (off the Kanban) and are woken when their work is due,
-- e.g. with a milestone's switch. Existing topics are hibernated too.

ALTER TABLE ac_topics ALTER COLUMN is_hibernated SET DEFAULT true;

UPDATE ac_topics SET is_hibernated = true WHERE NOT is_hibernated;

NOTIFY pgrst, 'reload schema';
