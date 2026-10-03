-- Migration: 030_org_site_tables.sql
-- Organization website CMS: everything the CryptDox public website
-- (cryptdox-public-website) used to read from its own Supabase project,
-- moved here so Bangla Tools can edit it. Namespaced behind `org_`.
--
-- SHAPE:
--   * Every row carries `org_id` — the IAM realm id of the signed-in user.
--     Each realm is a separate organization; the public site picks one with
--     its VITE_ORG_ID.
--   * Every row carries `created_by` / `updated_by` — IAM user ids. Bangla
--     Tools writes the signed-in user; the default covers rows written
--     without one (migrated data, the site's contact / job forms).
--   * Display lists have `sort_order` (ascending = display order) and
--     `is_visible`, which replaces the old `is_deleted` soft delete: hide an
--     item to take it off the site, delete it to remove it for good.
--   * The old platform_user / platform_role / platform_user_role tables are
--     not carried over: users and roles live in IAM now.
--
-- RLS: same permissive policy as the rest of the project. The site reads
-- with the anon key and its contact / job application forms insert with it.

------------------------------------------------------------------------------
-- Company
------------------------------------------------------------------------------

-- One row per organization (the About page).
CREATE TABLE IF NOT EXISTS org_about (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT '',
  founder_name TEXT,
  mission TEXT,
  description TEXT,
  story TEXT,
  core_values TEXT[] NOT NULL DEFAULT '{}',
  founder_image_url TEXT,
  created_by UUID DEFAULT '88b3efb5-8c58-486e-a3f7-751cc4b23e60',
  updated_by UUID DEFAULT '88b3efb5-8c58-486e-a3f7-751cc4b23e60',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  -- A lucide-react icon name the site renders (e.g. Code, Cloud, Smartphone).
  lucide_icon TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_by UUID DEFAULT '88b3efb5-8c58-486e-a3f7-751cc4b23e60',
  updated_by UUID DEFAULT '88b3efb5-8c58-486e-a3f7-751cc4b23e60',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Products / packages, each optionally under a service.
CREATE TABLE IF NOT EXISTS org_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  service_id UUID REFERENCES org_services(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_free BOOLEAN NOT NULL DEFAULT false,
  price NUMERIC(12, 2) CHECK (price IS NULL OR price >= 0),
  image_url TEXT,
  site_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_by UUID DEFAULT '88b3efb5-8c58-486e-a3f7-751cc4b23e60',
  updated_by UUID DEFAULT '88b3efb5-8c58-486e-a3f7-751cc4b23e60',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org_faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_by UUID DEFAULT '88b3efb5-8c58-486e-a3f7-751cc4b23e60',
  updated_by UUID DEFAULT '88b3efb5-8c58-486e-a3f7-751cc4b23e60',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

------------------------------------------------------------------------------
-- Clients & testimonials
------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS org_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  organization TEXT NOT NULL,
  joined_at DATE,
  sort_order INT NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_by UUID DEFAULT '88b3efb5-8c58-486e-a3f7-751cc4b23e60',
  updated_by UUID DEFAULT '88b3efb5-8c58-486e-a3f7-751cc4b23e60',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- `is_visible` is the old `approved`: only visible testimonials reach the site.
CREATE TABLE IF NOT EXISTS org_testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  client_id UUID REFERENCES org_clients(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  rating INT NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  sort_order INT NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_by UUID DEFAULT '88b3efb5-8c58-486e-a3f7-751cc4b23e60',
  updated_by UUID DEFAULT '88b3efb5-8c58-486e-a3f7-751cc4b23e60',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

------------------------------------------------------------------------------
-- Blog & careers
------------------------------------------------------------------------------

-- `content` is HTML (the site renders it as rich text). Newest first on the site.
CREATE TABLE IF NOT EXISTS org_blogs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_by UUID DEFAULT '88b3efb5-8c58-486e-a3f7-751cc4b23e60',
  updated_by UUID DEFAULT '88b3efb5-8c58-486e-a3f7-751cc4b23e60',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Job circulars. The site lists visible ones whose expire date is today or later.
CREATE TABLE IF NOT EXISTS org_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  recruitment_expire_date DATE,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_by UUID DEFAULT '88b3efb5-8c58-486e-a3f7-751cc4b23e60',
  updated_by UUID DEFAULT '88b3efb5-8c58-486e-a3f7-751cc4b23e60',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Inbound: written by the site's job application form.
CREATE TABLE IF NOT EXISTS org_job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  job_id UUID NOT NULL REFERENCES org_jobs(id) ON DELETE CASCADE,
  applicant_name TEXT NOT NULL,
  email TEXT NOT NULL,
  objective TEXT,
  cv_url TEXT,
  is_reviewed BOOLEAN NOT NULL DEFAULT false,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  created_by UUID DEFAULT '88b3efb5-8c58-486e-a3f7-751cc4b23e60',
  updated_by UUID DEFAULT '88b3efb5-8c58-486e-a3f7-751cc4b23e60',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Inbound: written by the site's contact form.
CREATE TABLE IF NOT EXISTS org_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'replied')),
  created_by UUID DEFAULT '88b3efb5-8c58-486e-a3f7-751cc4b23e60',
  updated_by UUID DEFAULT '88b3efb5-8c58-486e-a3f7-751cc4b23e60',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

------------------------------------------------------------------------------
-- Teams, people and their portfolios (the old individual_* tables)
------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS org_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_by UUID DEFAULT '88b3efb5-8c58-486e-a3f7-751cc4b23e60',
  updated_by UUID DEFAULT '88b3efb5-8c58-486e-a3f7-751cc4b23e60',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The skill catalogue members pick from.
CREATE TABLE IF NOT EXISTS org_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_by UUID DEFAULT '88b3efb5-8c58-486e-a3f7-751cc4b23e60',
  updated_by UUID DEFAULT '88b3efb5-8c58-486e-a3f7-751cc4b23e60',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, name)
);

