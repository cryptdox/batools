-- Migration: 092_lp_family.sql
-- Life-Stage Parenting: the data the app's signed-in users own.
--
--   lp_users                one row per IAM user of the parenting realm
--   lp_families             a family account (several children, several carers)
--   lp_family_members       everyone in the family: father, mother, children and
--                           other family by blood degree (lp_relation_types).
--                           A member may or may not have an account (user_id).
--   lp_child_profiles       birth details of a child member
--   lp_pregnancies          a mother member's pregnancy (children link back)
--   lp_cycle_logs           planning stage: cycle tracking (private by default)
--   health records          lp_growth_records, lp_vaccinations, lp_appointments,
--                           lp_medicines, lp_allergies, lp_health_events,
--                           lp_documents, lp_milestone_records
--   tasks                   lp_custom_tasks, lp_task_assignments, lp_task_logs
--   learning                lp_resource_progress (per user)
--   gamification            lp_xp_events, lp_user_achievements
--
-- Access (all through the x-lp-token of the parenting realm, 090):
--   * A member with an account gets what its role allows:
--       owner      everything, incl. members and roles; a family always keeps one
--       parent     everything except granting / removing 'owner'
--       guardian   health records (read + write) and tasks
--       caregiver  reads health records (allergies, medicines…) and does tasks
--       viewer     sees the family, children and the journey; no health records
--     The four switches (can_manage, can_view_health, can_edit_health,
--     can_do_tasks) start from the role and the family's managers may adjust them.
--   * is_private on a record: only the member who wrote it sees it (a mother's
--     own notes, cycle logs).
--   * batools (CRYPTDOX token) never sees family data.
-- Joining, leaving, deleting and XP go through the functions at the end.

DO $$
BEGIN
  IF to_regclass('public.lp_relation_types') IS NULL THEN
    RAISE EXCEPTION 'Run 090_lp_core.sql and 091_lp_content.sql first.';
  END IF;
END $$;

