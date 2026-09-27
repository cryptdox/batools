-- Migration: 011_task_manager_tables.sql
-- Brings the Task Manager feature set into the Bangla Tools database, with
-- every table namespaced behind a `tm_` prefix (same reasoning as the `lt_`
-- prefix in 010: this project is shared, and `task`/`vocabulary` are exactly
-- the kind of generic names that collide later).
--
-- Only the seven tables the Task Manager app actually uses are brought over.
-- The source project also hosts a portfolio/CMS schema (about, blog, clients,
-- projects, services, testimonials, platform_*, ...) which is deliberately
-- left behind.
--
-- THE ONE REAL DESIGN CHANGE — ownership and row-level security:
--
--   In the source project every one of these tables was scoped per user:
--   `user_id`/`created_by` carried a foreign key to auth.users, and the RLS
--   policies all read `auth.uid() = user_id`.
--
--   Bangla Tools does not use Supabase Auth at all. It gates the UI with a
--   static email/password from .env and talks to PostgREST with the anon key,
--   unauthenticated, so `auth.uid()` is always NULL here. Carrying those
--   policies across verbatim would make every Task Manager page silently
--   return zero rows and reject every insert.
--
--   So ownership becomes a single static identity, configured in .env as
--   VITE_TM_USER_ID and defaulting to the sentinel below, and the policies
--   become the same permissive "Allow all access" the lt_ tables already use.
--   The user_id / created_by columns are kept (not dropped) so the data keeps
--   its shape and the app's existing queries still work unchanged.
--
--   The auth.users foreign keys are dropped rather than repointed: the source
--   project's user UUIDs do not exist in this project's auth.users, so keeping
--   them would make the data copy in 012 fail on every row.

-- Sentinel owner: reads as "111", is a valid UUID, and cannot collide with a
-- real Supabase auth user id.
-- Keep this in sync with VITE_TM_USER_ID in .env.

CREATE TYPE tm_task_period      AS ENUM ('morning', 'day', 'night');
CREATE TYPE tm_to_do_task_type  AS ENUM ('always', 'one_time', 'progress');
CREATE TYPE tm_language_code    AS ENUM ('en', 'bn');
CREATE TYPE tm_relation_type    AS ENUM ('translation', 'semantic', 'contextual', 'synonym', 'antonym');

-- ---------------------------------------------------------------- task_type
CREATE TABLE tm_task_type (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  color      TEXT NOT NULL,
  user_id    UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000111',
  created_at TIMESTAMP DEFAULT now()
);

-- ----------------------------------------------------------------- task_tag
CREATE TABLE tm_task_tag (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  color      TEXT NOT NULL,
  user_id    UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000111',
  created_at TIMESTAMP DEFAULT now()
);

-- -------------------------------------------------------- task_tag_task_type
CREATE TABLE tm_task_tag_task_type (
  task_tag_id  UUID NOT NULL REFERENCES tm_task_tag(id)  ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE,
  task_type_id UUID NOT NULL REFERENCES tm_task_type(id) ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE,
  PRIMARY KEY (task_tag_id, task_type_id)
);

-- --------------------------------------------------------------------- task
CREATE TABLE tm_task (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task        TEXT NOT NULL,
  task_tag    UUID REFERENCES tm_task_tag(id) ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE,
  task_period tm_task_period NOT NULL,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  user_id     UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000111',
  created_at  TIMESTAMP DEFAULT now()
);

-- --------------------------------------------------------------- to_do_task
CREATE TABLE tm_to_do_task (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_do_type  tm_to_do_task_type NOT NULL,
  -- self-reference: a sub-task points at its parent
  parent_task UUID REFERENCES tm_to_do_task(id) ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE,
  description TEXT NOT NULL,
  created_on  TIMESTAMPTZ DEFAULT now(),
  task_tag    UUID REFERENCES tm_task_tag(id) ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE,
  archived    BOOLEAN DEFAULT false,
  user_id     UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000111',
  note        TEXT
);
COMMENT ON COLUMN tm_to_do_task.note IS 'Note';

-- --------------------------------------------------------------- vocabulary
CREATE TABLE tm_vocabulary (
  id             BIGSERIAL PRIMARY KEY,
  language_code  tm_language_code NOT NULL,
  text           TEXT NOT NULL,
  phonetic       TEXT,
  sentences      JSONB,
  note           TEXT,
  part_of_speech VARCHAR(50),
  is_draft       BOOLEAN DEFAULT false,
  created_by     UUID DEFAULT '00000000-0000-0000-0000-000000000111',
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tm_vocabulary_created_by ON tm_vocabulary (created_by);
CREATE INDEX idx_tm_vocabulary_language   ON tm_vocabulary (language_code);
CREATE INDEX idx_tm_vocabulary_text_gin   ON tm_vocabulary USING gin (to_tsvector('simple'::regconfig, text));

-- ----------------------------------------------------------- vocabulary_map
CREATE TABLE tm_vocabulary_map (
  id            BIGSERIAL PRIMARY KEY,
  source_id     BIGINT NOT NULL REFERENCES tm_vocabulary(id) ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE,
  target_id     BIGINT NOT NULL REFERENCES tm_vocabulary(id) ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE,
  relation_type tm_relation_type DEFAULT 'translation',
  is_primary    BOOLEAN DEFAULT false,
  created_by    UUID DEFAULT '00000000-0000-0000-0000-000000000111',
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tm_vocabmap_created_by ON tm_vocabulary_map (created_by);
CREATE INDEX idx_tm_vocabmap_source     ON tm_vocabulary_map (source_id);
CREATE INDEX idx_tm_vocabmap_target     ON tm_vocabulary_map (target_id);

-- ------------------------------------------------------------------- RLS
-- Matches the lt_ tables: the anon key is the only client, and the UI is
-- gated in the app rather than the database. See the header note above.
ALTER TABLE tm_task_type            ENABLE ROW LEVEL SECURITY;
ALTER TABLE tm_task_tag             ENABLE ROW LEVEL SECURITY;
ALTER TABLE tm_task_tag_task_type   ENABLE ROW LEVEL SECURITY;
ALTER TABLE tm_task                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE tm_to_do_task           ENABLE ROW LEVEL SECURITY;
ALTER TABLE tm_vocabulary           ENABLE ROW LEVEL SECURITY;
ALTER TABLE tm_vocabulary_map       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access" ON tm_task_type          FOR ALL USING (true);
CREATE POLICY "Allow all access" ON tm_task_tag           FOR ALL USING (true);
CREATE POLICY "Allow all access" ON tm_task_tag_task_type FOR ALL USING (true);
CREATE POLICY "Allow all access" ON tm_task               FOR ALL USING (true);
CREATE POLICY "Allow all access" ON tm_to_do_task         FOR ALL USING (true);
CREATE POLICY "Allow all access" ON tm_vocabulary         FOR ALL USING (true);
CREATE POLICY "Allow all access" ON tm_vocabulary_map     FOR ALL USING (true);

NOTIFY pgrst, 'reload schema';
