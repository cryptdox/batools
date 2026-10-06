-- Migration: 032_learning_cycle.sql
-- Learning Cycle: track learning of topics through repeated cycles.
-- Namespaced behind `lc_`; every row carries `user_id` (the signed-in IAM
-- user, like the tm_ / pf_ tables). Creates new objects only.
--
-- MODEL
--   * Domains group topics; a topic can be in many domains and a domain has
--     many topics (lc_topic_domains). Children inherit their parents' domains
--     for rollups, so tagging the subject is enough.
--   * Topics form a graph (lc_topic_links parent -> child): unlimited nesting,
--     a topic may have many parents and many children, no loops.
--       - a topic with no parent is a SUBJECT
--       - a link's role names the child under that parent: 'general' (general
--         topic) or 'area'. NULL = automatic: 'general' when the parent is a
--         subject, otherwise 'area'.
--   * Cycles (lc_cycles): one per topic per (kind, round):
--       new/0, revise/1, revise/2, ..., practice/1, practice/2, ...
--     Each has its own story points (total) and achieved points, and a
--     Kanban status. Every topic owns points, parents included.
--   * Completion of a topic for one cycle =
--       sum(achieved) / sum(total) over the topic and everything beneath it,
--     each topic counted once even when reachable by several paths. Cancelled
--     cycles are left out.
--   * lc_progress_logs: every +/- of achieved points, with an HTML comment.
--
-- RLS: same permissive policy as the rest of the project (Bangla Tools has no
-- Supabase Auth; pages filter by user_id).

------------------------------------------------------------------------------
-- Tables
------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS lc_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#6c5ce7',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lc_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  -- What one story point means for this topic (e.g. "one chapter").
  story_point_description TEXT,
  -- Story points a new cycle of this topic starts with.
  default_points INT NOT NULL DEFAULT 1 CHECK (default_points >= 0),
  is_milestone BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lc_topic_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  topic_id UUID NOT NULL REFERENCES lc_topics(id) ON DELETE CASCADE,
  domain_id UUID NOT NULL REFERENCES lc_domains(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (topic_id, domain_id)
);

CREATE TABLE IF NOT EXISTS lc_topic_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  parent_id UUID NOT NULL REFERENCES lc_topics(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES lc_topics(id) ON DELETE CASCADE,
  -- NULL = automatic (see header).
  role TEXT CHECK (role IS NULL OR role IN ('general', 'area')),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (parent_id, child_id),
  CHECK (parent_id <> child_id)
);

CREATE TABLE IF NOT EXISTS lc_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  topic_id UUID NOT NULL REFERENCES lc_topics(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('new', 'revise', 'practice')),
  round INT NOT NULL,
  total_points INT NOT NULL DEFAULT 0 CHECK (total_points >= 0),
  achieved_points INT NOT NULL DEFAULT 0 CHECK (achieved_points >= 0),
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'hold', 'in_progress', 'complete', 'cancel')),
  -- Position inside its Kanban column.
  sort_order INT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (topic_id, kind, round),
  -- Story points can grow, never drop below what is already achieved.
  CONSTRAINT lc_cycles_achieved_le_total CHECK (achieved_points <= total_points),
  CHECK ((kind = 'new' AND round = 0) OR (kind <> 'new' AND round >= 1))
);

