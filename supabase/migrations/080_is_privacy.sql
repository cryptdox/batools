-- Migration: 080_is_privacy.sql
-- Islamic Studio: what Google Play's privacy and user-content rules need.
--   * batools can hide a device's display name (offensive names on leaderboards).
--     A hidden name stays hidden: the app can't set it again, only batools can
--     un-hide it.
--   * "Delete my data" in the app: is_forget_device() deletes the calling
--     device and, through the foreign key, all of its scores. batools can
--     already delete a device (policy "is delete" from 077).
--   * Worship Tracker and Ramadan rows no longer keep which prayers / fasts
--     were marked; only the day's score is needed.

DO $$
BEGIN
  IF to_regclass('public.is_device_scores') IS NULL THEN
    RAISE EXCEPTION 'Run 074–077 first.';
  END IF;
END $$;

ALTER TABLE is_devices ADD COLUMN IF NOT EXISTS name_hidden BOOLEAN NOT NULL DEFAULT false;

-- Only batools may change name_hidden; while it is set the name stays empty.
CREATE OR REPLACE FUNCTION private.is_devices_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF private.lt_iam_claims() IS NULL THEN
    NEW.name_hidden := CASE WHEN TG_OP = 'UPDATE' THEN OLD.name_hidden ELSE false END;
  END IF;
  IF NEW.name_hidden THEN
    NEW.display_name := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS is_devices_guard ON is_devices;
CREATE TRIGGER is_devices_guard BEFORE INSERT OR UPDATE ON is_devices
  FOR EACH ROW EXECUTE FUNCTION private.is_devices_guard();

DROP POLICY IF EXISTS "is update" ON is_devices;
CREATE POLICY "is update" ON is_devices FOR UPDATE TO anon, authenticated
  USING ((SELECT private.lt_iam_claims()) IS NOT NULL) WITH CHECK ((SELECT private.lt_iam_claims()) IS NOT NULL);

-- The app's "Delete my data": removes this installation and all its scores.
CREATE OR REPLACE FUNCTION public.is_forget_device()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE me UUID := private.is_device_id();
BEGIN
  IF me IS NULL THEN
    RETURN false;
  END IF;
  -- Scores go with it (ON DELETE CASCADE).
  DELETE FROM is_devices WHERE device_id = me;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.is_forget_device() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_forget_device() TO anon, authenticated;

-- Older builds sent the marked prayers / fasts; keep only the score.
UPDATE is_device_scores SET details = '{}' WHERE feature IN ('tracker', 'ramadan') AND details <> '{}';

NOTIFY pgrst, 'reload schema';
