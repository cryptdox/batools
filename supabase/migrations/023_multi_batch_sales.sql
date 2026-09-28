-- Migration: 023_multi_batch_sales.sql
--
-- A sale can now draw on SEVERAL batches at once, so a sale event no longer
-- belongs to one batch and its extra costs have to be shared out.
--
-- 022 charged an event's extras to pb_sale_events.buy_batch_id, which only
-- worked while a sale came from a single batch. Sell one order out of batch A
-- and batch B and that column cannot answer whose delivery charge it was.
--
-- The extras are therefore split across the batches in the event BY REVENUE:
-- a ৳200 delivery on a sale of ৳1,500 from A and ৳500 from B charges ৳150 to A
-- and ৳50 to B. Revenue is the only defensible weight here -- it is what the
-- cost was incurred to earn -- and it degenerates to "all of it" for a
-- single-batch sale, so nothing about the 022 behaviour changes for those.
--
-- pb_sale_events.buy_batch_id is kept for a single-batch sale's convenience but
-- is no longer read by any money calculation; the batches are derived from the
-- sale rows themselves, which is the only place that can be right.

DROP VIEW IF EXISTS pb_batch_unadjusted_profit;
DROP VIEW IF EXISTS pb_batch_profit;

CREATE VIEW pb_batch_profit AS
WITH batch_rev AS (
  -- What each batch earned inside each sale event.
  SELECT sale_event_id, buy_batch_id, SUM(total_amount) AS revenue
  FROM pb_sales
  WHERE sale_event_id IS NOT NULL AND buy_batch_id IS NOT NULL
  GROUP BY sale_event_id, buy_batch_id
),
event_rev AS (
  -- What the whole event earned, batch-attributed lines only. An off-batch
  -- line carries no batch, so it must not dilute the split.
  SELECT sale_event_id, SUM(revenue) AS revenue
  FROM batch_rev GROUP BY sale_event_id
),
event_extra AS (
  SELECT sale_event_id, SUM(amount) AS extra
  FROM pb_sale_extra_costs GROUP BY sale_event_id
),
sale_costs AS (
  SELECT b.buy_batch_id,
         SUM(x.extra * b.revenue / e.revenue) AS sale_cost
  FROM batch_rev b
  JOIN event_rev  e ON e.sale_event_id = b.sale_event_id AND e.revenue > 0
  JOIN event_extra x ON x.sale_event_id = b.sale_event_id
  GROUP BY b.buy_batch_id
)
SELECT
  b.id           AS buy_batch_id,
  b.title,
  b.purchased_at,
  COALESCE(t.total_cost, 0)   AS total_cost,
  COALESCE(r.revenue, 0)      AS revenue,
  ROUND(COALESCE(sc.sale_cost, 0), 2) AS sale_cost,
  COALESCE(r.revenue, 0)
    - ROUND(COALESCE(sc.sale_cost, 0), 2)
    - COALESCE(t.total_cost, 0) AS profit,
  r.last_sold_at,
  NOT EXISTS (
    SELECT 1 FROM pb_buy_batch_item_stock st
    WHERE st.buy_batch_id = b.id AND COALESCE(st.remaining_quantity, 0) > 0
  ) AS is_fully_sold
FROM pb_buy_batches b
LEFT JOIN pb_buy_batch_totals t ON t.buy_batch_id = b.id
LEFT JOIN (
  SELECT buy_batch_id, SUM(total_amount) AS revenue, MAX(sold_at) AS last_sold_at
  FROM pb_sales WHERE buy_batch_id IS NOT NULL GROUP BY buy_batch_id
) r ON r.buy_batch_id = b.id
LEFT JOIN sale_costs sc ON sc.buy_batch_id = b.id;

CREATE VIEW pb_batch_unadjusted_profit AS
SELECT
  bp.buy_batch_id, bp.title, bp.purchased_at,
  bp.total_cost, bp.revenue, bp.sale_cost,
  bp.profit                             AS lifetime_profit,
  COALESCE(adj.adjusted, 0)             AS adjusted_profit,
  bp.profit - COALESCE(adj.adjusted, 0) AS remaining_profit,
  bp.is_fully_sold, bp.last_sold_at
FROM pb_batch_profit bp
LEFT JOIN (
  SELECT buy_batch_id, SUM(profit_amount) AS adjusted
  FROM pb_profit_adjustment_batches GROUP BY buy_batch_id
) adj ON adj.buy_batch_id = bp.buy_batch_id;

GRANT SELECT ON pb_batch_profit            TO anon, authenticated;
GRANT SELECT ON pb_batch_unadjusted_profit TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
