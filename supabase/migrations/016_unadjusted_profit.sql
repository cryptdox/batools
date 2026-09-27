-- Migration: 016_unadjusted_profit.sql
--
-- THE BUG THIS FIXES
--   Profit Adjust worked out each batch's profit from scratch every time, so a
--   batch whose profit had already been paid out to partners showed up again in
--   the next calculation. With two batches bought the same day, adjusting the
--   first one made the second unreachable: re-running the period double-counted
--   batch one, and any period that excluded batch one also excluded batch two.
--
-- THE FIX
--   Record how much of each batch's profit each adjustment actually paid out
--   (pb_profit_adjustment_batches), then drive the next calculation off what is
--   left (pb_batch_unadjusted_profit). A batch that later sells more simply
--   develops a new remainder and becomes adjustable again — which the old
--   purchase-date filter could never express.
--
--   Daily costs stay period-scoped: the no-overlap constraint on
--   pb_profit_adjustments already stops the same day's costs being counted twice.

CREATE TABLE IF NOT EXISTS pb_profit_adjustment_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profit_adjustment_id UUID NOT NULL REFERENCES pb_profit_adjustments(id) ON DELETE CASCADE,
  buy_batch_id UUID NOT NULL REFERENCES pb_buy_batches(id) ON DELETE CASCADE,
  -- Signed: a loss-making batch carries a negative amount.
  profit_amount NUMERIC(14,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profit_adjustment_id, buy_batch_id)
);

CREATE INDEX IF NOT EXISTS idx_pb_adj_batches_batch ON pb_profit_adjustment_batches(buy_batch_id);

------------------------------------------------------------------------------
-- Backfill adjustments made before this table existed
--
-- Their per-batch split was never recorded, so reconstruct it: walk the batches
-- of each adjustment's period oldest first, handing each one as much of the
-- adjustment's total_profit as its own profit can absorb, until the total is
-- used up. For a single-batch adjustment this is exact.
------------------------------------------------------------------------------

WITH ranked AS (
  SELECT
    a.id   AS adjustment_id,
    a.total_profit,
    bp.buy_batch_id,
    bp.profit,
    SUM(bp.profit) OVER (PARTITION BY a.id ORDER BY b.created_at
                         ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS profit_before
  FROM pb_profit_adjustments a
  JOIN pb_batch_profit bp ON bp.purchased_at BETWEEN a.period_start AND a.period_end
  JOIN pb_buy_batches b ON b.id = bp.buy_batch_id
  WHERE NOT EXISTS (
    SELECT 1 FROM pb_profit_adjustment_batches x WHERE x.profit_adjustment_id = a.id
  )
)
INSERT INTO pb_profit_adjustment_batches (profit_adjustment_id, buy_batch_id, profit_amount)
SELECT
  adjustment_id,
  buy_batch_id,
  LEAST(profit, GREATEST(total_profit - COALESCE(profit_before, 0), 0)) AS profit_amount
FROM ranked
WHERE LEAST(profit, GREATEST(total_profit - COALESCE(profit_before, 0), 0)) <> 0;

------------------------------------------------------------------------------
-- What is still owed on each batch
------------------------------------------------------------------------------

CREATE OR REPLACE VIEW pb_batch_unadjusted_profit AS
SELECT
  bp.buy_batch_id,
  bp.title,
  bp.purchased_at,
  bp.total_cost,
  bp.revenue,
  bp.profit                                   AS lifetime_profit,
  COALESCE(adj.adjusted, 0)                   AS adjusted_profit,
  bp.profit - COALESCE(adj.adjusted, 0)       AS remaining_profit,
  bp.is_fully_sold,
  bp.last_sold_at
FROM pb_batch_profit bp
LEFT JOIN (
  SELECT buy_batch_id, SUM(profit_amount) AS adjusted
  FROM pb_profit_adjustment_batches
  GROUP BY buy_batch_id
) adj ON adj.buy_batch_id = bp.buy_batch_id;

ALTER TABLE pb_profit_adjustment_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON pb_profit_adjustment_batches FOR ALL USING (true);

GRANT SELECT ON pb_batch_unadjusted_profit TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
