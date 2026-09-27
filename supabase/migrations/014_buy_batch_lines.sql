-- Migration: 014_buy_batch_lines.sql
-- A buy batch becomes a header with two sets of lines:
--   * pb_buy_batch_items      — one row per product bought in that batch
--   * pb_buy_batch_extra_costs — named costs on top of the product amounts
--     (transport, labour, ...), each with its own title
--
-- Previously a batch held exactly one product and a single unnamed
-- `extra_cost` number, so "buy three things in one purchase, plus ৳500
-- transport and ৳300 labour" had no way to be recorded.
--
-- The batch total is deliberately NOT stored. It is the sum of its lines, and
-- a stored copy is one more thing that can drift out of step with them
-- (same reasoning as partner balance living in a view, see 013).
--
-- Also adds pb_business_cash: how much partner capital has been put in, how
-- much of it has gone out on purchases, and what is left unspent.

------------------------------------------------------------------------------
-- New line tables
------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pb_buy_batch_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buy_batch_id UUID NOT NULL REFERENCES pb_buy_batches(id) ON DELETE CASCADE,

  -- NULL for a one-off item that is not in the catalogue.
  product_id UUID REFERENCES pb_products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,

  unit TEXT,
  quantity NUMERIC(14,3) CHECK (quantity IS NULL OR quantity > 0),
  unit_cost NUMERIC(14,2) CHECK (unit_cost IS NULL OR unit_cost >= 0),

  -- Authoritative for the line: quantity x unit_cost is only a convenience.
  line_total NUMERIC(14,2) NOT NULL CHECK (line_total >= 0),

  -- Per-line stock flag, so one product in a batch can be marked finished
  -- without touching the others.
  is_remaining BOOLEAN NOT NULL DEFAULT true,

  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pb_buy_items_batch ON pb_buy_batch_items(buy_batch_id);
CREATE INDEX IF NOT EXISTS idx_pb_buy_items_product ON pb_buy_batch_items(product_id);

CREATE TABLE IF NOT EXISTS pb_buy_batch_extra_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buy_batch_id UUID NOT NULL REFERENCES pb_buy_batches(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pb_buy_extra_batch ON pb_buy_batch_extra_costs(buy_batch_id);

------------------------------------------------------------------------------
-- Move existing single-product batches onto the new lines
------------------------------------------------------------------------------

INSERT INTO pb_buy_batch_items
  (buy_batch_id, product_id, product_name, unit, quantity, unit_cost, line_total, is_remaining)
SELECT id, product_id, product_name, unit, quantity, unit_cost, total_cost, is_remaining
FROM pb_buy_batches
WHERE NOT EXISTS (SELECT 1 FROM pb_buy_batch_items i WHERE i.buy_batch_id = pb_buy_batches.id);

INSERT INTO pb_buy_batch_extra_costs (buy_batch_id, title, amount)
SELECT id, 'Extra cost', extra_cost
FROM pb_buy_batches
WHERE extra_cost > 0
  AND NOT EXISTS (SELECT 1 FROM pb_buy_batch_extra_costs e WHERE e.buy_batch_id = pb_buy_batches.id);

------------------------------------------------------------------------------
-- The batch is now just a header
------------------------------------------------------------------------------

DROP VIEW IF EXISTS pb_product_stock;

ALTER TABLE pb_buy_batches
  DROP COLUMN IF EXISTS product_id,
  DROP COLUMN IF EXISTS product_name,
  DROP COLUMN IF EXISTS unit,
  DROP COLUMN IF EXISTS quantity,
  DROP COLUMN IF EXISTS unit_cost,
  DROP COLUMN IF EXISTS total_cost,
  DROP COLUMN IF EXISTS extra_cost;

ALTER TABLE pb_buy_batches ADD COLUMN IF NOT EXISTS title TEXT;

------------------------------------------------------------------------------
-- Derived totals
------------------------------------------------------------------------------

CREATE OR REPLACE VIEW pb_buy_batch_totals AS
SELECT
  b.id AS buy_batch_id,
  b.purchased_at,
  COALESCE(i.items_total, 0)  AS items_total,
  COALESCE(e.extra_total, 0)  AS extra_total,
  COALESCE(i.items_total, 0) + COALESCE(e.extra_total, 0) AS total_cost
FROM pb_buy_batches b
LEFT JOIN (
  SELECT buy_batch_id, SUM(line_total) AS items_total
  FROM pb_buy_batch_items GROUP BY buy_batch_id
) i ON i.buy_batch_id = b.id
LEFT JOIN (
  SELECT buy_batch_id, SUM(amount) AS extra_total
  FROM pb_buy_batch_extra_costs GROUP BY buy_batch_id
) e ON e.buy_batch_id = b.id;

-- Stock now aggregates the item lines rather than the batch row.
CREATE OR REPLACE VIEW pb_product_stock AS
SELECT
  p.id   AS product_id,
  p.name AS product_name,
  p.is_remaining,
  COALESCE(b.bought_qty, 0)  AS bought_quantity,
  COALESCE(s.sold_qty, 0)    AS sold_quantity,
  COALESCE(b.buy_cost, 0)    AS total_buy_cost,
  COALESCE(s.sale_amount, 0) AS total_sale_amount,
  CASE
    WHEN p.is_remaining = false THEN 0
    ELSE GREATEST(COALESCE(b.bought_qty, 0) - COALESCE(s.sold_qty, 0), 0)
  END AS remaining_quantity
FROM pb_products p
LEFT JOIN (
  SELECT product_id,
         SUM(CASE WHEN is_remaining THEN COALESCE(quantity, 0) ELSE 0 END) AS bought_qty,
         SUM(line_total) AS buy_cost
  FROM pb_buy_batch_items
  WHERE product_id IS NOT NULL
  GROUP BY product_id
) b ON b.product_id = p.id
LEFT JOIN (
  SELECT product_id,
         SUM(COALESCE(quantity, 0)) AS sold_qty,
         SUM(total_amount) AS sale_amount
  FROM pb_sales
  WHERE product_id IS NOT NULL
  GROUP BY product_id
) s ON s.product_id = p.id;

------------------------------------------------------------------------------
-- Where the money stands: capital in, capital spent on stock, what is left
------------------------------------------------------------------------------

CREATE OR REPLACE VIEW pb_business_cash AS
SELECT
  (SELECT COALESCE(SUM(CASE txn_type
      WHEN 'INVESTMENT' THEN amount
      WHEN 'RETURN'     THEN -amount
      ELSE 0 END), 0) FROM pb_partner_transactions)        AS invested_total,
  (SELECT COALESCE(SUM(total_cost), 0) FROM pb_buy_batch_totals) AS spent_on_buys,
  (SELECT COALESCE(SUM(total_amount), 0) FROM pb_sales)    AS sales_total,
  (SELECT COALESCE(SUM(amount), 0) FROM pb_additional_costs) AS costs_total;

ALTER TABLE pb_buy_batch_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE pb_buy_batch_extra_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON pb_buy_batch_items       FOR ALL USING (true);
CREATE POLICY "Allow all access" ON pb_buy_batch_extra_costs FOR ALL USING (true);

GRANT SELECT ON pb_buy_batch_totals TO anon, authenticated;
GRANT SELECT ON pb_product_stock     TO anon, authenticated;
GRANT SELECT ON pb_business_cash     TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
