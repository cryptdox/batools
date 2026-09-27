-- Migration: 017_adjust_any_period.sql
--
-- Drops the no-overlap rule on adjustment periods, and replaces what it was
-- protecting with something that tracks the money instead of the dates.
--
-- WHY THE OLD RULE HAS TO GO
--   It was the right guard when an adjustment meant "all profit in this date
--   range": non-overlapping ranges were the only thing stopping the same
--   profit going out twice. Since 016 that is no longer how profit is worked
--   out — each batch carries its own remainder, so re-adjusting an overlapping
--   period pays out nothing it has already paid. The rule now only blocks
--   legitimate work: with two batches bought the same day, adjusting the first
--   made the second permanently unreachable, because every period containing
--   it overlapped the adjustment that had settled the first.
--
-- WHAT REPLACES IT
--   Batches: pb_profit_adjustment_batches (016) — a batch can only ever hand
--   out its remainder.
--   Daily costs: pb_profit_adjustment_costs, added here — a cost row can only
--   be charged to partners once, no matter how many periods enclose its date.
--
--   Both are stronger than the date rule, because they key on the thing being
--   paid rather than on the window it happened to fall in.

ALTER TABLE pb_profit_adjustments
  DROP CONSTRAINT IF EXISTS pb_profit_adjustments_no_overlap;

CREATE TABLE IF NOT EXISTS pb_profit_adjustment_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profit_adjustment_id UUID NOT NULL REFERENCES pb_profit_adjustments(id) ON DELETE CASCADE,
  additional_cost_id UUID NOT NULL REFERENCES pb_additional_costs(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- The real guarantee: one cost row can belong to at most one adjustment.
  UNIQUE (additional_cost_id)
);

CREATE INDEX IF NOT EXISTS idx_pb_adj_costs_adjustment ON pb_profit_adjustment_costs(profit_adjustment_id);

-- Backfill: attach any cost already covered by an existing adjustment's period,
-- so it is not charged a second time. (There are none today, but an adjustment
-- made before this migration would otherwise re-offer its costs.)
INSERT INTO pb_profit_adjustment_costs (profit_adjustment_id, additional_cost_id, amount)
SELECT DISTINCT ON (c.id) a.id, c.id, c.amount
FROM pb_additional_costs c
JOIN pb_profit_adjustments a ON c.cost_date BETWEEN a.period_start AND a.period_end
WHERE NOT EXISTS (
  SELECT 1 FROM pb_profit_adjustment_costs x WHERE x.additional_cost_id = c.id
)
ORDER BY c.id, a.adjusted_at;

CREATE OR REPLACE VIEW pb_unadjusted_costs AS
SELECT c.*
FROM pb_additional_costs c
WHERE NOT EXISTS (
  SELECT 1 FROM pb_profit_adjustment_costs x WHERE x.additional_cost_id = c.id
);

ALTER TABLE pb_profit_adjustment_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON pb_profit_adjustment_costs FOR ALL USING (true);

GRANT SELECT ON pb_unadjusted_costs TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
