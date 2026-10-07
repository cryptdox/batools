-- Migration: 043_mp_similar_songs.sql
-- Music player: find songs whose title looks like a given one, so the upload
-- form can warn "this may already be in the library".
--
-- mp_similar_songs(p_title, p_limit) returns mp_songs rows (so PostgREST can
-- embed files / singers on it), best match first. A song matches when its
-- title is similar to p_title as a whole (pg_trgm similarity) or contains
-- something close to it (word_similarity), e.g. "Aalote Chol" matches
-- "Aalote Chol Lyrical (আলোতে চল) Srikanto ...".

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION mp_similar_songs(p_title TEXT, p_limit INT DEFAULT 5)
RETURNS SETOF mp_songs
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT s.*
  FROM mp_songs s
  CROSS JOIN LATERAL (
    SELECT greatest(
      similarity(lower(s.title), lower(btrim(p_title))),
      word_similarity(lower(btrim(p_title)), lower(s.title))
    ) AS score
  ) m
  WHERE length(btrim(p_title)) >= 3 AND m.score >= 0.45
  ORDER BY m.score DESC, s.created_at DESC
  LIMIT greatest(1, least(p_limit, 20));
$$;

GRANT EXECUTE ON FUNCTION mp_similar_songs(TEXT, INT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
