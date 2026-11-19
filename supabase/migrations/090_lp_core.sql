-- Migration: 090_lp_core.sql
-- Life-Stage Parenting (lp_) — the parenting app (web + Android/tablet/Chromebook,
-- repo cryptdox/life-stage-parenting) is controlled from batools (Parenting menu)
-- and keeps its data in this database. Three migrations:
--   090  core: sign-in check, app settings, feature switches, announcements,
--        feedback, files, sync manifest
--   091  content batools edits: life stages, age groups, knowledge domains,
--        categories, resources, sources, task templates, milestones, vaccine
--        schedules, relation types, achievements, garden levels
--   092  family data the app's users own: families, members, children,
--        pregnancies, health records, tasks, learning progress, XP
--
-- Two kinds of caller:
--   * batools: an IAM token of the CRYPTDOX realm in x-iam-token, checked by
--     private.lt_iam_claims() (054). Edits content; never sees family data.
--   * the app: an IAM token of the app's own realm in x-lp-token, checked by
--     private.lp_claims() below against Vault 'lp_iam_jwt_secret' (that realm's
--     SECRET RealmSetting). Reads content; owns its family's data.
--   Without a token the app (signed out, or offline-first start) still reads
--   content.
--
-- Text shown in the app is JSONB per language: {"en": "...", "bn": "..."}.
-- Life-day axis used by every age-aware table: day 0 = birth; a pregnancy is
-- negative (gestation day - 280, so the first day of the LMP is -280); before
-- pregnancy (planning) is below -280. Ranges are [from_day, to_day): NULL = open.

DO $$
BEGIN
  IF to_regprocedure('private.lt_iam_claims()') IS NULL THEN
    RAISE EXCEPTION 'private.lt_iam_claims() is missing: run the Late Tracker organizations migration (054) first.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'lp_iam_jwt_secret') THEN
    RAISE NOTICE 'Vault has no ''lp_iam_jwt_secret'' yet: app users cannot sign in until it holds the parenting realm''s secret. Content works without it.';
  END IF;
END $$;

GRANT USAGE ON SCHEMA private TO anon, authenticated;

