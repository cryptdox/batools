-- Migration: 034_achievement_cycle.sql
-- 1. "Learning Cycle" becomes "Achievement Cycle": the lc_ tables are renamed
--    to ac_ in place (data kept), and every lc_ function / trigger / index /
--    constraint is replaced by an ac_ one.
-- 2. Archive: domains and topics get is_archived / archived_at /
--    archive_batch. Removing a topic or domain either archives it with
--    everything beneath (one batch, restorable together) or deletes it all.
-- 3. Domain types (ac_domain_types) that a domain can be tagged with.
-- Touches only lc_/ac_ objects.

------------------------------------------------------------------------------
-- 1. Rename
------------------------------------------------------------------------------

-- Old functions first (triggers depend on some of them; bodies name lc_ tables).
DROP TRIGGER IF EXISTS trg_lc_links_guard ON lc_topic_links;
DROP TRIGGER IF EXISTS trg_lc_link_inherit_cycles ON lc_topic_links;
DROP TRIGGER IF EXISTS trg_lc_topic_new_cycle ON lc_topics;
DROP FUNCTION IF EXISTS lc_links_guard();
DROP FUNCTION IF EXISTS lc_link_inherit_cycles();
DROP FUNCTION IF EXISTS lc_topic_new_cycle();
DROP FUNCTION IF EXISTS lc_rollup(UUID, TEXT, INT);
DROP FUNCTION IF EXISTS lc_domain_rollup(UUID, TEXT, INT);
DROP FUNCTION IF EXISTS lc_closure(UUID);
DROP FUNCTION IF EXISTS lc_subtree(UUID);
DROP FUNCTION IF EXISTS lc_start_cycle(UUID, UUID, TEXT, INT, BOOLEAN);
DROP FUNCTION IF EXISTS lc_log_progress(UUID, UUID, INT, TEXT);
DROP FUNCTION IF EXISTS lc_set_status(UUID, UUID, TEXT, INT, TEXT);
DROP FUNCTION IF EXISTS lc_delete_cycle(UUID, UUID, BOOLEAN);

ALTER TABLE lc_domains       RENAME TO ac_domains;
ALTER TABLE lc_topics        RENAME TO ac_topics;
ALTER TABLE lc_topic_domains RENAME TO ac_topic_domains;
ALTER TABLE lc_topic_links   RENAME TO ac_topic_links;
ALTER TABLE lc_cycles        RENAME TO ac_cycles;
ALTER TABLE lc_progress_logs RENAME TO ac_progress_logs;

-- Constraints (their indexes follow) and the remaining indexes: lc_ → ac_.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT con.conname, cls.relname
    FROM pg_constraint con JOIN pg_class cls ON cls.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = cls.relnamespace
    WHERE n.nspname = 'public' AND cls.relname LIKE 'ac\_%' AND con.conname LIKE 'lc\_%'
  LOOP
    EXECUTE format('ALTER TABLE %I RENAME CONSTRAINT %I TO %I', r.relname, r.conname, 'ac_' || substr(r.conname, 4));
  END LOOP;
  FOR r IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'i' AND (c.relname LIKE 'idx\_lc\_%' OR c.relname LIKE 'lc\_%')
  LOOP
    EXECUTE format('ALTER INDEX %I RENAME TO %I', r.relname, replace(replace(r.relname, 'idx_lc_', 'idx_ac_'), 'lc_', 'ac_'));
  END LOOP;
END $$;

------------------------------------------------------------------------------
-- 2. Archive columns, 3. domain types
------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ac_domain_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#6c5ce7',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);
CREATE INDEX IF NOT EXISTS idx_ac_domain_types_user ON ac_domain_types(user_id, sort_order);

ALTER TABLE ac_domains
  ADD COLUMN IF NOT EXISTS type_id UUID REFERENCES ac_domain_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  -- Everything archived by one action shares a batch, and is restored together.
  ADD COLUMN IF NOT EXISTS archive_batch UUID;

ALTER TABLE ac_topics
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archive_batch UUID;

CREATE INDEX IF NOT EXISTS idx_ac_domains_archived ON ac_domains(user_id, is_archived);
CREATE INDEX IF NOT EXISTS idx_ac_topics_archived  ON ac_topics(user_id, is_archived);

