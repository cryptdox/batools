-- Life-Stage Parenting: is app sign-in set up? For batools' Parenting
-- dashboard, so a missing realm secret shows as a red warning instead of
-- silently leaving every signed-in user "on this device only" (see 095).
-- Tells only whether the Vault entries exist — never their values. batools editors only.

CREATE OR REPLACE FUNCTION public.lp_sign_in_setup()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF NOT private.lp_is_editor() THEN
    RAISE EXCEPTION 'batools only.' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'secret', EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'lp_iam_jwt_secret'
                      AND coalesce(decrypted_secret, '') NOT IN ('', '<SECRET not readable — copy it from IAM → realm settings>')),
    'realm', EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'lp_iam_realm_id')
  );
END $$;

REVOKE ALL ON FUNCTION public.lp_sign_in_setup() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lp_sign_in_setup() TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
