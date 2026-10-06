-- Migration: 033_lc_delete_cycle.sql
-- Deleting a revise / practice round (e.g. one started by mistake). Its
-- progress log goes with it (lc_progress_logs.cycle_id is ON DELETE CASCADE).
-- New cycles are not deletable: they are the topic itself (delete the topic).
-- Creates one new function only.

-- Deletes one revise / practice cycle; with p_cascade also the same round
-- (same kind and number) of every topic beneath it. Returns how many cycles
-- and log entries were removed: { "cycles": n, "logs": n }.
CREATE OR REPLACE FUNCTION lc_delete_cycle(p_user_id UUID, p_cycle_id UUID, p_cascade BOOLEAN DEFAULT false)
RETURNS JSONB
LANGUAGE plpgsql AS $$
DECLARE
  c lc_cycles%ROWTYPE;
  ids UUID[];
  n_logs INT;
  n_cycles INT;
BEGIN
  SELECT * INTO c FROM lc_cycles WHERE id = p_cycle_id AND user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cycle not found' USING ERRCODE = 'P0002';
  END IF;
  IF c.kind = 'new' THEN
    RAISE EXCEPTION 'The New cycle belongs to the topic; delete the topic instead' USING ERRCODE = '22023';
  END IF;

  ids := ARRAY(
    SELECT cy.id FROM lc_cycles cy
    WHERE cy.user_id = p_user_id AND cy.kind = c.kind AND cy.round = c.round
      AND (cy.id = c.id OR (p_cascade AND cy.topic_id IN (SELECT topic_id FROM lc_subtree(c.topic_id))))
  );

  SELECT count(*) INTO n_logs FROM lc_progress_logs WHERE cycle_id = ANY (ids);
  DELETE FROM lc_cycles WHERE id = ANY (ids);
  GET DIAGNOSTICS n_cycles = ROW_COUNT;

  RETURN jsonb_build_object('cycles', n_cycles, 'logs', n_logs);
END $$;

NOTIFY pgrst, 'reload schema';
