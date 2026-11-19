-- Migration: 091_lp_content.sql
-- Life-Stage Parenting: the content batools edits and the app reads.
--
--   lp_stages              the 7 life stages (planning → teenage years)
--   lp_age_groups          finer ranges inside a stage (0–6 months, trimester 2…)
--   lp_domains             the 20 permanent knowledge domains (Medical, Nutrition…)
--   lp_categories          categories and subcategories (parent_id) under a domain
--   lp_stage_categories    which categories a stage / age group shows, in order
--   lp_sources             evidence: WHO, CDC, DGHS, Quran, hadith, culture…
--   lp_resources           every guide, video, checklist, scenario, emergency page
--   lp_resource_categories / lp_resource_sources / lp_resource_links
--   lp_task_templates      daily / weekly / monthly tasks the app schedules by age
--   lp_milestones          development, health and family milestones
--   lp_vaccines, lp_vaccine_schedules, lp_vaccine_doses   per-country schedules
--   lp_relation_types      father, mother, child and other family by blood degree
--   lp_achievements, lp_garden_levels                     gamification
--
-- Ages use the life-day axis (090): [min_day, max_day), day 0 = birth, a
-- pregnancy is negative, NULL = open. The app also ships this content (its
-- static fallback, generated into supabase/data/lp_seed.sql) and uses the
-- database copy of a table once that table has rows.
--
-- Medical, Islamic and cultural content is shown only when
-- review_status = 'approved' AND is_active.

DO $$
BEGIN
  IF to_regclass('public.lp_features') IS NULL THEN
    RAISE EXCEPTION 'Run 090_lp_core.sql first.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS lp_stages (
  key TEXT PRIMARY KEY CHECK (key ~ '^[a-z_]{2,40}$'),
  number SMALLINT NOT NULL UNIQUE,
  name JSONB NOT NULL,
  -- "Birth – 2 years"
  age_label JSONB NOT NULL DEFAULT '{}',
  objective JSONB NOT NULL DEFAULT '{}',
  description JSONB NOT NULL DEFAULT '{}',
  emoji TEXT,
  color TEXT,
  image_url TEXT,
  min_day INT,
  max_day INT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  CHECK (min_day IS NULL OR max_day IS NULL OR min_day < max_day)
);

CREATE TABLE IF NOT EXISTS lp_age_groups (
  key TEXT PRIMARY KEY CHECK (key ~ '^[a-z0-9_]{2,40}$'),
  stage_key TEXT NOT NULL REFERENCES lp_stages(key) ON UPDATE CASCADE,
  name JSONB NOT NULL,
  focus JSONB NOT NULL DEFAULT '{}',
  min_day INT,
  max_day INT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  CHECK (min_day IS NULL OR max_day IS NULL OR min_day < max_day)
);
CREATE INDEX IF NOT EXISTS lp_age_groups_stage ON lp_age_groups (stage_key, sort_order);

CREATE TABLE IF NOT EXISTS lp_domains (
  key TEXT PRIMARY KEY CHECK (key ~ '^[a-z_]{2,40}$'),
  name JSONB NOT NULL,
  description JSONB NOT NULL DEFAULT '{}',
  emoji TEXT,
  color TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

CREATE TABLE IF NOT EXISTS lp_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE CHECK (key ~ '^[a-z0-9_]{2,60}$'),
  -- A subcategory points at its category.
  parent_id UUID REFERENCES lp_categories(id) ON DELETE CASCADE,
  domain_key TEXT NOT NULL REFERENCES lp_domains(key) ON UPDATE CASCADE,
  name JSONB NOT NULL,
  description JSONB NOT NULL DEFAULT '{}',
  emoji TEXT,
  color TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  CHECK (parent_id IS DISTINCT FROM id)
);
CREATE INDEX IF NOT EXISTS lp_categories_parent ON lp_categories (parent_id);

