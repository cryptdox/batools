-- Migration: 093_lp_devices.sql
-- Life-Stage Parenting without an account.
--
--   * Every installation has a secret device key; the app sends it in the
--     x-lp-device header. lp_me() turns an unknown key into a device-only
--     person: an lp_users row with kind = 'device', and lp_devices keeps the
--     key's SHA-256 (never the key). private.lp_uid() is then the IAM user
--     when a valid x-lp-token comes with the request, otherwise that device
--     person — so families, tasks, health records and XP work the same with or
--     without an account.
--   * Everyone has a connect ID (lp_users.share_code, 8 letters/digits) that is
--     safe to share: a parent adds someone by it (lp_invite_by_code) and that
--     person accepts. It is not the device key and gives no access by itself.
--   * Signing in on a device (lp_me with both headers) moves everything the
--     device person made into the account (lp_link_device): memberships,
--     records, task logs, XP, learning progress. The device then belongs to the
--     account, and its key alone no longer opens anything; the app starts a new
--     device key after signing out.

DO $$
BEGIN
  IF to_regclass('public.lp_family_members') IS NULL THEN
    RAISE EXCEPTION 'Run 090–092 first.';
  END IF;
END $$;

-- People: account or device-only, each with a connect ID ----------------------

-- 8 characters without look-alikes (no 0/O, 1/I/L).
CREATE OR REPLACE FUNCTION private.lp_new_code()
RETURNS TEXT LANGUAGE plpgsql VOLATILE AS $$
DECLARE
  alphabet CONSTANT TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code_out TEXT := '';
  b BYTEA := decode(md5(gen_random_uuid()::text || clock_timestamp()::text), 'hex');
BEGIN
  FOR i IN 0..7 LOOP
    code_out := code_out || substr(alphabet, (get_byte(b, i) % length(alphabet)) + 1, 1);
  END LOOP;
  RETURN code_out;
END $$;

