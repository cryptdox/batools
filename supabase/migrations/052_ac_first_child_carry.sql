-- Migration: 052_ac_first_child_carry.sql
-- When a topic that already has progress gets its first child, that progress
-- moves down into the child instead of vanishing (since 050/051 a parent's
-- points come only from its children):
--   - only for the first (non-archived) child, and only when that child is
--     fresh: no achieved points and no progress logs in any cycle (an existing
--     topic linked with its own progress is averaged as usual);
--   - per cycle (New, Revise n, Practice n) the parent had points in: the child's
--     same cycle starts at the parent's share (parent achieved / total × child
--     total), takes the parent's status, and gets a log saying where it came from;
--   - the parent then reads the same share, and later children average as usual.
-- Runs after trg_ac_link_inherit_cycles (which gives the child the parent's
-- revise / practice cycles) and before trg_ac_links_propagate: same-event
-- triggers fire in name order.

CREATE OR REPLACE FUNCTION ac_links_carry_first_child()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  p RECORD;
  ch ac_cycles%ROWTYPE;
  carried INT;
  parent_name TEXT;
BEGIN
  -- First child only.
  IF EXISTS (
    SELECT 1 FROM ac_topic_links l JOIN ac_topics t ON t.id = l.child_id AND NOT t.is_archived
    WHERE l.parent_id = NEW.parent_id AND l.id <> NEW.id
  ) THEN RETURN NULL; END IF;
  -- Fresh child only: nothing achieved or logged yet.
  IF EXISTS (SELECT 1 FROM ac_cycles WHERE topic_id = NEW.child_id AND achieved_points > 0)
     OR EXISTS (SELECT 1 FROM ac_progress_logs lg JOIN ac_cycles c ON c.id = lg.cycle_id WHERE c.topic_id = NEW.child_id)
  THEN RETURN NULL; END IF;

  SELECT name INTO parent_name FROM ac_topics WHERE id = NEW.parent_id;

  FOR p IN
    SELECT * FROM ac_cycles
    WHERE topic_id = NEW.parent_id AND achieved_points > 0 AND total_points > 0 AND status <> 'cancel'
  LOOP
    SELECT * INTO ch FROM ac_cycles WHERE topic_id = NEW.child_id AND kind = p.kind AND round = p.round;
    IF NOT FOUND OR ch.total_points <= 0 THEN CONTINUE; END IF;

    carried := least(ch.total_points, round(p.achieved_points::numeric / p.total_points * ch.total_points)::int);
    IF carried <= 0 THEN CONTINUE; END IF;

    UPDATE ac_cycles SET
      achieved_points = carried,
      status = p.status,
      started_at = coalesce(started_at, p.started_at, now()),
      completed_at = CASE WHEN p.status = 'complete' THEN coalesce(p.completed_at, now()) ELSE completed_at END,
      updated_at = now()
    WHERE id = ch.id;

    INSERT INTO ac_progress_logs (user_id, cycle_id, delta, achieved_after, comment_html)
    VALUES (ch.user_id, ch.id, carried, carried,
      format('<p>Carried over from parent "%s" (%s/%s) when it was split into children.</p>',
        replace(replace(replace(coalesce(parent_name, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'),
        p.achieved_points, p.total_points));
  END LOOP;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_ac_links_carry ON ac_topic_links;
CREATE TRIGGER trg_ac_links_carry
  AFTER INSERT ON ac_topic_links
  FOR EACH ROW EXECUTE FUNCTION ac_links_carry_first_child();

NOTIFY pgrst, 'reload schema';