-- A person shown on the site (was individual_portfolio + platform_user).
CREATE TABLE IF NOT EXISTS org_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  name TEXT NOT NULL,
  designation TEXT,
  objective TEXT,
  profile_image_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_by UUID DEFAULT '88b3efb5-8c58-486e-a3f7-751cc4b23e60',
  updated_by UUID DEFAULT '88b3efb5-8c58-486e-a3f7-751cc4b23e60',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org_member_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  member_id UUID NOT NULL REFERENCES org_members(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES org_teams(id) ON DELETE CASCADE,
  created_by UUID DEFAULT '88b3efb5-8c58-486e-a3f7-751cc4b23e60',
  updated_by UUID DEFAULT '88b3efb5-8c58-486e-a3f7-751cc4b23e60',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (member_id, team_id)
);

CREATE TABLE IF NOT EXISTS org_member_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  member_id UUID NOT NULL REFERENCES org_members(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES org_skills(id) ON DELETE CASCADE,
  level TEXT CHECK (level IS NULL OR level IN ('Beginner', 'Intermediate', 'Advanced', 'Expert')),
  created_by UUID DEFAULT '88b3efb5-8c58-486e-a3f7-751cc4b23e60',
  updated_by UUID DEFAULT '88b3efb5-8c58-486e-a3f7-751cc4b23e60',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (member_id, skill_id)
);

CREATE TABLE IF NOT EXISTS org_member_education (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  member_id UUID NOT NULL REFERENCES org_members(id) ON DELETE CASCADE,
  degree TEXT NOT NULL,
  institution TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  sort_order INT NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_by UUID DEFAULT '88b3efb5-8c58-486e-a3f7-751cc4b23e60',
  updated_by UUID DEFAULT '88b3efb5-8c58-486e-a3f7-751cc4b23e60',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org_member_experiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  member_id UUID NOT NULL REFERENCES org_members(id) ON DELETE CASCADE,
  company TEXT NOT NULL,
  position TEXT NOT NULL,
  start_date DATE,
  -- NULL = current position.
  end_date DATE,
  sort_order INT NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_by UUID DEFAULT '88b3efb5-8c58-486e-a3f7-751cc4b23e60',
  updated_by UUID DEFAULT '88b3efb5-8c58-486e-a3f7-751cc4b23e60',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The site's Portfolio page. `member_id` is who built it, if anyone in particular.
CREATE TABLE IF NOT EXISTS org_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  member_id UUID REFERENCES org_members(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  technology_used TEXT[] NOT NULL DEFAULT '{}',
  link TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_by UUID DEFAULT '88b3efb5-8c58-486e-a3f7-751cc4b23e60',
  updated_by UUID DEFAULT '88b3efb5-8c58-486e-a3f7-751cc4b23e60',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

------------------------------------------------------------------------------
-- Lookups are "everything of this org, in display order".
------------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_org_services_org     ON org_services(org_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_org_products_org     ON org_products(org_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_org_products_service ON org_products(service_id);
CREATE INDEX IF NOT EXISTS idx_org_faqs_org         ON org_faqs(org_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_org_clients_org      ON org_clients(org_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_org_testimonials_org ON org_testimonials(org_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_org_blogs_org        ON org_blogs(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_jobs_org         ON org_jobs(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_job_apps_org     ON org_job_applications(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_job_apps_job     ON org_job_applications(job_id);
CREATE INDEX IF NOT EXISTS idx_org_contacts_org     ON org_contacts(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_teams_org        ON org_teams(org_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_org_members_org      ON org_members(org_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_org_member_teams_m   ON org_member_teams(member_id);
CREATE INDEX IF NOT EXISTS idx_org_member_skills_m  ON org_member_skills(member_id);
CREATE INDEX IF NOT EXISTS idx_org_member_edu_m     ON org_member_education(member_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_org_member_exp_m     ON org_member_experiences(member_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_org_projects_org     ON org_projects(org_id, sort_order);

------------------------------------------------------------------------------
-- RLS: same permissive policy as every other table in this project (see 001).
------------------------------------------------------------------------------

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'org_about', 'org_services', 'org_products', 'org_faqs', 'org_clients', 'org_testimonials',
    'org_blogs', 'org_jobs', 'org_job_applications', 'org_contacts', 'org_teams', 'org_skills',
    'org_members', 'org_member_teams', 'org_member_skills', 'org_member_education',
    'org_member_experiences', 'org_projects'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Allow all access" ON %I', t);
    EXECUTE format('CREATE POLICY "Allow all access" ON %I FOR ALL USING (true)', t);
  END LOOP;
END $$;

------------------------------------------------------------------------------
-- Storage: public `org` bucket. Files live under `<org_id>/…` (images under
-- `<org_id>/images/`, CVs from the job form under `<org_id>/applications/`).
------------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('org', 'org', true, 10485760, ARRAY[
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'
])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "org read"   ON storage.objects;
DROP POLICY IF EXISTS "org insert" ON storage.objects;
DROP POLICY IF EXISTS "org update" ON storage.objects;
DROP POLICY IF EXISTS "org delete" ON storage.objects;
CREATE POLICY "org read"   ON storage.objects FOR SELECT USING (bucket_id = 'org');
CREATE POLICY "org insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'org');
CREATE POLICY "org update" ON storage.objects FOR UPDATE USING (bucket_id = 'org');
CREATE POLICY "org delete" ON storage.objects FOR DELETE USING (bucket_id = 'org');

NOTIFY pgrst, 'reload schema';
