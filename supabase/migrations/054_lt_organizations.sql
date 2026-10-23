-- Migration: 054_lt_organizations.sql
-- Late Tracker data now belongs to an organization.
--
--   lt_organizations        one row per organization (its info)
--   lt_organization_users   which IAM users belong to which organization;
--                           is_owner marks its owners
--
-- Whoever creates an organization is its owner. Owners add users (by email),
-- make or unmake owners and remove members, but an organization always keeps
-- at least one owner (checked by the functions and enforced by a trigger).
--
-- Every existing lt_ table gets an organization_id. All current rows are
-- backfilled to a "GHL" organization, created here, and its owner is
-- abir.hosen@ghl.healthcare (IAM realm CRYPTDOX). Nothing is copied, deleted or
-- recreated: columns are added and filled in place, and the foreign keys are
-- ON DELETE RESTRICT so removing an organization can never take its data with it.
--
-- Users are mapped by IAM user id. The GHL owner, and anyone an owner adds, is
-- known by email only at first (the id lives in IAM); lt_my_organizations()
-- fills the id in the first time that user calls it, taken from their verified
-- IAM token, never from the client.
--
-- The org_ prefix belongs to the Organization Site module, so these stay lt_.
-- Reads are not filtered by organization yet; that comes with the app change
-- that scopes every Late Tracker query (shukhee branch).

-- 1. Organizations and their users
CREATE TABLE IF NOT EXISTS lt_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  description TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  website TEXT,
  -- IAM user id of whoever created it; NULL for the GHL organization made here.
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lt_organization_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES lt_organizations(id) ON DELETE CASCADE,
  -- NULL until the user signs in once (see the header).
  iam_user_id UUID,
  email TEXT NOT NULL,
  is_owner BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lt_organization_users_org_user_key UNIQUE (organization_id, iam_user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS lt_organization_users_org_email_key
  ON lt_organization_users (organization_id, lower(email));
CREATE INDEX IF NOT EXISTS lt_organization_users_iam_user_id_idx ON lt_organization_users (iam_user_id);
CREATE INDEX IF NOT EXISTS lt_organization_users_email_idx ON lt_organization_users (lower(email));

-- Organization info may be read like the other lt_ tables; changes go through
-- the functions below. Memberships hold emails, so they get no policy at all:
-- only the SECURITY DEFINER functions reach them.
ALTER TABLE lt_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE lt_organization_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lt org read" ON lt_organizations;
CREATE POLICY "lt org read" ON lt_organizations FOR SELECT TO anon, authenticated USING (true);

-- 2. The GHL organization, its admin, and every existing row moved under it
DO $$
DECLARE
  v_org UUID;
  v_table TEXT;
BEGIN
  SELECT id INTO v_org FROM lt_organizations WHERE name = 'GHL' AND created_by IS NULL ORDER BY created_at LIMIT 1;
  IF v_org IS NULL THEN
    INSERT INTO lt_organizations (name) VALUES ('GHL') RETURNING id INTO v_org;
  END IF;

  INSERT INTO lt_organization_users (organization_id, email, is_owner)
  VALUES (v_org, 'abir.hosen@ghl.healthcare', true)
  ON CONFLICT (organization_id, lower(email)) DO UPDATE SET is_owner = true, updated_at = now();

  FOREACH v_table IN ARRAY ARRAY[
    'lt_team_member_types',
    'lt_team_members',
    'lt_attendance_settings',
    'lt_attendance_records',
    'lt_punishments',
    'lt_punishment_transactions',
    'lt_spends'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS organization_id UUID', v_table);
    EXECUTE format('UPDATE %I SET organization_id = %L WHERE organization_id IS NULL', v_table, v_org);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN organization_id SET NOT NULL', v_table);
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = v_table || '_organization_id_fkey'
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (organization_id) REFERENCES lt_organizations(id) ON DELETE RESTRICT',
        v_table, v_table || '_organization_id_fkey'
      );
    END IF;
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (organization_id)', 'idx_' || v_table || '_organization_id', v_table);
  END LOOP;
END $$;

-- 3. Type names were unique across everyone; now they are unique per organization.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.lt_team_member_types'::regclass
      AND c.contype = 'u'
      AND c.conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'public.lt_team_member_types'::regclass AND attname = 'name')]
  LOOP
    EXECUTE format('ALTER TABLE lt_team_member_types DROP CONSTRAINT %I', r.conname);
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lt_team_member_types_org_name_key') THEN
    ALTER TABLE lt_team_member_types
      ADD CONSTRAINT lt_team_member_types_org_name_key UNIQUE (organization_id, name);
  END IF;
