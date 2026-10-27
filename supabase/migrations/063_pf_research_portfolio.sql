-- Migration: 063_pf_research_portfolio.sql
-- What a researcher-style portfolio needs on top of the publications (027).
-- Additive only: the current portfolio ignores all of it.
--
--   pf_profile              research headline, affiliation, research statement
--                           (rich text), research interests, academic links
--                           (Hugging Face, Google Scholar, ORCID, ResearchGate)
--                           and a research CV, kept apart from the industry
--                           resume_url.
--   pf_experiences.kind     industry | research | teaching, so research roles
--                           can be listed on their own.
--   pf_research_artifacts   released models, datasets, demos and code, each
--                           optionally tied to the publication it comes from.
--
-- Same conventions and RLS as the other pf_ tables (see 025).

ALTER TABLE pf_profile
  ADD COLUMN IF NOT EXISTS research_title_en TEXT,
  ADD COLUMN IF NOT EXISTS research_title_bn TEXT,
  ADD COLUMN IF NOT EXISTS affiliation_en TEXT,
  ADD COLUMN IF NOT EXISTS affiliation_bn TEXT,
  ADD COLUMN IF NOT EXISTS research_statement_en TEXT,
  ADD COLUMN IF NOT EXISTS research_statement_bn TEXT,
  ADD COLUMN IF NOT EXISTS research_interests_en TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS research_interests_bn TEXT[] NOT NULL DEFAULT '{}',
  -- Handles / ids only, like the social columns; the site builds the URLs.
  ADD COLUMN IF NOT EXISTS huggingface TEXT,
  ADD COLUMN IF NOT EXISTS google_scholar TEXT,  -- the `user=` id of the profile URL
  ADD COLUMN IF NOT EXISTS orcid TEXT,           -- 0000-0000-0000-0000
  ADD COLUMN IF NOT EXISTS researchgate TEXT,    -- profile name, e.g. Abir-Hosen
  ADD COLUMN IF NOT EXISTS research_cv_url TEXT;

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

NOTIFY pgrst, 'reload schema';
