-- Migration: 037_ac_backlog.sql
-- Backlog: a cycle now starts in 'backlog' (not planned yet) and is pulled
-- into 'todo' when it is planned, so To do stays a short, deliberate list.
--   * status gains 'backlog' and defaults to it (new topics, started rounds
--     and inherited cycles all start there);
--   * every existing 'todo' cycle moves to 'backlog' (nothing was planned yet);
--   * ac_set_status accepts 'backlog';
--   * ac_bulk_status changes one cycle (kind / round) for a topic and
--     everything beneath it — used by the Milestones page (plan / cancel / reopen).
-- Touches only ac_ objects.

ALTER TABLE ac_cycles DROP CONSTRAINT IF EXISTS ac_cycles_status_check;
ALTER TABLE ac_cycles ADD CONSTRAINT ac_cycles_status_check
  CHECK (status IN ('backlog', 'todo', 'hold', 'in_progress', 'complete', 'cancel'));
ALTER TABLE ac_cycles ALTER COLUMN status SET DEFAULT 'backlog';

UPDATE ac_cycles SET status = 'backlog', updated_at = now() WHERE status = 'todo';

CREATE OR REPLACE FUNCTION ac_set_status(p_user_id UUID, p_cycle_id UUID, p_status TEXT, p_sort_order INT DEFAULT NULL, p_comment_html TEXT DEFAULT NULL)
RETURNS ac_cycles
LANGUAGE plpgsql AS $$
DECLARE
  c ac_cycles%ROWTYPE;
  remaining INT;
BEGIN
  IF p_status NOT IN ('backlog', 'todo', 'hold', 'in_progress', 'complete', 'cancel') THEN
    RAISE EXCEPTION 'Unknown status' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO c FROM ac_cycles WHERE id = p_cycle_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cycle not found' USING ERRCODE = 'P0002';
  END IF;

  remaining := c.total_points - c.achieved_points;
  IF p_status = 'complete' AND c.status <> 'complete' AND remaining > 0 THEN
    INSERT INTO ac_progress_logs (user_id, cycle_id, delta, achieved_after, comment_html)
    VALUES (p_user_id, c.id, remaining, c.total_points, coalesce(NULLIF(btrim(p_comment_html), ''), '<p>Marked complete</p>'));
  END IF;

  UPDATE ac_cycles SET
    status = p_status,
    achieved_points = CASE WHEN p_status = 'complete' THEN total_points ELSE achieved_points END,
    sort_order = coalesce(p_sort_order, sort_order),
    started_at = CASE WHEN p_status = 'in_progress' THEN coalesce(started_at, now()) ELSE started_at END,
    completed_at = CASE WHEN p_status = 'complete' THEN coalesce(completed_at, now()) ELSE NULL END,
    updated_at = now()
  WHERE id = c.id
  RETURNING * INTO c;

  RETURN c;
END $$;

-- Moves the (p_kind, p_round) cycles of p_topic_id and everything beneath it
-- (archived topics excepted) from any status in p_from to p_to. Points are
-- not touched, so 'complete' is not a valid target here. Returns how many moved.
CREATE OR REPLACE FUNCTION ac_bulk_status(p_user_id UUID, p_topic_id UUID, p_kind TEXT, p_round INT, p_from TEXT[], p_to TEXT)
RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE
  n INT;
BEGIN
  IF p_to NOT IN ('backlog', 'todo', 'hold', 'cancel') THEN
    RAISE EXCEPTION 'Use the board or the topic to start or complete work' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM ac_topics WHERE id = p_topic_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'Topic not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE ac_cycles cy SET status = p_to, completed_at = NULL, updated_at = now()
  FROM ac_topics t
  WHERE t.id = cy.topic_id AND NOT t.is_archived
    AND cy.user_id = p_user_id AND cy.kind = p_kind AND cy.round = p_round
    AND cy.status = ANY (p_from)
    AND cy.topic_id IN (SELECT topic_id FROM ac_subtree(p_topic_id));
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

NOTIFY pgrst, 'reload schema';