DO $$
BEGIN
  CREATE TYPE lp_review_status AS ENUM ('draft', 'in_review', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  CREATE TYPE lp_feature_status AS ENUM ('hidden', 'coming_soon', 'beta', 'active', 'maintenance');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION lp_touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- Sign-in ------------------------------------------------------------------
-- The app user's token claims, or NULL. Same check as lt_iam_claims(), with the
-- parenting realm's secret. When Vault also holds 'lp_iam_realm_id', the
-- token must name that realm.
CREATE OR REPLACE FUNCTION private.lp_claims()
RETURNS JSON
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = private, public, extensions
AS $$
DECLARE
  tok TEXT := nullif(current_setting('request.headers', true)::json ->> 'x-lp-token', '');
  parts TEXT[];
  payload JSON;
  secret TEXT;
  realm TEXT;
BEGIN
  IF tok IS NULL THEN RETURN NULL; END IF;
  parts := string_to_array(tok, '.');
  IF coalesce(array_length(parts, 1), 0) <> 3 THEN RETURN NULL; END IF;

  SELECT decrypted_secret INTO secret FROM vault.decrypted_secrets WHERE name = 'lp_iam_jwt_secret';
  IF secret IS NULL THEN RETURN NULL; END IF;
  IF translate(encode(hmac(parts[1] || '.' || parts[2], secret, 'sha256'), 'base64'), E'+/=\n', '-_') <> parts[3] THEN
    RETURN NULL;
  END IF;

  BEGIN
    payload := convert_from(decode(
      translate(parts[2], '-_', '+/') || repeat('=', (4 - length(parts[2]) % 4) % 4), 'base64'), 'utf8')::json;
    IF to_timestamp((payload ->> 'exp')::double precision) <= now() THEN RETURN NULL; END IF;
    IF (payload ->> 'userId')::uuid IS NULL THEN RETURN NULL; END IF;
    SELECT decrypted_secret INTO realm FROM vault.decrypted_secrets WHERE name = 'lp_iam_realm_id';
    IF realm IS NOT NULL AND realm <> coalesce(payload ->> 'realmId', '') THEN RETURN NULL; END IF;
    RETURN payload;
  EXCEPTION WHEN others THEN RETURN NULL;
  END;
END $$;

-- The signed-in app user's IAM id, or NULL.
CREATE OR REPLACE FUNCTION private.lp_uid()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = private, public AS $$
  SELECT (private.lp_claims() ->> 'userId')::uuid
$$;

-- batools (a CRYPTDOX IAM token).
CREATE OR REPLACE FUNCTION private.lp_is_editor()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = private, public AS $$
  SELECT private.lt_iam_claims() IS NOT NULL
$$;

REVOKE ALL ON FUNCTION private.lp_claims(), private.lp_uid(), private.lp_is_editor() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.lp_claims(), private.lp_uid(), private.lp_is_editor() TO anon, authenticated;

-- Tables -------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS lp_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('image', 'audio', 'video', 'animation', 'pdf', 'other')),
  provider TEXT NOT NULL DEFAULT 'supabase',
  bucket TEXT DEFAULT 'life-stage-parenting',
  path TEXT,
  url TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  duration_seconds NUMERIC(10, 2),
  -- Credit / licence shown under the media.
  credit TEXT,
  license TEXT,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lp_app_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  latest_version_code INT NOT NULL DEFAULT 1,
  -- Older builds get a blocking "please update" screen.
  min_supported_version_code INT NOT NULL DEFAULT 1,
  update_message JSONB NOT NULL DEFAULT '{}',
  maintenance_mode BOOLEAN NOT NULL DEFAULT false,
  maintenance_message JSONB NOT NULL DEFAULT '{}',
  default_language TEXT NOT NULL DEFAULT 'bn' CHECK (default_language IN ('bn', 'en')),
  default_country TEXT NOT NULL DEFAULT 'BD',
  play_store_url TEXT,
  web_url TEXT,
  support_email TEXT,
  privacy_url TEXT,
  terms_url TEXT,
  -- Shown on every medical page and at sign-up.
  medical_disclaimer JSONB NOT NULL DEFAULT '{}',
  -- Per country: {"BD": [{"label": {"en": "...", "bn": "..."}, "number": "999"}]}
  emergency_numbers JSONB NOT NULL DEFAULT '{}',
  share_text JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

