-- Migration: 067_pf_about_audiences.sql
-- "More about me" audiences become a list the owner manages, per version:
-- e.g. Developer: In general, As a client; Researcher: In general, For
-- collaborators. Each tab on the site is one audience of the version shown.
--
--   pf_about_audiences            name, order, show/hide and version tags
--                                 (empty = every version), like other lists.
--   pf_about_sections.audience_id the audience a section belongs to.
--
-- The old fixed audience ('general' / 'client') is moved over: every owner
-- with sections gets "In general" and "As a client" audiences, named after
-- their about.filters.* labels when set. The old column stays (now optional)
-- and is no longer used.

CREATE TABLE IF NOT EXISTS pf_about_audiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name_en TEXT NOT NULL,
  name_bn TEXT NOT NULL DEFAULT '',
  versions UUID[] NOT NULL DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pf_about_audiences_user ON pf_about_audiences(user_id, sort_order);

ALTER TABLE pf_about_audiences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access" ON pf_about_audiences;
CREATE POLICY "Allow all access" ON pf_about_audiences FOR ALL USING (true);

ALTER TABLE pf_about_sections
  ADD COLUMN IF NOT EXISTS audience_id UUID REFERENCES pf_about_audiences(id) ON DELETE SET NULL;
ALTER TABLE pf_about_sections ALTER COLUMN audience DROP NOT NULL;

-- Move the fixed audiences over (once per owner).
INSERT INTO pf_about_audiences (user_id, name_en, name_bn, sort_order)
SELECT u.user_id, COALESCE(NULLIF(l.value_en, ''), d.name_en), COALESCE(NULLIF(l.value_bn, ''), d.name_bn), d.ord
FROM (SELECT DISTINCT user_id, audience FROM pf_about_sections WHERE audience IS NOT NULL) u
JOIN (VALUES ('general', 'In general', 'সাধারণভাবে', 1), ('client', 'As a client', 'ক্লায়েন্ট হিসেবে', 2))
  AS d(audience, name_en, name_bn, ord) ON d.audience = u.audience
LEFT JOIN pf_labels l ON l.user_id = u.user_id AND l.key = 'about.filters.' || u.audience
WHERE NOT EXISTS (SELECT 1 FROM pf_about_audiences a WHERE a.user_id = u.user_id);

UPDATE pf_about_sections s SET audience_id = a.id
FROM pf_about_audiences a
WHERE s.audience_id IS NULL AND a.user_id = s.user_id
  AND a.sort_order = CASE s.audience WHEN 'general' THEN 1 WHEN 'client' THEN 2 END;

NOTIFY pgrst, 'reload schema';
