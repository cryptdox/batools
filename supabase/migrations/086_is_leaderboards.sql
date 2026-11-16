-- Migration: 086_is_leaderboards.sql
-- Islamic Studio connections leaderboard with one board per kind of activity:
--   'quiz'     quiz points (10 per correct answer)
--   'learn'    Academy XP
--   'worship'  worship points: the day's Worship Tracker and Ramadan scores
--              (the number of tasks done; the app never sends which ones),
--              10 points a task, so one task weighs the same as a quiz answer
--   'all'      the three added together
-- Like is_connection_board (083, kept for older app versions): only me and my
-- accepted connections, names only (never installation ids), between two days
-- (NULLs = all time).

DO $$
BEGIN
  IF to_regprocedure('public.is_connection_board(date, date)') IS NULL THEN
    RAISE EXCEPTION 'Run 083 first.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.is_leaderboard(p_kind TEXT, p_from DATE, p_to DATE)
RETURNS TABLE (rank BIGINT, display_name TEXT, points NUMERIC, quiz NUMERIC, learn NUMERIC, worship NUMERIC, is_me BOOLEAN)
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
           coalesce(sum(s.score) FILTER (WHERE s.feature = 'learn'), 0) AS learn,
           coalesce(sum(s.score) FILTER (WHERE s.feature IN ('tracker', 'ramadan')), 0) * 10 AS worship
    FROM people p
    LEFT JOIN is_device_scores s ON s.device_id = p.device_id AND s.feature IN ('quiz', 'learn', 'tracker', 'ramadan')
      AND (p_from IS NULL OR s.day >= p_from) AND (p_to IS NULL OR s.day <= p_to)
    GROUP BY p.device_id
  ),
  scored AS (
    SELECT t.*, CASE p_kind WHEN 'quiz' THEN t.quiz WHEN 'learn' THEN t.learn WHEN 'worship' THEN t.worship
                            ELSE t.quiz + t.learn + t.worship END AS points
    FROM totals t
  )
  SELECT rank() OVER (ORDER BY s.points DESC), coalesce(d.display_name, 'Player'), s.points, s.quiz, s.learn, s.worship,
         s.device_id = (SELECT id FROM me)
  FROM scored s JOIN is_devices d ON d.device_id = s.device_id
  ORDER BY s.points DESC, d.display_name;
$$;

REVOKE ALL ON FUNCTION public.is_leaderboard(TEXT, DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_leaderboard(TEXT, DATE, DATE) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