CREATE TABLE IF NOT EXISTS lp_stage_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_key TEXT NOT NULL REFERENCES lp_stages(key) ON UPDATE CASCADE ON DELETE CASCADE,
  -- NULL = the whole stage.
  age_group_key TEXT REFERENCES lp_age_groups(key) ON UPDATE CASCADE ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES lp_categories(id) ON DELETE CASCADE,
  -- What this category covers at this stage, e.g. "Latching, positioning, feeding cues".
  focus JSONB NOT NULL DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS lp_stage_categories_once
  ON lp_stage_categories (stage_key, coalesce(age_group_key, ''), category_id);

CREATE TABLE IF NOT EXISTS lp_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE CHECK (key ~ '^[a-z0-9_]{2,60}$'),
  name TEXT NOT NULL,
  organization TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('guideline', 'systematic_review', 'research', 'national_policy',
                                     'quran', 'hadith', 'fiqh', 'scholar', 'cultural', 'other')),
  perspective TEXT NOT NULL CHECK (perspective IN ('scientific', 'islamic', 'cultural')),
  -- Only a link someone has opened and checked; never a guessed one.
  url TEXT,
  country TEXT,
  published_on DATE,
  checked_on DATE,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

CREATE TABLE IF NOT EXISTS lp_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{2,100}$'),
  kind TEXT NOT NULL CHECK (kind IN ('article', 'video', 'animation', 'audio', 'infographic', 'checklist',
                                     'quiz', 'scenario', 'emergency', 'story', 'activity')),
  perspective TEXT NOT NULL DEFAULT 'scientific' CHECK (perspective IN ('scientific', 'islamic', 'cultural', 'general')),
  audience TEXT NOT NULL DEFAULT 'shared' CHECK (audience IN ('mother', 'father', 'shared', 'child', 'family')),
  urgency TEXT NOT NULL DEFAULT 'educational' CHECK (urgency IN ('emergency', 'important', 'routine', 'educational')),
  evidence_level TEXT CHECK (evidence_level IN ('guideline', 'consensus', 'research', 'limited', 'religious', 'tradition')),
  emoji TEXT,
  title JSONB NOT NULL,
  summary JSONB NOT NULL DEFAULT '{}',
  -- Markdown per language.
  body JSONB NOT NULL DEFAULT '{}',
  -- Structured parts. Scenario: understand, why, normal, do_now, steps, avoid,
  -- example, seek_help, warning_signs. Emergency: signs, do_now, avoid.
  -- Checklist: items. Each value is {"en": …, "bn": …} (text or list).
  sections JSONB NOT NULL DEFAULT '{}',
  media_url TEXT,
  thumbnail_url TEXT,
  duration_seconds INT,
  reading_minutes SMALLINT,
  min_day INT,
  max_day INT,
  -- Empty = everywhere.
  countries TEXT[] NOT NULL DEFAULT '{}',
  -- Puberty and similar content.
  sex TEXT NOT NULL DEFAULT 'any' CHECK (sex IN ('any', 'female', 'male')),
  tags TEXT[] NOT NULL DEFAULT '{}',
  -- Who checked it (medical / Islamic reviewers' names), shown with the content.
  reviewer_names TEXT,
  next_review_at DATE,
  version INT NOT NULL DEFAULT 1,
  review_status lp_review_status NOT NULL DEFAULT 'draft',
  -- The batools user who approved it, and when.
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (min_day IS NULL OR max_day IS NULL OR min_day < max_day)
);
CREATE INDEX IF NOT EXISTS lp_resources_age ON lp_resources (min_day, max_day);
CREATE INDEX IF NOT EXISTS lp_resources_kind ON lp_resources (kind, sort_order);
CREATE INDEX IF NOT EXISTS lp_resources_tags ON lp_resources USING gin (tags);

