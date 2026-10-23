-- Migration: 055_lt_member_iam_user.sql
-- Owners may set a member's IAM user id by hand.
--
-- Members are still added by email, and their id is normally filled in the
-- first time they open Late Tracker (lt_my_organizations, 054). This lets an
-- owner link someone before that, or correct a wrong link. Only owners of the
-- member's organization may do it, checked from the caller's IAM token like
-- the other membership functions.

CREATE OR REPLACE FUNCTION lt_set_organization_member_user(p_member_id UUID, p_iam_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID;
BEGIN
  IF p_iam_user_id IS NULL THEN
    RAISE EXCEPTION 'Enter the member''s IAM user id';
  END IF;
  SELECT organization_id INTO v_org FROM lt_organization_users WHERE id = p_member_id;
  IF v_org IS NULL THEN RAISE EXCEPTION 'Member not found'; END IF;
  PERFORM private.lt_caller_membership(v_org, true);

  IF EXISTS (
    SELECT 1 FROM lt_organization_users
    WHERE organization_id = v_org AND iam_user_id = p_iam_user_id AND id <> p_member_id
  ) THEN
    RAISE EXCEPTION 'Another member of this organization already has that IAM user id';
  END IF;

  UPDATE lt_organization_users SET iam_user_id = p_iam_user_id, updated_at = now() WHERE id = p_member_id;
END;
$$;

NOTIFY pgrst, 'reload schema';
