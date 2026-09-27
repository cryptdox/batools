-- Migration: 015_batch_sales_and_profit.sql
--
-- Ties selling back to the batch it came out of, which is what makes
-- per-batch profit possible:
--
--   * pb_sales.buy_batch_item_id  — which product line of which batch was sold
--   * pb_buy_batch_item_stock     — bought / sold / remaining per line, so the
--                                   sell form can show what is left
--   * pb_batch_profit             — revenue minus cost for one batch
--
-- WHY THIS MATTERS FOR THE MONEY:
--   Profit used to be a single period figure split by whatever the partners'
--   shares happen to be today. But each batch already carries a frozen share
--   snapshot from when it was bought (pb_buy_batch_partner_shares), and those
--   are the shares that actually funded it. Attributing a batch's profit by
--   today's shares would pay the wrong people whenever shares change.
--   So profit is now worked out per batch and split by that batch's own
--   snapshot.
--
-- NOTE ON PARTIAL SALES: a batch's profit counts its whole cost against the
-- revenue booked so far, so a half-sold batch reads as a loss until the rest
-- of it sells. pb_buy_batch_item_stock is what tells you whether a batch is
-- finished; the Profit Adjust page surfaces it before you commit.

ALTER TABLE pb_sales
  ADD COLUMN IF NOT EXISTS buy_batch_item_id UUID
    REFERENCES pb_buy_batch_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pb_sales_batch_item ON pb_sales(buy_batch_item_id);
CREATE INDEX IF NOT EXISTS idx_pb_sales_batch ON pb_sales(buy_batch_id);

------------------------------------------------------------------------------
-- What is left of each bought line
------------------------------------------------------------------------------

CREATE OR REPLACE VIEW pb_buy_batch_item_stock AS
SELECT
  i.id                AS buy_batch_item_id,
  i.buy_batch_id,
  i.product_id,
  i.product_name,
  i.unit,
  i.quantity          AS bought_quantity,
  i.line_total,
  i.is_remaining,
  COALESCE(s.sold_qty, 0)    AS sold_quantity,
  COALESCE(s.sold_amount, 0) AS sold_amount,
  CASE
    WHEN i.is_remaining = false THEN 0
    WHEN i.quantity IS NULL     THEN NULL          -- direct-cost line, no units
    ELSE GREATEST(i.quantity - COALESCE(s.sold_qty, 0), 0)
  END AS remaining_quantity
FROM pb_buy_batch_items i
LEFT JOIN (
  SELECT buy_batch_item_id,
         SUM(COALESCE(quantity, 0)) AS sold_qty,
         SUM(total_amount)          AS sold_amount
  FROM pb_sales
  WHERE buy_batch_item_id IS NOT NULL
  GROUP BY buy_batch_item_id
) s ON s.buy_batch_item_id = i.id;

------------------------------------------------------------------------------
-- Revenue, cost and profit for one batch
------------------------------------------------------------------------------

CREATE OR REPLACE VIEW pb_batch_profit AS
SELECT
  b.id           AS buy_batch_id,
  b.title,
  b.purchased_at,
  COALESCE(t.total_cost, 0)   AS total_cost,
  COALESCE(r.revenue, 0)      AS revenue,
  COALESCE(r.revenue, 0) - COALESCE(t.total_cost, 0) AS profit,
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
) r ON r.buy_batch_id = b.id;

GRANT SELECT ON pb_buy_batch_item_stock TO anon, authenticated;
GRANT SELECT ON pb_batch_profit         TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
