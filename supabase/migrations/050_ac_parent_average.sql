-- Migration: 050_ac_parent_average.sql
-- A parent topic's achieved points are computed from its children, per cycle:
--   achieved = round(average of the children's achieved / total) × the parent's own total
-- (each child counted once, equally; a child that is itself a parent brings its
-- own computed ratio, so it rolls up level by level). Children in cancel, with
-- no points, or archived are left out; a parent none of whose children has the
-- cycle keeps its own value. Parents are not progressed by hand any more.
--
-- Rollups follow: a topic's total / achieved are its own (for parents, the
-- computed value) instead of the sum of its subtree, and a domain is the
-- average of its top-level topics (tagged topics not beneath another tagged
-- topic of that domain), scaled to their combined points.

-- The computed achieved points of a parent's cycle, or NULL when it has no child to average.
CREATE OR REPLACE FUNCTION ac_parent_achieved(p_topic_id UUID, p_kind TEXT, p_round INT, p_total INT)
RETURNS INT
LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN avg(r) IS NULL THEN NULL ELSE least(p_total, round(avg(r) * p_total)::int) END
  FROM (
    SELECT c.achieved_points::numeric / c.total_points AS r
    FROM ac_topic_links l
    JOIN ac_topics ch ON ch.id = l.child_id AND NOT ch.is_archived
    JOIN ac_cycles c ON c.topic_id = l.child_id AND c.kind = p_kind AND c.round = p_round
    WHERE l.parent_id = p_topic_id AND c.status <> 'cancel' AND c.total_points > 0
  ) x;
$$;

-- Re-derives the cycles of the given parents (optionally one kind / round) that are out of date;
-- each update re-fires the triggers below, so the change climbs to grandparents.
CREATE OR REPLACE FUNCTION ac_touch_parent_cycles(p_parent_ids UUID[], p_kind TEXT DEFAULT NULL, p_round INT DEFAULT NULL)
RETURNS VOID
LANGUAGE sql AS $$
  UPDATE ac_cycles p SET achieved_points = v.achieved
  FROM (
    SELECT cy.id, ac_parent_achieved(cy.topic_id, cy.kind, cy.round, cy.total_points) AS achieved
    FROM ac_cycles cy
    WHERE cy.topic_id = ANY (p_parent_ids)
      AND (p_kind IS NULL OR cy.kind = p_kind)
      AND (p_round IS NULL OR cy.round = p_round)
  ) v
  WHERE p.id = v.id AND v.achieved IS NOT NULL AND v.achieved IS DISTINCT FROM p.achieved_points;
$$;

-- Before a cycle is written: a parent's achieved points are always the computed ones.
CREATE OR REPLACE FUNCTION ac_cycles_derive_parent()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  v INT := ac_parent_achieved(NEW.topic_id, NEW.kind, NEW.round, NEW.total_points);
BEGIN
  IF v IS NOT NULL THEN NEW.achieved_points := v; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_ac_cycles_derive_parent ON ac_cycles;
CREATE TRIGGER trg_ac_cycles_derive_parent
  BEFORE INSERT OR UPDATE ON ac_cycles
  FOR EACH ROW EXECUTE FUNCTION ac_cycles_derive_parent();

-- After a cycle changes: its parents' same cycle follows.
CREATE OR REPLACE FUNCTION ac_cycles_propagate()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  r RECORD := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
BEGIN
  PERFORM ac_touch_parent_cycles(
    ARRAY(SELECT parent_id FROM ac_topic_links WHERE child_id = r.topic_id), r.kind, r.round);
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_ac_cycles_propagate ON ac_cycles;
CREATE TRIGGER trg_ac_cycles_propagate
  AFTER INSERT OR DELETE OR UPDATE OF achieved_points, total_points, status ON ac_cycles
  FOR EACH ROW EXECUTE FUNCTION ac_cycles_propagate();

-- Linking / unlinking a child changes which children are averaged.
CREATE OR REPLACE FUNCTION ac_links_propagate()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM ac_touch_parent_cycles(ARRAY[CASE WHEN TG_OP = 'DELETE' THEN OLD.parent_id ELSE NEW.parent_id END]);
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_ac_links_propagate ON ac_topic_links;
CREATE TRIGGER trg_ac_links_propagate
  AFTER INSERT OR DELETE ON ac_topic_links
  FOR EACH ROW EXECUTE FUNCTION ac_links_propagate();

-- Archiving / restoring a child takes it out of / back into its parents' average.
CREATE OR REPLACE FUNCTION ac_topics_archive_propagate()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM ac_touch_parent_cycles(ARRAY(SELECT parent_id FROM ac_topic_links WHERE child_id = NEW.id));
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_ac_topics_archive_propagate ON ac_topics;
CREATE TRIGGER trg_ac_topics_archive_propagate
  AFTER UPDATE OF is_archived ON ac_topics
  FOR EACH ROW WHEN (OLD.is_archived IS DISTINCT FROM NEW.is_archived)
  EXECUTE FUNCTION ac_topics_archive_propagate();