-- People and families ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS lp_users (
  -- The IAM userId.
  id UUID PRIMARY KEY,
  email TEXT,
  display_name TEXT CHECK (char_length(display_name) <= 80),
  phone TEXT CHECK (char_length(phone) <= 30),
  avatar_path TEXT,
  language TEXT NOT NULL DEFAULT 'bn' CHECK (language IN ('bn', 'en')),
  country TEXT NOT NULL DEFAULT 'BD',
  timezone TEXT NOT NULL DEFAULT 'Asia/Dhaka',
  theme_mode TEXT NOT NULL DEFAULT 'system' CHECK (theme_mode IN ('light', 'dark', 'system')),
  -- Notifications, quiet hours, text size, reduced motion…
  settings JSONB NOT NULL DEFAULT '{}',
  active_family_id UUID,
  terms_accepted_at TIMESTAMPTZ,
  health_consent_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lp_families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  country TEXT NOT NULL DEFAULT 'BD',
  timezone TEXT NOT NULL DEFAULT 'Asia/Dhaka',
  -- Stage 1 (planning for a baby) is on for this family.
  is_planning BOOLEAN NOT NULL DEFAULT false,
  planning_since DATE,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  ALTER TABLE lp_users ADD CONSTRAINT lp_users_active_family
    FOREIGN KEY (active_family_id) REFERENCES lp_families(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS lp_family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES lp_families(id) ON DELETE CASCADE,
  -- Set only when the person joins (lp_create_family / lp_accept_invite).
  user_id UUID REFERENCES lp_users(id) ON DELETE SET NULL,
  -- Relation to the family's children: father, mother, child, grandmother…
  relation_key TEXT NOT NULL REFERENCES lp_relation_types(key) ON UPDATE CASCADE,
  display_name TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 80),
  sex TEXT CHECK (sex IN ('female', 'male')),
  birth_date DATE,
  avatar_path TEXT,
  app_role TEXT NOT NULL DEFAULT 'none' CHECK (app_role IN ('owner', 'parent', 'guardian', 'caregiver', 'viewer', 'none')),
  can_manage BOOLEAN NOT NULL DEFAULT false,
  can_view_health BOOLEAN NOT NULL DEFAULT false,
  can_edit_health BOOLEAN NOT NULL DEFAULT false,
  can_do_tasks BOOLEAN NOT NULL DEFAULT false,
  invite_email TEXT CHECK (char_length(invite_email) <= 200),
  invite_code TEXT UNIQUE,
  invite_status TEXT NOT NULL DEFAULT 'none' CHECK (invite_status IN ('none', 'pending', 'accepted', 'declined', 'revoked')),
  invited_by UUID,
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Records point at (member, family) so a record can't name another family's member.
  UNIQUE (id, family_id),
  CHECK (user_id IS NULL OR app_role <> 'none'),
  CHECK (app_role <> 'owner' OR user_id IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS lp_family_members_user ON lp_family_members (family_id, user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS lp_family_members_by_user ON lp_family_members (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS lp_family_members_invite ON lp_family_members (lower(invite_email)) WHERE invite_status = 'pending';

-- Children and pregnancies ------------------------------------------------------

CREATE TABLE IF NOT EXISTS lp_pregnancies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES lp_families(id) ON DELETE CASCADE,
  member_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'delivered', 'ended')),
  lmp_date DATE,
  edd_date DATE,
  dating_method TEXT NOT NULL DEFAULT 'lmp' CHECK (dating_method IN ('lmp', 'ultrasound', 'ivf', 'unknown')),
  fetus_count SMALLINT NOT NULL DEFAULT 1 CHECK (fetus_count BETWEEN 1 AND 6),
  ended_on DATE,
  notes TEXT CHECK (char_length(notes) <= 4000),
  is_private BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL DEFAULT private.lp_uid(),
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (member_id, family_id) REFERENCES lp_family_members(id, family_id) ON DELETE CASCADE,
  CHECK (lmp_date IS NOT NULL OR edd_date IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS lp_pregnancies_family ON lp_pregnancies (family_id, status);

CREATE TABLE IF NOT EXISTS lp_child_profiles (
  member_id UUID PRIMARY KEY,
  family_id UUID NOT NULL REFERENCES lp_families(id) ON DELETE CASCADE,
  pregnancy_id UUID REFERENCES lp_pregnancies(id) ON DELETE SET NULL,
  birth_date DATE NOT NULL,
  birth_time TIME,
  birth_place TEXT CHECK (char_length(birth_place) <= 200),
  birth_weight_g INT CHECK (birth_weight_g BETWEEN 300 AND 7000),
  birth_length_cm NUMERIC(4, 1) CHECK (birth_length_cm BETWEEN 20 AND 70),
  birth_head_cm NUMERIC(4, 1) CHECK (birth_head_cm BETWEEN 15 AND 50),
  gestational_weeks_at_birth SMALLINT CHECK (gestational_weeks_at_birth BETWEEN 20 AND 45),
  gestational_days_at_birth SMALLINT CHECK (gestational_days_at_birth BETWEEN 0 AND 6),
  delivery_type TEXT CHECK (delivery_type IN ('vaginal', 'caesarean', 'assisted', 'other')),
  blood_group TEXT CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  -- Decides the vaccine schedule and cultural content.
  country TEXT NOT NULL DEFAULT 'BD',
  vaccine_schedule_key TEXT REFERENCES lp_vaccine_schedules(key) ON UPDATE CASCADE ON DELETE SET NULL,
  -- Born before 37 weeks: the app uses corrected age for development until 2 years.
  use_corrected_age BOOLEAN NOT NULL DEFAULT true,
  notes TEXT CHECK (char_length(notes) <= 4000),
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (member_id, family_id) REFERENCES lp_family_members(id, family_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lp_cycle_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES lp_families(id) ON DELETE CASCADE,
  member_id UUID NOT NULL,
  started_on DATE NOT NULL,
  ended_on DATE,
  flow TEXT CHECK (flow IN ('light', 'medium', 'heavy')),
  symptoms TEXT[] NOT NULL DEFAULT '{}',
  note TEXT CHECK (char_length(note) <= 2000),
  is_private BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL DEFAULT private.lp_uid(),
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (member_id, family_id) REFERENCES lp_family_members(id, family_id) ON DELETE CASCADE,
  CHECK (ended_on IS NULL OR ended_on >= started_on)
);

-- Health records ------------------------------------------------------------------
-- Each one is about a member (member_id), carries is_private and who wrote it.

CREATE TABLE IF NOT EXISTS lp_growth_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES lp_families(id) ON DELETE CASCADE,
  member_id UUID NOT NULL,
  measured_on DATE NOT NULL,
  weight_g INT CHECK (weight_g BETWEEN 300 AND 250000),
  length_cm NUMERIC(5, 1) CHECK (length_cm BETWEEN 20 AND 250),
  head_cm NUMERIC(4, 1) CHECK (head_cm BETWEEN 15 AND 70),
  -- Lying down (under 2) or standing.
  length_method TEXT CHECK (length_method IN ('lying', 'standing')),
  note TEXT CHECK (char_length(note) <= 1000),
  is_private BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL DEFAULT private.lp_uid(),
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (member_id, family_id) REFERENCES lp_family_members(id, family_id) ON DELETE CASCADE,
  CHECK (weight_g IS NOT NULL OR length_cm IS NOT NULL OR head_cm IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS lp_growth_records_member ON lp_growth_records (member_id, measured_on);

CREATE TABLE IF NOT EXISTS lp_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES lp_families(id) ON DELETE CASCADE,
  member_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('prescription', 'report', 'vaccine_card', 'lab', 'scan', 'discharge', 'other')),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  document_date DATE,
  -- In the private 'lp-family' bucket: <family_id>/docs/<uuid>.<ext>
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INT CHECK (size_bytes <= 10485760),
  note TEXT CHECK (char_length(note) <= 1000),
  is_private BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL DEFAULT private.lp_uid(),
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (member_id, family_id) REFERENCES lp_family_members(id, family_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lp_vaccinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES lp_families(id) ON DELETE CASCADE,
  member_id UUID NOT NULL,
  -- The schedule's dose it fulfils; NULL for a vaccine outside the schedule.
  dose_id UUID REFERENCES lp_vaccine_doses(id) ON DELETE SET NULL,
  vaccine_key TEXT REFERENCES lp_vaccines(key) ON UPDATE CASCADE,
  vaccine_name TEXT CHECK (char_length(vaccine_name) <= 120),
  dose_number SMALLINT,
  status TEXT NOT NULL DEFAULT 'given' CHECK (status IN ('given', 'scheduled', 'skipped', 'unknown')),
  given_on DATE,
  scheduled_on DATE,
  place TEXT CHECK (char_length(place) <= 200),
  provider TEXT CHECK (char_length(provider) <= 200),
  batch_no TEXT CHECK (char_length(batch_no) <= 60),
  reaction_note TEXT CHECK (char_length(reaction_note) <= 1000),
  document_id UUID REFERENCES lp_documents(id) ON DELETE SET NULL,
  is_private BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL DEFAULT private.lp_uid(),
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (member_id, family_id) REFERENCES lp_family_members(id, family_id) ON DELETE CASCADE,
  CHECK (vaccine_key IS NOT NULL OR vaccine_name IS NOT NULL),
  CHECK (status <> 'given' OR given_on IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS lp_vaccinations_member ON lp_vaccinations (member_id);

CREATE TABLE IF NOT EXISTS lp_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES lp_families(id) ON DELETE CASCADE,
  member_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('antenatal', 'postnatal', 'checkup', 'vaccination', 'dental', 'vision', 'hearing',
                                     'specialist', 'therapy', 'other')),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  place TEXT CHECK (char_length(place) <= 200),
  doctor TEXT CHECK (char_length(doctor) <= 200),
  -- Questions to ask, observations to mention.
  prep_notes TEXT CHECK (char_length(prep_notes) <= 4000),
  outcome_notes TEXT CHECK (char_length(outcome_notes) <= 4000),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'done', 'cancelled', 'missed')),
  -- Minutes before: the app schedules local notifications.
  remind_minutes INT[] NOT NULL DEFAULT '{1440,60}',
  -- The family member who takes the person.
  escort_member_id UUID,
  is_private BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL DEFAULT private.lp_uid(),
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (member_id, family_id) REFERENCES lp_family_members(id, family_id) ON DELETE CASCADE,
  FOREIGN KEY (escort_member_id, family_id) REFERENCES lp_family_members(id, family_id) ON DELETE SET NULL (escort_member_id),
  CHECK (ends_at IS NULL OR ends_at >= starts_at)
);
CREATE INDEX IF NOT EXISTS lp_appointments_family ON lp_appointments (family_id, starts_at);

CREATE TABLE IF NOT EXISTS lp_medicines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES lp_families(id) ON DELETE CASCADE,
  member_id UUID NOT NULL,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  -- As written on the prescription; the app never suggests a dose.
  dose TEXT CHECK (char_length(dose) <= 200),
  how_often TEXT CHECK (char_length(how_often) <= 200),
  reason TEXT CHECK (char_length(reason) <= 500),
  prescribed_by TEXT CHECK (char_length(prescribed_by) <= 200),
  starts_on DATE,
  ends_on DATE,
  reminder_times TIME[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_private BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL DEFAULT private.lp_uid(),
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (member_id, family_id) REFERENCES lp_family_members(id, family_id) ON DELETE CASCADE,
  CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on)
);

CREATE TABLE IF NOT EXISTS lp_allergies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES lp_families(id) ON DELETE CASCADE,
  member_id UUID NOT NULL,
  allergen TEXT NOT NULL CHECK (char_length(allergen) BETWEEN 1 AND 200),
  kind TEXT NOT NULL DEFAULT 'other' CHECK (kind IN ('food', 'medicine', 'environment', 'insect', 'other')),
  reaction TEXT CHECK (char_length(reaction) <= 1000),
  severity TEXT NOT NULL DEFAULT 'unknown' CHECK (severity IN ('mild', 'moderate', 'severe', 'unknown')),
  noted_on DATE,
  confirmed_by_doctor BOOLEAN NOT NULL DEFAULT false,
  is_private BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL DEFAULT private.lp_uid(),
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (member_id, family_id) REFERENCES lp_family_members(id, family_id) ON DELETE CASCADE
);

