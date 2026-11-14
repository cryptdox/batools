-- Migration: 081_is_content.sql
-- Islamic Studio, app 2.2.0 (versionCode 102):
--   * Quran translation text is read only (loaded from its source, never edited
--     in batools).
--   * Ayah of the day: tags (friday / ramadan / dhul_hijjah) for seasonal picks.
--   * Audio & Video (feature 'media'): YouTube videos and audio talks, uploaded
--     to Storage or linked, in categories (lectures, waz, debates…).
--   * Books (feature 'books'): PDF books with licence, read in the app.
--   * Blog (feature 'blog'): posts by the team (batools) and by app users. A
--     user's post is public only after review; at most 2 waiting per device.
--     Readers can report a post. Images: cover + 2, 1 MB each, in the private
--     bucket is-blog-images (readable once the post is approved).
--   * is_sync_manifest(): a fingerprint per table, so the app downloads only
--     what changed.
--   * batools can stop a device from posting (is_devices.can_post); "Delete my
--     data" (is_forget_device) now also removes the device's reports (its posts
--     go with the device; the app deletes its pictures first).
-- Content is shown in the app only when is_active AND review_status = 'approved'.

DO $$
BEGIN
  IF to_regclass('public.is_devices') IS NULL OR to_regclass('public.is_translation_ayahs') IS NULL THEN
    RAISE EXCEPTION 'Run 074–080 first.';
  END IF;
END $$;

-- Quran text: read only ------------------------------------------------------
DROP POLICY IF EXISTS "is insert" ON is_translation_ayahs;
DROP POLICY IF EXISTS "is update" ON is_translation_ayahs;
DROP POLICY IF EXISTS "is delete" ON is_translation_ayahs;

-- Ayah of the day ------------------------------------------------------------
ALTER TABLE is_daily_items ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE is_daily_items DROP CONSTRAINT IF EXISTS is_daily_items_tags_check;
ALTER TABLE is_daily_items ADD CONSTRAINT is_daily_items_tags_check
  CHECK (tags <@ ARRAY['friday', 'ramadan', 'dhul_hijjah']::text[]);

-- Audio & Video ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS is_media_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{2,40}$'),
  name JSONB NOT NULL,
  icon TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

CREATE TABLE IF NOT EXISTS is_media_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('video', 'audio')),
  category_id UUID REFERENCES is_media_categories(id) ON DELETE SET NULL,
  title JSONB NOT NULL,
  description JSONB NOT NULL DEFAULT '{}',
  -- Speaker / scholar, e.g. {"en": "Dr. Zakir Naik", "bn": "ডা. জাকির নায়েক"}.
  speaker JSONB NOT NULL DEFAULT '{}',
  language TEXT CHECK (char_length(language) <= 5),
  -- video: the 11-character YouTube id (batools takes the whole link).
  youtube_id TEXT CHECK (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  -- audio: a file in the islamic-studio bucket (media/audio/…) or an https link.
  file_path TEXT,
  audio_url TEXT CHECK (audio_url ~ '^https://'),
  duration_seconds INT CHECK (duration_seconds > 0),
  thumbnail_url TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  is_featured BOOLEAN NOT NULL DEFAULT false,
  review_status is_review_status NOT NULL DEFAULT 'draft',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  CONSTRAINT is_media_items_source CHECK (
    (kind = 'video' AND youtube_id IS NOT NULL) OR (kind = 'audio' AND (file_path IS NOT NULL OR audio_url IS NOT NULL)))
);
CREATE INDEX IF NOT EXISTS is_media_items_list ON is_media_items (kind, category_id, sort_order);

-- Books -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS is_book_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{2,40}$'),
  name JSONB NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

CREATE TABLE IF NOT EXISTS is_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES is_book_categories(id) ON DELETE SET NULL,
  title JSONB NOT NULL,
  author JSONB NOT NULL DEFAULT '{}',
  description JSONB NOT NULL DEFAULT '{}',
  language TEXT NOT NULL DEFAULT 'bn' CHECK (char_length(language) <= 5),
  -- The PDF: a file in the islamic-studio bucket (books/…) or an https link.
  file_path TEXT,
  file_url TEXT CHECK (file_url ~ '^https://'),
  cover_path TEXT,
  pages INT CHECK (pages > 0),
  size_bytes BIGINT CHECK (size_bytes > 0),
  -- Who may share it and how (required before approval), and where it came from.
  license TEXT,
  source_url TEXT,
  review_status is_review_status NOT NULL DEFAULT 'draft',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  CONSTRAINT is_books_file CHECK (file_path IS NOT NULL OR file_url IS NOT NULL),
  CONSTRAINT is_books_licensed CHECK (review_status <> 'approved' OR coalesce(btrim(license), '') <> '')
);

