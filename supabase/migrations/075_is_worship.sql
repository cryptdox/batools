-- Migration: 075_is_worship.sql
-- Islamic Studio worship content, edited in batools:
--   is_prayer_regions      per-country prayer-time defaults (times are computed on the phone)
--   is_adhan_sounds        adhan audio choices
--   is_dhikr_presets       tasbih presets (counts stay on the phone)
--   is_dua_categories / is_duas / is_dua_category_items
--   is_islamic_events      events by Hijri date
--   is_hijri_month_starts  moon-sighting result: the real first day of a Hijri month per region
--   is_ramadan_seasons     Ramadan dates and sehri / iftar caution minutes per region
--   is_checklist_items     Ramadan and daily worship checklists
--
-- Religious text (dhikr, duas) needs a source and a reviewer: the app sees a
-- row only when it is active AND review_status = 'approved'.

CREATE TABLE IF NOT EXISTS is_prayer_regions (
  code TEXT PRIMARY KEY,
  name JSONB NOT NULL,
  -- adhan-js method: MuslimWorldLeague, Egyptian, Karachi, UmmAlQura, Dubai, MoonsightingCommittee,
  -- NorthAmerica, Kuwait, Qatar, Singapore, Tehran, Turkey.
  calc_method TEXT NOT NULL DEFAULT 'Karachi',
  madhab TEXT NOT NULL DEFAULT 'hanafi' CHECK (madhab IN ('hanafi', 'shafi')),
  high_latitude_rule TEXT NOT NULL DEFAULT 'middle_of_the_night'
    CHECK (high_latitude_rule IN ('middle_of_the_night', 'seventh_of_the_night', 'twilight_angle')),
  -- Minutes added per prayer: {"fajr":0,"sunrise":0,"dhuhr":0,"asr":0,"maghrib":0,"isha":0}
  adjustments JSONB NOT NULL DEFAULT '{}',
  -- Used before the phone knows where it is (and for picking a city by hand).
  default_lat DOUBLE PRECISION,
  default_lng DOUBLE PRECISION,
  default_city JSONB NOT NULL DEFAULT '{}',
  timezone TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

CREATE TABLE IF NOT EXISTS is_adhan_sounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name JSONB NOT NULL,
  muezzin TEXT,
  audio_url TEXT NOT NULL,
  for_fajr BOOLEAN NOT NULL DEFAULT false,
  is_default BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS is_dhikr_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  arabic TEXT NOT NULL,
  transliteration JSONB NOT NULL DEFAULT '{}',
  translation JSONB NOT NULL DEFAULT '{}',
  default_target INT NOT NULL DEFAULT 33 CHECK (default_target > 0),
  virtue JSONB NOT NULL DEFAULT '{}',
  source_ref TEXT,
  review_status is_review_status NOT NULL DEFAULT 'draft',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS is_dua_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name JSONB NOT NULL,
  icon TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

CREATE TABLE IF NOT EXISTS is_duas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title JSONB NOT NULL,
  arabic TEXT NOT NULL,
  transliteration JSONB NOT NULL DEFAULT '{}',
  translation JSONB NOT NULL DEFAULT '{}',
  virtue JSONB NOT NULL DEFAULT '{}',
  when_to_read JSONB NOT NULL DEFAULT '{}',
  repeat_count INT NOT NULL DEFAULT 1 CHECK (repeat_count > 0),
  -- Required: where the dua comes from, e.g. 'Sahih al-Bukhari 6306'.
  source_ref TEXT NOT NULL,
  grade TEXT,
  audio_url TEXT,
  review_status is_review_status NOT NULL DEFAULT 'draft',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A dua can sit in several categories (morning AND evening), ordered per category.
CREATE TABLE IF NOT EXISTS is_dua_category_items (
  category_id UUID NOT NULL REFERENCES is_dua_categories(id) ON DELETE CASCADE,
  dua_id UUID NOT NULL REFERENCES is_duas(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (category_id, dua_id)
);
CREATE INDEX IF NOT EXISTS is_dua_category_items_dua ON is_dua_category_items (dua_id);

CREATE TABLE IF NOT EXISTS is_islamic_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name JSONB NOT NULL,
  description JSONB NOT NULL DEFAULT '{}',
  kind TEXT NOT NULL CHECK (kind IN ('eid', 'ramadan', 'hajj', 'fasting', 'night', 'other')),
  hijri_month SMALLINT NOT NULL CHECK (hijri_month BETWEEN 1 AND 12),
  hijri_day SMALLINT NOT NULL CHECK (hijri_day BETWEEN 1 AND 30),
  duration_days SMALLINT NOT NULL DEFAULT 1 CHECK (duration_days > 0),
  remind_days_before SMALLINT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

-- The phone calculates Hijri dates (Umm al-Qura) and corrects them with these rows.
CREATE TABLE IF NOT EXISTS is_hijri_month_starts (
  region_code TEXT NOT NULL REFERENCES is_prayer_regions(code) ON DELETE CASCADE,
  hijri_year SMALLINT NOT NULL,
  hijri_month SMALLINT NOT NULL CHECK (hijri_month BETWEEN 1 AND 12),
  starts_on DATE NOT NULL,
  note TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  PRIMARY KEY (region_code, hijri_year, hijri_month)
);

CREATE TABLE IF NOT EXISTS is_ramadan_seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_code TEXT NOT NULL REFERENCES is_prayer_regions(code) ON DELETE CASCADE,
  hijri_year SMALLINT NOT NULL,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  -- Sehri ends this many minutes before Fajr; iftar is this many after Maghrib.
  sehri_caution_minutes SMALLINT NOT NULL DEFAULT 0,
  iftar_caution_minutes SMALLINT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  CHECK (ends_on >= starts_on),
  UNIQUE (region_code, hijri_year)
);

CREATE TABLE IF NOT EXISTS is_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  context TEXT NOT NULL CHECK (context IN ('ramadan', 'daily')),
  text JSONB NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['is_prayer_regions', 'is_adhan_sounds', 'is_dhikr_presets', 'is_dua_categories', 'is_duas',
                           'is_islamic_events', 'is_hijri_month_starts', 'is_ramadan_seasons', 'is_checklist_items'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_touch', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION is_touch_updated_at()', t || '_touch', t);
  END LOOP;
END $$;

-- Access: the app reads what is published, batools does everything (see 074).
DO $$
DECLARE
  batools CONSTANT TEXT := '(SELECT private.lt_iam_claims()) IS NOT NULL';
  approved CONSTANT TEXT := 'is_active AND review_status = ''approved''';
  r RECORD;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('is_prayer_regions', 'is_active'),
    ('is_adhan_sounds', 'is_active'),
    ('is_dhikr_presets', approved),
    ('is_dua_categories', 'is_active'),
    ('is_duas', approved),
    ('is_dua_category_items', 'true'),
    ('is_islamic_events', 'is_active'),
    ('is_hijri_month_starts', 'true'),
    ('is_ramadan_seasons', 'is_active'),
    ('is_checklist_items', 'is_active')
  ) AS v(tbl, app_reads) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', r.tbl);
    EXECUTE format('CREATE POLICY "is read" ON %I FOR SELECT TO anon, authenticated USING ((%s) OR %s)', r.tbl, r.app_reads, batools);
    EXECUTE format('CREATE POLICY "is insert" ON %I FOR INSERT TO anon, authenticated WITH CHECK (%s)', r.tbl, batools);
    EXECUTE format('CREATE POLICY "is update" ON %I FOR UPDATE TO anon, authenticated USING (%s) WITH CHECK (%s)', r.tbl, batools, batools);
    EXECUTE format('CREATE POLICY "is delete" ON %I FOR DELETE TO anon, authenticated USING (%s)', r.tbl, batools);
  END LOOP;
