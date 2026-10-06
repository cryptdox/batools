-- Migration: 035_ac_remove_archived_batch.sql
-- Removing something that is itself archived also takes what was archived
-- together with it (same archive_batch): deleting an archived branch or
-- domain for good should not leave the rest of that branch behind.
-- Replaces one function only.

CREATE OR REPLACE FUNCTION ac_removal_set(p_user_id UUID, p_topic_id UUID, p_domain_id UUID, p_archive BOOLEAN)
RETURNS UUID[]
LANGUAGE plpgsql STABLE AS $$
DECLARE
  removed UUID[];
  keep UUID[];
  root_batch UUID;
BEGIN
  IF p_topic_id IS NOT NULL THEN
    SELECT archive_batch INTO root_batch FROM ac_topics WHERE id = p_topic_id AND user_id = p_user_id AND is_archived;
    removed := ARRAY(
      SELECT s.topic_id FROM ac_subtree(p_topic_id) s JOIN ac_topics t ON t.id = s.topic_id
      WHERE t.user_id = p_user_id
        AND (s.topic_id = p_topic_id OR NOT t.is_archived OR (root_batch IS NOT NULL AND t.archive_batch = root_batch)));
  ELSE
    SELECT archive_batch INTO root_batch FROM ac_domains WHERE id = p_domain_id AND user_id = p_user_id AND is_archived;
    removed := ARRAY(
      SELECT DISTINCT s.topic_id
      FROM ac_topic_domains td
      CROSS JOIN LATERAL ac_subtree(td.topic_id) s
      JOIN ac_topics t ON t.id = s.topic_id
      WHERE td.domain_id = p_domain_id AND td.user_id = p_user_id
        AND (NOT t.is_archived OR (root_batch IS NOT NULL AND t.archive_batch = root_batch)));
  END IF;

  LOOP
    keep := ARRAY(
      SELECT t FROM unnest(removed) AS t
      WHERE t IS DISTINCT FROM p_topic_id
        AND (
          EXISTS (
            SELECT 1 FROM ac_topic_links l JOIN ac_topics p ON p.id = l.parent_id
            WHERE l.child_id = t AND NOT (l.parent_id = ANY (removed))
              AND (NOT p_archive OR NOT p.is_archived))
          OR (p_domain_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM ac_topic_domains td JOIN ac_domains d ON d.id = td.domain_id
            WHERE td.topic_id = t AND td.domain_id <> p_domain_id AND NOT d.is_archived))
        ));
    EXIT WHEN cardinality(keep) = 0;
    removed := ARRAY(SELECT x FROM unnest(removed) AS x WHERE NOT (x = ANY (keep)));
  END LOOP;

  RETURN removed;
END $$;

NOTIFY pgrst, 'reload schema';