-- Topic rollup: a topic's points are its own (computed for parents); counts still cover the subtree.
CREATE OR REPLACE FUNCTION ac_rollup(p_user_id UUID, p_kind TEXT DEFAULT NULL, p_round INT DEFAULT NULL, p_include_archived BOOLEAN DEFAULT false)
RETURNS TABLE(topic_id UUID, kind TEXT, round INT, own_total BIGINT, own_achieved BIGINT, own_status TEXT, total BIGINT, achieved BIGINT, topics BIGINT, completed_topics BIGINT)
LANGUAGE sql STABLE AS $$
  WITH cyc AS (
    SELECT cy.* FROM ac_cycles cy
    WHERE cy.user_id = p_user_id
      AND (p_kind IS NULL OR cy.kind = p_kind)
      AND (p_round IS NULL OR cy.round = p_round)
  ), clo AS (
    SELECT * FROM ac_closure(p_user_id, p_include_archived)
  ), agg AS (
    SELECT
      clo.ancestor_id, cyc.kind, cyc.round,
      sum(CASE WHEN cyc.topic_id = clo.ancestor_id AND cyc.status <> 'cancel' THEN cyc.total_points ELSE 0 END) AS own_total,
      sum(CASE WHEN cyc.topic_id = clo.ancestor_id AND cyc.status <> 'cancel' THEN cyc.achieved_points ELSE 0 END) AS own_achieved,
      max(CASE WHEN cyc.topic_id = clo.ancestor_id THEN cyc.status END) AS own_status,
      count(*) FILTER (WHERE cyc.status <> 'cancel') AS topics,
      count(*) FILTER (WHERE cyc.status = 'complete') AS completed_topics
    FROM clo JOIN cyc ON cyc.topic_id = clo.descendant_id
    GROUP BY clo.ancestor_id, cyc.kind, cyc.round
  )
  SELECT ancestor_id, kind, round, own_total, own_achieved, own_status, own_total, own_achieved, topics, completed_topics FROM agg;
$$;

-- Domain rollup: the average of its top-level topics' completion, scaled to their combined points.
CREATE OR REPLACE FUNCTION ac_domain_rollup(p_user_id UUID, p_kind TEXT DEFAULT NULL, p_round INT DEFAULT NULL, p_include_archived BOOLEAN DEFAULT false)
RETURNS TABLE(domain_id UUID, kind TEXT, round INT, total BIGINT, achieved BIGINT, topics BIGINT, completed_topics BIGINT)
LANGUAGE sql STABLE AS $$
  WITH clo AS (
    SELECT * FROM ac_closure(p_user_id, p_include_archived)
  ), tagged AS (
    SELECT DISTINCT td.domain_id, td.topic_id
    FROM ac_topic_domains td
    JOIN ac_domains d ON d.id = td.domain_id AND (p_include_archived OR NOT d.is_archived)
    JOIN ac_topics t ON t.id = td.topic_id AND (p_include_archived OR NOT t.is_archived)
    WHERE td.user_id = p_user_id
  ), tops AS (
    -- Tagged topics not beneath another topic tagged with the same domain.
    SELECT tg.domain_id, tg.topic_id FROM tagged tg
    WHERE NOT EXISTS (
      SELECT 1 FROM tagged o JOIN clo ON clo.ancestor_id = o.topic_id AND clo.descendant_id = tg.topic_id
      WHERE o.domain_id = tg.domain_id AND o.topic_id <> tg.topic_id)
  ), members AS (
    SELECT DISTINCT tg.domain_id, clo.descendant_id AS topic_id
    FROM tagged tg JOIN clo ON clo.ancestor_id = tg.topic_id
  ), counts AS (
    SELECT m.domain_id, cy.kind, cy.round,
      count(*) FILTER (WHERE cy.status <> 'cancel') AS topics,
      count(*) FILTER (WHERE cy.status = 'complete') AS completed_topics
    FROM members m JOIN ac_cycles cy ON cy.topic_id = m.topic_id
    WHERE (p_kind IS NULL OR cy.kind = p_kind) AND (p_round IS NULL OR cy.round = p_round)
    GROUP BY m.domain_id, cy.kind, cy.round
  ), avgs AS (
    SELECT tp.domain_id, cy.kind, cy.round,
      sum(cy.total_points) AS total,
      avg(cy.achieved_points::numeric / cy.total_points) AS ratio
    FROM tops tp JOIN ac_cycles cy ON cy.topic_id = tp.topic_id
    WHERE cy.status <> 'cancel' AND cy.total_points > 0
      AND (p_kind IS NULL OR cy.kind = p_kind) AND (p_round IS NULL OR cy.round = p_round)
    GROUP BY tp.domain_id, cy.kind, cy.round
  )
  SELECT c.domain_id, c.kind, c.round,
    coalesce(a.total, 0)::bigint,
    coalesce(round(a.ratio * a.total), 0)::bigint,
    c.topics, c.completed_topics
  FROM counts c LEFT JOIN avgs a USING (domain_id, kind, round);
$$;

-- Bring every existing parent in line, deepest first (each pass settles one more level).
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
