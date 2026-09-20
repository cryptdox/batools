-- Migration: 005_team_member_delete.sql
-- Adds a real "Delete" action for team members, distinct from is_active
-- (deactivate/reactivate). Deleting always removes the member from the
-- team_members table; the delete dialog offers a choice:
--   - keep their attendance/punishment history (default): implemented as
--     is_deleted = true, member is hidden everywhere but the row (and the
--     history that references it) stays intact.
--   - don't keep their data: an actual DELETE FROM team_members, which now
--     cascades down through attendance_records -> punishments ->
--     punishment_transactions so it doesn't hit an FK violation.

ALTER TABLE team_members ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE attendance_records DROP CONSTRAINT attendance_records_team_member_id_fkey;
ALTER TABLE attendance_records ADD CONSTRAINT attendance_records_team_member_id_fkey
  FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE CASCADE;

ALTER TABLE punishments DROP CONSTRAINT punishments_team_member_id_fkey;
ALTER TABLE punishments ADD CONSTRAINT punishments_team_member_id_fkey
  FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE CASCADE;

ALTER TABLE punishments DROP CONSTRAINT punishments_attendance_record_id_fkey;
ALTER TABLE punishments ADD CONSTRAINT punishments_attendance_record_id_fkey
  FOREIGN KEY (attendance_record_id) REFERENCES attendance_records(id) ON DELETE CASCADE;

ALTER TABLE punishment_transactions DROP CONSTRAINT punishment_transactions_punishment_id_fkey;
ALTER TABLE punishment_transactions ADD CONSTRAINT punishment_transactions_punishment_id_fkey
  FOREIGN KEY (punishment_id) REFERENCES punishments(id) ON DELETE CASCADE;