END $$;

-- 4. Rows that hang off a member or a punishment take their organization from
--    it, so record_attendance / add_punishment_transaction (and any insert that
--    leaves it out) stay correct without being told.
CREATE OR REPLACE FUNCTION lt_inherit_organization()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    IF TG_TABLE_NAME = 'lt_punishment_transactions' THEN
      SELECT organization_id INTO NEW.organization_id FROM lt_punishments WHERE id = NEW.punishment_id;
    ELSE
      SELECT organization_id INTO NEW.organization_id FROM lt_team_members WHERE id = NEW.team_member_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lt_attendance_records_organization ON lt_attendance_records;
CREATE TRIGGER lt_attendance_records_organization BEFORE INSERT ON lt_attendance_records
  FOR EACH ROW EXECUTE FUNCTION lt_inherit_organization();
DROP TRIGGER IF EXISTS lt_punishments_organization ON lt_punishments;
CREATE TRIGGER lt_punishments_organization BEFORE INSERT ON lt_punishments
  FOR EACH ROW EXECUTE FUNCTION lt_inherit_organization();
DROP TRIGGER IF EXISTS lt_punishment_transactions_organization ON lt_punishment_transactions;
CREATE TRIGGER lt_punishment_transactions_organization BEFORE INSERT ON lt_punishment_transactions
  FOR EACH ROW EXECUTE FUNCTION lt_inherit_organization();