-- Blog --------------------------------------------------------------------------
-- A device batools has blocked from writing (abuse); only batools changes it
-- (080's guard keeps app writes from touching name_hidden; this one too).
ALTER TABLE is_devices ADD COLUMN IF NOT EXISTS can_post BOOLEAN NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION private.is_devices_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF private.lt_iam_claims() IS NULL THEN
    NEW.name_hidden := CASE WHEN TG_OP = 'UPDATE' THEN OLD.name_hidden ELSE false END;
    NEW.can_post := CASE WHEN TG_OP = 'UPDATE' THEN OLD.can_post ELSE true END;
  END IF;
  IF NEW.name_hidden THEN
    NEW.display_name := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS is_blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- team: written in batools; user: written in the app (reviewed first).
  source TEXT NOT NULL DEFAULT 'user' CHECK (source IN ('team', 'user')),
  device_id UUID REFERENCES is_devices(device_id) ON DELETE CASCADE,
  author_name TEXT NOT NULL CHECK (char_length(author_name) BETWEEN 2 AND 60),
  language TEXT NOT NULL DEFAULT 'bn' CHECK (language IN ('bn', 'en', 'ar')),
  title TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 3 AND 160),
  summary TEXT CHECK (char_length(summary) <= 300),
  -- Rich text from the editor; the app and batools sanitise it when shown.
  body_html TEXT NOT NULL CHECK (char_length(body_html) BETWEEN 1 AND 60000),
  cover_path TEXT,
  image_paths TEXT[] NOT NULL DEFAULT '{}' CHECK (cardinality(image_paths) <= 2),
  tags TEXT[] NOT NULL DEFAULT '{}' CHECK (cardinality(tags) <= 5),
  review_status is_review_status NOT NULL DEFAULT 'draft',
  -- Why a post was sent back (shown to its author).
  review_note TEXT CHECK (char_length(review_note) <= 500),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- For search: title, summary and the text of the body, lower-cased.
  search_text TEXT GENERATED ALWAYS AS (lower(title || ' ' || coalesce(summary, '') || ' ' || regexp_replace(body_html, '<[^>]*>', ' ', 'g'))) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  CONSTRAINT is_blog_posts_owner CHECK (source = 'team' OR device_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS is_blog_posts_public ON is_blog_posts (published_at DESC) WHERE review_status = 'approved' AND is_active;
CREATE INDEX IF NOT EXISTS is_blog_posts_device ON is_blog_posts (device_id);

CREATE TABLE IF NOT EXISTS is_blog_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES is_blog_posts(id) ON DELETE CASCADE,
  device_id UUID NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('offensive', 'wrong', 'spam', 'other')),
  note TEXT CHECK (char_length(note) <= 300),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, device_id)
);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['is_media_categories', 'is_media_items', 'is_book_categories', 'is_books', 'is_blog_posts'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_touch', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION is_touch_updated_at()', t || '_touch', t);
  END LOOP;
END $$;

/**
 * Rules for posts written in the app (batools is not limited):
 *   - the author is the device's display name (a name is needed to post);
 *   - review fields and publishing are batools' only;
 *   - sending for review: at most 2 posts waiting per device; 20 posts in all;
 *   - editing a published post sends it back for review.
 */
CREATE OR REPLACE FUNCTION private.is_blog_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  me UUID := private.is_device_id();
  waiting INT;
