-- Migration: 025_portfolio_tables.sql
-- Portfolio CMS: everything the public portfolio site (abir-dev-portfolio)
-- used to hard-code in src/data/content.ts, moved into tables so Bangla Tools
-- can edit it. Namespaced behind `pf_` (same reasoning as `lt_`/`tm_`/`pb_`).
--
-- SHAPE:
--   * Every row carries `user_id` — the IAM user id of the owner, the same
--     identity the tm_ tables use. One database can host several portfolios;
--     the site picks one with its VITE_PORTFOLIO_USER_ID.
--   * The site is bilingual (en/bn). Translatable text lives in paired
--     `_en` / `_bn` columns on the same row, so one edit form shows both
--     languages side by side and a row can never exist in only one language.
--     Things that are not translated (tech names, links, handles) are single.
--   * Lists of short strings (responsibilities, skills) are TEXT[]: they are
--     always edited and shown as a whole, never queried item by item.
--   * Text may contain `<b>…</b>` (rendered bold) and `{years}` (replaced by
--     the years since pf_profile.career_start_year at render time).
--   * List tables have `sort_order` (ascending = display order) and
--     `is_visible`, so an item can be hidden without being deleted.
--
-- RLS: same permissive policy as the rest of the project. The site reads
-- with the anon key and the contact form inserts into pf_messages with it.

------------------------------------------------------------------------------
-- One row per portfolio: identity, links, hero texts
------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pf_profile (
  user_id UUID PRIMARY KEY,

  name_en TEXT NOT NULL DEFAULT '',
  name_bn TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone_en TEXT,
  phone_bn TEXT,

  -- Handles, not URLs: the site builds the link per platform.
  github TEXT,
  linkedin TEXT,
  medium TEXT,
  youtube TEXT,
  facebook TEXT,
  x TEXT,
  gitlab TEXT,
  kaggle TEXT,

  resume_url TEXT,
  -- Drives every "N years" figure ({years} in text, hero stats).
  career_start_year INT CHECK (career_start_year IS NULL OR career_start_year BETWEEN 1950 AND 2100),

  greeting_en TEXT, greeting_bn TEXT,
  title_en TEXT, title_bn TEXT,
  subtitle_en TEXT, subtitle_bn TEXT,
  slogan_en TEXT, slogan_bn TEXT,
  objective_en TEXT, objective_bn TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rotating roles under the name in the hero.
CREATE TABLE IF NOT EXISTS pf_hero_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  text_en TEXT NOT NULL,
  text_bn TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT 'code',
  sort_order INT NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

------------------------------------------------------------------------------
-- UI labels: section titles, buttons, nav — anything that is chrome rather
-- than content. `key` is the dotted path the site reads (e.g. 'nav.home').
------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pf_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  key TEXT NOT NULL CHECK (key ~ '^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$'),
  value_en TEXT NOT NULL DEFAULT '',
  value_bn TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, key)
);

------------------------------------------------------------------------------
-- About: long-form "about me" sections, shown per audience
------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pf_about_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  audience TEXT NOT NULL CHECK (audience IN ('general', 'client')),
  heading_en TEXT NOT NULL,
  heading_bn TEXT NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A section's body: a paragraph (text_*) or a bullet list (items_*).