END $$;

-- Starting data ------------------------------------------------------------

-- Bangladesh: Karachi method with Hanafi Asr (as Islamic Foundation Bangladesh). Check the minute adjustments against IFB's timetable.
INSERT INTO is_prayer_regions (code, name, calc_method, madhab, default_lat, default_lng, default_city, timezone, sort_order) VALUES
  ('BD', '{"en":"Bangladesh","bn":"বাংলাদেশ","ar":"بنغلاديش"}', 'Karachi', 'hanafi', 23.8103, 90.4125,
   '{"en":"Dhaka","bn":"ঢাকা","ar":"دكا"}', 'Asia/Dhaka', 1),
  ('XX', '{"en":"Other countries","bn":"অন্যান্য দেশ","ar":"دول أخرى"}', 'MuslimWorldLeague', 'shafi', 21.4225, 39.8262,
   '{"en":"Makkah","bn":"মক্কা","ar":"مكة"}', NULL, 99)
ON CONFLICT (code) DO NOTHING;

INSERT INTO is_dua_categories (slug, name, icon, sort_order) VALUES
  ('morning', '{"en":"Morning","bn":"সকালের যিকির","ar":"أذكار الصباح"}', 'sunrise', 1),
  ('evening', '{"en":"Evening","bn":"সন্ধ্যার যিকির","ar":"أذكار المساء"}', 'sunset', 2),
  ('after-salah', '{"en":"After Salah","bn":"নামাজের পর","ar":"بعد الصلاة"}', 'repeat', 3),
  ('sleep', '{"en":"Sleeping","bn":"ঘুমানোর সময়","ar":"النوم"}', 'moon', 4),
  ('waking', '{"en":"Waking up","bn":"ঘুম থেকে ওঠা","ar":"الاستيقاظ"}', 'sun', 5),
  ('home', '{"en":"Home","bn":"ঘর","ar":"المنزل"}', 'home', 6),
  ('food', '{"en":"Food & Drink","bn":"খাওয়া-দাওয়া","ar":"الطعام والشراب"}', 'utensils', 7),
  ('travel', '{"en":"Travel","bn":"সফর","ar":"السفر"}', 'plane', 8),
  ('masjid', '{"en":"Masjid","bn":"মসজিদ","ar":"المسجد"}', 'landmark', 9),
  ('wudu', '{"en":"Wudu","bn":"অজু","ar":"الوضوء"}', 'droplets', 10),
  ('distress', '{"en":"Distress & Worry","bn":"বিপদ ও দুশ্চিন্তা","ar":"الكرب والهم"}', 'heart', 11),
  ('forgiveness', '{"en":"Forgiveness","bn":"ক্ষমা প্রার্থনা","ar":"الاستغفار"}', 'sparkles', 12)
