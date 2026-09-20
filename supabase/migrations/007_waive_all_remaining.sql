-- Migration: 007_waive_all_remaining.sql
-- Bulk "reset dues": records a WAIVED (DISCOUNT) transaction for the full
-- outstanding balance of every punishment in range, clearing what is payable
-- without ever touching punishment_amount (the historical snapshot) or
-- deleting the existing paid/waived history.
--
-- Done as a single INSERT ... SELECT so the whole reset commits or fails as
-- one unit; waiving row-by-row from the client could half-complete and leave
-- some members cleared and others not.

CREATE OR REPLACE FUNCTION waive_all_remaining(
  p_from DATE DEFAULT NULL,
  p_to DATE DEFAULT NULL,
  p_note TEXT DEFAULT NULL
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH outstanding AS (
    SELECT
      p.id,
      p.punishment_amount - COALESCE(SUM(t.amount), 0) AS remaining
    FROM punishments p
    LEFT JOIN punishment_transactions t ON t.punishment_id = p.id
    WHERE (p_from IS NULL OR p.attendance_date >= p_from)
      AND (p_to IS NULL OR p.attendance_date <= p_to)
    GROUP BY p.id, p.punishment_amount
    HAVING p.punishment_amount - COALESCE(SUM(t.amount), 0) > 0
  )
  INSERT INTO punishment_transactions (punishment_id, transaction_type, amount, note)
  SELECT id, 'DISCOUNT', remaining, COALESCE(p_note, 'Bulk waiver (reset dues)')
  FROM outstanding;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