-- Medical history and day-to-day observations (illness, symptom, lab result…).
CREATE TABLE IF NOT EXISTS lp_health_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES lp_families(id) ON DELETE CASCADE,
  member_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('illness', 'symptom', 'observation', 'hospitalization', 'surgery', 'lab', 'injury',
                                     'wellbeing', 'feeding', 'other')),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  occurred_on DATE NOT NULL,
  ended_on DATE,
  details TEXT CHECK (char_length(details) <= 4000),
  -- Numbers some kinds keep, e.g. {"temperature_c": 38.4} or {"mood": 3}.
  values JSONB NOT NULL DEFAULT '{}',
  document_id UUID REFERENCES lp_documents(id) ON DELETE SET NULL,
  is_private BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL DEFAULT private.lp_uid(),
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (member_id, family_id) REFERENCES lp_family_members(id, family_id) ON DELETE CASCADE,
  CHECK (ended_on IS NULL OR ended_on >= occurred_on)
);
CREATE INDEX IF NOT EXISTS lp_health_events_member ON lp_health_events (member_id, occurred_on DESC);

CREATE TABLE IF NOT EXISTS lp_milestone_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES lp_families(id) ON DELETE CASCADE,
  member_id UUID NOT NULL,
  milestone_key TEXT NOT NULL REFERENCES lp_milestones(key) ON UPDATE CASCADE ON DELETE CASCADE,
  -- Never a pass / fail: observed, not yet, unsure, or talked about with a professional.
  status TEXT NOT NULL CHECK (status IN ('observed', 'not_yet', 'unsure', 'discussed')),
  observed_on DATE,
  note TEXT CHECK (char_length(note) <= 1000),
  is_private BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL DEFAULT private.lp_uid(),
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (member_id, family_id) REFERENCES lp_family_members(id, family_id) ON DELETE CASCADE,
  UNIQUE (member_id, milestone_key)
);

-- Tasks -------------------------------------------------------------------------
-- Template tasks are not stored per day: the app works out today's list from
-- lp_task_templates and the ages, and lp_task_logs keeps what was done in each
-- period (day 2026-11-19, week 2026-W47, month 2026-11, quarter 2026-Q4, year
-- 2026, or 'once').

CREATE TABLE IF NOT EXISTS lp_custom_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES lp_families(id) ON DELETE CASCADE,
  -- Who it is for (a child, the mother…); NULL = the whole family.
  member_id UUID,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description TEXT CHECK (char_length(description) <= 2000),
  emoji TEXT,
  frequency TEXT NOT NULL DEFAULT 'once' CHECK (frequency IN ('once', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
  assignee_member_id UUID,
  due_on DATE,
  remind_at TIME,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL DEFAULT private.lp_uid(),
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (member_id, family_id) REFERENCES lp_family_members(id, family_id) ON DELETE CASCADE,
  FOREIGN KEY (assignee_member_id, family_id) REFERENCES lp_family_members(id, family_id) ON DELETE SET NULL (assignee_member_id)
);

-- A family's own choice of who does a template task (default: the template's assignee).
CREATE TABLE IF NOT EXISTS lp_task_assignments (
  family_id UUID NOT NULL REFERENCES lp_families(id) ON DELETE CASCADE,
  template_key TEXT NOT NULL REFERENCES lp_task_templates(key) ON UPDATE CASCADE ON DELETE CASCADE,
  assignee_member_id UUID,
  -- The family switched this task off.
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  remind_at TIME,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (family_id, template_key),
  FOREIGN KEY (assignee_member_id, family_id) REFERENCES lp_family_members(id, family_id) ON DELETE SET NULL (assignee_member_id)
);

