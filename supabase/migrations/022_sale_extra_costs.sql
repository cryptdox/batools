-- Migration: 022_sale_extra_costs.sql
--
-- Gives a sale the same titled extra costs a buy batch has: delivery,
-- packaging, commission -- whatever the selling itself cost.
--
-- WHY A SALE EVENT TABLE
--   Selling several lines out of one batch already writes several pb_sales
--   rows in one go, and a delivery charge belongs to that whole event, not to
--   any one line. There was nothing to hang it on, so pb_sale_events is that
--   missing header: one row per Sell submit, carrying the date, the note and
--   the batch, with the extras beside it.
--
--   pb_sales.sale_event_id is ON DELETE SET NULL, so deleting an event never
--   deletes the sales themselves -- an old sale simply loses its header. The
--   extras go with the event (CASCADE), because they are meaningless without it.
--
-- WHAT IT DOES TO PROFIT
--   A sale cost reduces PROFIT, exactly like pb_additional_costs and unlike an
--   asset. Selling is an expense; it does not turn cash into something the
--   business still owns. pb_batch_profit now reads
--       profit = revenue - sale costs - buy cost
--   and since pb_batch_unadjusted_profit is built on it, profit adjustment
--   picks this up with no change of its own.

CREATE TABLE IF NOT EXISTS pb_sale_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Which batch was sold from, so the extras can be charged to that batch's
  -- profit. NULL for an off-batch sale, whose extras land in no batch.
  buy_batch_id UUID REFERENCES pb_buy_batches(id) ON DELETE SET NULL,
  sold_at DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pb_sale_events_batch ON pb_sale_events(buy_batch_id);

ALTER TABLE pb_sales
  ADD COLUMN IF NOT EXISTS sale_event_id UUID REFERENCES pb_sale_events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pb_sales_event ON pb_sales(sale_event_id);

CREATE TABLE IF NOT EXISTS pb_sale_extra_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_event_id UUID NOT NULL REFERENCES pb_sale_events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pb_sale_extras_event ON pb_sale_extra_costs(sale_event_id);

------------------------------------------------------------------------------
-- One sale event: what it brought in, what it cost to sell, what is left
------------------------------------------------------------------------------

CREATE OR REPLACE VIEW pb_sale_event_totals AS
SELECT
  e.id AS sale_event_id,
  e.buy_batch_id,
  e.sold_at,
  COALESCE(s.revenue, 0) AS revenue,
  COALESCE(x.extra, 0)   AS extra_cost,
  COALESCE(s.revenue, 0) - COALESCE(x.extra, 0) AS net_revenue,
  COALESCE(s.line_count, 0) AS line_count
FROM pb_sale_events e
LEFT JOIN (
  SELECT sale_event_id, SUM(total_amount) AS revenue, COUNT(*) AS line_count
  FROM pb_sales WHERE sale_event_id IS NOT NULL GROUP BY sale_event_id
) s ON s.sale_event_id = e.id
LEFT JOIN (
  SELECT sale_event_id, SUM(amount) AS extra
  FROM pb_sale_extra_costs GROUP BY sale_event_id
) x ON x.sale_event_id = e.id;

------------------------------------------------------------------------------
-- Batch profit, now net of what the selling cost
------------------------------------------------------------------------------
-- Dropped and rebuilt rather than replaced, because sale_cost goes in the
-- middle. pb_batch_unadjusted_profit is rebuilt straight after, unchanged
-- except for carrying the new column through.

DROP VIEW IF EXISTS pb_batch_unadjusted_profit;
DROP VIEW IF EXISTS pb_batch_profit;

CREATE VIEW pb_batch_profit AS
SELECT
  b.id           AS buy_batch_id,
  b.title,
  b.purchased_at,
  COALESCE(t.total_cost, 0)   AS total_cost,
  COALESCE(r.revenue, 0)      AS revenue,
  COALESCE(sc.sale_cost, 0)   AS sale_cost,
  COALESCE(r.revenue, 0) - COALESCE(sc.sale_cost, 0) - COALESCE(t.total_cost, 0) AS profit,
  COALESCE(r.last_sold_at, NULL) AS last_sold_at,
  -- true when every line that can run out has run out
  NOT EXISTS (
    SELECT 1 FROM pb_buy_batch_item_stock st
    WHERE st.buy_batch_id = b.id AND COALESCE(st.remaining_quantity, 0) > 0
  ) AS is_fully_sold
FROM pb_buy_batches b
LEFT JOIN pb_buy_batch_totals t ON t.buy_batch_id = b.id
LEFT JOIN (
  SELECT buy_batch_id,
         SUM(total_amount) AS revenue,
         MAX(sold_at)      AS last_sold_at
  FROM pb_sales
  WHERE buy_batch_id IS NOT NULL
  GROUP BY buy_batch_id
) r ON r.buy_batch_id = b.id
LEFT JOIN (
  SELECT e.buy_batch_id, SUM(x.amount) AS sale_cost
  FROM pb_sale_extra_costs x
  JOIN pb_sale_events e ON e.id = x.sale_event_id
  WHERE e.buy_batch_id IS NOT NULL
  GROUP BY e.buy_batch_id
) sc ON sc.buy_batch_id = b.id;

CREATE VIEW pb_batch_unadjusted_profit AS
SELECT
  bp.buy_batch_id,
  bp.title,
  bp.purchased_at,
  bp.total_cost,
  bp.revenue,
  bp.sale_cost,
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

-- Business-wide totals gain the sale-cost figure, appended so every existing
-- consumer keeps working.
CREATE OR REPLACE VIEW pb_business_cash AS
SELECT
  (SELECT COALESCE(SUM(CASE txn_type
      WHEN 'INVESTMENT' THEN amount
      WHEN 'RETURN'     THEN -amount
      ELSE 0 END), 0) FROM pb_partner_transactions)        AS invested_total,
  (SELECT COALESCE(SUM(total_cost), 0) FROM pb_buy_batch_totals) AS spent_on_buys,
  (SELECT COALESCE(SUM(total_amount), 0) FROM pb_sales)    AS sales_total,
  (SELECT COALESCE(SUM(amount), 0) FROM pb_additional_costs) AS costs_total,
  (SELECT COALESCE(SUM(amount), 0) FROM pb_assets)         AS assets_total,
  (SELECT COALESCE(SUM(amount), 0) FROM pb_sale_extra_costs) AS sale_costs_total;

ALTER TABLE pb_sale_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE pb_sale_extra_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON pb_sale_events      FOR ALL USING (true);
CREATE POLICY "Allow all access" ON pb_sale_extra_costs FOR ALL USING (true);

GRANT SELECT ON pb_sale_event_totals        TO anon, authenticated;
GRANT SELECT ON pb_batch_profit             TO anon, authenticated;
GRANT SELECT ON pb_batch_unadjusted_profit  TO anon, authenticated;
GRANT SELECT ON pb_business_cash            TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
