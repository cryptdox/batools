-- Migration: 011_spends.sql
-- Tracks money spent out of the collected punishment fund: what it was for,
-- how much, and on which day. Shown on the Spend page, the Financial Report
-- and the public late tracker.

CREATE TABLE IF NOT EXISTS lt_spends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spend_date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lt_spends_spend_date ON lt_spends(spend_date DESC);

-- Same permissive policy as the other lt_ tables (see 001).
ALTER TABLE lt_spends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON lt_spends FOR ALL USING (true);

NOTIFY pgrst, 'reload schema';
