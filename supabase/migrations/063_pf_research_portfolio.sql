-- Migration: 063_pf_research_portfolio.sql
-- Portfolio versions (developer, researcher, …) and what the researcher
-- version needs. Additive only: until a version exists the site shows
-- everything, as before.
--
--   pf_versions             one row per version of the portfolio. `layout`
--                           picks how the site draws it; is_active publishes
--                           it; the is_default one is shown when the visitor
--                           asks for none. A version can override the hero
--                           title, carry its own statement (rich text),
--                           interests, affiliation and CV.
--   versions UUID[]         on every content table: the versions a row is
--                           shown in. Empty = every version (the default).
--                           Ids of deleted versions are ignored.
--   pf_profile              academic links (Hugging Face, Google Scholar,
--                           ORCID, ResearchGate).
--   pf_experiences.kind     industry | research | teaching, so research roles
--                           can be listed on their own.
--   pf_research_artifacts   released models, datasets, demos and code, each
--                           optionally tied to the publication it comes from.
--
-- Same conventions and RLS as the other pf_ tables (see 025).

CREATE TABLE IF NOT EXISTS pf_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  -- Address of the version: ?version=<slug>. "all" is reserved.
  slug TEXT NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND slug <> 'all'),
  name_en TEXT NOT NULL,
  name_bn TEXT NOT NULL DEFAULT '',
  layout TEXT NOT NULL DEFAULT 'developer' CHECK (layout IN ('developer', 'researcher')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  -- Overrides; empty falls back to the profile.
  title_en TEXT,
  title_bn TEXT,
  statement_en TEXT,
  statement_bn TEXT,
  -- Researcher layout.
  affiliation_en TEXT,
  affiliation_bn TEXT,
  interests_en TEXT[] NOT NULL DEFAULT '{}',
  interests_bn TEXT[] NOT NULL DEFAULT '{}',
  cv_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_pf_versions_user ON pf_versions(user_id, sort_order);

ALTER TABLE pf_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access" ON pf_versions;
CREATE POLICY "Allow all access" ON pf_versions FOR ALL USING (true);

ALTER TABLE pf_profile
  -- Handles / ids only, like the social columns; the site builds the URLs.
  ADD COLUMN IF NOT EXISTS huggingface TEXT,
  ADD COLUMN IF NOT EXISTS google_scholar TEXT,  -- the `user=` id of the profile URL
  ADD COLUMN IF NOT EXISTS orcid TEXT,           -- 0000-0000-0000-0000
  ADD COLUMN IF NOT EXISTS researchgate TEXT;    -- profile name, e.g. Abir-Hosen

ALTER TABLE pf_experiences
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'industry';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pf_experiences_kind_check') THEN
    ALTER TABLE pf_experiences ADD CONSTRAINT pf_experiences_kind_check
      CHECK (kind IN ('industry', 'research', 'teaching'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS pf_research_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  kind TEXT NOT NULL DEFAULT 'model' CHECK (kind IN ('model', 'dataset', 'demo', 'code')),
  platform TEXT NOT NULL DEFAULT 'huggingface'
    CHECK (platform IN ('huggingface', 'kaggle', 'github', 'zenodo', 'website', 'other')),
  title_en TEXT NOT NULL,
  title_bn TEXT NOT NULL DEFAULT '',
  description_en TEXT,
  description_bn TEXT,
  url TEXT NOT NULL,
  -- A model's live demo (e.g. its Hugging Face Space), shown as a second button.
  demo_url TEXT,
  -- The paper it comes from; unlinked when the paper is deleted.
  publication_id UUID REFERENCES pf_publications(id) ON DELETE SET NULL,
  -- Headline results, never translated, e.g. "94.49% accuracy".
  metrics TEXT[] NOT NULL DEFAULT '{}',
  tags TEXT[] NOT NULL DEFAULT '{}',
  released_on DATE,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pf_research_artifacts_user ON pf_research_artifacts(user_id, sort_order);

ALTER TABLE pf_research_artifacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access" ON pf_research_artifacts;
CREATE POLICY "Allow all access" ON pf_research_artifacts FOR ALL USING (true);

-- The version tag on every content table (children such as about blocks,
-- case-study sections and article blocks follow their parent).
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'pf_hero_roles', 'pf_about_sections', 'pf_education', 'pf_interests', 'pf_core_skills', 'pf_checklist',
    'pf_projects', 'pf_experiences', 'pf_tech_categories', 'pf_publications', 'pf_posts', 'pf_research_artifacts'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS versions UUID[] NOT NULL DEFAULT ''{}''', t);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
