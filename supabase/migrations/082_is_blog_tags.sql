-- Migration: 082_is_blog_tags.sql
-- Islamic Studio blog hashtags. Readers and the team tag posts in their own
-- ways, so tags are tidied when saved (lowercase, no "#", spaces → "-",
-- at most 5, 30 characters each, no repeats) and the search text includes
-- them: searching "ramadan" or "#rama" finds posts tagged #ramadan.

DO $$
BEGIN
  IF to_regclass('public.is_blog_posts') IS NULL THEN
    RAISE EXCEPTION 'Run 081 first.';
  END IF;
END $$;

-- Hashtags as one line of text (for search). Immutable for text[], so a
-- generated column may use it (array_to_string is only stable).
CREATE OR REPLACE FUNCTION private.is_tags_text(p_tags TEXT[])
RETURNS TEXT LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT coalesce(string_agg(tag, ' '), '') FROM unnest(p_tags) AS tag;
$$;
GRANT EXECUTE ON FUNCTION private.is_tags_text(TEXT[]) TO anon, authenticated;

CREATE OR REPLACE FUNCTION private.is_blog_tags_tidy()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.tags := ARRAY(
    SELECT tag FROM (
      SELECT DISTINCT ON (tag) tag, n FROM (
        SELECT left(trim(BOTH '-' FROM regexp_replace(lower(btrim(raw, ' #')), '[\s#]+', '-', 'g')), 30) AS tag, n
        FROM unnest(coalesce(NEW.tags, '{}')) WITH ORDINALITY AS u(raw, n)
      ) cleaned
      WHERE char_length(tag) >= 2
      ORDER BY tag, n
    ) unique_tags
    ORDER BY n
    LIMIT 5);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS is_blog_tags_tidy ON is_blog_posts;
CREATE TRIGGER is_blog_tags_tidy BEFORE INSERT OR UPDATE OF tags ON is_blog_posts
  FOR EACH ROW EXECUTE FUNCTION private.is_blog_tags_tidy();

-- Tidy what is already there (the trigger runs on this update).
UPDATE is_blog_posts SET tags = tags WHERE tags <> '{}';

-- Search text now includes the hashtags.
ALTER TABLE is_blog_posts DROP COLUMN IF EXISTS search_text;
ALTER TABLE is_blog_posts ADD COLUMN search_text TEXT GENERATED ALWAYS AS (
  lower(title || ' ' || coalesce(summary, '') || ' ' || regexp_replace(body_html, '<[^>]*>', ' ', 'g') || ' ' || private.is_tags_text(tags))
) STORED;

NOTIFY pgrst, 'reload schema';