ALTER TABLE ac_domain_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access" ON ac_domain_types;
CREATE POLICY "Allow all access" ON ac_domain_types FOR ALL USING (true);

------------------------------------------------------------------------------
-- Graph helpers
------------------------------------------------------------------------------

-- (ancestor, descendant) pairs incl. (t, t), each pair once. Archived topics
-- are left out (and not walked through) unless p_include_archived.
CREATE OR REPLACE FUNCTION ac_closure(p_user_id UUID, p_include_archived BOOLEAN DEFAULT false)
RETURNS TABLE (ancestor_id UUID, descendant_id UUID)
LANGUAGE sql STABLE AS $$
  WITH RECURSIVE c(ancestor_id, descendant_id) AS (
    SELECT t.id, t.id FROM ac_topics t
    WHERE t.user_id = p_user_id AND (p_include_archived OR NOT t.is_archived)
    UNION
    SELECT c.ancestor_id, l.child_id
    FROM c
    JOIN ac_topic_links l ON l.parent_id = c.descendant_id
    JOIN ac_topics ch ON ch.id = l.child_id
    WHERE p_include_archived OR NOT ch.is_archived
  )
  SELECT ancestor_id, descendant_id FROM c;
$$;

-- A topic and everything beneath it (archived or not).
CREATE OR REPLACE FUNCTION ac_subtree(p_topic_id UUID)
RETURNS TABLE (topic_id UUID)
LANGUAGE sql STABLE AS $$
  WITH RECURSIVE s(id) AS (
    SELECT p_topic_id
    UNION
    SELECT l.child_id FROM s JOIN ac_topic_links l ON l.parent_id = s.id
  )
  SELECT id FROM s;
$$;