-- 5. Bulk waiver can be limited to one organization. Same body as 010 plus the
--    filter; NULL keeps the old behaviour. Dropped first so the old 3-argument
--    version does not linger as an ambiguous overload.
DROP FUNCTION IF EXISTS waive_all_remaining(DATE, DATE, TEXT);
CREATE OR REPLACE FUNCTION waive_all_remaining(
  p_from DATE DEFAULT NULL,
  p_to DATE DEFAULT NULL,
  p_note TEXT DEFAULT NULL,
  p_organization_id UUID DEFAULT NULL
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH outstanding AS (
    SELECT
      p.id,
      p.punishment_amount - COALESCE(SUM(t.amount), 0) AS remaining
    FROM lt_punishments p
    LEFT JOIN lt_punishment_transactions t ON t.punishment_id = p.id
    WHERE (p_from IS NULL OR p.attendance_date >= p_from)
      AND (p_to IS NULL OR p.attendance_date <= p_to)
      AND (p_organization_id IS NULL OR p.organization_id = p_organization_id)
    GROUP BY p.id, p.punishment_amount
    HAVING p.punishment_amount - COALESCE(SUM(t.amount), 0) > 0
  )
  INSERT INTO lt_punishment_transactions (punishment_id, transaction_type, amount, note)
  SELECT id, 'DISCOUNT', remaining, COALESCE(p_note, 'Bulk waiver (reset dues)')
  FROM outstanding;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 6. Who is calling: the claims of this request's x-iam-token, checked the same
--    way as private.mp_iam_user() (047), or NULL when it is missing or invalid.
CREATE SCHEMA IF NOT EXISTS private;
CREATE OR REPLACE FUNCTION private.lt_iam_claims()
RETURNS JSON
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = private, public, extensions
AS $$
DECLARE
  tok TEXT := nullif(current_setting('request.headers', true)::json ->> 'x-iam-token', '');
  parts TEXT[];
  payload JSON;
  secret TEXT;
BEGIN
  IF tok IS NULL THEN RETURN NULL; END IF;
  parts := string_to_array(tok, '.');
  IF coalesce(array_length(parts, 1), 0) <> 3 THEN RETURN NULL; END IF;

  SELECT decrypted_secret INTO secret FROM vault.decrypted_secrets WHERE name = 'iam_jwt_secret';
  IF secret IS NULL THEN RETURN NULL; END IF;
  IF translate(encode(hmac(parts[1] || '.' || parts[2], secret, 'sha256'), 'base64'), E'+/=\n', '-_') <> parts[3] THEN
    RETURN NULL;
  END IF;

  BEGIN
    payload := convert_from(decode(
      translate(parts[2], '-_', '+/') || repeat('=', (4 - length(parts[2]) % 4) % 4), 'base64'), 'utf8')::json;
    IF to_timestamp((payload ->> 'exp')::double precision) <= now() THEN RETURN NULL; END IF;
    IF (payload ->> 'userId')::uuid IS NULL THEN RETURN NULL; END IF;
    RETURN payload;
  EXCEPTION WHEN others THEN RETURN NULL;
  END;
END $$;

REVOKE ALL ON FUNCTION private.lt_iam_claims() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.lt_iam_claims() TO anon, authenticated;

-- 7. The caller's organizations. Also links any membership seeded by email
--    (like the GHL admin) to the caller's IAM user id.
CREATE OR REPLACE FUNCTION lt_my_organizations()
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  website TEXT,
  is_owner BOOLEAN,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_claims JSON := private.lt_iam_claims();
  v_user UUID;
  v_email TEXT;
BEGIN
  IF v_claims IS NULL THEN
    RAISE EXCEPTION 'Sign in again to load your organizations.' USING ERRCODE = '28000';
  END IF;
  v_user := (v_claims ->> 'userId')::uuid;
  v_email := lower(nullif(v_claims ->> 'email', ''));

  IF v_email IS NOT NULL THEN
    UPDATE lt_organization_users ou
    SET iam_user_id = v_user, updated_at = now()
    WHERE ou.iam_user_id IS NULL
      AND lower(ou.email) = v_email
      AND NOT EXISTS (
        SELECT 1 FROM lt_organization_users x
        WHERE x.organization_id = ou.organization_id AND x.iam_user_id = v_user
      );
  END IF;

  RETURN QUERY
    SELECT o.id, o.name, o.description, o.email, o.phone, o.address, o.website, ou.is_owner, o.created_at
    FROM lt_organization_users ou
    JOIN lt_organizations o ON o.id = ou.organization_id
    WHERE ou.iam_user_id = v_user
    ORDER BY o.created_at, o.name;
END;
$$;

-- 8. Creates an organization with the caller as its owner; returns its id.
CREATE OR REPLACE FUNCTION lt_create_organization(
  p_name TEXT,
  p_description TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_website TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claims JSON := private.lt_iam_claims();
  v_user UUID;
  v_email TEXT;
  v_org UUID;
BEGIN
  IF v_claims IS NULL THEN
    RAISE EXCEPTION 'Sign in again to create an organization.' USING ERRCODE = '28000';
  END IF;
  v_user := (v_claims ->> 'userId')::uuid;
  v_email := coalesce(nullif(v_claims ->> 'email', ''), v_user::text);

  IF p_name IS NULL OR length(btrim(p_name)) = 0 THEN
    RAISE EXCEPTION 'Organization name is required';
  END IF;

  INSERT INTO lt_organizations (name, description, email, phone, address, website, created_by)
  VALUES (
    btrim(p_name),
    nullif(btrim(p_description), ''),
    nullif(btrim(p_email), ''),
    nullif(btrim(p_phone), ''),
    nullif(btrim(p_address), ''),
    nullif(btrim(p_website), ''),
    v_user
  )
  RETURNING id INTO v_org;

  INSERT INTO lt_organization_users (organization_id, iam_user_id, email, is_owner)
  VALUES (v_org, v_user, v_email, true);

  RETURN v_org;
END;
$$;

-- 9. An organization never ends up without an owner. Runs at commit, so a
--    transaction may hand ownership over (add the new owner, then step down).
--    Deleting the organization itself (which cascades here) is not blocked.
CREATE OR REPLACE FUNCTION lt_keep_an_owner()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.is_owner
     AND EXISTS (SELECT 1 FROM lt_organizations o WHERE o.id = OLD.organization_id)
     AND NOT EXISTS (
       SELECT 1 FROM lt_organization_users ou WHERE ou.organization_id = OLD.organization_id AND ou.is_owner
     ) THEN
    RAISE EXCEPTION 'An organization must keep at least one owner.';
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS lt_organization_users_keep_owner ON lt_organization_users;
CREATE CONSTRAINT TRIGGER lt_organization_users_keep_owner
  AFTER UPDATE OF is_owner, organization_id OR DELETE ON lt_organization_users
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION lt_keep_an_owner();

-- 10. Membership management. Every function checks the caller from their IAM
--     token; listing needs membership, changes need ownership. The organization
--     row is locked first so two owners acting at once cannot both step down.
CREATE OR REPLACE FUNCTION private.lt_caller_membership(p_organization_id UUID, p_owner BOOLEAN)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claims JSON := private.lt_iam_claims();
  v_user UUID;
BEGIN
  IF v_claims IS NULL THEN
    RAISE EXCEPTION 'Sign in again to manage the organization.' USING ERRCODE = '28000';
  END IF;
  v_user := (v_claims ->> 'userId')::uuid;
  PERFORM 1 FROM lt_organizations WHERE id = p_organization_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM lt_organization_users
    WHERE organization_id = p_organization_id AND iam_user_id = v_user AND (is_owner OR NOT p_owner)
  ) THEN
    RAISE EXCEPTION '%', CASE WHEN p_owner THEN 'Only an owner of this organization can do that.'
                              ELSE 'You are not a member of this organization.' END
      USING ERRCODE = '42501';
  END IF;
  RETURN v_user;
END;
$$;

REVOKE ALL ON FUNCTION private.lt_caller_membership(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.lt_caller_membership(UUID, BOOLEAN) TO anon, authenticated;

CREATE OR REPLACE FUNCTION lt_organization_members(p_organization_id UUID)
RETURNS TABLE (
  id UUID,
  email TEXT,
  iam_user_id UUID,
  is_owner BOOLEAN,
  is_me BOOLEAN,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_user UUID := private.lt_caller_membership(p_organization_id, false);
BEGIN
  RETURN QUERY
    SELECT ou.id, ou.email, ou.iam_user_id, ou.is_owner, ou.iam_user_id IS NOT DISTINCT FROM v_user, ou.created_at
    FROM lt_organization_users ou
    WHERE ou.organization_id = p_organization_id
    ORDER BY ou.is_owner DESC, lower(ou.email);
END;
$$;

-- Adds a user by email (they are linked to their IAM account when they next
-- sign in). Adding someone already there only updates their owner flag.
CREATE OR REPLACE FUNCTION lt_add_organization_member(
  p_organization_id UUID,
  p_email TEXT,
  p_is_owner BOOLEAN DEFAULT false
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(btrim(p_email));
  v_id UUID;
BEGIN
  PERFORM private.lt_caller_membership(p_organization_id, true);
  IF v_email IS NULL OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Enter a valid email address';
  END IF;

  INSERT INTO lt_organization_users (organization_id, email, is_owner)
  VALUES (p_organization_id, v_email, coalesce(p_is_owner, false))
  ON CONFLICT (organization_id, lower(email))
  DO UPDATE SET is_owner = EXCLUDED.is_owner, updated_at = now()
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION lt_set_organization_owner(p_member_id UUID, p_is_owner BOOLEAN)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID;
BEGIN
  SELECT organization_id INTO v_org FROM lt_organization_users WHERE id = p_member_id;
  IF v_org IS NULL THEN RAISE EXCEPTION 'Member not found'; END IF;
  PERFORM private.lt_caller_membership(v_org, true);

  IF NOT p_is_owner AND NOT EXISTS (
    SELECT 1 FROM lt_organization_users WHERE organization_id = v_org AND is_owner AND id <> p_member_id
  ) THEN
    RAISE EXCEPTION 'This is the only owner. Make someone else an owner first.';
  END IF;

  UPDATE lt_organization_users SET is_owner = p_is_owner, updated_at = now() WHERE id = p_member_id;
END;
$$;

CREATE OR REPLACE FUNCTION lt_remove_organization_member(p_member_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID;
  v_owner BOOLEAN;
BEGIN
  SELECT organization_id, is_owner INTO v_org, v_owner FROM lt_organization_users WHERE id = p_member_id;
  IF v_org IS NULL THEN RAISE EXCEPTION 'Member not found'; END IF;
  PERFORM private.lt_caller_membership(v_org, true);

  IF v_owner AND NOT EXISTS (
    SELECT 1 FROM lt_organization_users WHERE organization_id = v_org AND is_owner AND id <> p_member_id
  ) THEN
    RAISE EXCEPTION 'This is the only owner. Make someone else an owner first.';
  END IF;

  DELETE FROM lt_organization_users WHERE id = p_member_id;
END;
$$;

NOTIFY pgrst, 'reload schema';