BEGIN
  -- batools, and loads run in the SQL editor (not through the API, which
  -- switches the session's role to anon / authenticated), aren't limited.
  -- (current_user is this function's owner here, so the role setting is checked.)
  IF private.lt_iam_claims() IS NOT NULL OR coalesce(current_setting('role', true), 'none') NOT IN ('anon', 'authenticated') THEN
    IF NEW.review_status = 'approved' AND NEW.published_at IS NULL THEN
      NEW.published_at := now();
    END IF;
    RETURN NEW;
  END IF;

  NEW.source := 'user';
  NEW.device_id := me;
  IF EXISTS (SELECT 1 FROM is_devices WHERE device_id = me AND NOT can_post) THEN
    RAISE EXCEPTION 'is_blog_blocked';
  END IF;
  SELECT display_name INTO NEW.author_name FROM is_devices WHERE device_id = me;
  IF NEW.author_name IS NULL THEN
    RAISE EXCEPTION 'is_blog_name_required' USING HINT = 'Set a display name first.';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.review_note := CASE WHEN NEW.review_status = 'in_review' THEN NULL ELSE OLD.review_note END;
    NEW.reviewed_by := OLD.reviewed_by;
    NEW.reviewed_at := OLD.reviewed_at;
    NEW.published_at := OLD.published_at;
    NEW.is_active := OLD.is_active;
    -- A changed published post is reviewed again.
    IF OLD.review_status = 'approved' AND (NEW.title, NEW.summary, NEW.body_html, NEW.cover_path, NEW.image_paths)
       IS DISTINCT FROM (OLD.title, OLD.summary, OLD.body_html, OLD.cover_path, OLD.image_paths) THEN
      NEW.review_status := 'in_review';
    END IF;
  ELSE
    NEW.review_note := NULL;
    NEW.reviewed_by := NULL;
    NEW.reviewed_at := NULL;
    NEW.published_at := NULL;
    NEW.is_active := true;
    IF (SELECT count(*) FROM is_blog_posts WHERE device_id = me) >= 20 THEN
      RAISE EXCEPTION 'is_blog_post_limit';
    END IF;
  END IF;
  IF NEW.review_status NOT IN ('draft', 'in_review') AND (TG_OP = 'INSERT' OR NEW.review_status IS DISTINCT FROM OLD.review_status) THEN
    RAISE EXCEPTION 'is_blog_status_not_allowed';
  END IF;
  IF NEW.review_status = 'in_review' AND (TG_OP = 'INSERT' OR OLD.review_status <> 'in_review') THEN
    SELECT count(*) INTO waiting FROM is_blog_posts WHERE device_id = me AND review_status = 'in_review' AND id <> NEW.id;
    IF waiting >= 2 THEN
      RAISE EXCEPTION 'is_blog_pending_limit' USING HINT = 'At most 2 posts can wait for review.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS is_blog_guard ON is_blog_posts;
CREATE TRIGGER is_blog_guard BEFORE INSERT OR UPDATE ON is_blog_posts FOR EACH ROW EXECUTE FUNCTION private.is_blog_guard();

-- Access ------------------------------------------------------------------------
DO $$
DECLARE
  batools CONSTANT TEXT := '(SELECT private.lt_iam_claims()) IS NOT NULL';
  me CONSTANT TEXT := '(SELECT private.is_device_id())';
  r RECORD;
BEGIN
  -- batools edits; the app reads what is switched on and approved.
  FOR r IN SELECT * FROM (VALUES
    ('is_media_categories', 'is_active'),
    ('is_media_items', 'is_active AND review_status = ''approved'''),
    ('is_book_categories', 'is_active'),
    ('is_books', 'is_active AND review_status = ''approved''')
  ) AS v(tbl, app_reads) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', r.tbl);
    EXECUTE format('DROP POLICY IF EXISTS "is read" ON %I', r.tbl);
    EXECUTE format('DROP POLICY IF EXISTS "is insert" ON %I', r.tbl);
    EXECUTE format('DROP POLICY IF EXISTS "is update" ON %I', r.tbl);
    EXECUTE format('DROP POLICY IF EXISTS "is delete" ON %I', r.tbl);
    EXECUTE format('CREATE POLICY "is read" ON %I FOR SELECT TO anon, authenticated USING ((%s) OR %s)', r.tbl, r.app_reads, batools);
    EXECUTE format('CREATE POLICY "is insert" ON %I FOR INSERT TO anon, authenticated WITH CHECK (%s)', r.tbl, batools);
    EXECUTE format('CREATE POLICY "is update" ON %I FOR UPDATE TO anon, authenticated USING (%s) WITH CHECK (%s)', r.tbl, batools, batools);
    EXECUTE format('CREATE POLICY "is delete" ON %I FOR DELETE TO anon, authenticated USING (%s)', r.tbl, batools);
  END LOOP;

  -- Posts: everyone reads published ones; a device reads, writes and deletes its own.
  ALTER TABLE is_blog_posts ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "is read" ON is_blog_posts;
  DROP POLICY IF EXISTS "is insert" ON is_blog_posts;
  DROP POLICY IF EXISTS "is update" ON is_blog_posts;
  DROP POLICY IF EXISTS "is delete" ON is_blog_posts;
  EXECUTE format('CREATE POLICY "is read" ON is_blog_posts FOR SELECT TO anon, authenticated USING ((is_active AND review_status = ''approved'') OR device_id = %s OR %s)', me, batools);
  EXECUTE format('CREATE POLICY "is insert" ON is_blog_posts FOR INSERT TO anon, authenticated WITH CHECK (%s OR (source = ''user'' AND device_id = %s))', batools, me);
  EXECUTE format('CREATE POLICY "is update" ON is_blog_posts FOR UPDATE TO anon, authenticated USING (%s OR device_id = %s) WITH CHECK (%s OR device_id = %s)', batools, me, batools, me);
  EXECUTE format('CREATE POLICY "is delete" ON is_blog_posts FOR DELETE TO anon, authenticated USING (%s OR device_id = %s)', batools, me);

  -- Reports: a device files one per post; batools reads and closes them.
  ALTER TABLE is_blog_reports ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "is read" ON is_blog_reports;
  DROP POLICY IF EXISTS "is insert" ON is_blog_reports;
  DROP POLICY IF EXISTS "is update" ON is_blog_reports;
  DROP POLICY IF EXISTS "is delete" ON is_blog_reports;
  EXECUTE format('CREATE POLICY "is read" ON is_blog_reports FOR SELECT TO anon, authenticated USING (%s)', batools);
  EXECUTE format('CREATE POLICY "is insert" ON is_blog_reports FOR INSERT TO anon, authenticated WITH CHECK (device_id = %s AND status = ''new'')', me);
  EXECUTE format('CREATE POLICY "is update" ON is_blog_reports FOR UPDATE TO anon, authenticated USING (%s) WITH CHECK (%s)', batools, batools);
  EXECUTE format('CREATE POLICY "is delete" ON is_blog_reports FOR DELETE TO anon, authenticated USING (%s)', batools);
END $$;

-- Storage -----------------------------------------------------------------------
-- islamic-studio (public): team uploads — audio talks (media/audio/), books
-- (books/), covers. Up to 50 MB a file.
UPDATE storage.buckets SET file_size_limit = 52428800,
  allowed_mime_types = ARRAY['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/ogg', 'audio/webm',
                             'application/pdf', 'image/png', 'image/jpeg', 'image/webp']
WHERE id = 'islamic-studio';

-- is-blog-images (private): blog pictures, 1 MB each. App users write only to
-- user/<their installation id>/ (30 files at most); a picture is readable by
-- everyone once a published post uses it.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('is-blog-images', 'is-blog-images', false, 1048576, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 1048576, allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION private.is_blog_image_public(p_name TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM is_blog_posts
                 WHERE is_active AND review_status = 'approved' AND (cover_path = p_name OR p_name = ANY (image_paths)));
$$;

CREATE OR REPLACE FUNCTION private.is_blog_image_room(p_device UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, storage AS $$
  SELECT count(*) < 30 FROM storage.objects WHERE bucket_id = 'is-blog-images' AND name LIKE 'user/' || p_device::text || '/%';
$$;
GRANT EXECUTE ON FUNCTION private.is_blog_image_public(TEXT), private.is_blog_image_room(UUID) TO anon, authenticated;

DROP POLICY IF EXISTS "is-blog-images read" ON storage.objects;
DROP POLICY IF EXISTS "is-blog-images insert" ON storage.objects;
DROP POLICY IF EXISTS "is-blog-images delete" ON storage.objects;
CREATE POLICY "is-blog-images read" ON storage.objects FOR SELECT TO public USING (
  bucket_id = 'is-blog-images' AND (
    (SELECT private.lt_iam_claims()) IS NOT NULL
    OR name LIKE 'user/' || (SELECT private.is_device_id())::text || '/%'
    OR private.is_blog_image_public(name)));
CREATE POLICY "is-blog-images insert" ON storage.objects FOR INSERT TO public WITH CHECK (
  bucket_id = 'is-blog-images' AND (
    (SELECT private.lt_iam_claims()) IS NOT NULL
    OR (name LIKE 'user/' || (SELECT private.is_device_id())::text || '/%' AND private.is_blog_image_room((SELECT private.is_device_id())))));
CREATE POLICY "is-blog-images delete" ON storage.objects FOR DELETE TO public USING (
  bucket_id = 'is-blog-images' AND (
    (SELECT private.lt_iam_claims()) IS NOT NULL
    OR name LIKE 'user/' || (SELECT private.is_device_id())::text || '/%'));

-- What changed --------------------------------------------------------------------
-- A fingerprint of each listed table, as the caller sees it (RLS applies), so
-- the app reloads only tables whose fingerprint changed.
CREATE OR REPLACE FUNCTION public.is_sync_manifest(p_tables TEXT[])
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE
  t TEXT;
  fingerprint TEXT;
  result JSONB := '{}';
BEGIN
  IF cardinality(p_tables) > 60 THEN
    RAISE EXCEPTION 'too many tables';
  END IF;
  FOREACH t IN ARRAY p_tables LOOP
    CONTINUE WHEN t !~ '^is_[a-z_]{1,60}$' OR to_regclass(format('public.%I', t)) IS NULL;
    EXECUTE format('SELECT md5(coalesce(string_agg(md5(x::text), '','' ORDER BY md5(x::text)), '''')) FROM %I x', t) INTO fingerprint;
    result := result || jsonb_build_object(t, fingerprint);
  END LOOP;
  RETURN result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.is_sync_manifest(TEXT[]) TO anon, authenticated;

-- "Delete my data" also removes the reports this device filed (its posts go
-- with the device row; the app deletes its pictures before calling this).
CREATE OR REPLACE FUNCTION public.is_forget_device()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE me UUID := private.is_device_id();
BEGIN
  IF me IS NULL THEN
    RETURN false;
  END IF;
  DELETE FROM is_blog_reports WHERE device_id = me;
  -- Scores and blog posts go with it (ON DELETE CASCADE).
  DELETE FROM is_devices WHERE device_id = me;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.is_forget_device() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_forget_device() TO anon, authenticated;

-- Features ----------------------------------------------------------------------
INSERT INTO is_features (key, name, description, feature_group, tab, phase, min_version_code, icon, sort_order) VALUES
  ('books', '{"en":"Books","bn":"বই","ar":"الكتب"}',
   '{"en":"Islamic books to read in the app.","bn":"অ্যাপে পড়ার জন্য ইসলামিক বই।"}', 'quran_learning', 'learn', 3, 102, 'library', 85),
  ('blog', '{"en":"Blog","bn":"ব্লগ","ar":"المدونة"}',
   '{"en":"Articles by the team and readers; readers'' posts are reviewed first.","bn":"টিম ও পাঠকদের লেখা; পাঠকদের লেখা আগে যাচাই হয়।"}', 'community_media', 'learn', 3, 102, 'book-open', 195)
ON CONFLICT (key) DO NOTHING;
UPDATE is_features SET min_version_code = 102 WHERE key = 'media' AND min_version_code IS NULL;

-- Starting categories (rename or add more in batools).
INSERT INTO is_media_categories (slug, name, icon, sort_order) VALUES
  ('lecture', '{"en":"Lectures","bn":"লেকচার"}', 'mic', 10),
  ('waz', '{"en":"Waz mahfil","bn":"ওয়াজ মাহফিল"}', 'users', 20),
  ('speech', '{"en":"Speeches","bn":"বক্তৃতা"}', 'mic', 30),
  ('debate', '{"en":"Debates","bn":"ইসলামিক বিতর্ক"}', 'users', 40),
  ('tafsir', '{"en":"Tafsir","bn":"তাফসির"}', 'book-open', 50),
  ('kids', '{"en":"For children","bn":"শিশুদের জন্য"}', 'sparkles', 60)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO is_book_categories (slug, name, sort_order) VALUES
  ('aqeedah', '{"en":"Belief (Aqeedah)","bn":"আকিদা"}', 10),
  ('salah', '{"en":"Prayer & worship","bn":"নামাজ ও ইবাদত"}', 20),
  ('seerah', '{"en":"Seerah","bn":"সিরাত"}', 30),
  ('hadith', '{"en":"Hadith","bn":"হাদিস"}', 40),
  ('duas', '{"en":"Duas & dhikr","bn":"দোয়া ও জিকির"}', 50),
  ('family', '{"en":"Family & manners","bn":"পরিবার ও আদব"}', 60),
  ('kids', '{"en":"For children","bn":"শিশুদের জন্য"}', 70)
ON CONFLICT (slug) DO NOTHING;

NOTIFY pgrst, 'reload schema';
