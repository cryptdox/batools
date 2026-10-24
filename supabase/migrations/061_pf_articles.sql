-- Migration: 061_pf_articles.sql
-- "Articles" on the portfolio: posts published elsewhere (Medium, LinkedIn, X,
-- Facebook, Instagram, YouTube, any site) and articles written here.
--
--   pf_posts         one row per post, both kinds, so they order and filter
--                    together. external: links out to external_url.
--                    article: has its own page at /articles/<slug>.
--   pf_post_blocks   an article's body, in order (like Medium): text,
--                    heading, image, video, quote, code, link, divider.
--                    Videos are never uploaded: link_url points at the
--                    video and the site shows a banner that opens it.
--
-- Images (covers, image blocks) live in the public `portfolio` bucket under
-- <user_id>/posts/. Same RLS as the other pf_ tables (see 025).

CREATE TABLE IF NOT EXISTS pf_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('external', 'article')),
  platform TEXT NOT NULL DEFAULT 'website'
    CHECK (platform IN ('native', 'medium', 'linkedin', 'x', 'facebook', 'instagram', 'youtube', 'website', 'other')),
  external_url TEXT,
  -- URL-safe, unique per user; the article's address.
  slug TEXT CHECK (slug IS NULL OR slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title_en TEXT NOT NULL,
  title_bn TEXT NOT NULL DEFAULT '',
  summary_en TEXT,
  summary_bn TEXT,
  cover_url TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  published_at DATE,
  -- Drafts never reach the portfolio.
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
  -- Articles: estimated from the block text when saved.
  reading_minutes INT CHECK (reading_minutes IS NULL OR reading_minutes >= 0),
  is_featured BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pf_posts_kind_fields CHECK (
    (kind = 'external' AND external_url IS NOT NULL AND slug IS NULL)
    OR (kind = 'article' AND slug IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS pf_posts_user_slug_key ON pf_posts (user_id, slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pf_posts_user ON pf_posts (user_id, sort_order);

CREATE TABLE IF NOT EXISTS pf_post_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  post_id UUID NOT NULL REFERENCES pf_posts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'text'
    CHECK (kind IN ('text', 'heading', 'image', 'video', 'quote', 'code', 'link', 'divider')),
  -- text (rich HTML), heading, quote
  text_en TEXT,
  text_bn TEXT,
  -- image: the uploaded file
  media_url TEXT,
  alt_en TEXT,
  -- image, video, link
  caption_en TEXT,
  caption_bn TEXT,
  -- video (never uploaded) and link: where a click goes
  link_url TEXT,
  -- video / link banner image (YouTube's is filled in from the link)
  thumbnail_url TEXT,
  -- code
  code TEXT,
  code_language TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pf_post_blocks_post ON pf_post_blocks (post_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_pf_post_blocks_user ON pf_post_blocks (user_id, sort_order);

ALTER TABLE pf_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pf_post_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access" ON pf_posts;
DROP POLICY IF EXISTS "Allow all access" ON pf_post_blocks;
CREATE POLICY "Allow all access" ON pf_posts FOR ALL USING (true);
CREATE POLICY "Allow all access" ON pf_post_blocks FOR ALL USING (true);

-- Instagram joins the other social handles on the profile.
ALTER TABLE pf_profile ADD COLUMN IF NOT EXISTS instagram TEXT;

NOTIFY pgrst, 'reload schema';