ALTER TABLE lp_users ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'account';
ALTER TABLE lp_users ADD COLUMN IF NOT EXISTS share_code TEXT;
DO $$
BEGIN
  ALTER TABLE lp_users ADD CONSTRAINT lp_users_kind CHECK (kind IN ('account', 'device'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
UPDATE lp_users SET share_code = private.lp_new_code() WHERE share_code IS NULL;
ALTER TABLE lp_users ALTER COLUMN share_code SET DEFAULT private.lp_new_code();
ALTER TABLE lp_users ALTER COLUMN share_code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS lp_users_share_code ON lp_users (share_code);

CREATE TABLE IF NOT EXISTS lp_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- SHA-256 of the device key, hex.
  key_hash TEXT NOT NULL UNIQUE,
  -- The device person, or after sign-in the account it was linked to.
  user_id UUID NOT NULL REFERENCES lp_users(id) ON DELETE CASCADE,
  platform TEXT CHECK (platform IN ('web', 'android', 'ios')),
  linked_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lp_devices_user ON lp_devices (user_id);
-- Only the functions below read or write it.
ALTER TABLE lp_devices ENABLE ROW LEVEL SECURITY;

-- Whom a member row invites by connect ID (the person accepts it).
ALTER TABLE lp_family_members ADD COLUMN IF NOT EXISTS invited_user_id UUID REFERENCES lp_users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS lp_family_members_invited_user ON lp_family_members (invited_user_id) WHERE invite_status = 'pending';

-- Who is calling ----------------------------------------------------------------

/** SHA-256 of the x-lp-device header, or NULL when missing or too short to be a key. */
CREATE OR REPLACE FUNCTION private.lp_device_hash()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = private, public, extensions AS $$
  SELECT CASE WHEN length(k) >= 32 AND length(k) <= 200 THEN encode(digest(k, 'sha256'), 'hex') END
  FROM (SELECT nullif(current_setting('request.headers', true)::json ->> 'x-lp-device', '') AS k) h
$$;

/** The device-only person behind the x-lp-device key (never an account: those need their token). */
CREATE OR REPLACE FUNCTION private.lp_device_user()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = private, public AS $$
  SELECT d.user_id FROM lp_devices d JOIN lp_users u ON u.id = d.user_id
  WHERE d.key_hash = private.lp_device_hash() AND u.kind = 'device'
$$;

-- The caller: the signed-in IAM user, else the device-only person.
CREATE OR REPLACE FUNCTION private.lp_uid()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = private, public AS $$
  SELECT coalesce((private.lp_claims() ->> 'userId')::uuid, private.lp_device_user())
$$;

REVOKE ALL ON FUNCTION private.lp_new_code(), private.lp_device_hash(), private.lp_device_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.lp_device_hash(), private.lp_device_user(), private.lp_new_code() TO anon, authenticated;

-- Records: the merge below (trusted) may move authorship to the account.
CREATE OR REPLACE FUNCTION private.lp_record_touch()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  NEW.family_id := OLD.family_id;
  IF NOT private.lp_trusted() THEN
    NEW.created_by := OLD.created_by;
  END IF;
  NEW.updated_by := private.lp_uid();
  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- Linking a device to an account ---------------------------------------------------

-- Moves everything device person p_from made into account p_to.
CREATE OR REPLACE FUNCTION private.lp_merge_person(p_from UUID, p_to UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  dm lp_family_members;
  am UUID;
  pair RECORD;
BEGIN
  PERFORM set_config('lp.trusted', 'on', true);

  FOR dm IN SELECT * FROM lp_family_members WHERE user_id = p_from LOOP
    SELECT id INTO am FROM lp_family_members WHERE family_id = dm.family_id AND user_id = p_to;
    IF am IS NULL THEN
      -- The account takes over the device's place in the family.
      UPDATE lp_family_members SET user_id = p_to WHERE id = dm.id;
    ELSE
      -- Both are in this family: keep the account's row, move the device row's records onto it.
      DELETE FROM lp_milestone_records x WHERE x.member_id = dm.id
        AND EXISTS (SELECT 1 FROM lp_milestone_records y WHERE y.member_id = am AND y.milestone_key = x.milestone_key);
      DELETE FROM lp_task_logs x WHERE x.member_id = dm.id
        AND EXISTS (SELECT 1 FROM lp_task_logs y WHERE y.member_id = am AND y.family_id = x.family_id
                    AND coalesce(y.template_key, y.custom_task_id::text) = coalesce(x.template_key, x.custom_task_id::text) AND y.period_key = x.period_key);
      FOR pair IN SELECT * FROM (VALUES
        ('lp_pregnancies', 'member_id'), ('lp_cycle_logs', 'member_id'), ('lp_growth_records', 'member_id'),
        ('lp_documents', 'member_id'), ('lp_vaccinations', 'member_id'), ('lp_appointments', 'member_id'),
        ('lp_appointments', 'escort_member_id'), ('lp_medicines', 'member_id'), ('lp_allergies', 'member_id'),
        ('lp_health_events', 'member_id'), ('lp_milestone_records', 'member_id'), ('lp_custom_tasks', 'member_id'),
        ('lp_custom_tasks', 'assignee_member_id'), ('lp_task_assignments', 'assignee_member_id'), ('lp_task_logs', 'member_id')
      ) AS v(tbl, col) LOOP
        EXECUTE format('UPDATE %I SET %I = $1 WHERE %I = $2', pair.tbl, pair.col, pair.col) USING am, dm.id;
      END LOOP;
      IF dm.app_role = 'owner' THEN
        UPDATE lp_family_members SET app_role = 'owner' WHERE id = am;
      END IF;
      DELETE FROM lp_family_members WHERE id = dm.id;
    END IF;
  END LOOP;

  -- Authorship and personal progress.
  FOR pair IN SELECT * FROM (VALUES
    ('lp_pregnancies', 'created_by'), ('lp_cycle_logs', 'created_by'), ('lp_growth_records', 'created_by'),
    ('lp_documents', 'created_by'), ('lp_vaccinations', 'created_by'), ('lp_appointments', 'created_by'),
    ('lp_medicines', 'created_by'), ('lp_allergies', 'created_by'), ('lp_health_events', 'created_by'),
    ('lp_milestone_records', 'created_by'), ('lp_custom_tasks', 'created_by'), ('lp_task_logs', 'done_by'),
    ('lp_families', 'created_by'), ('lp_family_members', 'invited_by')
  ) AS v(tbl, col) LOOP
    EXECUTE format('UPDATE %I SET %I = $1 WHERE %I = $2', pair.tbl, pair.col, pair.col) USING p_to, p_from;
  END LOOP;

  INSERT INTO lp_resource_progress (user_id, resource_id, bookmarked, learned_at, last_opened_at, progress, note)
  SELECT p_to, resource_id, bookmarked, learned_at, last_opened_at, progress, note FROM lp_resource_progress WHERE user_id = p_from
  ON CONFLICT (user_id, resource_id) DO NOTHING;
  INSERT INTO lp_xp_events (family_id, user_id, source, ref, xp, created_at)
  SELECT family_id, p_to, source, ref, xp, created_at FROM lp_xp_events WHERE user_id = p_from
  ON CONFLICT (family_id, user_id, source, ref) DO NOTHING;
  INSERT INTO lp_user_achievements (family_id, user_id, achievement_key, earned_at)
  SELECT family_id, p_to, achievement_key, earned_at FROM lp_user_achievements WHERE user_id = p_from
  ON CONFLICT DO NOTHING;

  -- The account keeps its own settings; it takes the device's where it has none.
  UPDATE lp_users a SET
    display_name = coalesce(a.display_name, d.display_name),
    active_family_id = coalesce(a.active_family_id, d.active_family_id),
    health_consent_at = coalesce(a.health_consent_at, d.health_consent_at),
    terms_accepted_at = coalesce(a.terms_accepted_at, d.terms_accepted_at)
  FROM lp_users d WHERE a.id = p_to AND d.id = p_from;
  UPDATE lp_family_members SET invited_user_id = p_to WHERE invited_user_id = p_from;
  UPDATE lp_devices SET user_id = p_to, linked_at = now() WHERE user_id = p_from;
  DELETE FROM lp_users WHERE id = p_from;

  PERFORM set_config('lp.trusted', '', true);
END $$;
REVOKE ALL ON FUNCTION private.lp_merge_person(UUID, UUID) FROM PUBLIC;

-- Functions the app calls -------------------------------------------------------

-- The caller's profile. With a token: the account (created on first sign-in),
-- and a device person on this device is merged into it. Without a token: the
-- device person behind x-lp-device, created on first use.
CREATE OR REPLACE FUNCTION public.lp_me(p_display_name TEXT DEFAULT NULL, p_language TEXT DEFAULT NULL)
RETURNS lp_users LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  claims JSON := private.lp_claims();
  account UUID := (claims ->> 'userId')::uuid;
  v_hash TEXT := private.lp_device_hash();
  dev lp_devices;
  owner_kind TEXT;
  v_user lp_users;
  lang TEXT := CASE WHEN p_language IN ('bn', 'en') THEN p_language END;
BEGIN
  IF v_hash IS NOT NULL THEN
    SELECT * INTO dev FROM lp_devices d WHERE d.key_hash = v_hash;
  END IF;

  IF account IS NOT NULL THEN
    INSERT INTO lp_users (id, kind, email, display_name, language, last_seen_at)
    VALUES (account, 'account', lower(nullif(claims ->> 'email', '')), nullif(btrim(p_display_name), ''), coalesce(lang, 'bn'), now())
    ON CONFLICT (id) DO UPDATE SET
      kind = 'account',
      email = coalesce(EXCLUDED.email, lp_users.email),
      display_name = coalesce(nullif(btrim(p_display_name), ''), lp_users.display_name),
      language = coalesce(lang, lp_users.language),
      last_seen_at = now();
    IF dev.id IS NOT NULL AND dev.user_id <> account THEN
      SELECT kind INTO owner_kind FROM lp_users WHERE id = dev.user_id;
      IF owner_kind = 'device' THEN
        PERFORM private.lp_merge_person(dev.user_id, account);
      ELSE
        -- This device was another account's: it is this account's now.
        UPDATE lp_devices SET user_id = account, linked_at = now() WHERE id = dev.id;
      END IF;
    ELSIF dev.id IS NULL AND v_hash IS NOT NULL THEN
      INSERT INTO lp_devices (key_hash, user_id, linked_at) VALUES (v_hash, account, now());
    END IF;
    UPDATE lp_devices d SET last_seen_at = now() WHERE d.key_hash = v_hash;
    SELECT * INTO v_user FROM lp_users WHERE id = account;
    RETURN v_user;
  END IF;

  IF v_hash IS NULL THEN
    RAISE EXCEPTION 'Sign in again.' USING ERRCODE = '28000';
  END IF;
  IF dev.id IS NOT NULL THEN
    SELECT kind INTO owner_kind FROM lp_users WHERE id = dev.user_id;
    IF owner_kind = 'account' THEN
      -- Linked to an account: its data needs the sign-in.
      RAISE EXCEPTION 'This device belongs to an account. Sign in, or start again on a new device key.' USING ERRCODE = '28000';
    END IF;
    UPDATE lp_users SET
      display_name = coalesce(nullif(btrim(p_display_name), ''), display_name),
      language = coalesce(lang, language),
      last_seen_at = now()
    WHERE id = dev.user_id
    RETURNING * INTO v_user;
    UPDATE lp_devices SET last_seen_at = now() WHERE id = dev.id;
    RETURN v_user;
  END IF;

  -- A new installation.
  INSERT INTO lp_users (id, kind, display_name, language, last_seen_at)
  VALUES (gen_random_uuid(), 'device', nullif(btrim(p_display_name), ''), coalesce(lang, 'bn'), now())
  RETURNING * INTO v_user;
  INSERT INTO lp_devices (key_hash, user_id) VALUES (v_hash, v_user.id);
  RETURN v_user;
END $$;

-- A parent adds someone by their connect ID; the person sees it in
-- lp_my_invites() and accepts it. Returns the new member row's id.
CREATE OR REPLACE FUNCTION public.lp_invite_by_code(
  p_family_id UUID, p_share_code TEXT, p_relation_key TEXT, p_display_name TEXT,
  p_role TEXT DEFAULT 'viewer', p_sex TEXT DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  me UUID := private.lp_uid();
  target UUID;
  new_id UUID;
BEGIN
  IF NOT p_family_id = ANY (private.lp_families('manage')) THEN
    RAISE EXCEPTION 'Only a parent can add family members.' USING ERRCODE = '42501';
  END IF;
  IF p_role NOT IN ('parent', 'guardian', 'caregiver', 'viewer') THEN
    RAISE EXCEPTION 'Unknown role.' USING ERRCODE = '22023';
  END IF;
  SELECT id INTO target FROM lp_users WHERE share_code = upper(regexp_replace(coalesce(p_share_code, ''), '[^A-Za-z0-9]', '', 'g'));
  IF target IS NULL THEN
    RAISE EXCEPTION 'No one has this connect ID.' USING ERRCODE = 'P0002';
  END IF;
  IF target = me OR EXISTS (SELECT 1 FROM lp_family_members WHERE family_id = p_family_id AND (user_id = target OR (invited_user_id = target AND invite_status = 'pending'))) THEN
    RAISE EXCEPTION 'This person is already in the family or invited.' USING ERRCODE = '23505';
  END IF;

  PERFORM set_config('lp.trusted', 'on', true);
  INSERT INTO lp_family_members (family_id, relation_key, display_name, sex, app_role, invited_user_id, invite_code,
                                 invite_status, invited_by, invited_at, created_by)
  VALUES (p_family_id, p_relation_key, btrim(p_display_name), p_sex, p_role, target, private.lp_new_code(),
          'pending', me, now(), me)
  RETURNING id INTO new_id;
  PERFORM set_config('lp.trusted', '', true);
  RETURN new_id;
END $$;

-- Invitations waiting for the caller: by email (accounts) or by connect ID.
CREATE OR REPLACE FUNCTION public.lp_my_invites()
RETURNS TABLE (member_id UUID, family_id UUID, family_name TEXT, relation_key TEXT, display_name TEXT,
               app_role TEXT, invited_by_name TEXT, invited_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT m.id, f.id, f.name, m.relation_key, m.display_name, m.app_role,
         (SELECT b.display_name FROM lp_family_members b WHERE b.family_id = f.id AND b.user_id = m.invited_by LIMIT 1),
         m.invited_at
  FROM lp_family_members m
  JOIN lp_families f ON f.id = m.family_id
  WHERE m.invite_status = 'pending' AND m.user_id IS NULL AND m.is_active
    AND (m.invited_user_id = private.lp_uid()
      OR m.invite_email = lower(nullif(private.lp_claims() ->> 'email', '')))
  ORDER BY m.invited_at DESC
$$;

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
      OR (p_member_id IS NOT NULL AND x.id = p_member_id AND (x.invited_user_id = me OR x.invite_email = my_email)))
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
    invite_status = 'accepted', invite_code = NULL, invited_user_id = NULL, joined_at = now()
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
    AND (invited_user_id = private.lp_uid() OR invite_email = lower(nullif(private.lp_claims() ->> 'email', '')));
  PERFORM set_config('lp.trusted', '', true);
  RETURN FOUND;
END $$;

-- batools' dashboard: device-only people counted apart.
CREATE OR REPLACE FUNCTION public.lp_admin_stats()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF NOT private.lp_is_editor() THEN
    RAISE EXCEPTION 'batools only.' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'users', (SELECT count(*) FROM lp_users),
    'accounts', (SELECT count(*) FROM lp_users WHERE kind = 'account'),
    'device_only', (SELECT count(*) FROM lp_users WHERE kind = 'device'),
    'active_users_7d', (SELECT count(*) FROM lp_users WHERE last_seen_at > now() - interval '7 days'),
    'families', (SELECT count(*) FROM lp_families),
    'children', (SELECT count(*) FROM lp_child_profiles),
    'active_pregnancies', (SELECT count(*) FROM lp_pregnancies WHERE status = 'active'),
    'planning_families', (SELECT count(*) FROM lp_families WHERE is_planning),
    'tasks_done_7d', (SELECT count(*) FROM lp_task_logs WHERE status = 'done' AND done_at > now() - interval '7 days'));
END $$;

DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.lp_me(TEXT, TEXT)',
    'public.lp_invite_by_code(UUID, TEXT, TEXT, TEXT, TEXT, TEXT)',
    'public.lp_my_invites()',
    'public.lp_accept_invite(TEXT, UUID)',
    'public.lp_decline_invite(UUID)',
    'public.lp_admin_stats()'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated', f);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
