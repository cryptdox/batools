-- Migration: 003_reconciliation_and_offdays.sql
-- Fixes:
-- 1) record_attendance previously did DELETE FROM punishments unconditionally when an
--    attendance record became non-late. If that punishment already had paid/discount
--    transactions against it, the DELETE violated the punishment_transactions FK and
--    the whole RPC call failed silently on the client. Now we only delete a punishment
--    that has no transactions; a punishment with financial history is preserved as-is.
-- 2) Friday and Saturday are organizational off days: entering a late time on those
--    days must never create a punishment snapshot.

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
  -- Postgres DOW: Sunday = 0 ... Friday = 5, Saturday = 6
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
    IF p_entry_time::time >= p_threshold_time_used THEN
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
      -- punishment_amount is intentionally never overwritten here: it is the historical snapshot.
  ELSE
    -- Only clear a punishment that has no financial history against it. A punishment
    -- that was already paid/discounted stays as a historical record even if a later
    -- time correction makes the attendance record itself punctual/leave/no-entry.
    DELETE FROM punishments p
    WHERE p.attendance_record_id = v_record_id
      AND NOT EXISTS (
        SELECT 1 FROM punishment_transactions t WHERE t.punishment_id = p.id
      );
  END IF;
END;
$$;
