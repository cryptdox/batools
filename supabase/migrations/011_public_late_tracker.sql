-- Migration: 011_public_late_tracker.sql
-- A read-only public page at /late-tracker/<key> that shows today's late
-- status and per-member totals without signing in.
--
-- The key lives in its own table with RLS enabled and no policies, so the anon
-- role cannot list it directly; it is only reachable through the SECURITY
-- DEFINER functions below. Regenerating replaces the key, which invalidates
-- every link shared before.
--
-- Note: the other lt_ tables still carry the "Allow all access" policy from
-- 001, so this key hides the page, it does not by itself protect the data.

CREATE TABLE IF NOT EXISTS lt_public_share (
  key TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE lt_public_share ENABLE ROW LEVEL SECURITY;

-- Current key, or NULL when public sharing has never been enabled.
CREATE OR REPLACE FUNCTION get_public_share_key() RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT key FROM lt_public_share ORDER BY created_at DESC LIMIT 1;
$$;

-- Swaps in a fresh key and returns it. Only one key is ever valid.
CREATE OR REPLACE FUNCTION regenerate_public_share_key() RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_key TEXT := replace(gen_random_uuid()::text, '-', '');
BEGIN
  DELETE FROM lt_public_share WHERE true;
  INSERT INTO lt_public_share (key) VALUES (v_key);
  RETURN v_key;
END;
$$;

-- Everything the public page needs, or NULL when the key does not match.
-- Aggregation is left to the client, the same as the other report pages.
CREATE OR REPLACE FUNCTION get_public_late_tracker(p_key TEXT) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_key IS NULL OR NOT EXISTS (SELECT 1 FROM lt_public_share WHERE key = p_key) THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'members', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'created_at', m.created_at) ORDER BY m.name)
      FROM lt_team_members m
      WHERE m.is_active AND NOT m.is_deleted
    ), '[]'::jsonb),
    'records', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'team_member_id', r.team_member_id,
        'attendance_date', r.attendance_date,
        'state', r.state,
        'entry_time', r.entry_time,
        'threshold_time_used', r.threshold_time_used
      ))
      FROM lt_attendance_records r
      JOIN lt_team_members m ON m.id = r.team_member_id
      WHERE m.is_active AND NOT m.is_deleted
    ), '[]'::jsonb),
    'punishments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'team_member_id', p.team_member_id,
        'attendance_date', p.attendance_date,
        'punishment_amount', p.punishment_amount,
        'paid', COALESCE((SELECT SUM(t.amount) FROM lt_punishment_transactions t WHERE t.punishment_id = p.id AND t.transaction_type = 'PAID'), 0),
        'waived', COALESCE((SELECT SUM(t.amount) FROM lt_punishment_transactions t WHERE t.punishment_id = p.id AND t.transaction_type = 'DISCOUNT'), 0)
      ))
      FROM lt_punishments p
      JOIN lt_team_members m ON m.id = p.team_member_id
      WHERE m.is_active AND NOT m.is_deleted
    ), '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_public_share_key() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION regenerate_public_share_key() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_public_late_tracker(TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