CREATE TABLE IF NOT EXISTS pf_about_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  section_id UUID NOT NULL REFERENCES pf_about_sections(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'paragraph' CHECK (kind IN ('paragraph', 'list')),
  text_en TEXT,
  text_bn TEXT,
  items_en TEXT[] NOT NULL DEFAULT '{}',
  items_bn TEXT[] NOT NULL DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pf_about_blocks_section ON pf_about_blocks(section_id);

CREATE TABLE IF NOT EXISTS pf_education (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  degree_en TEXT NOT NULL,
  degree_bn TEXT NOT NULL DEFAULT '',
  institution_en TEXT NOT NULL DEFAULT '',
  institution_bn TEXT NOT NULL DEFAULT '',
  year_en TEXT,
  year_bn TEXT,
  location_en TEXT,
  location_bn TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- "Beyond coding"
CREATE TABLE IF NOT EXISTS pf_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  text_en TEXT NOT NULL,
  text_bn TEXT NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- "Core expertise" tiles
CREATE TABLE IF NOT EXISTS pf_core_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  label_en TEXT NOT NULL,
  label_bn TEXT NOT NULL DEFAULT '',
  percent INT NOT NULL DEFAULT 100 CHECK (percent BETWEEN 0 AND 100),
  sort_order INT NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

------------------------------------------------------------------------------
-- Work
------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pf_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title_en TEXT NOT NULL,
  title_bn TEXT NOT NULL DEFAULT '',
  duration_en TEXT,
  duration_bn TEXT,
  description_en TEXT,
  description_bn TEXT,
  responsibilities_en TEXT[] NOT NULL DEFAULT '{}',
  responsibilities_bn TEXT[] NOT NULL DEFAULT '{}',
  tech_stack TEXT[] NOT NULL DEFAULT '{}',
  link TEXT,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pf_experiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_en TEXT NOT NULL,
  company_bn TEXT NOT NULL DEFAULT '',
  position_en TEXT NOT NULL DEFAULT '',
  position_bn TEXT NOT NULL DEFAULT '',
  location_en TEXT,
  location_bn TEXT,
  duration_en TEXT,
  duration_bn TEXT,
  responsibilities_en TEXT[] NOT NULL DEFAULT '{}',
  responsibilities_bn TEXT[] NOT NULL DEFAULT '{}',
  -- Shows the CURRENT badge (the site used to assume "first item").
  is_current BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tech stack: one row per category; skill names are not translated.
CREATE TABLE IF NOT EXISTS pf_tech_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title_en TEXT NOT NULL,
  title_bn TEXT NOT NULL DEFAULT '',
  -- One of the icon keys the site knows: cpu, code, globe, database, cloud,
  -- wrench. It also picks the category colour.
  icon TEXT NOT NULL DEFAULT 'code',
  skills TEXT[] NOT NULL DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- "Check list before hiring me" (the Summary section)
CREATE TABLE IF NOT EXISTS pf_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  text_en TEXT NOT NULL,
  text_bn TEXT NOT NULL DEFAULT '',
  rating INT NOT NULL DEFAULT 5 CHECK (rating BETWEEN 0 AND 5),
  sort_order INT NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

------------------------------------------------------------------------------
-- Contact form inbox (replaces the site's old `message` table, which lived in
-- a separate Supabase project; rows there are not copied).
------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pf_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT,
  contact TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pf_messages_user ON pf_messages(user_id, created_at DESC);

------------------------------------------------------------------------------
-- Lookups are always "everything of this user, in display order".
------------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_pf_hero_roles_user      ON pf_hero_roles(user_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_pf_about_sections_user  ON pf_about_sections(user_id, audience, sort_order);
CREATE INDEX IF NOT EXISTS idx_pf_about_blocks_user    ON pf_about_blocks(user_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_pf_education_user       ON pf_education(user_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_pf_interests_user       ON pf_interests(user_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_pf_core_skills_user     ON pf_core_skills(user_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_pf_projects_user        ON pf_projects(user_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_pf_experiences_user     ON pf_experiences(user_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_pf_tech_categories_user ON pf_tech_categories(user_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_pf_checklist_user       ON pf_checklist(user_id, sort_order);

------------------------------------------------------------------------------
-- RLS: same permissive policy as every other table in this project (see 001).
------------------------------------------------------------------------------

ALTER TABLE pf_profile         ENABLE ROW LEVEL SECURITY;
ALTER TABLE pf_hero_roles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE pf_labels          ENABLE ROW LEVEL SECURITY;
ALTER TABLE pf_about_sections  ENABLE ROW LEVEL SECURITY;
ALTER TABLE pf_about_blocks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE pf_education       ENABLE ROW LEVEL SECURITY;
ALTER TABLE pf_interests       ENABLE ROW LEVEL SECURITY;
ALTER TABLE pf_core_skills     ENABLE ROW LEVEL SECURITY;
ALTER TABLE pf_projects        ENABLE ROW LEVEL SECURITY;
ALTER TABLE pf_experiences     ENABLE ROW LEVEL SECURITY;
ALTER TABLE pf_tech_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE pf_checklist       ENABLE ROW LEVEL SECURITY;
ALTER TABLE pf_messages        ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access" ON pf_profile         FOR ALL USING (true);
CREATE POLICY "Allow all access" ON pf_hero_roles      FOR ALL USING (true);
CREATE POLICY "Allow all access" ON pf_labels          FOR ALL USING (true);
CREATE POLICY "Allow all access" ON pf_about_sections  FOR ALL USING (true);
CREATE POLICY "Allow all access" ON pf_about_blocks    FOR ALL USING (true);
CREATE POLICY "Allow all access" ON pf_education       FOR ALL USING (true);
CREATE POLICY "Allow all access" ON pf_interests       FOR ALL USING (true);
CREATE POLICY "Allow all access" ON pf_core_skills     FOR ALL USING (true);
CREATE POLICY "Allow all access" ON pf_projects        FOR ALL USING (true);
CREATE POLICY "Allow all access" ON pf_experiences     FOR ALL USING (true);
CREATE POLICY "Allow all access" ON pf_tech_categories FOR ALL USING (true);
CREATE POLICY "Allow all access" ON pf_checklist       FOR ALL USING (true);
CREATE POLICY "Allow all access" ON pf_messages        FOR ALL USING (true);

-- Make PostgREST see the new tables now, not after its next cache refresh.
NOTIFY pgrst, 'reload schema';
