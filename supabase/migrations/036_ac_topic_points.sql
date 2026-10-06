-- Migration: 036_ac_topic_points.sql
-- Changing a topic's story points now carries through to its cycles, so the
-- rollups ("with everything beneath") show the new value. Cycles that still
-- use the topic's old value follow it, never below what is achieved;
-- complete / cancelled cycles and cycles given their own value are left as is.
-- Creates one new function only.

-- Sets a topic's story points; returns how many cycles followed.
CREATE OR REPLACE FUNCTION ac_set_topic_points(p_user_id UUID, p_topic_id UUID, p_points INT)
RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE
  old_points INT;
  n INT;
BEGIN
  IF p_points IS NULL OR p_points < 0 THEN
    RAISE EXCEPTION 'Story points must be 0 or more' USING ERRCODE = '22023';
  END IF;
  SELECT default_points INTO old_points FROM ac_topics WHERE id = p_topic_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Topic not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE ac_topics SET default_points = p_points, updated_at = now() WHERE id = p_topic_id;

  UPDATE ac_cycles SET total_points = greatest(p_points, achieved_points), updated_at = now()
  WHERE topic_id = p_topic_id AND user_id = p_user_id
    AND total_points = old_points AND status NOT IN ('complete', 'cancel');
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

NOTIFY pgrst, 'reload schema';
