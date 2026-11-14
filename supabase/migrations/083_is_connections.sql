-- Migration: 083_is_connections.sql
-- Islamic Studio connections: readers connect with each other (no sign-in)
-- and compare learning points.
--   * is_devices.friend_code: a short code to share, e.g. K7QP-3M9X (no
--     0/O/1/I). Made by the database; the app can't choose or change it.
--   * is_connections: a request from one installation to another; accepted,
--     both see each other on the connections leaderboard. Either side can
--     remove it. Limits: 100 connections, 20 requests waiting.
--   * Everything goes through functions (no direct table access), so an
--     installation never sees another's id — only display names.
--   * is_connection_board(from, to): me and my connections ranked by learning
--     points (quiz points + Academy XP) between two days (NULLs = all time).
-- Deleting an installation ("Delete my data") removes its connections.

DO $$
BEGIN
  IF to_regclass('public.is_devices') IS NULL OR to_regprocedure('private.is_devices_guard()') IS NULL THEN
    RAISE EXCEPTION 'Run 074–082 first.';
  END IF;
END $$;

-- Friend codes -----------------------------------------------------------------
ALTER TABLE is_devices ADD COLUMN IF NOT EXISTS friend_code TEXT UNIQUE CHECK (friend_code ~ '^[A-Z2-9]{4}-[A-Z2-9]{4}$');

CREATE OR REPLACE FUNCTION private.is_new_friend_code()
RETURNS TEXT LANGUAGE plpgsql VOLATILE SET search_path = public AS $$
DECLARE
  alphabet CONSTANT TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code TEXT;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..8 LOOP
      code := code || substr(alphabet, 1 + floor(random() * 32)::int, 1);
      IF i = 4 THEN code := code || '-'; END IF;
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM is_devices WHERE friend_code = code);
  END LOOP;
  RETURN code;
END;
$$;

-- The database gives each installation its code and keeps it.
CREATE OR REPLACE FUNCTION private.is_devices_code()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.friend_code := coalesce(OLD.friend_code, private.is_new_friend_code());
  ELSE
    NEW.friend_code := private.is_new_friend_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS is_devices_code ON is_devices;
CREATE TRIGGER is_devices_code BEFORE INSERT OR UPDATE ON is_devices FOR EACH ROW EXECUTE FUNCTION private.is_devices_code();

UPDATE is_devices SET friend_code = private.is_new_friend_code() WHERE friend_code IS NULL;

-- Connections ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS is_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester UUID NOT NULL REFERENCES is_devices(device_id) ON DELETE CASCADE,
  addressee UUID NOT NULL REFERENCES is_devices(device_id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  CHECK (requester <> addressee)
);
-- One connection per pair, whichever way it was asked.
CREATE UNIQUE INDEX IF NOT EXISTS is_connections_pair ON is_connections (least(requester, addressee), greatest(requester, addressee));
CREATE INDEX IF NOT EXISTS is_connections_addressee ON is_connections (addressee);

-- Only through the functions below; batools can read for support.
ALTER TABLE is_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "is read" ON is_connections;
CREATE POLICY "is read" ON is_connections FOR SELECT TO anon, authenticated USING ((SELECT private.lt_iam_claims()) IS NOT NULL);
DROP POLICY IF EXISTS "is delete" ON is_connections;
CREATE POLICY "is delete" ON is_connections FOR DELETE TO anon, authenticated USING ((SELECT private.lt_iam_claims()) IS NOT NULL);

/**
 * Sends a connection request to the installation with this code. Returns
 * 'sent', 'connected' (they had asked me: now connected), 'already',
 * 'pending' (I asked already), 'self', 'not_found', 'limit' or 'no_device'.
 */
