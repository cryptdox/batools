-- Migration: 042_mp_more_covers.sql
-- Music player: singers, sources (band / movie / ...) and genres get a cover
-- photo too, stored like song / album covers (a row in mp_files).

ALTER TABLE mp_singers ADD COLUMN IF NOT EXISTS cover_file_id UUID CONSTRAINT mp_singers_cover_fkey REFERENCES mp_files(id) ON DELETE SET NULL;
ALTER TABLE mp_sources ADD COLUMN IF NOT EXISTS cover_file_id UUID CONSTRAINT mp_sources_cover_fkey REFERENCES mp_files(id) ON DELETE SET NULL;
ALTER TABLE mp_genres  ADD COLUMN IF NOT EXISTS cover_file_id UUID CONSTRAINT mp_genres_cover_fkey  REFERENCES mp_files(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';
