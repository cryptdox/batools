-- Migration: 078_is_stored_translations.sql
-- Quran translations kept in our own database, so the app no longer depends
-- on an outside server for them. A translation pack (is_content_packs) can now
-- be "stored": its text (and footnotes, when the translator has them) is in
-- is_translation_ayahs, one row per ayah.
-- The app reads a surah's rows once and keeps them on the phone.
-- A stored pack reaches the app under the same rule as every pack: active,
-- approved and with its licence filled in.

DO $$
BEGIN
  IF to_regclass('public.is_content_packs') IS NULL THEN
    RAISE EXCEPTION 'Run 074–076 first.';
  END IF;
END $$;

ALTER TABLE is_content_packs ADD COLUMN IF NOT EXISTS is_stored BOOLEAN NOT NULL DEFAULT false;

-- A pack's text comes from a file, an alquran.cloud edition, or (now) our database.
DO $$
DECLARE c TEXT;
BEGIN
  SELECT conname INTO c FROM pg_constraint
  WHERE conrelid = 'is_content_packs'::regclass AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%file_url IS NOT NULL%api_edition IS NOT NULL%';
  IF c IS NOT NULL THEN
    EXECUTE format('ALTER TABLE is_content_packs DROP CONSTRAINT %I', c);
  END IF;
END $$;
ALTER TABLE is_content_packs DROP CONSTRAINT IF EXISTS is_content_packs_has_source;
ALTER TABLE is_content_packs ADD CONSTRAINT is_content_packs_has_source
  CHECK (file_url IS NOT NULL OR api_edition IS NOT NULL OR is_stored);

CREATE TABLE IF NOT EXISTS is_translation_ayahs (
  pack_id UUID NOT NULL REFERENCES is_content_packs(id) ON DELETE CASCADE,
  surah SMALLINT NOT NULL CHECK (surah BETWEEN 1 AND 114),
  ayah SMALLINT NOT NULL CHECK (ayah BETWEEN 1 AND 286),
  text TEXT NOT NULL,
  -- The translator's footnotes for this ayah, unchanged (may hold <b> and line breaks).
  note TEXT,
  PRIMARY KEY (pack_id, surah, ayah)
);
ALTER TABLE is_translation_ayahs ADD COLUMN IF NOT EXISTS note TEXT;

ALTER TABLE is_translation_ayahs ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE
  batools CONSTANT TEXT := '(SELECT private.lt_iam_claims()) IS NOT NULL';
BEGIN
  -- The app reads a pack's ayahs only while the pack itself is published.
  EXECUTE format($p$CREATE POLICY "is read" ON is_translation_ayahs FOR SELECT TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM is_content_packs p WHERE p.id = pack_id AND p.is_active AND p.review_status = 'approved'
            AND coalesce(trim(p.license), '') <> '') OR %s)$p$, batools);
  EXECUTE format('CREATE POLICY "is insert" ON is_translation_ayahs FOR INSERT TO anon, authenticated WITH CHECK (%s)', batools);
  EXECUTE format('CREATE POLICY "is update" ON is_translation_ayahs FOR UPDATE TO anon, authenticated USING (%s) WITH CHECK (%s)', batools, batools);
  EXECUTE format('CREATE POLICY "is delete" ON is_translation_ayahs FOR DELETE TO anon, authenticated USING (%s)', batools);
END $$;

NOTIFY pgrst, 'reload schema';
