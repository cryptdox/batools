-- Migration: 051_ac_parent_locked.sql
-- A parent topic's achieved points can't be edited by any path (follows 050):
--   - a topic with (non-archived) children always takes the computed value, 0
--     when none of its children has a cycle to average (050 kept its own then);
--   - ac_log_progress refuses parents;
--   - ac_set_status 'complete' on a parent no longer fills or logs points.
-- A parent's total points stay editable: they scale the computed value.

CREATE OR REPLACE FUNCTION ac_is_parent(p_topic_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM ac_topic_links l JOIN ac_topics ch ON ch.id = l.child_id AND NOT ch.is_archived
    WHERE l.parent_id = p_topic_id);
$$;

-- NULL only for topics with no children (they keep their own, hand-logged points).
CREATE OR REPLACE FUNCTION ac_parent_achieved(p_topic_id UUID, p_kind TEXT, p_round INT, p_total INT)
RETURNS INT
LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN NOT ac_is_parent(p_topic_id) THEN NULL
    ELSE coalesce((
      SELECT least(p_total, round(avg(c.achieved_points::numeric / c.total_points) * p_total)::int)
      FROM ac_topic_links l
      JOIN ac_topics ch ON ch.id = l.child_id AND NOT ch.is_archived
      JOIN ac_cycles c ON c.topic_id = l.child_id AND c.kind = p_kind AND c.round = p_round
      WHERE l.parent_id = p_topic_id AND c.status <> 'cancel' AND c.total_points > 0
    ), 0)
  END;
$$;

CREATE OR REPLACE FUNCTION public.ac_log_progress(p_user_id uuid, p_cycle_id uuid, p_delta integer, p_comment_html text DEFAULT NULL::text)
 RETURNS ac_cycles
 LANGUAGE plpgsql
AS $function$
DECLARE
  c ac_cycles%ROWTYPE;
  next_achieved INT;
BEGIN
  SELECT * INTO c FROM ac_cycles WHERE id = p_cycle_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cycle not found' USING ERRCODE = 'P0002';
  END IF;
  IF ac_is_parent(c.topic_id) THEN
    RAISE EXCEPTION 'A parent topic''s points come from its children; log progress on them instead' USING ERRCODE = '22023';
  END IF;
  IF c.status <> 'in_progress' THEN
    RAISE EXCEPTION 'Only cycles in progress take points' USING ERRCODE = '22023';
  END IF;
  IF coalesce(p_delta, 0) = 0 THEN
    RAISE EXCEPTION 'Change the points by at least 1' USING ERRCODE = '22023';
  END IF;
  next_achieved := c.achieved_points + p_delta;
  IF next_achieved < 0 OR next_achieved > c.total_points THEN
    RAISE EXCEPTION 'Achieved points must stay between 0 and %', c.total_points USING ERRCODE = '22023';
  END IF;

  UPDATE ac_cycles SET
    achieved_points = next_achieved,
    status = CASE WHEN next_achieved = total_points AND total_points > 0 THEN 'complete' ELSE status END,
    completed_at = CASE WHEN next_achieved = total_points AND total_points > 0 THEN now() ELSE completed_at END,
    updated_at = now()
  WHERE id = c.id
  RETURNING * INTO c;

  INSERT INTO ac_progress_logs (user_id, cycle_id, delta, achieved_after, comment_html)
  VALUES (p_user_id, c.id, p_delta, next_achieved, NULLIF(btrim(p_comment_html), ''));

  RETURN c;
END $function$;

CREATE OR REPLACE FUNCTION public.ac_set_status(p_user_id uuid, p_cycle_id uuid, p_status text, p_sort_order integer DEFAULT NULL::integer, p_comment_html text DEFAULT NULL::text)
 RETURNS ac_cycles
 LANGUAGE plpgsql
AS $function$
DECLARE
  c ac_cycles%ROWTYPE;
  remaining INT;
  parent BOOLEAN;
BEGIN
  IF p_status NOT IN ('backlog', 'todo', 'hold', 'in_progress', 'complete', 'cancel') THEN
    RAISE EXCEPTION 'Unknown status' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO c FROM ac_cycles WHERE id = p_cycle_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cycle not found' USING ERRCODE = 'P0002';
  END IF;

  -- A parent's points come from its children: completing it neither fills nor logs points.
  parent := ac_is_parent(c.topic_id);
  remaining := c.total_points - c.achieved_points;
  IF p_status = 'complete' AND c.status <> 'complete' AND remaining > 0 AND NOT parent THEN
    INSERT INTO ac_progress_logs (user_id, cycle_id, delta, achieved_after, comment_html)
    VALUES (p_user_id, c.id, remaining, c.total_points, coalesce(NULLIF(btrim(p_comment_html), ''), '<p>Marked complete</p>'));
  END IF;

  UPDATE ac_cycles SET
    status = p_status,
    achieved_points = CASE WHEN p_status = 'complete' AND NOT parent THEN total_points ELSE achieved_points END,
    sort_order = coalesce(p_sort_order, sort_order),
    started_at = CASE WHEN p_status = 'in_progress' THEN coalesce(started_at, now()) ELSE started_at END,
    completed_at = CASE WHEN p_status = 'complete' THEN coalesce(completed_at, now()) ELSE NULL END,
    updated_at = now()
  WHERE id = c.id
  RETURNING * INTO c;

  RETURN c;
END $function$;

-- Parents whose children have no cycle to average now read 0.
DO $$
DECLARE n INT; i INT := 0;
BEGIN
  LOOP
    UPDATE ac_cycles p SET achieved_points = v.achieved
    FROM (SELECT cy.id, ac_parent_achieved(cy.topic_id, cy.kind, cy.round, cy.total_points) AS achieved FROM ac_cycles cy) v
    WHERE p.id = v.id AND v.achieved IS NOT NULL AND v.achieved IS DISTINCT FROM p.achieved_points;
    GET DIAGNOSTICS n = ROW_COUNT;
    i := i + 1;
    EXIT WHEN n = 0 OR i > 20;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
