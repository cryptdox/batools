-- Migration: 089_is_leaderboard_tasbih.sql
-- Islamic Studio connections leaderboard (086) gets a tasbih board:
--   'tasbih'   tasbih count (every tap of the Digital Tasbih, 1 point each)
--   'all'      quiz + Academy + worship + tasbih
-- Each row also returns every count on its own (quiz, learn, worship, tasbih),
-- so the app shows them beside the total. Same rules as 086: only me and my
-- accepted connections, names only, between two days (NULLs = all time).
-- The return columns change, so the function is dropped and made again.

DO $$
BEGIN
  IF to_regprocedure('public.is_leaderboard(text, date, date)') IS NULL THEN
    RAISE EXCEPTION 'Run 086 first.';
  END IF;
END $$;

DROP FUNCTION public.is_leaderboard(TEXT, DATE, DATE);

CREATE FUNCTION public.is_leaderboard(p_kind TEXT, p_from DATE, p_to DATE)
RETURNS TABLE (rank BIGINT, display_name TEXT, points NUMERIC, quiz NUMERIC, learn NUMERIC, worship NUMERIC, tasbih NUMERIC, is_me BOOLEAN)
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
           coalesce(sum(s.score) FILTER (WHERE s.feature IN ('tracker', 'ramadan')), 0) * 10 AS worship,
           coalesce(sum(s.score) FILTER (WHERE s.feature = 'tasbih'), 0) AS tasbih
    FROM people p
    LEFT JOIN is_device_scores s ON s.device_id = p.device_id AND s.feature IN ('quiz', 'learn', 'tracker', 'ramadan', 'tasbih')
      AND (p_from IS NULL OR s.day >= p_from) AND (p_to IS NULL OR s.day <= p_to)
    GROUP BY p.device_id
  ),
  scored AS (
    SELECT t.*, CASE p_kind WHEN 'quiz' THEN t.quiz WHEN 'learn' THEN t.learn WHEN 'worship' THEN t.worship
                            WHEN 'tasbih' THEN t.tasbih
                            ELSE t.quiz + t.learn + t.worship + t.tasbih END AS points
    FROM totals t
  )
  SELECT rank() OVER (ORDER BY s.points DESC), coalesce(d.display_name, 'Player'), s.points, s.quiz, s.learn, s.worship, s.tasbih,
         s.device_id = (SELECT id FROM me)
  FROM scored s JOIN is_devices d ON d.device_id = s.device_id
  ORDER BY s.points DESC, d.display_name;
$$;

REVOKE ALL ON FUNCTION public.is_leaderboard(TEXT, DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_leaderboard(TEXT, DATE, DATE) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
