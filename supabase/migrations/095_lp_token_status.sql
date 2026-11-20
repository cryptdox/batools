-- Life-Stage Parenting: why the database does not accept an app sign-in.
--
-- private.lp_claims() (090) quietly returns NULL when the x-lp-token header
-- can't be checked, so a signed-in person looks like a device-only user. This
-- says which check failed, so the app can show it. It reveals nothing secret.
--
--   no_token       the request carried no x-lp-token
--   malformed      not a three-part JWT
--   no_secret      Vault has no lp_iam_jwt_secret: run the SQL printed by
--                  batools scripts/iam-life-stage-parenting.mjs --only=app
--   bad_signature  the token was signed with another secret (wrong or old
--                  secret in Vault, or the token is from another realm)
--   expired        the token is out of date (the app refreshes it)
--   wrong_realm    lp_iam_realm_id in Vault is not the token's realm
--   ok             accepted

CREATE OR REPLACE FUNCTION public.lp_token_status()
RETURNS TEXT
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
  IF tok IS NULL THEN RETURN 'no_token'; END IF;
  parts := string_to_array(tok, '.');
  IF coalesce(array_length(parts, 1), 0) <> 3 THEN RETURN 'malformed'; END IF;

  SELECT decrypted_secret INTO secret FROM vault.decrypted_secrets WHERE name = 'lp_iam_jwt_secret';
  IF secret IS NULL THEN RETURN 'no_secret'; END IF;
  IF translate(encode(hmac(parts[1] || '.' || parts[2], secret, 'sha256'), 'base64'), E'+/=\n', '-_') <> parts[3] THEN
    RETURN 'bad_signature';
  END IF;

  BEGIN
    payload := convert_from(decode(
      translate(parts[2], '-_', '+/') || repeat('=', (4 - length(parts[2]) % 4) % 4), 'base64'), 'utf8')::json;
  EXCEPTION WHEN others THEN RETURN 'malformed';
  END;
  IF to_timestamp((payload ->> 'exp')::double precision) <= now() THEN RETURN 'expired'; END IF;
  SELECT decrypted_secret INTO realm FROM vault.decrypted_secrets WHERE name = 'lp_iam_realm_id';
  IF realm IS NOT NULL AND realm <> coalesce(payload ->> 'realmId', '') THEN RETURN 'wrong_realm'; END IF;
  RETURN 'ok';
END $$;

REVOKE ALL ON FUNCTION public.lp_token_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lp_token_status() TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
