-- Migration: 009_consider_entry.sql
-- Adds the CONSIDER_ENTRY attendance state: a day that is recorded and
-- acknowledged but explicitly exempt from the late rule. The entry time is
-- still kept on the record (so the real arrival time is never lost), it is
-- simply never compared against the threshold, so no punishment snapshot is
-- created for it.
--
-- The value is added with IF NOT EXISTS because it was already introduced by
-- hand on the live database; this migration exists so a fresh environment
-- ends up with the same enum.

ALTER TYPE attendance_state ADD VALUE IF NOT EXISTS 'CONSIDER_ENTRY';

CREATE OR REPLACE FUNCTION record_attendance(
  p_team_member_id UUID,
  p_attendance_date DATE,
  p_state TEXT,
  p_entry_time TIMESTAMPTZ,
  p_threshold_time_used TIME,
  p_punishment_amount NUMERIC
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_record_id UUID;
  v_is_late BOOLEAN := false;
  v_is_off_day BOOLEAN;
  v_keep_time BOOLEAN;
BEGIN
  v_is_off_day := EXTRACT(DOW FROM p_attendance_date) IN (5, 6);

  -- Marking a day as considered must never wipe a time that is already on the
  -- record: the toggle only decides whether the day is judged against the
  -- threshold. A caller that sends CONSIDER_ENTRY without a time therefore
  -- keeps whatever time (and threshold) was stored before.
  v_keep_time := (p_state = 'CONSIDER_ENTRY' AND p_entry_time IS NULL);

  INSERT INTO attendance_records (
    team_member_id, attendance_date, state, entry_time, threshold_time_used
  ) VALUES (
    p_team_member_id, p_attendance_date, p_state::attendance_state, p_entry_time, p_threshold_time_used
  )
  ON CONFLICT (team_member_id, attendance_date)
  DO UPDATE SET
    state = EXCLUDED.state,
    entry_time = CASE WHEN v_keep_time THEN attendance_records.entry_time ELSE EXCLUDED.entry_time END,
    threshold_time_used = CASE WHEN v_keep_time THEN attendance_records.threshold_time_used ELSE EXCLUDED.threshold_time_used END,
    updated_at = now()
  RETURNING id INTO v_record_id;

  -- Only a plain ENTRY can be late. CONSIDER_ENTRY (like LEAVE and NO_ENTRY)
  -- falls through to the reconciliation branch below, so switching a late day
  -- to considered clears the penalty it had accrued.
  IF NOT v_is_off_day
     AND p_state = 'ENTRY' AND p_entry_time IS NOT NULL AND p_threshold_time_used IS NOT NULL THEN
    IF (p_entry_time AT TIME ZONE 'Asia/Dhaka')::time >= p_threshold_time_used THEN
      v_is_late := true;
    END IF;
  END IF;

  IF v_is_late THEN
    INSERT INTO punishments (
      team_member_id, attendance_record_id, attendance_date, entry_time, threshold_time_used, punishment_amount
    ) VALUES (
      p_team_member_id, v_record_id, p_attendance_date, p_entry_time, p_threshold_time_used, p_punishment_amount
    )
    ON CONFLICT (attendance_record_id)
    DO UPDATE SET
      entry_time = EXCLUDED.entry_time,
      threshold_time_used = EXCLUDED.threshold_time_used,
      updated_at = now();
  ELSE
    DELETE FROM punishments p
    WHERE p.attendance_record_id = v_record_id
      AND NOT EXISTS (
        SELECT 1 FROM punishment_transactions t WHERE t.punishment_id = p.id
      );
  END IF;
END;
$$;
