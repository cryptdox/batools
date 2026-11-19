-- Migration: 094_lp_counters.sql
-- Life-Stage Parenting: counters — things a family counts against a target
-- (feeds 8 a day, tummy time 30 minutes, screen time at most 1 hour…).
--
--   lp_counter_templates  content batools edits (reviewed like tasks): unit, how
--                         it is entered (tap / timer / amount), target, at least
--                         or at most, per day / week / month, age range
--   lp_counters           a family's own counters, and its own target for a template
--   lp_counter_entries    every count, timer run or amount, by whom and when
--
-- Totals are summed per period in the family's time zone. Meeting an
-- "at least" target earns a little garden XP once per period
-- (lp_claim_counter_goal checks the sum in the database). An "at most" target
-- (screen time) never earns or loses anything.

DO $$
BEGIN
  IF to_regclass('public.lp_family_members') IS NULL OR to_regprocedure('private.lp_add_xp(uuid,text,text,integer)') IS NULL THEN
    RAISE EXCEPTION 'Run 090–093 first.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS lp_counter_templates (
  key TEXT PRIMARY KEY CHECK (key ~ '^[a-z0-9_]{2,80}$'),
  title JSONB NOT NULL,
  description JSONB NOT NULL DEFAULT '{}',
  why JSONB NOT NULL DEFAULT '{}',
  safety_note JSONB NOT NULL DEFAULT '{}',
  emoji TEXT,
  unit TEXT NOT NULL CHECK (unit IN ('times', 'minutes', 'hours', 'glasses', 'ml', 'pages', 'tablets')),
  -- tap: +step each tap · timer: start / stop adds minutes · amount: type a number.
  input TEXT NOT NULL DEFAULT 'tap' CHECK (input IN ('tap', 'timer', 'amount')),
  step NUMERIC(8, 2) NOT NULL DEFAULT 1 CHECK (step > 0),
  target NUMERIC(10, 2) CHECK (target >= 0),
  target_kind TEXT NOT NULL DEFAULT 'at_least' CHECK (target_kind IN ('at_least', 'at_most')),
  period TEXT NOT NULL DEFAULT 'day' CHECK (period IN ('day', 'week', 'month')),
  subject TEXT NOT NULL DEFAULT 'child' CHECK (subject IN ('child', 'pregnancy', 'planning', 'family')),
  min_day INT,
  max_day INT,
  sex TEXT NOT NULL DEFAULT 'any' CHECK (sex IN ('any', 'female', 'male')),
  xp SMALLINT NOT NULL DEFAULT 5 CHECK (xp BETWEEN 0 AND 100),
  category_key TEXT REFERENCES lp_categories(key) ON UPDATE CASCADE,
  source_key TEXT REFERENCES lp_sources(key) ON UPDATE CASCADE,
  review_status lp_review_status NOT NULL DEFAULT 'draft',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  CHECK (min_day IS NULL OR max_day IS NULL OR min_day < max_day)
);