ON CONFLICT (slug) DO NOTHING;

-- Tasbih presets start as drafts: a reviewer checks the source and approves them in batools.
INSERT INTO is_dhikr_presets (arabic, transliteration, translation, default_target, source_ref, sort_order) VALUES
  ('سُبْحَانَ اللّٰهِ', '{"en":"SubhanAllah","bn":"সুবহানাল্লাহ"}', '{"en":"Glory be to Allah","bn":"আল্লাহ পবিত্র"}', 33, 'Sahih Muslim 597', 1),
  ('الْحَمْدُ لِلّٰهِ', '{"en":"Alhamdulillah","bn":"আলহামদুলিল্লাহ"}', '{"en":"All praise is for Allah","bn":"সকল প্রশংসা আল্লাহর"}', 33, 'Sahih Muslim 597', 2),
  ('اللّٰهُ أَكْبَرُ', '{"en":"Allahu Akbar","bn":"আল্লাহু আকবার"}', '{"en":"Allah is the Greatest","bn":"আল্লাহ সবচেয়ে মহান"}', 33, 'Sahih Muslim 597', 3),
  ('أَسْتَغْفِرُ اللّٰهَ', '{"en":"Astaghfirullah","bn":"আস্তাগফিরুল্লাহ"}', '{"en":"I seek Allah''s forgiveness","bn":"আমি আল্লাহর কাছে ক্ষমা চাই"}', 100, 'Sahih Muslim 2702', 4),
  ('لَا إِلٰهَ إِلَّا اللّٰهُ', '{"en":"La ilaha illallah","bn":"লা ইলাহা ইল্লাল্লাহ"}', '{"en":"There is no god but Allah","bn":"আল্লাহ ছাড়া কোনো উপাস্য নেই"}', 100, 'Sunan at-Tirmidhi 3383', 5);

INSERT INTO is_islamic_events (name, kind, hijri_month, hijri_day, duration_days, remind_days_before, sort_order) VALUES
  ('{"en":"Islamic New Year","bn":"হিজরি নববর্ষ","ar":"رأس السنة الهجرية"}', 'other', 1, 1, 1, NULL, 1),
  ('{"en":"Day of Ashura","bn":"আশুরা","ar":"يوم عاشوراء"}', 'fasting', 1, 10, 1, 1, 2),
  ('{"en":"Ramadan begins","bn":"রমজান শুরু","ar":"بداية رمضان"}', 'ramadan', 9, 1, 1, 3, 3),
  ('{"en":"Laylat al-Qadr (27th night)","bn":"শবে কদর (২৭তম রাত)","ar":"ليلة القدر"}', 'night', 9, 27, 1, NULL, 4),
  ('{"en":"Eid al-Fitr","bn":"ঈদুল ফিতর","ar":"عيد الفطر"}', 'eid', 10, 1, 1, 2, 5),
  ('{"en":"Days of Hajj begin","bn":"হজের দিন শুরু","ar":"أيام الحج"}', 'hajj', 12, 8, 1, NULL, 6),
  ('{"en":"Day of Arafah","bn":"আরাফার দিন","ar":"يوم عرفة"}', 'fasting', 12, 9, 1, 1, 7),
  ('{"en":"Eid al-Adha","bn":"ঈদুল আযহা","ar":"عيد الأضحى"}', 'eid', 12, 10, 1, 2, 8);

INSERT INTO is_checklist_items (context, text, sort_order) VALUES
  ('daily', '{"en":"Five daily prayers","bn":"পাঁচ ওয়াক্ত নামাজ"}', 1),
  ('daily', '{"en":"Read Quran","bn":"কুরআন তিলাওয়াত"}', 2),
  ('daily', '{"en":"Morning & evening adhkar","bn":"সকাল-সন্ধ্যার যিকির"}', 3),
  ('ramadan', '{"en":"Sehri","bn":"সেহরি"}', 1),
  ('ramadan', '{"en":"Fast","bn":"রোজা"}', 2),
  ('ramadan', '{"en":"Taraweeh","bn":"তারাবিহ"}', 3),
  ('ramadan', '{"en":"Read one juz","bn":"এক পারা তিলাওয়াত"}', 4),
  ('ramadan', '{"en":"Give charity","bn":"দান-সদকা"}', 5);

NOTIFY pgrst, 'reload schema';