------------------------------------------------------------------------------
-- Integrity triggers (same rules as 032)
------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION ac_links_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM ac_topics WHERE id = NEW.parent_id AND user_id = NEW.user_id)
     OR NOT EXISTS (SELECT 1 FROM ac_topics WHERE id = NEW.child_id AND user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'Topic not found' USING ERRCODE = 'P0002';
  END IF;
  IF EXISTS (SELECT 1 FROM ac_subtree(NEW.child_id) s WHERE s.topic_id = NEW.parent_id) THEN
    RAISE EXCEPTION 'That would make a topic its own ancestor' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_ac_links_guard BEFORE INSERT OR UPDATE OF parent_id, child_id ON ac_topic_links
  FOR EACH ROW EXECUTE FUNCTION ac_links_guard();

CREATE OR REPLACE FUNCTION ac_topic_new_cycle() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO ac_cycles (user_id, topic_id, kind, round, total_points)
  VALUES (NEW.user_id, NEW.id, 'new', 0, NEW.default_points)
  ON CONFLICT (topic_id, kind, round) DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_ac_topic_new_cycle AFTER INSERT ON ac_topics
  FOR EACH ROW EXECUTE FUNCTION ac_topic_new_cycle();

-- Linking a topic under a parent gives its (non-archived) subtree the parent's
-- revise / practice cycles, so the parent's rollup includes the new branch.
CREATE OR REPLACE FUNCTION ac_link_inherit_cycles() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO ac_cycles (user_id, topic_id, kind, round, total_points)
  SELECT NEW.user_id, s.topic_id, pc.kind, pc.round, t.default_points
  FROM ac_cycles pc
  CROSS JOIN ac_subtree(NEW.child_id) s
  JOIN ac_topics t ON t.id = s.topic_id AND NOT t.is_archived
  WHERE pc.topic_id = NEW.parent_id AND pc.kind <> 'new'
  ON CONFLICT (topic_id, kind, round) DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_ac_link_inherit_cycles AFTER INSERT ON ac_topic_links
  FOR EACH ROW EXECUTE FUNCTION ac_link_inherit_cycles();

------------------------------------------------------------------------------
-- Rollups (archived topics / domains count only with p_include_archived)
------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION ac_rollup(p_user_id UUID, p_kind TEXT DEFAULT NULL, p_round INT DEFAULT NULL, p_include_archived BOOLEAN DEFAULT false)
RETURNS TABLE (
  topic_id UUID, kind TEXT, round INT,
  own_total BIGINT, own_achieved BIGINT, own_status TEXT,
  total BIGINT, achieved BIGINT, topics BIGINT, completed_topics BIGINT
)
LANGUAGE sql STABLE AS $$
  WITH cyc AS (
    SELECT cy.* FROM ac_cycles cy
    WHERE cy.user_id = p_user_id
      AND (p_kind IS NULL OR cy.kind = p_kind)
      AND (p_round IS NULL OR cy.round = p_round)
  ), clo AS (
    SELECT * FROM ac_closure(p_user_id, p_include_archived)
  )
  SELECT
    clo.ancestor_id, cyc.kind, cyc.round,
    sum(CASE WHEN cyc.topic_id = clo.ancestor_id AND cyc.status <> 'cancel' THEN cyc.total_points ELSE 0 END),
    sum(CASE WHEN cyc.topic_id = clo.ancestor_id AND cyc.status <> 'cancel' THEN cyc.achieved_points ELSE 0 END),
    max(CASE WHEN cyc.topic_id = clo.ancestor_id THEN cyc.status END),
    sum(CASE WHEN cyc.status <> 'cancel' THEN cyc.total_points ELSE 0 END),
    sum(CASE WHEN cyc.status <> 'cancel' THEN cyc.achieved_points ELSE 0 END),
    count(*) FILTER (WHERE cyc.status <> 'cancel'),
    count(*) FILTER (WHERE cyc.status = 'complete')
  FROM clo JOIN cyc ON cyc.topic_id = clo.descendant_id
  GROUP BY clo.ancestor_id, cyc.kind, cyc.round;
$$;

CREATE OR REPLACE FUNCTION ac_domain_rollup(p_user_id UUID, p_kind TEXT DEFAULT NULL, p_round INT DEFAULT NULL, p_include_archived BOOLEAN DEFAULT false)
RETURNS TABLE (domain_id UUID, kind TEXT, round INT, total BIGINT, achieved BIGINT, topics BIGINT, completed_topics BIGINT)
LANGUAGE sql STABLE AS $$
  WITH members AS (
    SELECT DISTINCT td.domain_id, clo.descendant_id AS topic_id
    FROM ac_topic_domains td
    JOIN ac_domains d ON d.id = td.domain_id AND (p_include_archived OR NOT d.is_archived)
    JOIN ac_closure(p_user_id, p_include_archived) clo ON clo.ancestor_id = td.topic_id
    WHERE td.user_id = p_user_id
  )
  SELECT m.domain_id, cy.kind, cy.round,
    sum(CASE WHEN cy.status <> 'cancel' THEN cy.total_points ELSE 0 END),
    sum(CASE WHEN cy.status <> 'cancel' THEN cy.achieved_points ELSE 0 END),
    count(*) FILTER (WHERE cy.status <> 'cancel'),
    count(*) FILTER (WHERE cy.status = 'complete')
  FROM members m
  JOIN ac_cycles cy ON cy.topic_id = m.topic_id
  WHERE (p_kind IS NULL OR cy.kind = p_kind) AND (p_round IS NULL OR cy.round = p_round)
  GROUP BY m.domain_id, cy.kind, cy.round;
$$;

------------------------------------------------------------------------------
-- Cycle actions (same rules as 032 / 033)
------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION ac_start_cycle(p_user_id UUID, p_topic_id UUID, p_kind TEXT, p_round INT DEFAULT NULL, p_cascade BOOLEAN DEFAULT true)
RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE
  r INT := p_round;
BEGIN
  IF p_kind NOT IN ('revise', 'practice') THEN
    RAISE EXCEPTION 'Only revise or practice cycles can be started' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM ac_topics WHERE id = p_topic_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'Topic not found' USING ERRCODE = 'P0002';
  END IF;
  IF r IS NULL THEN
    SELECT coalesce(max(round), 0) + 1 INTO r FROM ac_cycles WHERE topic_id = p_topic_id AND kind = p_kind;
  END IF;

  INSERT INTO ac_cycles (user_id, topic_id, kind, round, total_points)
  SELECT p_user_id, t.id, p_kind, r, t.default_points
  FROM ac_topics t
  WHERE t.user_id = p_user_id
    AND (t.id = p_topic_id OR (p_cascade AND NOT t.is_archived AND t.id IN (SELECT topic_id FROM ac_subtree(p_topic_id))))
  ON CONFLICT (topic_id, kind, round) DO NOTHING;

  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION ac_log_progress(p_user_id UUID, p_cycle_id UUID, p_delta INT, p_comment_html TEXT DEFAULT NULL)
RETURNS ac_cycles
LANGUAGE plpgsql AS $$
DECLARE
  c ac_cycles%ROWTYPE;
  next_achieved INT;
BEGIN
  SELECT * INTO c FROM ac_cycles WHERE id = p_cycle_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cycle not found' USING ERRCODE = 'P0002';
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
END $$;

CREATE OR REPLACE FUNCTION ac_set_status(p_user_id UUID, p_cycle_id UUID, p_status TEXT, p_sort_order INT DEFAULT NULL, p_comment_html TEXT DEFAULT NULL)
RETURNS ac_cycles
LANGUAGE plpgsql AS $$
DECLARE
  c ac_cycles%ROWTYPE;
  remaining INT;
BEGIN
  IF p_status NOT IN ('todo', 'hold', 'in_progress', 'complete', 'cancel') THEN
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

CREATE OR REPLACE FUNCTION ac_delete_cycle(p_user_id UUID, p_cycle_id UUID, p_cascade BOOLEAN DEFAULT false)
RETURNS JSONB
LANGUAGE plpgsql AS $$
DECLARE
  c ac_cycles%ROWTYPE;
  ids UUID[];
  n_logs INT;
  n_cycles INT;
BEGIN
  SELECT * INTO c FROM ac_cycles WHERE id = p_cycle_id AND user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cycle not found' USING ERRCODE = 'P0002';
  END IF;
  IF c.kind = 'new' THEN
    RAISE EXCEPTION 'The New cycle belongs to the topic; delete the topic instead' USING ERRCODE = '22023';
  END IF;

  ids := ARRAY(
    SELECT cy.id FROM ac_cycles cy
    WHERE cy.user_id = p_user_id AND cy.kind = c.kind AND cy.round = c.round
      AND (cy.id = c.id OR (p_cascade AND cy.topic_id IN (SELECT topic_id FROM ac_subtree(c.topic_id))))
  );

  SELECT count(*) INTO n_logs FROM ac_progress_logs WHERE cycle_id = ANY (ids);
  DELETE FROM ac_cycles WHERE id = ANY (ids);
  GET DIAGNOSTICS n_cycles = ROW_COUNT;

  RETURN jsonb_build_object('cycles', n_cycles, 'logs', n_logs);
END $$;

------------------------------------------------------------------------------
-- Removing (archive or delete) a topic or a domain with everything beneath
------------------------------------------------------------------------------

-- The topics removing p_topic_id (or p_domain_id) takes along: everything
-- beneath, except
--   * topics that still have a parent outside the removed set (they belong
--     elsewhere too; when archiving, that parent must be active),
--   * when removing a domain, topics also tagged with another active domain,
--   * topics already archived (archiving: nothing to do; deleting: they stay
--     archived and restorable, just unlinked from what is deleted).
CREATE OR REPLACE FUNCTION ac_removal_set(p_user_id UUID, p_topic_id UUID, p_domain_id UUID, p_archive BOOLEAN)
RETURNS UUID[]
LANGUAGE plpgsql STABLE AS $$
DECLARE
  removed UUID[];
  keep UUID[];
BEGIN
  IF p_topic_id IS NOT NULL THEN
    removed := ARRAY(
      SELECT s.topic_id FROM ac_subtree(p_topic_id) s JOIN ac_topics t ON t.id = s.topic_id
      WHERE t.user_id = p_user_id AND (s.topic_id = p_topic_id OR NOT t.is_archived));
  ELSE
    removed := ARRAY(
      SELECT DISTINCT s.topic_id
      FROM ac_topic_domains td
      CROSS JOIN LATERAL ac_subtree(td.topic_id) s
      JOIN ac_topics t ON t.id = s.topic_id
      WHERE td.domain_id = p_domain_id AND td.user_id = p_user_id AND NOT t.is_archived);
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

-- Archives (p_archive) or permanently deletes a topic or a domain (pass one)
-- with everything ac_removal_set says goes with it. p_dry_run only counts.
-- Returns { topics, cycles, logs, domains }.
CREATE OR REPLACE FUNCTION ac_remove(p_user_id UUID, p_topic_id UUID, p_domain_id UUID, p_archive BOOLEAN, p_dry_run BOOLEAN DEFAULT false)
RETURNS JSONB
LANGUAGE plpgsql AS $$
DECLARE
  ids UUID[];
  batch UUID := gen_random_uuid();
  n_cycles INT;
  n_logs INT;
BEGIN
  IF (p_topic_id IS NULL) = (p_domain_id IS NULL) THEN
    RAISE EXCEPTION 'Pass a topic or a domain' USING ERRCODE = '22023';
  END IF;
  IF p_topic_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ac_topics WHERE id = p_topic_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'Topic not found' USING ERRCODE = 'P0002';
  END IF;
  IF p_domain_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ac_domains WHERE id = p_domain_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'Domain not found' USING ERRCODE = 'P0002';
  END IF;

  ids := ac_removal_set(p_user_id, p_topic_id, p_domain_id, p_archive);
  SELECT count(*) INTO n_cycles FROM ac_cycles WHERE topic_id = ANY (ids);
  SELECT count(*) INTO n_logs FROM ac_progress_logs l JOIN ac_cycles c ON c.id = l.cycle_id WHERE c.topic_id = ANY (ids);

  IF NOT p_dry_run THEN
    IF p_archive THEN
      UPDATE ac_topics SET is_archived = true, archived_at = now(), archive_batch = batch, updated_at = now()
      WHERE id = ANY (ids);
      UPDATE ac_domains SET is_archived = true, archived_at = now(), archive_batch = batch, updated_at = now()
      WHERE id = p_domain_id;
    ELSE
      DELETE FROM ac_topics WHERE id = ANY (ids);
      DELETE FROM ac_domains WHERE id = p_domain_id;
    END IF;
  END IF;

  RETURN jsonb_build_object('topics', cardinality(ids), 'cycles', n_cycles, 'logs', n_logs,
                            'domains', CASE WHEN p_domain_id IS NULL THEN 0 ELSE 1 END);
END $$;

-- Restores a topic or a domain (pass one) together with everything archived
-- in the same action. A restored topic whose parent was deleted meanwhile is
-- simply a subject again (its links went with the parent).
CREATE OR REPLACE FUNCTION ac_restore(p_user_id UUID, p_topic_id UUID, p_domain_id UUID)
RETURNS JSONB
LANGUAGE plpgsql AS $$
DECLARE
  b UUID;
  n_topics INT;
  n_domains INT := 0;
BEGIN
  IF p_topic_id IS NOT NULL THEN
    SELECT archive_batch INTO b FROM ac_topics WHERE id = p_topic_id AND user_id = p_user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Topic not found' USING ERRCODE = 'P0002'; END IF;
    UPDATE ac_topics SET is_archived = false, archived_at = NULL, archive_batch = NULL, updated_at = now()
    WHERE user_id = p_user_id AND is_archived
      AND (id = p_topic_id OR (b IS NOT NULL AND archive_batch = b AND id IN (SELECT topic_id FROM ac_subtree(p_topic_id))));
    GET DIAGNOSTICS n_topics = ROW_COUNT;
  ELSE
    SELECT archive_batch INTO b FROM ac_domains WHERE id = p_domain_id AND user_id = p_user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Domain not found' USING ERRCODE = 'P0002'; END IF;
    UPDATE ac_domains SET is_archived = false, archived_at = NULL, archive_batch = NULL, updated_at = now()
    WHERE id = p_domain_id;
    GET DIAGNOSTICS n_domains = ROW_COUNT;
    UPDATE ac_topics SET is_archived = false, archived_at = NULL, archive_batch = NULL, updated_at = now()
    WHERE user_id = p_user_id AND is_archived AND b IS NOT NULL AND archive_batch = b;
    GET DIAGNOSTICS n_topics = ROW_COUNT;
  END IF;
  RETURN jsonb_build_object('topics', n_topics, 'domains', n_domains);
END $$;

NOTIFY pgrst, 'reload schema';