-- A family's own counter (title set), or its own settings for a template
-- (template_key set): another target, or hidden.
CREATE TABLE IF NOT EXISTS lp_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES lp_families(id) ON DELETE CASCADE,
  template_key TEXT REFERENCES lp_counter_templates(key) ON UPDATE CASCADE ON DELETE CASCADE,
  -- Whom it is about (a child, the mother); NULL = the whole family.
  member_id UUID,
  title TEXT CHECK (char_length(title) <= 80),
  emoji TEXT,
  unit TEXT CHECK (unit IN ('times', 'minutes', 'hours', 'glasses', 'ml', 'pages', 'tablets')),
  input TEXT CHECK (input IN ('tap', 'timer', 'amount')),
  step NUMERIC(8, 2) CHECK (step > 0),
  target NUMERIC(10, 2) CHECK (target >= 0),
  target_kind TEXT CHECK (target_kind IN ('at_least', 'at_most')),
  period TEXT CHECK (period IN ('day', 'week', 'month')),
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_by UUID NOT NULL DEFAULT private.lp_uid(),
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (member_id, family_id) REFERENCES lp_family_members(id, family_id) ON DELETE CASCADE,
  -- Own counters need their own name, unit and target kind.
  CHECK (template_key IS NOT NULL OR (title IS NOT NULL AND unit IS NOT NULL AND input IS NOT NULL AND period IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS lp_counters_template_once ON lp_counters (family_id, template_key) WHERE template_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS lp_counter_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES lp_families(id) ON DELETE CASCADE,
  member_id UUID,
  template_key TEXT REFERENCES lp_counter_templates(key) ON UPDATE CASCADE ON DELETE CASCADE,
  counter_id UUID REFERENCES lp_counters(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0 AND amount <= 100000),
  -- Timer runs: when it started (at = when it stopped).
  started_at TIMESTAMPTZ,
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT CHECK (char_length(note) <= 500),
  created_by UUID NOT NULL DEFAULT private.lp_uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (member_id, family_id) REFERENCES lp_family_members(id, family_id) ON DELETE CASCADE,
  CHECK ((template_key IS NULL) <> (counter_id IS NULL)),
  CHECK (started_at IS NULL OR started_at <= at)
);
CREATE INDEX IF NOT EXISTS lp_counter_entries_family_at ON lp_counter_entries (family_id, at DESC);

DROP TRIGGER IF EXISTS lp_counter_templates_touch ON lp_counter_templates;
CREATE TRIGGER lp_counter_templates_touch BEFORE UPDATE ON lp_counter_templates FOR EACH ROW EXECUTE FUNCTION lp_touch_updated_at();
DROP TRIGGER IF EXISTS lp_counters_touch ON lp_counters;
CREATE TRIGGER lp_counters_touch BEFORE UPDATE ON lp_counters FOR EACH ROW EXECUTE FUNCTION private.lp_record_touch();

-- XP may now come from a counter goal.
ALTER TABLE lp_xp_events DROP CONSTRAINT IF EXISTS lp_xp_events_source_check;
ALTER TABLE lp_xp_events ADD CONSTRAINT lp_xp_events_source_check CHECK (source IN ('task', 'resource', 'milestone', 'achievement', 'counter'));

-- Moving a device person into an account (093) now carries counters too.
-- Moves everything device person p_from made into account p_to.
CREATE OR REPLACE FUNCTION private.lp_merge_person(p_from UUID, p_to UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  dm lp_family_members;
  am UUID;
  pair RECORD;
BEGIN
  PERFORM set_config('lp.trusted', 'on', true);

  FOR dm IN SELECT * FROM lp_family_members WHERE user_id = p_from LOOP
    SELECT id INTO am FROM lp_family_members WHERE family_id = dm.family_id AND user_id = p_to;
    IF am IS NULL THEN
      -- The account takes over the device's place in the family.
      UPDATE lp_family_members SET user_id = p_to WHERE id = dm.id;
    ELSE
      -- Both are in this family: keep the account's row, move the device row's records onto it.
      DELETE FROM lp_milestone_records x WHERE x.member_id = dm.id
        AND EXISTS (SELECT 1 FROM lp_milestone_records y WHERE y.member_id = am AND y.milestone_key = x.milestone_key);
      DELETE FROM lp_task_logs x WHERE x.member_id = dm.id
        AND EXISTS (SELECT 1 FROM lp_task_logs y WHERE y.member_id = am AND y.family_id = x.family_id
                    AND coalesce(y.template_key, y.custom_task_id::text) = coalesce(x.template_key, x.custom_task_id::text) AND y.period_key = x.period_key);
      FOR pair IN SELECT * FROM (VALUES
        ('lp_pregnancies', 'member_id'), ('lp_cycle_logs', 'member_id'), ('lp_growth_records', 'member_id'),
        ('lp_documents', 'member_id'), ('lp_vaccinations', 'member_id'), ('lp_appointments', 'member_id'),
        ('lp_appointments', 'escort_member_id'), ('lp_medicines', 'member_id'), ('lp_allergies', 'member_id'),
        ('lp_health_events', 'member_id'), ('lp_milestone_records', 'member_id'), ('lp_custom_tasks', 'member_id'),
        ('lp_custom_tasks', 'assignee_member_id'), ('lp_task_assignments', 'assignee_member_id'), ('lp_task_logs', 'member_id'),
        ('lp_counters', 'member_id'), ('lp_counter_entries', 'member_id')
      ) AS v(tbl, col) LOOP
        EXECUTE format('UPDATE %I SET %I = $1 WHERE %I = $2', pair.tbl, pair.col, pair.col) USING am, dm.id;
      END LOOP;
      IF dm.app_role = 'owner' THEN
        UPDATE lp_family_members SET app_role = 'owner' WHERE id = am;
      END IF;
      DELETE FROM lp_family_members WHERE id = dm.id;
    END IF;
  END LOOP;

  -- Authorship and personal progress.
  FOR pair IN SELECT * FROM (VALUES
    ('lp_pregnancies', 'created_by'), ('lp_cycle_logs', 'created_by'), ('lp_growth_records', 'created_by'),
    ('lp_documents', 'created_by'), ('lp_vaccinations', 'created_by'), ('lp_appointments', 'created_by'),
    ('lp_medicines', 'created_by'), ('lp_allergies', 'created_by'), ('lp_health_events', 'created_by'),
    ('lp_milestone_records', 'created_by'), ('lp_custom_tasks', 'created_by'), ('lp_task_logs', 'done_by'),
    ('lp_families', 'created_by'), ('lp_family_members', 'invited_by'),
    ('lp_counters', 'created_by'), ('lp_counter_entries', 'created_by')
  ) AS v(tbl, col) LOOP
    EXECUTE format('UPDATE %I SET %I = $1 WHERE %I = $2', pair.tbl, pair.col, pair.col) USING p_to, p_from;
  END LOOP;

  INSERT INTO lp_resource_progress (user_id, resource_id, bookmarked, learned_at, last_opened_at, progress, note)
  SELECT p_to, resource_id, bookmarked, learned_at, last_opened_at, progress, note FROM lp_resource_progress WHERE user_id = p_from
  ON CONFLICT (user_id, resource_id) DO NOTHING;
  INSERT INTO lp_xp_events (family_id, user_id, source, ref, xp, created_at)
  SELECT family_id, p_to, source, ref, xp, created_at FROM lp_xp_events WHERE user_id = p_from
  ON CONFLICT (family_id, user_id, source, ref) DO NOTHING;
  INSERT INTO lp_user_achievements (family_id, user_id, achievement_key, earned_at)
  SELECT family_id, p_to, achievement_key, earned_at FROM lp_user_achievements WHERE user_id = p_from
  ON CONFLICT DO NOTHING;

  -- The account keeps its own settings; it takes the device's where it has none.
  UPDATE lp_users a SET
    display_name = coalesce(a.display_name, d.display_name),
    active_family_id = coalesce(a.active_family_id, d.active_family_id),
    health_consent_at = coalesce(a.health_consent_at, d.health_consent_at),
    terms_accepted_at = coalesce(a.terms_accepted_at, d.terms_accepted_at)
  FROM lp_users d WHERE a.id = p_to AND d.id = p_from;
  UPDATE lp_family_members SET invited_user_id = p_to WHERE invited_user_id = p_from;
  UPDATE lp_devices SET user_id = p_to, linked_at = now() WHERE user_id = p_from;
  DELETE FROM lp_users WHERE id = p_from;

  PERFORM set_config('lp.trusted', '', true);
END $$;
REVOKE ALL ON FUNCTION private.lp_merge_person(UUID, UUID) FROM PUBLIC;

-- Access ------------------------------------------------------------------------
DO $$
DECLARE me CONSTANT TEXT := '(SELECT private.lp_uid())';
BEGIN
  ALTER TABLE lp_counter_templates ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "lp read" ON lp_counter_templates;
  DROP POLICY IF EXISTS "lp insert" ON lp_counter_templates;
  DROP POLICY IF EXISTS "lp update" ON lp_counter_templates;
  DROP POLICY IF EXISTS "lp delete" ON lp_counter_templates;
  CREATE POLICY "lp read" ON lp_counter_templates FOR SELECT TO anon, authenticated
    USING ((is_active AND review_status = 'approved') OR (SELECT private.lp_is_editor()));
  CREATE POLICY "lp insert" ON lp_counter_templates FOR INSERT TO anon, authenticated WITH CHECK ((SELECT private.lp_is_editor()));
  CREATE POLICY "lp update" ON lp_counter_templates FOR UPDATE TO anon, authenticated
    USING ((SELECT private.lp_is_editor())) WITH CHECK ((SELECT private.lp_is_editor()));
  CREATE POLICY "lp delete" ON lp_counter_templates FOR DELETE TO anon, authenticated USING ((SELECT private.lp_is_editor()));

  -- The family reads; members who do tasks count and set counters.
  ALTER TABLE lp_counters ENABLE ROW LEVEL SECURITY;
  ALTER TABLE lp_counter_entries ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "lp read" ON lp_counters;
  DROP POLICY IF EXISTS "lp insert" ON lp_counters;
  DROP POLICY IF EXISTS "lp update" ON lp_counters;
  DROP POLICY IF EXISTS "lp delete" ON lp_counters;
  DROP POLICY IF EXISTS "lp read" ON lp_counter_entries;
  DROP POLICY IF EXISTS "lp insert" ON lp_counter_entries;
  DROP POLICY IF EXISTS "lp delete" ON lp_counter_entries;
  CREATE POLICY "lp read" ON lp_counters FOR SELECT TO anon, authenticated USING (family_id = ANY ((SELECT private.lp_families('read'))::uuid[]));
  EXECUTE format('CREATE POLICY "lp insert" ON lp_counters FOR INSERT TO anon, authenticated WITH CHECK (family_id = ANY ((SELECT private.lp_families(''tasks''))::uuid[]) AND created_by = %s)', me);
  CREATE POLICY "lp update" ON lp_counters FOR UPDATE TO anon, authenticated
    USING (family_id = ANY ((SELECT private.lp_families('tasks'))::uuid[])) WITH CHECK (family_id = ANY ((SELECT private.lp_families('tasks'))::uuid[]));
  CREATE POLICY "lp delete" ON lp_counters FOR DELETE TO anon, authenticated USING (family_id = ANY ((SELECT private.lp_families('tasks'))::uuid[]));
  CREATE POLICY "lp read" ON lp_counter_entries FOR SELECT TO anon, authenticated USING (family_id = ANY ((SELECT private.lp_families('read'))::uuid[]));
  EXECUTE format('CREATE POLICY "lp insert" ON lp_counter_entries FOR INSERT TO anon, authenticated WITH CHECK (family_id = ANY ((SELECT private.lp_families(''tasks''))::uuid[]) AND created_by = %s)', me);
  -- Your own entries (a mistaken tap), or any entry for a parent.
  EXECUTE format('CREATE POLICY "lp delete" ON lp_counter_entries FOR DELETE TO anon, authenticated USING (family_id = ANY ((SELECT private.lp_families(''tasks''))::uuid[]) AND (created_by = %s OR family_id = ANY ((SELECT private.lp_families(''manage''))::uuid[])))', me);
END $$;

-- The start of the current day / week / month in the family's time zone.
CREATE OR REPLACE FUNCTION private.lp_period_start(p_period TEXT, p_tz TEXT)
RETURNS TIMESTAMPTZ LANGUAGE sql STABLE AS $$
  SELECT date_trunc(p_period, now() AT TIME ZONE p_tz) AT TIME ZONE p_tz
$$;

-- XP once per period when an "at least" target is reached. The sum, the
-- target and the period are all worked out here, not by the app.
CREATE OR REPLACE FUNCTION public.lp_claim_counter_goal(
  p_family_id UUID, p_template_key TEXT DEFAULT NULL, p_counter_id UUID DEFAULT NULL, p_member_id UUID DEFAULT NULL)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  tz TEXT;
  tpl lp_counter_templates;
  own lp_counters;
  v_target NUMERIC;
  v_kind TEXT;
  v_period TEXT;
  v_xp INT;
  since TIMESTAMPTZ;
  total NUMERIC;
BEGIN
  IF NOT p_family_id = ANY (private.lp_families('tasks')) THEN RETURN 0; END IF;
  SELECT timezone INTO tz FROM lp_families WHERE id = p_family_id;
  IF p_template_key IS NOT NULL THEN
    SELECT * INTO tpl FROM lp_counter_templates WHERE key = p_template_key;
    SELECT * INTO own FROM lp_counters WHERE family_id = p_family_id AND template_key = p_template_key;
    v_target := coalesce(own.target, tpl.target);
    v_kind := coalesce(own.target_kind, tpl.target_kind);
    v_period := coalesce(own.period, tpl.period);
    v_xp := coalesce(tpl.xp, 5);
  ELSE
    SELECT * INTO own FROM lp_counters WHERE id = p_counter_id AND family_id = p_family_id;
    IF own.id IS NULL THEN RETURN 0; END IF;
    v_target := own.target;
    v_kind := coalesce(own.target_kind, 'at_least');
    v_period := own.period;
    v_xp := 5;
  END IF;
  IF v_target IS NULL OR v_target <= 0 OR v_kind <> 'at_least' THEN RETURN 0; END IF;

  since := private.lp_period_start(v_period, coalesce(tz, 'Asia/Dhaka'));
  SELECT coalesce(sum(amount), 0) INTO total FROM lp_counter_entries
  WHERE family_id = p_family_id AND at >= since
    AND template_key IS NOT DISTINCT FROM p_template_key AND counter_id IS NOT DISTINCT FROM p_counter_id
    AND member_id IS NOT DISTINCT FROM p_member_id;
  IF total < v_target THEN RETURN 0; END IF;

  RETURN private.lp_add_xp(p_family_id, 'counter',
    coalesce(p_template_key, p_counter_id::text) || ':' || coalesce(p_member_id::text, '-') || ':' || to_char(since AT TIME ZONE coalesce(tz, 'Asia/Dhaka'), 'YYYY-MM-DD'),
    v_xp);
END $$;
REVOKE ALL ON FUNCTION public.lp_claim_counter_goal(UUID, TEXT, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lp_claim_counter_goal(UUID, TEXT, UUID, UUID) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