CREATE TABLE IF NOT EXISTS lp_resource_categories (
  resource_id UUID NOT NULL REFERENCES lp_resources(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES lp_categories(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (resource_id, category_id)
);
CREATE INDEX IF NOT EXISTS lp_resource_categories_cat ON lp_resource_categories (category_id, sort_order);

CREATE TABLE IF NOT EXISTS lp_resource_sources (
  resource_id UUID NOT NULL REFERENCES lp_resources(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES lp_sources(id) ON DELETE RESTRICT,
  -- Page, section, hadith number…
  citation TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (resource_id, source_id)
);

CREATE TABLE IF NOT EXISTS lp_resource_links (
  resource_id UUID NOT NULL REFERENCES lp_resources(id) ON DELETE CASCADE,
  related_id UUID NOT NULL REFERENCES lp_resources(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (resource_id, related_id),
  CHECK (resource_id <> related_id)
);

CREATE TABLE IF NOT EXISTS lp_task_templates (
  key TEXT PRIMARY KEY CHECK (key ~ '^[a-z0-9_]{2,80}$'),
  title JSONB NOT NULL,
  description JSONB NOT NULL DEFAULT '{}',
  why JSONB NOT NULL DEFAULT '{}',
  benefit JSONB NOT NULL DEFAULT '{}',
  -- [{"en": "...", "bn": "..."}, …]
  steps JSONB NOT NULL DEFAULT '[]',
  safety_note JSONB NOT NULL DEFAULT '{}',
  task_type TEXT NOT NULL CHECK (task_type IN ('must_do', 'recommended', 'learn', 'observe', 'family')),
  frequency TEXT NOT NULL CHECK (frequency IN ('once', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
  -- Who usually does it; a family can reassign (lp_task_assignments, 092).
  assignee TEXT NOT NULL DEFAULT 'shared' CHECK (assignee IN ('mother', 'father', 'shared', 'any')),
  -- Whose age decides when it shows: the child's, the pregnancy's, or the family's journey.
  subject TEXT NOT NULL DEFAULT 'child' CHECK (subject IN ('child', 'pregnancy', 'planning', 'family')),
  min_day INT,
  max_day INT,
  estimated_minutes SMALLINT,
  xp SMALLINT NOT NULL DEFAULT 10 CHECK (xp BETWEEN 0 AND 200),
  emoji TEXT,
  category_key TEXT REFERENCES lp_categories(key) ON UPDATE CASCADE,
  resource_slug TEXT REFERENCES lp_resources(slug) ON UPDATE CASCADE ON DELETE SET NULL,
  source_key TEXT REFERENCES lp_sources(key) ON UPDATE CASCADE,
  countries TEXT[] NOT NULL DEFAULT '{}',
  sex TEXT NOT NULL DEFAULT 'any' CHECK (sex IN ('any', 'female', 'male')),
  review_status lp_review_status NOT NULL DEFAULT 'draft',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  CHECK (min_day IS NULL OR max_day IS NULL OR min_day < max_day)
);

CREATE TABLE IF NOT EXISTS lp_milestones (
  key TEXT PRIMARY KEY CHECK (key ~ '^[a-z0-9_]{2,80}$'),
  kind TEXT NOT NULL CHECK (kind IN ('development', 'health', 'family')),
  area TEXT NOT NULL CHECK (area IN ('social_emotional', 'language', 'cognitive', 'movement', 'self_care',
                                     'pregnancy', 'health', 'learning', 'islamic')),
  title JSONB NOT NULL,
  description JSONB NOT NULL DEFAULT '{}',
  how_to_support JSONB NOT NULL DEFAULT '{}',
  -- The checkpoint age: by this day most children (CDC: 75 % or more) show it.
  typical_day INT,
  emoji TEXT,
  source_key TEXT REFERENCES lp_sources(key) ON UPDATE CASCADE,
  review_status lp_review_status NOT NULL DEFAULT 'draft',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);
CREATE INDEX IF NOT EXISTS lp_milestones_day ON lp_milestones (typical_day);

CREATE TABLE IF NOT EXISTS lp_vaccines (
  key TEXT PRIMARY KEY CHECK (key ~ '^[a-z0-9_]{2,40}$'),
  name JSONB NOT NULL,
  short_name TEXT NOT NULL,
  protects_against JSONB NOT NULL DEFAULT '{}',
  common_reactions JSONB NOT NULL DEFAULT '{}',
  notes JSONB NOT NULL DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

CREATE TABLE IF NOT EXISTS lp_vaccine_schedules (
  key TEXT PRIMARY KEY CHECK (key ~ '^[a-z0-9_]{2,60}$'),
  country TEXT NOT NULL,
  -- National programme, a private paediatric schedule, or WHO's baseline: shown separately.
  kind TEXT NOT NULL CHECK (kind IN ('national', 'private', 'who')),
  name JSONB NOT NULL,
  notes JSONB NOT NULL DEFAULT '{}',
  effective_from DATE,
  version INT NOT NULL DEFAULT 1,
  source_key TEXT REFERENCES lp_sources(key) ON UPDATE CASCADE,
  is_default BOOLEAN NOT NULL DEFAULT false,
  review_status lp_review_status NOT NULL DEFAULT 'draft',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);
-- One default schedule per country.
CREATE UNIQUE INDEX IF NOT EXISTS lp_vaccine_schedules_default ON lp_vaccine_schedules (country) WHERE is_default;

CREATE TABLE IF NOT EXISTS lp_vaccine_doses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_key TEXT NOT NULL REFERENCES lp_vaccine_schedules(key) ON UPDATE CASCADE ON DELETE CASCADE,
  vaccine_key TEXT NOT NULL REFERENCES lp_vaccines(key) ON UPDATE CASCADE,
  dose_number SMALLINT NOT NULL CHECK (dose_number BETWEEN 1 AND 10),
  label JSONB NOT NULL DEFAULT '{}',
  -- 'child': due by the child's age; 'mother': women's doses (Td), timed by due_note.
  subject TEXT NOT NULL DEFAULT 'child' CHECK (subject IN ('child', 'mother')),
  -- Age day it is due (child). NULL for doses timed by an interval only.
  due_day INT,
  -- Last day the programme still gives it (catch-up limit), if any.
  latest_day INT,
  -- Interval after the previous dose, in days.
  min_interval_days INT,
  due_note JSONB NOT NULL DEFAULT '{}',
  sex TEXT NOT NULL DEFAULT 'any' CHECK (sex IN ('any', 'female', 'male')),
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE (schedule_key, vaccine_key, dose_number)
);

CREATE TABLE IF NOT EXISTS lp_relation_types (
  key TEXT PRIMARY KEY CHECK (key ~ '^[a-z_]{2,40}$'),
  -- Decides the member's colour theme: father, mother, child or family.
  group_key TEXT NOT NULL CHECK (group_key IN ('father', 'mother', 'child', 'family')),
  -- Blood relation to the family's children: 1 = first degree (parents,
  -- siblings), 2 = second (grandparents, aunts, uncles…), 3 = third
  -- (cousins, great-grandparents…), NULL = not by blood (in-laws, step, guardian).
  blood_degree SMALLINT CHECK (blood_degree BETWEEN 1 AND 3),
  side TEXT CHECK (side IN ('paternal', 'maternal')),
  name JSONB NOT NULL,
  -- Default app role when invited (092).
  default_role TEXT NOT NULL DEFAULT 'viewer' CHECK (default_role IN ('parent', 'guardian', 'caregiver', 'viewer', 'none')),
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS lp_achievements (
  key TEXT PRIMARY KEY CHECK (key ~ '^[a-z0-9_]{2,60}$'),
  name JSONB NOT NULL,
  description JSONB NOT NULL DEFAULT '{}',
  emoji TEXT,
  category TEXT NOT NULL CHECK (category IN ('learning', 'health_records', 'family', 'islamic', 'activities', 'development', 'safety')),
  -- {"kind": "tasks_done" | "resources_learned" | "records_added" | "streak_days" | "milestones_observed",
  --  "count": 10, "task_type": "learn", "category_key": "…"}
  rule JSONB NOT NULL,
  xp SMALLINT NOT NULL DEFAULT 50,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

CREATE TABLE IF NOT EXISTS lp_garden_levels (
  level SMALLINT PRIMARY KEY CHECK (level BETWEEN 1 AND 100),
  min_xp INT NOT NULL UNIQUE CHECK (min_xp >= 0),
  name JSONB NOT NULL,
  description JSONB NOT NULL DEFAULT '{}',
  emoji TEXT,
  image_url TEXT
);

-- updated_at ---------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['lp_stages', 'lp_age_groups', 'lp_domains', 'lp_categories', 'lp_sources', 'lp_resources',
                           'lp_task_templates', 'lp_milestones', 'lp_vaccines', 'lp_vaccine_schedules', 'lp_achievements'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_touch', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION lp_touch_updated_at()', t || '_touch', t);
  END LOOP;
END $$;

-- First approval stamps published_at.
CREATE OR REPLACE FUNCTION lp_resources_published() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.review_status = 'approved' AND NEW.published_at IS NULL THEN
    NEW.published_at := now();
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS lp_resources_published ON lp_resources;
CREATE TRIGGER lp_resources_published BEFORE INSERT OR UPDATE ON lp_resources
  FOR EACH ROW EXECUTE FUNCTION lp_resources_published();

-- Access -------------------------------------------------------------------
-- batools edits everything; the app reads what is switched on (and approved).
DO $$
DECLARE
  editor CONSTANT TEXT := '(SELECT private.lp_is_editor())';
  approved CONSTANT TEXT := 'is_active AND review_status = ''approved''';
  r RECORD;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('lp_stages', 'is_active'),
    ('lp_age_groups', 'is_active'),
    ('lp_domains', 'is_active'),
    ('lp_categories', 'is_active'),
    ('lp_stage_categories', 'true'),
    ('lp_sources', 'true'),
    ('lp_resources', approved),
    ('lp_resource_categories', 'true'),
    ('lp_resource_sources', 'true'),
    ('lp_resource_links', 'true'),
    ('lp_task_templates', approved),
    ('lp_milestones', approved),
    ('lp_vaccines', 'is_active'),
    ('lp_vaccine_schedules', approved),
    ('lp_vaccine_doses', 'true'),
    ('lp_relation_types', 'is_active'),
    ('lp_achievements', 'is_active'),
    ('lp_garden_levels', 'true')
  ) AS v(tbl, app_reads) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', r.tbl);
    EXECUTE format('DROP POLICY IF EXISTS "lp read" ON %I', r.tbl);
    EXECUTE format('DROP POLICY IF EXISTS "lp insert" ON %I', r.tbl);
    EXECUTE format('DROP POLICY IF EXISTS "lp update" ON %I', r.tbl);
    EXECUTE format('DROP POLICY IF EXISTS "lp delete" ON %I', r.tbl);
    EXECUTE format('CREATE POLICY "lp read" ON %I FOR SELECT TO anon, authenticated USING ((%s) OR %s)', r.tbl, r.app_reads, editor);
    EXECUTE format('CREATE POLICY "lp insert" ON %I FOR INSERT TO anon, authenticated WITH CHECK (%s)', r.tbl, editor);
    EXECUTE format('CREATE POLICY "lp update" ON %I FOR UPDATE TO anon, authenticated USING (%s) WITH CHECK (%s)', r.tbl, editor, editor);
    EXECUTE format('CREATE POLICY "lp delete" ON %I FOR DELETE TO anon, authenticated USING (%s)', r.tbl, editor);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
