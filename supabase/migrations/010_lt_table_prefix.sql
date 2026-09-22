-- Migration: 010_lt_table_prefix.sql
-- Namespaces every Late Tracker table behind an `lt_` prefix.
--
-- This Supabase project is shared with other tools (task-manager already owns
-- `task`, `task_tag`, `task_type`, `to_do_task`, `vocabulary`), so generic
-- names like `team_members` or `punishments` are collisions waiting to happen.
-- Prefixing claims the namespace up front.
--
-- Renaming is done with ALTER TABLE ... RENAME so all data, indexes, RLS
-- policies and foreign keys survive untouched; nothing is copied or recreated.
--
-- Constraints and indexes are renamed too, not just the tables. Index and
-- constraint names live in the same per-schema namespace as tables in
-- Postgres, so leaving `team_members_pkey` behind would block another tool
-- from ever creating its own `team_members`, which is the exact problem this
-- migration exists to solve.
--
-- The plpgsql functions resolve table names at execution time, so they are
-- recreated below against the new names. Their own names are deliberately
-- unchanged: this migration is about tables only.

-- 1. Tables
DO $$
DECLARE
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'team_members',
    'team_member_types',
    'attendance_records',
    'attendance_settings',
    'punishments',
    'punishment_transactions'
  ] LOOP
    -- Guarded so the migration is re-runnable and safe on an environment where
    -- some of the rename was already applied by hand.
    IF to_regclass('public.' || quote_ident(v_table)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I RENAME TO %I', v_table, 'lt_' || v_table);
    END IF;
  END LOOP;
END $$;

-- 2. Constraints (primary keys, uniques, foreign keys, checks)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname, rel.relname AS tbl
    FROM pg_constraint c
    JOIN pg_class rel ON rel.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = rel.relnamespace
    WHERE n.nspname = 'public'
      AND rel.relname = ANY (ARRAY[
        'lt_team_members',
        'lt_team_member_types',
        'lt_attendance_records',
        'lt_attendance_settings',
        'lt_punishments',
        'lt_punishment_transactions'
      ])
      AND c.conname NOT LIKE 'lt\_%'
  LOOP
    -- left(..., 63) because identifiers are truncated at NAMEDATALEN anyway;
    -- doing it explicitly keeps the emitted name and the stored name identical.
    EXECUTE format(
      'ALTER TABLE public.%I RENAME CONSTRAINT %I TO %I',
      r.tbl, r.conname, left('lt_' || r.conname, 63)
    );
  END LOOP;
END $$;

-- 3. Standalone indexes
--    Constraint-backed indexes were already carried along by step 2, so they
--    are excluded here to avoid renaming them to `lt_lt_...`.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT idx.relname AS idxname
    FROM pg_class idx
    JOIN pg_namespace n ON n.oid = idx.relnamespace
    JOIN pg_index i ON i.indexrelid = idx.oid
    JOIN pg_class tbl ON tbl.oid = i.indrelid
    WHERE n.nspname = 'public'
      AND idx.relkind = 'i'
      AND tbl.relname = ANY (ARRAY[
        'lt_team_members',
        'lt_team_member_types',
        'lt_attendance_records',
        'lt_attendance_settings',
        'lt_punishments',
        'lt_punishment_transactions'
      ])
      AND idx.relname NOT LIKE 'lt\_%'
      AND NOT EXISTS (
        SELECT 1 FROM pg_constraint pc WHERE pc.conindid = idx.oid
      )
  LOOP
    EXECUTE format(
      'ALTER INDEX public.%I RENAME TO %I',
      r.idxname, left('lt_' || r.idxname, 63)
    );
  END LOOP;
END $$;

-- 4. Functions repointed at the renamed tables.
--    Bodies are otherwise identical to 009 / 002 / 007 respectively.

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

  v_keep_time := (p_state = 'CONSIDER_ENTRY' AND p_entry_time IS NULL);

  INSERT INTO lt_attendance_records (
    team_member_id, attendance_date, state, entry_time, threshold_time_used
  ) VALUES (
    p_team_member_id, p_attendance_date, p_state::attendance_state, p_entry_time, p_threshold_time_used
  )
  ON CONFLICT (team_member_id, attendance_date)
  DO UPDATE SET
    state = EXCLUDED.state,
    entry_time = CASE WHEN v_keep_time THEN lt_attendance_records.entry_time ELSE EXCLUDED.entry_time END,
    threshold_time_used = CASE WHEN v_keep_time THEN lt_attendance_records.threshold_time_used ELSE EXCLUDED.threshold_time_used END,
    updated_at = now()
  RETURNING id INTO v_record_id;

  IF NOT v_is_off_day
     AND p_state = 'ENTRY' AND p_entry_time IS NOT NULL AND p_threshold_time_used IS NOT NULL THEN
    IF (p_entry_time AT TIME ZONE 'Asia/Dhaka')::time >= p_threshold_time_used THEN
      v_is_late := true;
    END IF;
  END IF;

  IF v_is_late THEN
    INSERT INTO lt_punishments (
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
    DELETE FROM lt_punishments p
    WHERE p.attendance_record_id = v_record_id
      AND NOT EXISTS (
        SELECT 1 FROM lt_punishment_transactions t WHERE t.punishment_id = p.id
      );
  END IF;
END;
$$;

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
  v_adjusted NUMERIC;
  v_remaining NUMERIC;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  IF p_type NOT IN ('PAID', 'DISCOUNT') THEN
    RAISE EXCEPTION 'Invalid transaction type';
  END IF;

  SELECT punishment_amount INTO v_original
  FROM lt_punishments WHERE id = p_punishment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Punishment record not found';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_adjusted
  FROM lt_punishment_transactions
  WHERE punishment_id = p_punishment_id;

  v_remaining := v_original - v_adjusted;

  IF p_amount > v_remaining THEN
    RAISE EXCEPTION 'Adjustment amount cannot exceed the remaining punishment amount';
  END IF;

  INSERT INTO lt_punishment_transactions (
    punishment_id, transaction_type, amount, note
  ) VALUES (
    p_punishment_id, p_type, p_amount, p_note
  );
END;
$$;

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
    FROM lt_punishments p
    LEFT JOIN lt_punishment_transactions t ON t.punishment_id = p.id
    WHERE (p_from IS NULL OR p.attendance_date >= p_from)
      AND (p_to IS NULL OR p.attendance_date <= p_to)
    GROUP BY p.id, p.punishment_amount
    HAVING p.punishment_amount - COALESCE(SUM(t.amount), 0) > 0
  )
  INSERT INTO lt_punishment_transactions (punishment_id, transaction_type, amount, note)
  SELECT id, 'DISCOUNT', remaining, COALESCE(p_note, 'Bulk waiver (reset dues)')
  FROM outstanding;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 5. PostgREST caches the schema, so it keeps serving the old table names (and
--    404s the new ones) until told otherwise. Supabase normally reloads on DDL
--    via an event trigger, but doing it explicitly makes the migration
--    self-contained and removes the window where the API is out of step.
NOTIFY pgrst, 'reload schema';
