-- Migration: 002_functions.sql

-- 1. record_attendance
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
BEGIN
  -- Insert or update attendance record
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

  -- Determine if late
  IF p_state = 'ENTRY' AND p_entry_time IS NOT NULL AND p_threshold_time_used IS NOT NULL THEN
    IF p_entry_time::time >= p_threshold_time_used THEN
      v_is_late := true;
    END IF;
  END IF;

  -- Reconcile punishment
  IF v_is_late THEN
    -- Insert punishment if it doesn't exist
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
      -- Intentionally NOT updating punishment_amount to preserve historical snapshots if already created 
      -- Wait, if they were already late on the SAME day, we might keep the snapshot. 
      -- If we want to overwrite it because they edited time? The spec says:
      -- "If: 09:45 -> 10:15 becomes LATE and a punishment is created using the applicable historical punishment amount."
  ELSE
    -- Reconcile: delete punishment if they are no longer late (Punctual, Leave, or No Entry)
    DELETE FROM punishments WHERE attendance_record_id = v_record_id;
  END IF;

END;
$$;

-- 2. add_punishment_transaction
CREATE OR REPLACE FUNCTION add_punishment_transaction(
  p_punishment_id UUID,
  p_type TEXT,
  p_amount NUMERIC,
  p_note TEXT
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_original NUMERIC;
  v_deducted NUMERIC;
  v_remaining NUMERIC;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  IF p_type NOT IN ('PAID', 'DISCOUNT') THEN
    RAISE EXCEPTION 'Invalid transaction type';
  END IF;

  SELECT punishment_amount INTO v_original
  FROM punishments WHERE id = p_punishment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Punishment record not found';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_deducted
  FROM punishment_transactions
  WHERE punishment_id = p_punishment_id;

  v_remaining := v_original - v_deducted;

  IF p_amount > v_remaining THEN
    RAISE EXCEPTION 'Adjustment amount cannot exceed the remaining punishment amount';
  END IF;

  INSERT INTO punishment_transactions (
    punishment_id, transaction_type, amount, note
  ) VALUES (
    p_punishment_id, p_type, p_amount, p_note
  );
END;
$$;
