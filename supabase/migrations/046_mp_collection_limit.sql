-- An album or mix holds at most 20 songs (the public player, mumu, shows
-- top-20 style lists everywhere, like Spotify). Enforced here so every writer
-- (batools pages, bulk tools, direct API calls) gets the same rule.

CREATE OR REPLACE FUNCTION mp_collection_songs_limit()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  -- Serialise adds to the same collection so two parallel inserts can't both pass at 19.
  PERFORM pg_advisory_xact_lock(hashtext('mp_collection_songs:' || NEW.collection_id::text));
  IF (SELECT count(*) FROM mp_collection_songs
      WHERE collection_id = NEW.collection_id AND id IS DISTINCT FROM NEW.id) >= 20 THEN
    RAISE EXCEPTION 'An album or mix can hold at most 20 songs'
      USING ERRCODE = 'check_violation', HINT = 'mp_collection_full';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS mp_collection_songs_limit ON mp_collection_songs;
CREATE TRIGGER mp_collection_songs_limit
  BEFORE INSERT OR UPDATE OF collection_id ON mp_collection_songs
  FOR EACH ROW EXECUTE FUNCTION mp_collection_songs_limit();