CREATE TABLE IF NOT EXISTS lp_features (
  key TEXT PRIMARY KEY,
  name JSONB NOT NULL,
  description JSONB NOT NULL DEFAULT '{}',
  feature_group TEXT NOT NULL CHECK (feature_group IN ('journey', 'health', 'learn', 'family', 'engage', 'ai')),
  -- Where the app puts its entry point.
  tab TEXT NOT NULL CHECK (tab IN ('home', 'journey', 'learn', 'health', 'tasks', 'family')),
  phase SMALLINT NOT NULL CHECK (phase BETWEEN 1 AND 6),
  status lp_feature_status NOT NULL DEFAULT 'hidden',
  -- First app build (versionCode) that contains the feature; NULL = not built yet.
  min_version_code INT,
  icon TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  status_message JSONB,
  -- IAM user ids that see a 'beta' feature.
  beta_testers TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  CONSTRAINT lp_features_built CHECK (status IN ('hidden', 'coming_soon') OR min_version_code IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS lp_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title JSONB NOT NULL,
  body JSONB NOT NULL DEFAULT '{}',
  image_url TEXT,
  -- A web link, or an in-app route such as app://learn/safe-sleep.
  link_url TEXT,
  placement TEXT NOT NULL DEFAULT 'home' CHECK (placement IN ('home', 'popup', 'banner')),
  -- Empty = every stage / every country.
  stage_keys TEXT[] NOT NULL DEFAULT '{}',
  countries TEXT[] NOT NULL DEFAULT '{}',
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  min_version_code INT,
  priority INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lp_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL DEFAULT 'general' CHECK (kind IN ('general', 'bug', 'content_error', 'medical_concern', 'feature_request')),
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 3 AND 2000),
  contact TEXT CHECK (char_length(contact) <= 200),
  -- What it is about, e.g. 'resource:<slug>' or 'milestone:<key>'.
  content_ref TEXT CHECK (char_length(content_ref) <= 200),
  -- Filled from the token when signed in.
  user_id UUID DEFAULT private.lp_uid(),
  app_version_code INT,
  platform TEXT CHECK (platform IN ('web', 'android', 'ios')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'seen', 'done', 'spam')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lp_feedback_created ON lp_feedback (created_at DESC);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['lp_app_settings', 'lp_features', 'lp_announcements'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_touch', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION lp_touch_updated_at()', t || '_touch', t);
  END LOOP;
END $$;

-- Access -------------------------------------------------------------------
DO $$
DECLARE
  editor CONSTANT TEXT := '(SELECT private.lp_is_editor())';
  r RECORD;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    -- table, what the app may read
    ('lp_files', 'true'),
    ('lp_app_settings', 'true'),
    ('lp_features', 'true'),
    ('lp_announcements', 'is_active AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now())')
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

  -- Feedback: anyone may add a new row; only batools reads and handles it.
  ALTER TABLE lp_feedback ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "lp feedback send" ON lp_feedback;
  DROP POLICY IF EXISTS "lp read" ON lp_feedback;
  DROP POLICY IF EXISTS "lp update" ON lp_feedback;
  DROP POLICY IF EXISTS "lp delete" ON lp_feedback;
  CREATE POLICY "lp feedback send" ON lp_feedback FOR INSERT TO anon, authenticated
    WITH CHECK (status = 'new' AND user_id IS NOT DISTINCT FROM (SELECT private.lp_uid()));
  EXECUTE format('CREATE POLICY "lp read" ON lp_feedback FOR SELECT TO anon, authenticated USING (%s)', editor);
  EXECUTE format('CREATE POLICY "lp update" ON lp_feedback FOR UPDATE TO anon, authenticated USING (%s) WITH CHECK (%s)', editor, editor);
  EXECUTE format('CREATE POLICY "lp delete" ON lp_feedback FOR DELETE TO anon, authenticated USING (%s)', editor);
END $$;

-- Storage: public bucket for content media; only batools uploads, replaces or deletes.
INSERT INTO storage.buckets (id, name, public) VALUES ('life-stage-parenting', 'life-stage-parenting', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "life-stage-parenting read" ON storage.objects;
DROP POLICY IF EXISTS "life-stage-parenting insert" ON storage.objects;
DROP POLICY IF EXISTS "life-stage-parenting update" ON storage.objects;
DROP POLICY IF EXISTS "life-stage-parenting delete" ON storage.objects;
CREATE POLICY "life-stage-parenting read" ON storage.objects FOR SELECT TO public USING (bucket_id = 'life-stage-parenting');
CREATE POLICY "life-stage-parenting insert" ON storage.objects FOR INSERT TO public
  WITH CHECK (bucket_id = 'life-stage-parenting' AND (SELECT private.lp_is_editor()));
CREATE POLICY "life-stage-parenting update" ON storage.objects FOR UPDATE TO public
  USING (bucket_id = 'life-stage-parenting' AND (SELECT private.lp_is_editor()));
CREATE POLICY "life-stage-parenting delete" ON storage.objects FOR DELETE TO public
  USING (bucket_id = 'life-stage-parenting' AND (SELECT private.lp_is_editor()));

-- What changed ---------------------------------------------------------------
-- A fingerprint of each listed lp_ table as the caller sees it (RLS applies),
-- so the app reloads only tables whose fingerprint changed.
CREATE OR REPLACE FUNCTION public.lp_sync_manifest(p_tables TEXT[])
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE
  t TEXT;
  fingerprint TEXT;
  result JSONB := '{}';
BEGIN
  IF cardinality(p_tables) > 60 THEN
    RAISE EXCEPTION 'too many tables';
  END IF;
  FOREACH t IN ARRAY p_tables LOOP
    CONTINUE WHEN t !~ '^lp_[a-z_]{1,60}$' OR to_regclass(format('public.%I', t)) IS NULL;
    EXECUTE format('SELECT md5(coalesce(string_agg(md5(x::text), '','' ORDER BY md5(x::text)), '''')) FROM %I x', t) INTO fingerprint;
    result := result || jsonb_build_object(t, fingerprint);
  END LOOP;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.lp_sync_manifest(TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lp_sync_manifest(TEXT[]) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
