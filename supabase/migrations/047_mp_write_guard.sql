-- Music (mp_) tables only: public read, writes only for signed-in batools users.
--
-- The public player (mumu) ships the anon key inside its APK / web bundle, so
-- the anon role must not be able to change the music catalogue. batools has no
-- Supabase session (it signs in with IAM), so it sends its IAM access token in
-- an `x-iam-token` header on every request (REST and Storage). The mp_ write
-- policies accept a request only when that token is a valid, unexpired IAM
-- token: its HS256 signature is checked here, in the database, with IAM's
-- JWT secret kept in Supabase Vault (no network call, so it fits easily in the
-- anon role's 3 s statement timeout).
--
-- BEFORE applying, store IAM's JWT_SECRET in Vault (Supabase SQL editor):
--   select vault.create_secret('<IAM JWT_SECRET>', 'iam_jwt_secret');
-- If IAM's secret is ever rotated, update it the same way:
--   select vault.update_secret((select id from vault.secrets where name = 'iam_jwt_secret'), '<new secret>');

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'iam_jwt_secret') THEN
    RAISE EXCEPTION 'Store IAM''s JWT secret in Vault as ''iam_jwt_secret'' first, or every music write from batools would be refused.';
  END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
-- Policies run as the caller, so the API roles must reach the checker. The
-- private schema is not exposed by the API.
GRANT USAGE ON SCHEMA private TO anon, authenticated;

-- The IAM user id behind this request's x-iam-token header, or NULL when the
-- header is missing, malformed, expired or not signed by IAM.
CREATE OR REPLACE FUNCTION private.mp_iam_user()
RETURNS UUID
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
  -- HS256: base64url(hmac_sha256(header.payload, secret)) must equal the signature.
  IF translate(encode(hmac(parts[1] || '.' || parts[2], secret, 'sha256'), 'base64'), E'+/=\n', '-_') <> parts[3] THEN
    RETURN NULL;
  END IF;

  BEGIN
    payload := convert_from(decode(
      translate(parts[2], '-_', '+/') || repeat('=', (4 - length(parts[2]) % 4) % 4), 'base64'), 'utf8')::json;
    IF to_timestamp((payload ->> 'exp')::double precision) <= now() THEN RETURN NULL; END IF;
    RETURN (payload ->> 'userId')::uuid;
  EXCEPTION WHEN others THEN RETURN NULL;
  END;
END $$;

REVOKE ALL ON FUNCTION private.mp_iam_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.mp_iam_user() TO anon, authenticated;

-- Play counts come from the public player: allow exactly "+1", nothing else.
CREATE OR REPLACE FUNCTION public.mp_count_play(p_song_id UUID)
RETURNS INTEGER
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE mp_songs SET play_count = play_count + 1 WHERE id = p_song_id RETURNING play_count;
$$;

-- mp_ table policies: everyone reads; insert / update / delete need a valid IAM token.
DO $$
DECLARE
  t TEXT;
  p RECORD;
  guard CONSTANT TEXT := '(SELECT private.mp_iam_user()) IS NOT NULL';
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'mp_files', 'mp_genres', 'mp_songs', 'mp_collections', 'mp_collection_songs',
    'mp_countries', 'mp_languages', 'mp_singers', 'mp_song_singers', 'mp_ratings',
    'mp_sources', 'mp_source_singers', 'mp_collection_singers', 'mp_collection_languages'
  ] LOOP
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY %I ON %I', p.policyname, t);
    END LOOP;
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "mp read" ON %I FOR SELECT TO anon, authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY "mp insert" ON %I FOR INSERT TO anon, authenticated WITH CHECK (%s)', t, guard);
    EXECUTE format('CREATE POLICY "mp update" ON %I FOR UPDATE TO anon, authenticated USING (%s) WITH CHECK (%s)', t, guard, guard);
    EXECUTE format('CREATE POLICY "mp delete" ON %I FOR DELETE TO anon, authenticated USING (%s)', t, guard);
  END LOOP;
END $$;

-- Storage, music bucket only: stays publicly readable; uploads / changes need the token too.
DROP POLICY IF EXISTS "music insert" ON storage.objects;
DROP POLICY IF EXISTS "music update" ON storage.objects;
DROP POLICY IF EXISTS "music delete" ON storage.objects;
CREATE POLICY "music insert" ON storage.objects FOR INSERT TO public
  WITH CHECK (bucket_id = 'music' AND (SELECT private.mp_iam_user()) IS NOT NULL);
CREATE POLICY "music update" ON storage.objects FOR UPDATE TO public
  USING (bucket_id = 'music' AND (SELECT private.mp_iam_user()) IS NOT NULL);
CREATE POLICY "music delete" ON storage.objects FOR DELETE TO public
  USING (bucket_id = 'music' AND (SELECT private.mp_iam_user()) IS NOT NULL);

NOTIFY pgrst, 'reload schema';
