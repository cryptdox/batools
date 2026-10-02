-- Migration: 027_portfolio_research.sql
-- Research & Publications section of the portfolio (see 025 for the pf_
-- conventions: user_id owner, _en/_bn pairs, sort_order, is_visible).
--
-- Titles and abstracts are bilingual like everything else, but papers are
-- usually English only: leave the _bn half empty and the site falls back to
-- English. Authors, venue, links and citation are never translated.

CREATE TABLE IF NOT EXISTS pf_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,

  title_en TEXT NOT NULL,
  title_bn TEXT NOT NULL DEFAULT '',
  -- In citation order. The entry matching the profile name is highlighted.
  authors TEXT[] NOT NULL DEFAULT '{}',
  -- Journal / conference / publisher, e.g. "IEEE Access" or "ICCIT 2022".
  venue TEXT,
  pub_type TEXT NOT NULL DEFAULT 'journal'
    CHECK (pub_type IN ('journal', 'conference', 'preprint', 'thesis', 'book_chapter', 'other')),
  status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('published', 'accepted', 'under_review')),
  year INT CHECK (year IS NULL OR year BETWEEN 1950 AND 2100),

  abstract_en TEXT,
  abstract_bn TEXT,
  keywords TEXT[] NOT NULL DEFAULT '{}',

  doi TEXT,          -- bare DOI ("10.1109/…"); the site builds the doi.org link
  url TEXT,          -- publisher / landing page
  pdf_url TEXT,
  code_url TEXT,
  citation TEXT,     -- BibTeX, copied by the site's "Cite" button

  is_featured BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pf_publications_user ON pf_publications(user_id, sort_order);

ALTER TABLE pf_publications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON pf_publications FOR ALL USING (true);

------------------------------------------------------------------------------
-- Labels for the new section, for the existing portfolio owner. Keys already
-- present (edited by hand) are left alone.
------------------------------------------------------------------------------

INSERT INTO pf_labels (user_id, key, value_en, value_bn)
SELECT '88b3efb5-8c58-486e-a3f7-751cc4b23e60', key, value_en, value_bn
FROM (VALUES
  ('nav.research', 'research', 'গবেষণা'),
  ('research.title', 'Research & Publications', 'গবেষণা ও প্রকাশনা'),
  ('research.subTitle', 'Peer-reviewed work and ongoing research', 'পিয়ার-রিভিউড কাজ ও চলমান গবেষণা'),
  ('research.filters.all', 'All', 'সব'),
  ('research.types.journal', 'Journal', 'জার্নাল'),
  ('research.types.conference', 'Conference', 'কনফারেন্স'),
  ('research.types.preprint', 'Preprint', 'প্রিপ্রিন্ট'),
  ('research.types.thesis', 'Thesis', 'থিসিস'),
  ('research.types.book_chapter', 'Book Chapter', 'বইয়ের অধ্যায়'),
  ('research.types.other', 'Other', 'অন্যান্য'),
  ('research.status.accepted', 'Accepted', 'গৃহীত'),
  ('research.status.under_review', 'Under Review', 'পর্যালোচনাধীন'),
  ('research.publications', 'Publications', 'প্রকাশনা'),
  ('research.abstract', 'Abstract', 'সারসংক্ষেপ'),
  ('research.show_abstract', 'Show abstract', 'সারসংক্ষেপ দেখুন'),
  ('research.hide_abstract', 'Hide abstract', 'সারসংক্ষেপ লুকান'),
  ('research.paper', 'Paper', 'পেপার'),
  ('research.pdf', 'PDF', 'PDF'),
  ('research.code', 'Code', 'কোড'),
  ('research.cite', 'Cite', 'উদ্ধৃতি'),
  ('research.cite_copied', 'BibTeX copied!', 'BibTeX কপি হয়েছে!')
) AS v(key, value_en, value_bn)
ON CONFLICT (user_id, key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