CREATE OR REPLACE FUNCTION public.is_connect_request(p_code TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  me UUID := private.is_device_id();
  them UUID;
  existing is_connections%ROWTYPE;
BEGIN
  IF me IS NULL OR NOT EXISTS (SELECT 1 FROM is_devices WHERE device_id = me) THEN RETURN 'no_device'; END IF;
  SELECT device_id INTO them FROM is_devices
  WHERE friend_code = upper(regexp_replace(btrim(coalesce(p_code, '')), '^([A-Za-z2-9]{4})-?([A-Za-z2-9]{4})$', '\1-\2'));
  IF them IS NULL THEN RETURN 'not_found'; END IF;
  IF them = me THEN RETURN 'self'; END IF;
  SELECT * INTO existing FROM is_connections
  WHERE least(requester, addressee) = least(me, them) AND greatest(requester, addressee) = greatest(me, them);
  IF FOUND THEN
    IF existing.status = 'accepted' THEN RETURN 'already'; END IF;
    IF existing.requester = me THEN RETURN 'pending'; END IF;
    UPDATE is_connections SET status = 'accepted', responded_at = now() WHERE id = existing.id;
    RETURN 'connected';
  END IF;
  IF (SELECT count(*) FROM is_connections WHERE requester = me AND status = 'pending') >= 20
     OR (SELECT count(*) FROM is_connections WHERE me IN (requester, addressee) AND status = 'accepted') >= 100 THEN
    RETURN 'limit';
  END IF;
  INSERT INTO is_connections (requester, addressee) VALUES (me, them);
  RETURN 'sent';
END;
$$;

/** Accepts (true) or declines (false) a request sent to me. */
CREATE OR REPLACE FUNCTION public.is_connect_respond(p_id UUID, p_accept BOOLEAN)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE me UUID := private.is_device_id();
BEGIN
  IF p_accept THEN
    UPDATE is_connections SET status = 'accepted', responded_at = now() WHERE id = p_id AND addressee = me AND status = 'pending';
  ELSE
    DELETE FROM is_connections WHERE id = p_id AND addressee = me AND status = 'pending';
  END IF;
  RETURN FOUND;
END;
$$;

/** Removes a connection, or cancels a request I sent. */
CREATE OR REPLACE FUNCTION public.is_connect_remove(p_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE me UUID := private.is_device_id();
BEGIN
  DELETE FROM is_connections WHERE id = p_id AND me IN (requester, addressee);
  RETURN FOUND;
END;
$$;

/** My connections and requests: the other side's name only, never its id. */
CREATE OR REPLACE FUNCTION public.is_my_connections()
RETURNS TABLE (id UUID, display_name TEXT, status TEXT, incoming BOOLEAN, created_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT c.id, coalesce(d.display_name, 'Player'), c.status, c.addressee = private.is_device_id(), c.created_at
  FROM is_connections c
  JOIN is_devices d ON d.device_id = CASE WHEN c.requester = private.is_device_id() THEN c.addressee ELSE c.requester END
  WHERE private.is_device_id() IN (c.requester, c.addressee)
  ORDER BY c.status DESC, c.created_at DESC;
$$;

/**
 * Me and my accepted connections, ranked by learning points between two days
 * (inclusive; NULL = no limit): quiz points (each day's best per quiz) plus
 * Academy XP.
 */
CREATE OR REPLACE FUNCTION public.is_connection_board(p_from DATE, p_to DATE)
RETURNS TABLE (rank BIGINT, display_name TEXT, points NUMERIC, quiz NUMERIC, learn NUMERIC, is_me BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  WITH me AS (SELECT private.is_device_id() AS id),
  people AS (
    SELECT id AS device_id FROM me WHERE id IS NOT NULL
    UNION
    SELECT CASE WHEN c.requester = me.id THEN c.addressee ELSE c.requester END
    FROM is_connections c, me WHERE c.status = 'accepted' AND me.id IN (c.requester, c.addressee)
  ),
  totals AS (
    SELECT p.device_id,
           coalesce(sum(s.score) FILTER (WHERE s.feature = 'quiz'), 0) AS quiz,
           coalesce(sum(s.score) FILTER (WHERE s.feature = 'learn'), 0) AS learn
    FROM people p
    LEFT JOIN is_device_scores s ON s.device_id = p.device_id AND s.feature IN ('quiz', 'learn')
      AND (p_from IS NULL OR s.day >= p_from) AND (p_to IS NULL OR s.day <= p_to)
    GROUP BY p.device_id
  )
  SELECT rank() OVER (ORDER BY t.quiz + t.learn DESC), coalesce(d.display_name, 'Player'), t.quiz + t.learn, t.quiz, t.learn,
         t.device_id = (SELECT id FROM me)
  FROM totals t JOIN is_devices d ON d.device_id = t.device_id
  ORDER BY t.quiz + t.learn DESC, d.display_name;
$$;

REVOKE ALL ON FUNCTION public.is_connect_request(TEXT), public.is_connect_respond(UUID, BOOLEAN), public.is_connect_remove(UUID),
  public.is_my_connections(), public.is_connection_board(DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_connect_request(TEXT), public.is_connect_respond(UUID, BOOLEAN), public.is_connect_remove(UUID),
  public.is_my_connections(), public.is_connection_board(DATE, DATE) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