CREATE TABLE IF NOT EXISTS lp_task_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES lp_families(id) ON DELETE CASCADE,
  -- The task's subject (a child, the mother); NULL = family task.
  member_id UUID,
  template_key TEXT REFERENCES lp_task_templates(key) ON UPDATE CASCADE ON DELETE CASCADE,
  custom_task_id UUID REFERENCES lp_custom_tasks(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL CHECK (period_key ~ '^(once|[0-9]{4}(-[0-9]{2}(-[0-9]{2})?|-W[0-9]{2}|-Q[1-4])?)$'),
  -- Skipping never counts against anyone; it only clears the task for the period.
  status TEXT NOT NULL CHECK (status IN ('done', 'skipped', 'snoozed', 'not_applicable')),
  snoozed_until TIMESTAMPTZ,
  note TEXT CHECK (char_length(note) <= 1000),
  done_by UUID NOT NULL DEFAULT private.lp_uid(),
  done_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (member_id, family_id) REFERENCES lp_family_members(id, family_id) ON DELETE CASCADE,
  CHECK ((template_key IS NULL) <> (custom_task_id IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS lp_task_logs_once ON lp_task_logs (
  family_id, coalesce(member_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(template_key, custom_task_id::text), period_key);
CREATE INDEX IF NOT EXISTS lp_task_logs_recent ON lp_task_logs (family_id, done_at DESC);

-- Learning and progress ----------------------------------------------------------

CREATE TABLE IF NOT EXISTS lp_resource_progress (
  user_id UUID NOT NULL DEFAULT private.lp_uid() REFERENCES lp_users(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES lp_resources(id) ON DELETE CASCADE,
  bookmarked BOOLEAN NOT NULL DEFAULT false,
  -- Set by "Mark as learned", never by opening a page.
  learned_at TIMESTAMPTZ,
  last_opened_at TIMESTAMPTZ,
  progress SMALLINT NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  note TEXT CHECK (char_length(note) <= 2000),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, resource_id)
);

-- XP is written only by the functions below, once per (user, source, ref).
CREATE TABLE IF NOT EXISTS lp_xp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES lp_families(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES lp_users(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('task', 'resource', 'milestone', 'achievement')),
  ref TEXT NOT NULL,
  xp SMALLINT NOT NULL CHECK (xp BETWEEN 0 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (family_id, user_id, source, ref)
);
CREATE INDEX IF NOT EXISTS lp_xp_events_family ON lp_xp_events (family_id);

CREATE TABLE IF NOT EXISTS lp_user_achievements (
  family_id UUID NOT NULL REFERENCES lp_families(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES lp_users(id) ON DELETE CASCADE,
  achievement_key TEXT NOT NULL REFERENCES lp_achievements(key) ON UPDATE CASCADE ON DELETE CASCADE,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (family_id, user_id, achievement_key)
);

-- Who may do what ------------------------------------------------------------------

-- The families the caller belongs to with the given right:
-- 'read' | 'tasks' | 'health' | 'health_edit' | 'manage' | 'owner'.
CREATE OR REPLACE FUNCTION private.lp_families(p_need TEXT)
RETURNS UUID[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT coalesce(array_agg(m.family_id), '{}')
  FROM lp_family_members m
  WHERE m.user_id = private.lp_uid()
    AND m.is_active
    AND CASE p_need
          WHEN 'read' THEN true
          WHEN 'tasks' THEN m.can_do_tasks
          WHEN 'health' THEN m.can_view_health
          WHEN 'health_edit' THEN m.can_edit_health
          WHEN 'manage' THEN m.can_manage
          WHEN 'owner' THEN m.app_role = 'owner'
          ELSE false
        END
$$;
REVOKE ALL ON FUNCTION private.lp_families(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.lp_families(TEXT) TO anon, authenticated;

-- The functions below set this for their own writes to lp_family_members.
CREATE OR REPLACE FUNCTION private.lp_trusted() RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('lp.trusted', true), '') = 'on'
$$;

CREATE OR REPLACE FUNCTION private.lp_role_rights(m lp_family_members)
RETURNS lp_family_members LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  m.can_manage := m.app_role IN ('owner', 'parent');
  m.can_view_health := m.app_role IN ('owner', 'parent', 'guardian', 'caregiver');
  m.can_edit_health := m.app_role IN ('owner', 'parent', 'guardian');
  m.can_do_tasks := m.app_role IN ('owner', 'parent', 'guardian', 'caregiver');
  RETURN m;
END $$;

-- Guards what a caller may set on a member row (the RPCs are trusted).
CREATE OR REPLACE FUNCTION private.lp_members_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  me UUID := private.lp_uid();
  is_owner BOOLEAN;
  is_manager BOOLEAN;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.family_id := OLD.family_id;
    NEW.created_by := OLD.created_by;
  END IF;

  IF NOT private.lp_trusted() THEN
    is_owner := NEW.family_id = ANY (private.lp_families('owner'));
    is_manager := NEW.family_id = ANY (private.lp_families('manage'));

    IF TG_OP = 'INSERT' THEN
      -- People join only through an invite.
      NEW.user_id := NULL;
      NEW.joined_at := NULL;
      NEW.created_by := me;
      IF NEW.app_role = 'owner' THEN
        RAISE EXCEPTION 'Make someone an owner after they join.' USING ERRCODE = '42501';
      END IF;
    ELSE
      NEW.user_id := OLD.user_id;
      NEW.joined_at := OLD.joined_at;
      IF NOT is_manager THEN
        -- Editing your own row: name, photo, birth date only.
        NEW.app_role := OLD.app_role;
        NEW.relation_key := OLD.relation_key;
        NEW.can_manage := OLD.can_manage;
        NEW.can_view_health := OLD.can_view_health;
        NEW.can_edit_health := OLD.can_edit_health;
        NEW.can_do_tasks := OLD.can_do_tasks;
        NEW.invite_email := OLD.invite_email;
        NEW.invite_status := OLD.invite_status;
        NEW.invite_code := OLD.invite_code;
        NEW.is_active := OLD.is_active;
      ELSIF (NEW.app_role = 'owner') <> (OLD.app_role = 'owner') AND NOT is_owner THEN
        RAISE EXCEPTION 'Only an owner can make or remove an owner.' USING ERRCODE = '42501';
      END IF;
    END IF;

    -- A pending invite: a fresh code whenever the email is set or changed.
    IF NEW.user_id IS NULL THEN
      IF NEW.invite_email IS NULL OR btrim(NEW.invite_email) = '' THEN
        NEW.invite_email := NULL;
        NEW.invite_code := NULL;
        NEW.invite_status := CASE WHEN NEW.invite_status = 'revoked' THEN 'revoked' ELSE 'none' END;
      ELSIF TG_OP = 'INSERT' OR NEW.invite_email IS DISTINCT FROM OLD.invite_email
            OR (NEW.invite_status = 'pending' AND OLD.invite_status <> 'pending') THEN
        NEW.invite_email := lower(btrim(NEW.invite_email));
        NEW.invite_code := upper(substr(md5(gen_random_uuid()::text), 1, 8));
        NEW.invite_status := 'pending';
        NEW.invited_by := me;
        NEW.invited_at := now();
      END IF;
      IF NEW.invite_status = 'revoked' THEN
        NEW.invite_code := NULL;
      END IF;
    END IF;
  END IF;

  -- Rights follow the role when it is set or changed, or when the person joins
  -- (managers fine-tune afterwards).
  IF TG_OP = 'INSERT' OR NEW.app_role IS DISTINCT FROM OLD.app_role
     OR (OLD.user_id IS NULL AND NEW.user_id IS NOT NULL) THEN
    NEW := private.lp_role_rights(NEW);
  END IF;
  IF NEW.app_role = 'owner' THEN
    NEW.can_manage := true;
  END IF;
  -- Without an account there is nobody to give rights to.
  IF NEW.user_id IS NULL THEN
    NEW.can_manage := false;
    NEW.can_view_health := false;
    NEW.can_edit_health := false;
    NEW.can_do_tasks := false;
  END IF;
  RETURN NEW;
END $$;

-- A family is never left without an owner who has an account.
CREATE OR REPLACE FUNCTION private.lp_members_keep_owner()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM lp_families f WHERE f.id = OLD.family_id)
     AND NOT EXISTS (SELECT 1 FROM lp_family_members m
                     WHERE m.family_id = OLD.family_id AND m.app_role = 'owner' AND m.user_id IS NOT NULL AND m.is_active) THEN
    RAISE EXCEPTION 'A family needs at least one owner. Make someone else an owner first.' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS lp_members_guard ON lp_family_members;
CREATE TRIGGER lp_members_guard BEFORE INSERT OR UPDATE ON lp_family_members
  FOR EACH ROW EXECUTE FUNCTION private.lp_members_guard();
DROP TRIGGER IF EXISTS lp_members_keep_owner ON lp_family_members;
CREATE TRIGGER lp_members_keep_owner AFTER UPDATE OR DELETE ON lp_family_members
  FOR EACH ROW EXECUTE FUNCTION private.lp_members_keep_owner();

-- Records: family and author never change; stamp updated_by / updated_at.
CREATE OR REPLACE FUNCTION private.lp_record_touch()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  NEW.family_id := OLD.family_id;
  NEW.created_by := OLD.created_by;
  NEW.updated_by := private.lp_uid();
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['lp_pregnancies', 'lp_cycle_logs', 'lp_growth_records', 'lp_documents', 'lp_vaccinations',
                           'lp_appointments', 'lp_medicines', 'lp_allergies', 'lp_health_events', 'lp_milestone_records',
                           'lp_custom_tasks'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_touch', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION private.lp_record_touch()', t || '_touch', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['lp_users', 'lp_families', 'lp_family_members', 'lp_child_profiles', 'lp_task_assignments',
                           'lp_resource_progress'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_touch', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION lp_touch_updated_at()', t || '_touch', t);
  END LOOP;
END $$;

-- Policies -----------------------------------------------------------------------
DO $$
DECLARE
  me CONSTANT TEXT := '(SELECT private.lp_uid())';
  r RECORD;
  t TEXT;
  fam TEXT;
BEGIN
  -- Drop what an earlier run made.
  FOREACH t IN ARRAY ARRAY['lp_users', 'lp_families', 'lp_family_members', 'lp_child_profiles', 'lp_pregnancies',
                           'lp_cycle_logs', 'lp_growth_records', 'lp_documents', 'lp_vaccinations', 'lp_appointments',
                           'lp_medicines', 'lp_allergies', 'lp_health_events', 'lp_milestone_records', 'lp_custom_tasks',
                           'lp_task_assignments', 'lp_task_logs', 'lp_resource_progress', 'lp_xp_events',
                           'lp_user_achievements'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "lp read" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "lp insert" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "lp update" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "lp delete" ON %I', t);
  END LOOP;

  -- Your own profile.
  EXECUTE format('CREATE POLICY "lp read" ON lp_users FOR SELECT TO anon, authenticated USING (id = %s)', me);
  EXECUTE format('CREATE POLICY "lp insert" ON lp_users FOR INSERT TO anon, authenticated WITH CHECK (id = %s)', me);
  EXECUTE format('CREATE POLICY "lp update" ON lp_users FOR UPDATE TO anon, authenticated USING (id = %s) WITH CHECK (id = %s)', me, me);

  -- Families: created and deleted through the functions below.
  CREATE POLICY "lp read" ON lp_families FOR SELECT TO anon, authenticated
    USING (id = ANY ((SELECT private.lp_families('read'))::uuid[]));
  CREATE POLICY "lp update" ON lp_families FOR UPDATE TO anon, authenticated
    USING (id = ANY ((SELECT private.lp_families('manage'))::uuid[])) WITH CHECK (id = ANY ((SELECT private.lp_families('manage'))::uuid[]));

  -- Members: everyone in the family sees the family; managers add and change
  -- members; you may edit your own row (the guard keeps your role).
  CREATE POLICY "lp read" ON lp_family_members FOR SELECT TO anon, authenticated
    USING (family_id = ANY ((SELECT private.lp_families('read'))::uuid[]));
  CREATE POLICY "lp insert" ON lp_family_members FOR INSERT TO anon, authenticated
    WITH CHECK (family_id = ANY ((SELECT private.lp_families('manage'))::uuid[]));
  EXECUTE format('CREATE POLICY "lp update" ON lp_family_members FOR UPDATE TO anon, authenticated '
                 'USING (family_id = ANY ((SELECT private.lp_families(''manage''))::uuid[]) OR user_id = %s) '
                 'WITH CHECK (family_id = ANY ((SELECT private.lp_families(''manage''))::uuid[]) OR user_id = %s)', me, me);
  CREATE POLICY "lp delete" ON lp_family_members FOR DELETE TO anon, authenticated
    USING (family_id = ANY ((SELECT private.lp_families('manage'))::uuid[]));

  -- Child profiles: the whole family reads (the journey needs the birth date);
  -- health editors write.
  CREATE POLICY "lp read" ON lp_child_profiles FOR SELECT TO anon, authenticated
    USING (family_id = ANY ((SELECT private.lp_families('read'))::uuid[]));
  CREATE POLICY "lp insert" ON lp_child_profiles FOR INSERT TO anon, authenticated
    WITH CHECK (family_id = ANY ((SELECT private.lp_families('health_edit'))::uuid[]));
  CREATE POLICY "lp update" ON lp_child_profiles FOR UPDATE TO anon, authenticated
    USING (family_id = ANY ((SELECT private.lp_families('health_edit'))::uuid[])) WITH CHECK (family_id = ANY ((SELECT private.lp_families('health_edit'))::uuid[]));
  CREATE POLICY "lp delete" ON lp_child_profiles FOR DELETE TO anon, authenticated
    USING (family_id = ANY ((SELECT private.lp_families('health_edit'))::uuid[]));

  -- Records with is_private: who reads them, health editors write them; a
  -- private row is seen and changed only by the member who wrote it.
  FOR r IN SELECT * FROM (VALUES
    ('lp_pregnancies', 'read'),
    ('lp_cycle_logs', 'health'),
    ('lp_growth_records', 'health'),
    ('lp_documents', 'health'),
    ('lp_vaccinations', 'health'),
    ('lp_appointments', 'health'),
    ('lp_medicines', 'health'),
    ('lp_allergies', 'health'),
    ('lp_health_events', 'health'),
    ('lp_milestone_records', 'health')
  ) AS v(tbl, reads) LOOP
    fam := format('family_id = ANY ((SELECT private.lp_families(%L))::uuid[])', r.reads);
    EXECUTE format('CREATE POLICY "lp read" ON %I FOR SELECT TO anon, authenticated USING (%s AND (NOT is_private OR created_by = %s))',
                   r.tbl, fam, me);
    fam := 'family_id = ANY ((SELECT private.lp_families(''health_edit''))::uuid[])';
    EXECUTE format('CREATE POLICY "lp insert" ON %I FOR INSERT TO anon, authenticated WITH CHECK (%s AND created_by = %s)', r.tbl, fam, me);
    EXECUTE format('CREATE POLICY "lp update" ON %I FOR UPDATE TO anon, authenticated '
                   'USING (%s AND (NOT is_private OR created_by = %s)) WITH CHECK (%s AND (NOT is_private OR created_by = %s))',
                   r.tbl, fam, me, fam, me);
    EXECUTE format('CREATE POLICY "lp delete" ON %I FOR DELETE TO anon, authenticated USING (%s AND (NOT is_private OR created_by = %s))',
                   r.tbl, fam, me);
  END LOOP;

  -- Tasks: the family reads; members who do tasks write. Logs go through lp_log_task().
  FOREACH t IN ARRAY ARRAY['lp_custom_tasks', 'lp_task_assignments'] LOOP
    EXECUTE format('CREATE POLICY "lp read" ON %I FOR SELECT TO anon, authenticated USING (family_id = ANY ((SELECT private.lp_families(''read''))::uuid[]))', t);
    EXECUTE format('CREATE POLICY "lp insert" ON %I FOR INSERT TO anon, authenticated WITH CHECK (family_id = ANY ((SELECT private.lp_families(''tasks''))::uuid[]))', t);
    EXECUTE format('CREATE POLICY "lp update" ON %I FOR UPDATE TO anon, authenticated USING (family_id = ANY ((SELECT private.lp_families(''tasks''))::uuid[])) '
                   'WITH CHECK (family_id = ANY ((SELECT private.lp_families(''tasks''))::uuid[]))', t);
    EXECUTE format('CREATE POLICY "lp delete" ON %I FOR DELETE TO anon, authenticated USING (family_id = ANY ((SELECT private.lp_families(''tasks''))::uuid[]))', t);
  END LOOP;
  CREATE POLICY "lp read" ON lp_task_logs FOR SELECT TO anon, authenticated
    USING (family_id = ANY ((SELECT private.lp_families('read'))::uuid[]));
  EXECUTE format('CREATE POLICY "lp delete" ON lp_task_logs FOR DELETE TO anon, authenticated '
                 'USING (family_id = ANY ((SELECT private.lp_families(''tasks''))::uuid[]) AND done_by = %s)', me);

  -- Learning progress: yours only.
  EXECUTE format('CREATE POLICY "lp read" ON lp_resource_progress FOR SELECT TO anon, authenticated USING (user_id = %s)', me);
  EXECUTE format('CREATE POLICY "lp insert" ON lp_resource_progress FOR INSERT TO anon, authenticated WITH CHECK (user_id = %s)', me);
  EXECUTE format('CREATE POLICY "lp update" ON lp_resource_progress FOR UPDATE TO anon, authenticated USING (user_id = %s) WITH CHECK (user_id = %s)', me, me);
  EXECUTE format('CREATE POLICY "lp delete" ON lp_resource_progress FOR DELETE TO anon, authenticated USING (user_id = %s)', me);

  -- XP and achievements: the family sees them; written by the functions only.
  CREATE POLICY "lp read" ON lp_xp_events FOR SELECT TO anon, authenticated
    USING (family_id = ANY ((SELECT private.lp_families('read'))::uuid[]));
  CREATE POLICY "lp read" ON lp_user_achievements FOR SELECT TO anon, authenticated
    USING (family_id = ANY ((SELECT private.lp_families('read'))::uuid[]));
END $$;

-- Private files: <family_id>/avatars/… (the family sees them) and
-- <family_id>/docs/… (health readers see them). The app deletes a family's
-- files through the storage API before deleting the family.
INSERT INTO storage.buckets (id, name, public, file_size_limit) VALUES ('lp-family', 'lp-family', false, 10485760)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 10485760;

DROP POLICY IF EXISTS "lp-family read" ON storage.objects;
DROP POLICY IF EXISTS "lp-family insert" ON storage.objects;
DROP POLICY IF EXISTS "lp-family update" ON storage.objects;
DROP POLICY IF EXISTS "lp-family delete" ON storage.objects;
CREATE POLICY "lp-family read" ON storage.objects FOR SELECT TO public USING (
  bucket_id = 'lp-family' AND (
    ((storage.foldername(name))[2] = 'avatars' AND (storage.foldername(name))[1] = ANY ((SELECT private.lp_families('read'))::text[]))
    OR ((storage.foldername(name))[2] = 'docs' AND (storage.foldername(name))[1] = ANY ((SELECT private.lp_families('health'))::text[]))));
CREATE POLICY "lp-family insert" ON storage.objects FOR INSERT TO public WITH CHECK (
  bucket_id = 'lp-family' AND (
    ((storage.foldername(name))[2] = 'avatars' AND (storage.foldername(name))[1] = ANY ((SELECT private.lp_families('read'))::text[]))
    OR ((storage.foldername(name))[2] = 'docs' AND (storage.foldername(name))[1] = ANY ((SELECT private.lp_families('health_edit'))::text[]))));
CREATE POLICY "lp-family update" ON storage.objects FOR UPDATE TO public USING (
  bucket_id = 'lp-family' AND (storage.foldername(name))[1] = ANY ((SELECT private.lp_families('health_edit'))::text[]));
CREATE POLICY "lp-family delete" ON storage.objects FOR DELETE TO public USING (
  bucket_id = 'lp-family' AND (
    ((storage.foldername(name))[2] = 'avatars' AND (storage.foldername(name))[1] = ANY ((SELECT private.lp_families('read'))::text[]))
    OR (storage.foldername(name))[1] = ANY ((SELECT private.lp_families('health_edit'))::text[])));

-- Functions the app calls -------------------------------------------------------

-- Signs the caller in: creates or refreshes their lp_users row from the token.
CREATE OR REPLACE FUNCTION public.lp_me(p_display_name TEXT DEFAULT NULL, p_language TEXT DEFAULT NULL)
RETURNS lp_users LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  claims JSON := private.lp_claims();
  me UUID := (claims ->> 'userId')::uuid;
  v_user lp_users;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Sign in again.' USING ERRCODE = '28000';
  END IF;
  INSERT INTO lp_users (id, email, display_name, language, last_seen_at)
  VALUES (me, lower(nullif(claims ->> 'email', '')), nullif(btrim(p_display_name), ''),
          CASE WHEN p_language IN ('bn', 'en') THEN p_language ELSE 'bn' END, now())
  ON CONFLICT (id) DO UPDATE SET
    email = coalesce(EXCLUDED.email, lp_users.email),
    display_name = coalesce(nullif(btrim(p_display_name), ''), lp_users.display_name),
    language = CASE WHEN p_language IN ('bn', 'en') THEN p_language ELSE lp_users.language END,
    last_seen_at = now()
  RETURNING * INTO v_user;
  RETURN v_user;
END $$;

-- A new family with the caller as its owner. p_relation_key says who the caller
-- is to the children (father, mother, grandmother…).
CREATE OR REPLACE FUNCTION public.lp_create_family(
  p_name TEXT, p_relation_key TEXT, p_display_name TEXT, p_sex TEXT DEFAULT NULL,
  p_country TEXT DEFAULT 'BD', p_is_planning BOOLEAN DEFAULT false)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  me UUID := private.lp_uid();
  fam UUID;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Sign in again.' USING ERRCODE = '28000';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM lp_users WHERE id = me) THEN
    PERFORM public.lp_me(p_display_name, NULL);
  END IF;
  IF (SELECT count(*) FROM lp_family_members WHERE user_id = me) >= 10 THEN
    RAISE EXCEPTION 'You are already in 10 families.' USING ERRCODE = '54000';
  END IF;
  IF (SELECT group_key FROM lp_relation_types WHERE key = p_relation_key) = 'child' THEN
    RAISE EXCEPTION 'Add children after creating the family.' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('lp.trusted', 'on', true);
  INSERT INTO lp_families (name, country, is_planning, planning_since, created_by)
  VALUES (btrim(p_name), coalesce(nullif(p_country, ''), 'BD'), p_is_planning,
          CASE WHEN p_is_planning THEN current_date END, me)
  RETURNING id INTO fam;
  INSERT INTO lp_family_members (family_id, user_id, relation_key, display_name, sex, app_role, invite_status, joined_at, created_by)
  VALUES (fam, me, p_relation_key, btrim(p_display_name), p_sex, 'owner', 'accepted', now(), me);
  UPDATE lp_users SET active_family_id = fam WHERE id = me AND active_family_id IS NULL;
  PERFORM set_config('lp.trusted', '', true);
  RETURN fam;
END $$;

-- Invitations waiting for the caller's email.
CREATE OR REPLACE FUNCTION public.lp_my_invites()
RETURNS TABLE (member_id UUID, family_id UUID, family_name TEXT, relation_key TEXT, display_name TEXT,
               app_role TEXT, invited_by_name TEXT, invited_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT m.id, f.id, f.name, m.relation_key, m.display_name, m.app_role,
         (SELECT b.display_name FROM lp_family_members b WHERE b.family_id = f.id AND b.user_id = m.invited_by LIMIT 1),
         m.invited_at
  FROM lp_family_members m
  JOIN lp_families f ON f.id = m.family_id
  WHERE m.invite_status = 'pending' AND m.user_id IS NULL
    AND m.invite_email = lower(nullif(private.lp_claims() ->> 'email', ''))
  ORDER BY m.invited_at DESC
$$;

-- Joins a family: by the invite code, or by an invite sent to the caller's email.
CREATE OR REPLACE FUNCTION public.lp_accept_invite(p_code TEXT DEFAULT NULL, p_member_id UUID DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  me UUID := private.lp_uid();
  my_email TEXT := lower(nullif(private.lp_claims() ->> 'email', ''));
  m lp_family_members;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Sign in again.' USING ERRCODE = '28000';
  END IF;
  SELECT * INTO m FROM lp_family_members x
  WHERE x.invite_status = 'pending' AND x.user_id IS NULL AND x.is_active
    AND ((p_code IS NOT NULL AND x.invite_code = upper(btrim(p_code)))
      OR (p_member_id IS NOT NULL AND x.id = p_member_id AND x.invite_email = my_email))
  FOR UPDATE;
  IF m.id IS NULL THEN
    RAISE EXCEPTION 'This invitation is not valid any more.' USING ERRCODE = 'P0002';
  END IF;
  IF EXISTS (SELECT 1 FROM lp_family_members WHERE family_id = m.family_id AND user_id = me) THEN
    RAISE EXCEPTION 'You are already in this family.' USING ERRCODE = '23505';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM lp_users WHERE id = me) THEN
    PERFORM public.lp_me(NULL, NULL);
  END IF;

  PERFORM set_config('lp.trusted', 'on', true);
  UPDATE lp_family_members SET
    user_id = me,
    app_role = CASE WHEN app_role = 'none' THEN 'viewer' ELSE app_role END,
    invite_status = 'accepted', invite_code = NULL, joined_at = now()
  WHERE id = m.id;
  UPDATE lp_users SET active_family_id = m.family_id WHERE id = me AND active_family_id IS NULL;
  PERFORM set_config('lp.trusted', '', true);
  RETURN m.family_id;
END $$;

CREATE OR REPLACE FUNCTION public.lp_decline_invite(p_member_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  PERFORM set_config('lp.trusted', 'on', true);
  UPDATE lp_family_members SET invite_status = 'declined', invite_code = NULL
  WHERE id = p_member_id AND invite_status = 'pending' AND user_id IS NULL
    AND invite_email = lower(nullif(private.lp_claims() ->> 'email', ''));
  PERFORM set_config('lp.trusted', '', true);
  RETURN FOUND;
END $$;

-- Leaves a family. The member row stays (relation, records about them); only
-- the account link and rights go. The last owner must hand over first.
CREATE OR REPLACE FUNCTION public.lp_leave_family(p_family_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE me UUID := private.lp_uid();
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Sign in again.' USING ERRCODE = '28000';
  END IF;
  PERFORM set_config('lp.trusted', 'on', true);
  UPDATE lp_family_members SET user_id = NULL, app_role = 'none', invite_status = 'none', invite_email = NULL
  WHERE family_id = p_family_id AND user_id = me;
  UPDATE lp_users SET active_family_id = NULL WHERE id = me AND active_family_id = p_family_id;
  PERFORM set_config('lp.trusted', '', true);
  RETURN FOUND;
END $$;

-- Deletes a family and everything in it (owners only). Delete its files first.
CREATE OR REPLACE FUNCTION public.lp_delete_family(p_family_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF NOT p_family_id = ANY (private.lp_families('owner')) THEN
    RAISE EXCEPTION 'Only an owner can delete the family.' USING ERRCODE = '42501';
  END IF;
  DELETE FROM lp_families WHERE id = p_family_id;
  RETURN FOUND;
END $$;

-- "Delete my account": families where the caller is the only account are
-- deleted; from the others the caller leaves (an owner who is the only owner
-- must hand over first). Then the profile, progress and XP go.
-- The IAM account itself is deleted through IAM.
CREATE OR REPLACE FUNCTION public.lp_delete_my_account()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  me UUID := private.lp_uid();
  f UUID;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Sign in again.' USING ERRCODE = '28000';
  END IF;
  FOR f IN SELECT family_id FROM lp_family_members WHERE user_id = me LOOP
    IF NOT EXISTS (SELECT 1 FROM lp_family_members WHERE family_id = f AND user_id IS NOT NULL AND user_id <> me) THEN
      DELETE FROM lp_families WHERE id = f;
    ELSE
      PERFORM public.lp_leave_family(f);
    END IF;
  END LOOP;
  PERFORM set_config('lp.trusted', 'on', true);
  DELETE FROM lp_users WHERE id = me;
  PERFORM set_config('lp.trusted', '', true);
  RETURN true;
END $$;

-- XP for one thing, once. The amount comes from the database, not the app.
CREATE OR REPLACE FUNCTION private.lp_add_xp(p_family_id UUID, p_source TEXT, p_ref TEXT, p_xp INT)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE me UUID := private.lp_uid();
BEGIN
  IF me IS NULL OR p_xp IS NULL OR p_xp <= 0 THEN RETURN 0; END IF;
  INSERT INTO lp_xp_events (family_id, user_id, source, ref, xp)
  VALUES (p_family_id, me, p_source, p_ref, least(p_xp, 500))
  ON CONFLICT (family_id, user_id, source, ref) DO NOTHING;
  RETURN CASE WHEN FOUND THEN least(p_xp, 500) ELSE 0 END;
END $$;

-- Marks a task done / skipped / snoozed / not applicable for a period and
-- returns the XP it earned (0 when not done or already counted).
CREATE OR REPLACE FUNCTION public.lp_log_task(
  p_family_id UUID, p_period_key TEXT, p_status TEXT,
  p_template_key TEXT DEFAULT NULL, p_custom_task_id UUID DEFAULT NULL, p_member_id UUID DEFAULT NULL,
  p_note TEXT DEFAULT NULL, p_snoozed_until TIMESTAMPTZ DEFAULT NULL)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  me UUID := private.lp_uid();
  xp INT := 0;
BEGIN
  IF NOT p_family_id = ANY (private.lp_families('tasks')) THEN
    RAISE EXCEPTION 'You can''t do tasks in this family.' USING ERRCODE = '42501';
  END IF;
  IF p_custom_task_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM lp_custom_tasks WHERE id = p_custom_task_id AND family_id = p_family_id) THEN
    RAISE EXCEPTION 'Unknown task.' USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM lp_task_logs
  WHERE family_id = p_family_id
    AND member_id IS NOT DISTINCT FROM p_member_id
    AND template_key IS NOT DISTINCT FROM p_template_key
    AND custom_task_id IS NOT DISTINCT FROM p_custom_task_id
    AND period_key = p_period_key;
  INSERT INTO lp_task_logs (family_id, member_id, template_key, custom_task_id, period_key, status, snoozed_until, note, done_by)
  VALUES (p_family_id, p_member_id, p_template_key, p_custom_task_id, p_period_key, p_status, p_snoozed_until, p_note, me);

  IF p_status = 'done' THEN
    IF p_template_key IS NOT NULL THEN
      SELECT t.xp INTO xp FROM lp_task_templates t WHERE t.key = p_template_key;
    ELSE
      xp := 5;
    END IF;
    xp := private.lp_add_xp(p_family_id, 'task',
      coalesce(p_template_key, p_custom_task_id::text) || ':' || coalesce(p_member_id::text, '-') || ':' || p_period_key, xp);
  END IF;
  RETURN xp;
END $$;

-- XP for a guide marked as learned (10) or a milestone recorded (5).
CREATE OR REPLACE FUNCTION public.lp_award_xp(p_family_id UUID, p_source TEXT, p_ref TEXT)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE me UUID := private.lp_uid();
BEGIN
  IF NOT p_family_id = ANY (private.lp_families('read')) THEN
    RETURN 0;
  END IF;
  IF p_source = 'resource' AND EXISTS (
       SELECT 1 FROM lp_resource_progress WHERE user_id = me AND resource_id::text = p_ref AND learned_at IS NOT NULL) THEN
    RETURN private.lp_add_xp(p_family_id, 'resource', p_ref, 10);
  END IF;
  IF p_source = 'milestone' AND EXISTS (
       SELECT 1 FROM lp_milestone_records WHERE family_id = p_family_id AND id::text = p_ref AND created_by = me) THEN
    RETURN private.lp_add_xp(p_family_id, 'milestone', p_ref, 5);
  END IF;
  RETURN 0;
END $$;

-- Claims an achievement when its rule is met; returns whether it was earned.
CREATE OR REPLACE FUNCTION public.lp_claim_achievement(p_family_id UUID, p_key TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  me UUID := private.lp_uid();
  a lp_achievements;
  need INT;
  have INT := 0;
BEGIN
  IF NOT p_family_id = ANY (private.lp_families('read')) THEN RETURN false; END IF;
  SELECT * INTO a FROM lp_achievements WHERE key = p_key AND is_active;
  IF a.key IS NULL THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM lp_user_achievements WHERE family_id = p_family_id AND user_id = me AND achievement_key = p_key) THEN
    RETURN true;
  END IF;
  need := coalesce((a.rule ->> 'count')::int, 1);

  CASE a.rule ->> 'kind'
    WHEN 'tasks_done' THEN
      SELECT count(*) INTO have FROM lp_task_logs l
      LEFT JOIN lp_task_templates t ON t.key = l.template_key
      WHERE l.family_id = p_family_id AND l.done_by = me AND l.status = 'done'
        AND (a.rule ->> 'task_type' IS NULL OR t.task_type = a.rule ->> 'task_type')
        AND (a.rule ->> 'category_key' IS NULL OR t.category_key = a.rule ->> 'category_key');
    WHEN 'streak_days' THEN
      -- Days with something done (not necessarily in a row: missing a day is fine).
      SELECT count(DISTINCT (done_at AT TIME ZONE 'UTC')::date) INTO have FROM lp_task_logs
      WHERE family_id = p_family_id AND done_by = me AND status = 'done';
    WHEN 'resources_learned' THEN
      SELECT count(*) INTO have FROM lp_resource_progress p
      WHERE p.user_id = me AND p.learned_at IS NOT NULL
        AND (a.rule ->> 'category_key' IS NULL OR EXISTS (
          SELECT 1 FROM lp_resource_categories rc JOIN lp_categories c ON c.id = rc.category_id
          WHERE rc.resource_id = p.resource_id AND c.key = a.rule ->> 'category_key'));
    WHEN 'records_added' THEN
      SELECT (SELECT count(*) FROM lp_growth_records WHERE family_id = p_family_id AND created_by = me)
           + (SELECT count(*) FROM lp_vaccinations WHERE family_id = p_family_id AND created_by = me)
           + (SELECT count(*) FROM lp_appointments WHERE family_id = p_family_id AND created_by = me)
           + (SELECT count(*) FROM lp_health_events WHERE family_id = p_family_id AND created_by = me)
        INTO have;
    WHEN 'milestones_observed' THEN
      SELECT count(*) INTO have FROM lp_milestone_records
      WHERE family_id = p_family_id AND created_by = me AND status IN ('observed', 'discussed');
    WHEN 'shared_tasks' THEN
      -- Family tasks done by two or more members in the same period.
      SELECT count(*) INTO have FROM (
        SELECT l.period_key FROM lp_task_logs l JOIN lp_task_templates t ON t.key = l.template_key
        WHERE l.family_id = p_family_id AND l.status = 'done' AND t.task_type = 'family'
        GROUP BY l.period_key HAVING count(DISTINCT l.done_by) >= 2 AND bool_or(l.done_by = me)) s;
    ELSE
      RETURN false;
  END CASE;

  IF have < need THEN RETURN false; END IF;
  INSERT INTO lp_user_achievements (family_id, user_id, achievement_key) VALUES (p_family_id, me, p_key)
  ON CONFLICT DO NOTHING;
  PERFORM private.lp_add_xp(p_family_id, 'achievement', p_key, a.xp);
  RETURN true;
END $$;

-- The family garden: total XP, level and each member's share.
CREATE OR REPLACE FUNCTION public.lp_family_progress(p_family_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  total INT;
  lvl lp_garden_levels;
  nxt INT;
BEGIN
  IF NOT p_family_id = ANY (private.lp_families('read')) THEN
    RAISE EXCEPTION 'Not your family.' USING ERRCODE = '42501';
  END IF;
  SELECT coalesce(sum(xp), 0) INTO total FROM lp_xp_events WHERE family_id = p_family_id;
  SELECT * INTO lvl FROM lp_garden_levels WHERE min_xp <= total ORDER BY min_xp DESC LIMIT 1;
  SELECT min(min_xp) INTO nxt FROM lp_garden_levels WHERE min_xp > total;
  RETURN jsonb_build_object(
    'xp', total,
    'level', lvl.level,
    'next_level_xp', nxt,
    'members', coalesce((SELECT jsonb_agg(jsonb_build_object('user_id', user_id, 'xp', xp) ORDER BY xp DESC)
                         FROM (SELECT user_id, sum(xp)::int AS xp FROM lp_xp_events WHERE family_id = p_family_id GROUP BY user_id) s), '[]'));
END $$;

DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.lp_me(TEXT, TEXT)',
    'public.lp_create_family(TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN)',
    'public.lp_my_invites()',
    'public.lp_accept_invite(TEXT, UUID)',
    'public.lp_decline_invite(UUID)',
    'public.lp_leave_family(UUID)',
    'public.lp_delete_family(UUID)',
    'public.lp_delete_my_account()',
    'public.lp_log_task(UUID, TEXT, TEXT, TEXT, UUID, UUID, TEXT, TIMESTAMPTZ)',
    'public.lp_award_xp(UUID, TEXT, TEXT)',
    'public.lp_claim_achievement(UUID, TEXT)',
    'public.lp_family_progress(UUID)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated', f);
  END LOOP;
  REVOKE ALL ON FUNCTION private.lp_add_xp(UUID, TEXT, TEXT, INT) FROM PUBLIC;
  REVOKE ALL ON FUNCTION private.lp_trusted() FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION private.lp_trusted() TO anon, authenticated;
END $$;

-- batools' dashboard: how the app is used, as counts only (no family data).
CREATE OR REPLACE FUNCTION public.lp_admin_stats()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF NOT private.lp_is_editor() THEN
    RAISE EXCEPTION 'batools only.' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'users', (SELECT count(*) FROM lp_users),
    'active_users_7d', (SELECT count(*) FROM lp_users WHERE last_seen_at > now() - interval '7 days'),
    'families', (SELECT count(*) FROM lp_families),
    'children', (SELECT count(*) FROM lp_child_profiles),
    'active_pregnancies', (SELECT count(*) FROM lp_pregnancies WHERE status = 'active'),
    'planning_families', (SELECT count(*) FROM lp_families WHERE is_planning),
    'tasks_done_7d', (SELECT count(*) FROM lp_task_logs WHERE status = 'done' AND done_at > now() - interval '7 days'));
END $$;
REVOKE ALL ON FUNCTION public.lp_admin_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lp_admin_stats() TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
