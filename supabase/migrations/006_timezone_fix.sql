-- Migration: 006_timezone_fix.sql
-- record_attendance compared `p_entry_time::time` against the late threshold,
-- but that cast uses Postgres's session timezone (UTC on Supabase), not the
-- organization's local time (Asia/Dhaka). A genuinely late 11:30 AM Dhaka
-- entry is stored as 05:30 UTC, which read back as ::time is "05:30" —
-- always less than the threshold, so no punishment was ever created despite
-- the frontend correctly showing "Late". Converting to Asia/Dhaka before
-- extracting the time-of-day fixes the comparison.

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
BEGIN
  v_is_off_day := EXTRACT(DOW FROM p_attendance_date) IN (5, 6);

  INSERT INTO attendance_records (
    team_member_id, attendance_date, state, entry_time, threshold_time_used
  ) VALUES (
    p_team_member_id, p_attendance_date, p_state::attendance_state, p_entry_time, p_threshold_time_used
  )
  ON CONFLICT (team_member_id, attendance_date)
  DO UPDATE SET
    state = EXCLUDED.state,
    entry_time = EXCLUDED.entry_time,
    threshold_time_used = EXCLUDED.threshold_time_used,
    updated_at = now()
  RETURNING id INTO v_record_id;

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
