-- Migration: 053_cv_maker.sql
-- CV Maker: each signed-in user keeps any number of CVs, edits them with a
-- live preview and prints them to PDF. Namespaced behind `cv_`. Creates new
-- objects only.
--
-- MODEL
--   * cv_resumes: one CV. Its content (personal details, summary, experience,
--     education, projects, skills, …, plus section order and hidden sections)
--     is one JSONB document shaped by src/lib/cvMaker.ts (CvData), so new
--     fields need no migration. `template` and `accent` pick the look.
--     `user_id` (IAM user id) owns the row; the app lists only the user's own.
--
-- RLS: same permissive policy as the rest of the project (no Supabase Auth;
-- ownership is enforced by the app).

CREATE TABLE IF NOT EXISTS cv_resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled CV',
  template TEXT NOT NULL DEFAULT 'classic' CHECK (template IN ('classic', 'modern', 'minimal')),
  accent TEXT NOT NULL DEFAULT '#2a78d6',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cv_resumes_user ON cv_resumes(user_id, updated_at DESC);

ALTER TABLE cv_resumes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access" ON cv_resumes;
CREATE POLICY "Allow all access" ON cv_resumes FOR ALL USING (true);
