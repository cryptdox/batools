-- Migration: 056_pf_publication_pdf_public.sql
-- Whether a publication's PDF is offered to everyone on the portfolio site.
-- On by default, so existing entries keep showing their PDF. Turning it off
-- hides the PDF button; the paper itself (title, abstract, DOI, links) stays.

ALTER TABLE pf_publications ADD COLUMN IF NOT EXISTS pdf_public BOOLEAN NOT NULL DEFAULT true;

NOTIFY pgrst, 'reload schema';