CREATE TABLE IF NOT EXISTS lc_progress_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  cycle_id UUID NOT NULL REFERENCES lc_cycles(id) ON DELETE CASCADE,
  delta INT NOT NULL CHECK (delta <> 0),
  achieved_after INT NOT NULL,
  -- Rich text (HTML) explaining the progress.
  comment_html TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_lc_domains_user      ON lc_domains(user_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_lc_topics_user       ON lc_topics(user_id, name);
CREATE INDEX IF NOT EXISTS idx_lc_topic_domains_t   ON lc_topic_domains(topic_id);
CREATE INDEX IF NOT EXISTS idx_lc_topic_domains_d   ON lc_topic_domains(domain_id);
CREATE INDEX IF NOT EXISTS idx_lc_links_parent      ON lc_topic_links(parent_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_lc_links_child       ON lc_topic_links(child_id);
CREATE INDEX IF NOT EXISTS idx_lc_cycles_user       ON lc_cycles(user_id, kind, round, status, sort_order);
CREATE INDEX IF NOT EXISTS idx_lc_cycles_topic      ON lc_cycles(topic_id);
CREATE INDEX IF NOT EXISTS idx_lc_logs_cycle        ON lc_progress_logs(cycle_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lc_logs_user         ON lc_progress_logs(user_id, created_at DESC);

------------------------------------------------------------------------------
-- Graph helpers
------------------------------------------------------------------------------

-- Every (ancestor, descendant) pair of a user's topics, including (t, t).
-- UNION de-duplicates, so a topic reachable by two paths appears once.
CREATE OR REPLACE FUNCTION lc_closure(p_user_id UUID)
RETURNS TABLE (ancestor_id UUID, descendant_id UUID)
LANGUAGE sql STABLE AS $$
  WITH RECURSIVE c(ancestor_id, descendant_id) AS (
    SELECT t.id, t.id FROM lc_topics t WHERE t.user_id = p_user_id
    UNION
    SELECT c.ancestor_id, l.child_id
    FROM c JOIN lc_topic_links l ON l.parent_id = c.descendant_id
  )
  SELECT ancestor_id, descendant_id FROM c;
$$;

-- A topic and everything beneath it.
CREATE OR REPLACE FUNCTION lc_subtree(p_topic_id UUID)
RETURNS TABLE (topic_id UUID)
LANGUAGE sql STABLE AS $$
  WITH RECURSIVE s(id) AS (
    SELECT p_topic_id
    UNION
    SELECT l.child_id FROM s JOIN lc_topic_links l ON l.parent_id = s.id
  )
  SELECT id FROM s;
$$;

------------------------------------------------------------------------------
-- Integrity triggers
------------------------------------------------------------------------------

-- Links stay inside one user's topics and never form a loop.
CREATE OR REPLACE FUNCTION lc_links_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM lc_topics WHERE id = NEW.parent_id AND user_id = NEW.user_id)
     OR NOT EXISTS (SELECT 1 FROM lc_topics WHERE id = NEW.child_id AND user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'Topic not found' USING ERRCODE = 'P0002';
  END IF;
  IF EXISTS (SELECT 1 FROM lc_subtree(NEW.child_id) s WHERE s.topic_id = NEW.parent_id) THEN
    RAISE EXCEPTION 'That would make a topic its own ancestor' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_lc_links_guard ON lc_topic_links;
CREATE TRIGGER trg_lc_links_guard BEFORE INSERT OR UPDATE OF parent_id, child_id ON lc_topic_links
  FOR EACH ROW EXECUTE FUNCTION lc_links_guard();

-- A new topic starts with its New cycle.
CREATE OR REPLACE FUNCTION lc_topic_new_cycle() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO lc_cycles (user_id, topic_id, kind, round, total_points)
  VALUES (NEW.user_id, NEW.id, 'new', 0, NEW.default_points)
  ON CONFLICT (topic_id, kind, round) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_lc_topic_new_cycle ON lc_topics;
CREATE TRIGGER trg_lc_topic_new_cycle AFTER INSERT ON lc_topics
  FOR EACH ROW EXECUTE FUNCTION lc_topic_new_cycle();

-- Linking a topic under a parent gives it (and its subtree) every revise /
-- practice cycle the parent already has, so the parent's rollup for that
-- cycle includes the new branch.
CREATE OR REPLACE FUNCTION lc_link_inherit_cycles() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO lc_cycles (user_id, topic_id, kind, round, total_points)
  SELECT NEW.user_id, s.topic_id, pc.kind, pc.round, t.default_points
  FROM lc_cycles pc
  CROSS JOIN lc_subtree(NEW.child_id) s
  JOIN lc_topics t ON t.id = s.topic_id
  WHERE pc.topic_id = NEW.parent_id AND pc.kind <> 'new'
  ON CONFLICT (topic_id, kind, round) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_lc_link_inherit_cycles ON lc_topic_links;
CREATE TRIGGER trg_lc_link_inherit_cycles AFTER INSERT ON lc_topic_links
  FOR EACH ROW EXECUTE FUNCTION lc_link_inherit_cycles();

------------------------------------------------------------------------------
-- Rollups
------------------------------------------------------------------------------

-- Per topic and cycle: own points and points of the whole subtree (topic
-- included, each descendant once). Cancelled cycles count as nothing.
-- p_kind / p_round NULL = all cycles.
CREATE OR REPLACE FUNCTION lc_rollup(p_user_id UUID, p_kind TEXT DEFAULT NULL, p_round INT DEFAULT NULL)
RETURNS TABLE (
  topic_id UUID, kind TEXT, round INT,
  own_total BIGINT, own_achieved BIGINT, own_status TEXT,
  total BIGINT, achieved BIGINT, topics BIGINT, completed_topics BIGINT
)
LANGUAGE sql STABLE AS $$
  WITH cyc AS (
    SELECT cy.* FROM lc_cycles cy
    WHERE cy.user_id = p_user_id
      AND (p_kind IS NULL OR cy.kind = p_kind)
      AND (p_round IS NULL OR cy.round = p_round)
  ), clo AS (
    SELECT * FROM lc_closure(p_user_id)
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

-- Per domain and cycle: everything tagged with the domain plus everything
-- beneath those topics, each topic once.
CREATE OR REPLACE FUNCTION lc_domain_rollup(p_user_id UUID, p_kind TEXT DEFAULT NULL, p_round INT DEFAULT NULL)
RETURNS TABLE (domain_id UUID, kind TEXT, round INT, total BIGINT, achieved BIGINT, topics BIGINT, completed_topics BIGINT)
LANGUAGE sql STABLE AS $$
  WITH members AS (
    SELECT DISTINCT td.domain_id, clo.descendant_id AS topic_id
    FROM lc_topic_domains td
    JOIN lc_closure(p_user_id) clo ON clo.ancestor_id = td.topic_id
    WHERE td.user_id = p_user_id
  )
  SELECT m.domain_id, cy.kind, cy.round,
    sum(CASE WHEN cy.status <> 'cancel' THEN cy.total_points ELSE 0 END),
    sum(CASE WHEN cy.status <> 'cancel' THEN cy.achieved_points ELSE 0 END),
    count(*) FILTER (WHERE cy.status <> 'cancel'),
    count(*) FILTER (WHERE cy.status = 'complete')
  FROM members m
  JOIN lc_cycles cy ON cy.topic_id = m.topic_id
  WHERE (p_kind IS NULL OR cy.kind = p_kind) AND (p_round IS NULL OR cy.round = p_round)
  GROUP BY m.domain_id, cy.kind, cy.round;
$$;

------------------------------------------------------------------------------
-- Actions (one transaction each)
------------------------------------------------------------------------------

-- Starts a revise / practice cycle on a topic, and with p_cascade on every
-- topic beneath it that does not have that cycle yet. p_round NULL = the
-- topic's next round of that kind. Returns the round.
CREATE OR REPLACE FUNCTION lc_start_cycle(p_user_id UUID, p_topic_id UUID, p_kind TEXT, p_round INT DEFAULT NULL, p_cascade BOOLEAN DEFAULT true)
RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE
  r INT := p_round;
BEGIN
  IF p_kind NOT IN ('revise', 'practice') THEN
    RAISE EXCEPTION 'Only revise or practice cycles can be started' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM lc_topics WHERE id = p_topic_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'Topic not found' USING ERRCODE = 'P0002';
  END IF;
  IF r IS NULL THEN
    SELECT coalesce(max(round), 0) + 1 INTO r FROM lc_cycles WHERE topic_id = p_topic_id AND kind = p_kind;
  END IF;

  INSERT INTO lc_cycles (user_id, topic_id, kind, round, total_points)
  SELECT p_user_id, t.id, p_kind, r, t.default_points
  FROM lc_topics t
  WHERE t.user_id = p_user_id
    AND (t.id = p_topic_id OR (p_cascade AND t.id IN (SELECT topic_id FROM lc_subtree(p_topic_id))))
  ON CONFLICT (topic_id, kind, round) DO NOTHING;

  RETURN r;
END $$;

-- Adds (or with a negative delta removes) achieved points on a cycle that is
-- in progress, logging why. Reaching the total completes the cycle; going
-- back below it from complete re-opens it as in progress.
CREATE OR REPLACE FUNCTION lc_log_progress(p_user_id UUID, p_cycle_id UUID, p_delta INT, p_comment_html TEXT DEFAULT NULL)
RETURNS lc_cycles
LANGUAGE plpgsql AS $$
DECLARE
  c lc_cycles%ROWTYPE;
  next_achieved INT;
BEGIN
  SELECT * INTO c FROM lc_cycles WHERE id = p_cycle_id AND user_id = p_user_id FOR UPDATE;
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

  UPDATE lc_cycles SET
    achieved_points = next_achieved,
    status = CASE WHEN next_achieved = total_points AND total_points > 0 THEN 'complete' ELSE status END,
    completed_at = CASE WHEN next_achieved = total_points AND total_points > 0 THEN now() ELSE completed_at END,
    updated_at = now()
  WHERE id = c.id
  RETURNING * INTO c;

  INSERT INTO lc_progress_logs (user_id, cycle_id, delta, achieved_after, comment_html)
  VALUES (p_user_id, c.id, p_delta, next_achieved, NULLIF(btrim(p_comment_html), ''));

  RETURN c;
END $$;

-- Moves a cycle to another Kanban column (and position). Moving to complete
-- fills the remaining points, logged with p_comment_html.
CREATE OR REPLACE FUNCTION lc_set_status(p_user_id UUID, p_cycle_id UUID, p_status TEXT, p_sort_order INT DEFAULT NULL, p_comment_html TEXT DEFAULT NULL)
RETURNS lc_cycles
LANGUAGE plpgsql AS $$
DECLARE
  c lc_cycles%ROWTYPE;
  remaining INT;
BEGIN
  IF p_status NOT IN ('todo', 'hold', 'in_progress', 'complete', 'cancel') THEN
    RAISE EXCEPTION 'Unknown status' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO c FROM lc_cycles WHERE id = p_cycle_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cycle not found' USING ERRCODE = 'P0002';
  END IF;

  remaining := c.total_points - c.achieved_points;
  IF p_status = 'complete' AND c.status <> 'complete' AND remaining > 0 THEN
    INSERT INTO lc_progress_logs (user_id, cycle_id, delta, achieved_after, comment_html)
    VALUES (p_user_id, c.id, remaining, c.total_points, coalesce(NULLIF(btrim(p_comment_html), ''), '<p>Marked complete</p>'));
  END IF;

  UPDATE lc_cycles SET
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

------------------------------------------------------------------------------
-- RLS: same permissive policy as every other table in this project (see 001).
------------------------------------------------------------------------------

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['lc_domains', 'lc_topics', 'lc_topic_domains', 'lc_topic_links', 'lc_cycles', 'lc_progress_logs'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Allow all access" ON %I', t);
    EXECUTE format('CREATE POLICY "Allow all access" ON %I FOR ALL USING (true)', t);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
