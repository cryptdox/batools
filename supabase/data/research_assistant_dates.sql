-- Research Assistant role: Apr 2023 – Present (was Apr 2021 – May 2023), to
-- match the CV. Run in the Supabase SQL editor. Safe to re-run.
--
-- 1. The Research Assistant entry (Researcher version): new dates, marked current.
-- 2. The Researcher "Short bio" sentence that gave 2021 to 2023.
-- Only these words change; the rest of each row stays as it is.

BEGIN;

UPDATE pf_experiences SET
  duration_en = 'Apr 2023 – Present',
  duration_bn = 'এপ্রিল ২০২৩ – বর্তমান',
  is_current = true,
  updated_at = now()
WHERE user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60'
  AND position_en = 'Research Assistant'
  AND company_en ILIKE '%Noakhali%';

UPDATE pf_about_blocks SET
  text_en = replace(text_en,
    'and from 2021 to 2023 worked as a Research Assistant',
    'and since 2023 has worked as a Research Assistant'),
  text_bn = replace(replace(text_bn,
    '২০২১ থেকে ২০২৩ সাল পর্যন্ত', '২০২৩ সাল থেকে'),
    'রিসার্চ অ্যাসিস্ট্যান্ট হিসেবে কাজ করেছেন', 'রিসার্চ অ্যাসিস্ট্যান্ট হিসেবে কাজ করছেন'),
  updated_at = now()
WHERE user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60'
  AND (text_en LIKE '%from 2021 to 2023 worked as a Research Assistant%'
       OR text_bn LIKE '%২০২১ থেকে ২০২৩ সাল পর্যন্ত%');

COMMIT;

-- Check:
-- SELECT position_en, duration_en, duration_bn, is_current FROM pf_experiences
--   WHERE user_id = '88b3efb5-8c58-486e-a3f7-751cc4b23e60' AND position_en = 'Research Assistant';
