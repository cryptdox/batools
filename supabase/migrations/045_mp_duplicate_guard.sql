-- Migration: 045_mp_duplicate_guard.sql
-- Music player: a new song whose title is too close to an existing one
-- (score >= 0.78) is a duplicate and cannot be inserted. The uploader should
-- edit (or delete) the existing song instead.
--
-- mp_title_score(a, b): the score mp_similar_songs ranks by (0..1).
-- mp_similar_song_scores(p_title, p_limit): (song_id, score), best first, so
-- the app can tell "similar" (warn) from "duplicate" (block).

CREATE OR REPLACE FUNCTION mp_title_score(p_typed TEXT, p_title TEXT)
RETURNS FLOAT8
LANGUAGE sql IMMUTABLE
SET search_path = public, extensions
AS $$
  SELECT greatest(
    similarity(lower(p_title), lower(btrim(p_typed))),
    word_similarity(lower(btrim(p_typed)), lower(p_title))
  )::float8;
$$;

CREATE OR REPLACE FUNCTION mp_similar_song_scores(p_title TEXT, p_limit INT DEFAULT 5)
RETURNS TABLE (song_id UUID, score FLOAT8)
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT s.id, mp_title_score(p_title, s.title) AS score
  FROM mp_songs s
  WHERE length(btrim(p_title)) >= 3 AND mp_title_score(p_title, s.title) >= 0.45
  ORDER BY score DESC, s.created_at DESC
  LIMIT greatest(1, least(p_limit, 20));
$$;

GRANT EXECUTE ON FUNCTION mp_title_score(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION mp_similar_song_scores(TEXT, INT) TO anon, authenticated;

-- Inserts only: editing a song's own title never trips over itself.
CREATE OR REPLACE FUNCTION mp_songs_block_duplicate()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE dup RECORD;
BEGIN
  SELECT s.id, s.title INTO dup
  FROM mp_songs s
  WHERE mp_title_score(NEW.title, s.title) >= 0.78
  ORDER BY mp_title_score(NEW.title, s.title) DESC
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'Duplicate song: "%" is too similar to "%"', NEW.title, dup.title
      USING ERRCODE = 'unique_violation', HINT = dup.id::text;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_mp_songs_block_duplicate ON mp_songs;
CREATE TRIGGER trg_mp_songs_block_duplicate BEFORE INSERT ON mp_songs
  FOR EACH ROW EXECUTE FUNCTION mp_songs_block_duplicate();

NOTIFY pgrst, 'reload schema';
