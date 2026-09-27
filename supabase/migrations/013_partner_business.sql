-- Migration: 013_partner_business.sql
-- Partner Business module: buying in batches, flexible selling, daily costs,
-- assets, and partner capital/profit accounting. Namespaced behind `pb_`
-- (same reasoning as `lt_` in 010 and `tm_` in 011).
--
-- Single-operator module: no roles, same permissive RLS as the rest of the app.
--
-- THE ORGANISING PRINCIPLE (carried over from the lt_ punishment tables):
--   Anything historical is a snapshot and must never move when configuration
--   changes; anything current stays editable. So a partner's share percent can
--   change whenever, but the share frozen onto an old buy batch and onto an
--   already-adjusted profit period never changes.
--
-- TWO PLACES THIS DELIBERATELY DIVERGES FROM THE SKETCHED DESIGN:
--
--   1. There is no `pb_partner_accounts` table holding `balance` and
--      `investment_amount` as stored columns. Those are derived in the view
--      `pb_partner_account_summary` from the transaction log instead.
--      A cached balance and a ledger that disagree is the classic accounting
--      bug, and it cannot happen if there is only one source of truth.
--      If the balance ever needs to be read fast at scale, it can become a
--      materialised view without changing any caller.
--
--   2. Profit periods carry a real exclusion constraint so the same window
--      cannot be adjusted twice. Paying the same profit out to partners twice
--      is the worst failure this module has, so it is blocked in the database
--      rather than in a handler.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Money everywhere: NUMERIC(14,2). Wider than the lt_ tables' (12,2) because
-- this side holds investment capital, not ~200 taka fines. Never float.
-- Quantities are NUMERIC(14,3) so fractional units (kg, litre) work.

------------------------------------------------------------------------------
-- Catalogue
------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pb_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  default_unit TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- Manual override: false means "treat this product as out of stock now",
  -- regardless of what bought-minus-sold says. Honoured by the stock view.
  -- Historical buy/sell rows are never rewritten to achieve this.
  is_remaining BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pb_products_name ON pb_products(name);

------------------------------------------------------------------------------
-- Buying: one purchase = one batch
------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pb_buy_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Nullable on purpose: a batch may be a one-off item that is not in the
  -- catalogue at all. product_name then carries the custom name.
  product_id UUID REFERENCES pb_products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,

  -- All three optional together: a "direct cost" purchase records only
  -- total_cost, with no unit maths at all.
  unit TEXT,
  quantity NUMERIC(14,3) CHECK (quantity IS NULL OR quantity > 0),
  unit_cost NUMERIC(14,2) CHECK (unit_cost IS NULL OR unit_cost >= 0),

  -- Always the authoritative figure for the batch, even when quantity and
  -- unit_cost are present: freight, discounts and rounding live in the gap.
  total_cost NUMERIC(14,2) NOT NULL CHECK (total_cost >= 0),
  extra_cost NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (extra_cost >= 0),

  note TEXT,
  is_remaining BOOLEAN NOT NULL DEFAULT true,

  purchased_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- "Sort desc each prod"
CREATE INDEX IF NOT EXISTS idx_pb_buy_batches_purchased_at ON pb_buy_batches(purchased_at DESC);
CREATE INDEX IF NOT EXISTS idx_pb_buy_batches_product ON pb_buy_batches(product_id, purchased_at DESC);

------------------------------------------------------------------------------
-- Selling: product-level and flexible, not bound to a batch
------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pb_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  product_id UUID REFERENCES pb_products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,

  unit TEXT,
  quantity NUMERIC(14,3) CHECK (quantity IS NULL OR quantity > 0),
  unit_price NUMERIC(14,2) CHECK (unit_price IS NULL OR unit_price >= 0),

  total_amount NUMERIC(14,2) NOT NULL CHECK (total_amount >= 0),

  -- Optional pointer for the case where a whole batch is sold in one go.
  -- Deliberately NOT a required allocation: per-unit FIFO/LIFO costing can be
  -- added later as pb_sale_batch_allocations without touching this table.
  buy_batch_id UUID REFERENCES pb_buy_batches(id) ON DELETE SET NULL,

  note TEXT,
  sold_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pb_sales_sold_at ON pb_sales(sold_at DESC);
CREATE INDEX IF NOT EXISTS idx_pb_sales_product ON pb_sales(product_id, sold_at DESC);

------------------------------------------------------------------------------
-- Daily additional cost
------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pb_additional_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cost_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pb_additional_costs_date ON pb_additional_costs(cost_date DESC);

------------------------------------------------------------------------------
-- Assets
------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pb_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  quantity NUMERIC(14,3) NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  unit TEXT,
  -- Value of the whole holding, not per unit.
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  note TEXT,
  acquired_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pb_assets_acquired_at ON pb_assets(acquired_at DESC);

------------------------------------------------------------------------------
-- Partners and their (current, changeable) share
------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pb_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  note TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Share history. The open row (effective_to IS NULL) is the current share;
-- changing a share closes the old row and opens a new one, so past batches
-- and past adjustments keep pointing at what was true then.
CREATE TABLE IF NOT EXISTS pb_partner_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES pb_partners(id) ON DELETE CASCADE,
  share_percent NUMERIC(6,3) NOT NULL CHECK (share_percent >= 0 AND share_percent <= 100),
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

-- A partner can only have one current share at a time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_pb_partner_shares_one_current
  ON pb_partner_shares(partner_id) WHERE effective_to IS NULL;

-- NOTE: "all current shares sum to 100" is not expressible as a row
-- constraint; it is validated when shares are saved, not here.

------------------------------------------------------------------------------
-- Partner share frozen onto a buy batch
------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pb_buy_batch_partner_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buy_batch_id UUID NOT NULL REFERENCES pb_buy_batches(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES pb_partners(id) ON DELETE RESTRICT,
  -- Copied from the partner's current share at purchase time unless the buy
  -- form overrode it. Never updated afterwards.
  share_percent NUMERIC(6,3) NOT NULL CHECK (share_percent >= 0 AND share_percent <= 100),
  -- That partner's slice of this batch's cost.
  invested_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (invested_amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (buy_batch_id, partner_id)
);

CREATE INDEX IF NOT EXISTS idx_pb_batch_shares_partner ON pb_buy_batch_partner_shares(partner_id);

------------------------------------------------------------------------------
-- Profit adjustment: turning a period's trading into partner money
------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pb_profit_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Snapshot of the maths at adjust time. Recomputing later must never change
  -- what partners were actually credited.
  total_sales NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_buy_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_additional_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_profit NUMERIC(14,2) NOT NULL DEFAULT 0,

  note TEXT,
  adjusted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CHECK (period_end >= period_start),

  -- The guardrail: no two adjustments may cover overlapping days, so the same
  -- profit can never be credited to partners twice.
  CONSTRAINT pb_profit_adjustments_no_overlap
    EXCLUDE USING gist (daterange(period_start, period_end, '[]') WITH &&)
);

CREATE INDEX IF NOT EXISTS idx_pb_profit_adjustments_period ON pb_profit_adjustments(period_start DESC);

CREATE TABLE IF NOT EXISTS pb_profit_adjustment_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profit_adjustment_id UUID NOT NULL REFERENCES pb_profit_adjustments(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES pb_partners(id) ON DELETE RESTRICT,
  share_percent NUMERIC(6,3) NOT NULL CHECK (share_percent >= 0 AND share_percent <= 100),
  -- Signed: a loss-making period credits a negative amount.
  profit_amount NUMERIC(14,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profit_adjustment_id, partner_id)
);

------------------------------------------------------------------------------
-- The partner ledger — the single source of truth for money
------------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE pb_partner_txn_type AS ENUM (
    'DEPOSIT',     -- capital paid in from outside; raises balance
    'INVESTMENT',  -- balance moved into the business; lowers balance, raises invested
    'WITHDRAW',    -- money taken out; lowers balance
    'PROFIT',      -- profit adjustment credit (may be negative for a loss)
    'RETURN'       -- capital returned out of the business; raises balance, lowers invested
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS pb_partner_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES pb_partners(id) ON DELETE RESTRICT,
  txn_type pb_partner_txn_type NOT NULL,

  -- Stored positive for every type except PROFIT, whose sign carries a loss.
  -- Direction per type is applied in pb_partner_account_summary, so the rule
  -- lives in exactly one place.
  amount NUMERIC(14,2) NOT NULL,

  -- What caused this row: 'PROFIT_ADJUSTMENT', 'BUY_BATCH', or NULL if manual.
  reference_type TEXT,
  reference_id UUID,

  description TEXT,
  txn_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CHECK (txn_type = 'PROFIT' OR amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_pb_partner_txn_partner ON pb_partner_transactions(partner_id, txn_date DESC);
CREATE INDEX IF NOT EXISTS idx_pb_partner_txn_reference ON pb_partner_transactions(reference_type, reference_id);

------------------------------------------------------------------------------
-- Derived views
------------------------------------------------------------------------------

-- Balance and invested capital, computed from the ledger. Replaces a stored
-- pb_partner_accounts table so the two can never disagree.
CREATE OR REPLACE VIEW pb_partner_account_summary AS
SELECT
  p.id                AS partner_id,
  p.name              AS partner_name,
  p.is_active,
  COALESCE(s.share_percent, 0) AS current_share_percent,
  COALESCE(SUM(CASE t.txn_type
    WHEN 'DEPOSIT'    THEN  t.amount
    WHEN 'RETURN'     THEN  t.amount
    WHEN 'PROFIT'     THEN  t.amount
    WHEN 'INVESTMENT' THEN -t.amount
    WHEN 'WITHDRAW'   THEN -t.amount
  END), 0)            AS balance,
  COALESCE(SUM(CASE t.txn_type
    WHEN 'INVESTMENT' THEN  t.amount
    WHEN 'RETURN'     THEN -t.amount
    ELSE 0
  END), 0)            AS investment_amount,
  COALESCE(SUM(CASE WHEN t.txn_type = 'PROFIT' THEN t.amount ELSE 0 END), 0) AS profit_total
FROM pb_partners p
LEFT JOIN pb_partner_transactions t ON t.partner_id = p.id
LEFT JOIN pb_partner_shares s ON s.partner_id = p.id AND s.effective_to IS NULL
GROUP BY p.id, p.name, p.is_active, s.share_percent;

-- Stock per product. Batches booked as a direct cost (quantity NULL) carry
-- money but no units, so they contribute nothing here.
-- is_remaining = false on either the product or a batch forces that side to 0
-- without rewriting any history.
CREATE OR REPLACE VIEW pb_product_stock AS
SELECT
  p.id   AS product_id,
  p.name AS product_name,
  p.is_remaining,
  COALESCE(b.bought_qty, 0) AS bought_quantity,
  COALESCE(s.sold_qty, 0)   AS sold_quantity,
  COALESCE(b.buy_cost, 0)   AS total_buy_cost,
  COALESCE(s.sale_amount, 0) AS total_sale_amount,
  CASE
    WHEN p.is_remaining = false THEN 0
    ELSE GREATEST(COALESCE(b.bought_qty, 0) - COALESCE(s.sold_qty, 0), 0)
  END AS remaining_quantity
FROM pb_products p
LEFT JOIN (
  SELECT product_id,
         SUM(CASE WHEN is_remaining THEN COALESCE(quantity, 0) ELSE 0 END) AS bought_qty,
         SUM(total_cost + extra_cost) AS buy_cost
  FROM pb_buy_batches
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
-- RLS: same permissive policy as every other table in this project (see 001).
------------------------------------------------------------------------------

ALTER TABLE pb_products                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE pb_buy_batches                ENABLE ROW LEVEL SECURITY;
ALTER TABLE pb_sales                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE pb_additional_costs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE pb_assets                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE pb_partners                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE pb_partner_shares             ENABLE ROW LEVEL SECURITY;
ALTER TABLE pb_buy_batch_partner_shares   ENABLE ROW LEVEL SECURITY;
ALTER TABLE pb_profit_adjustments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE pb_profit_adjustment_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE pb_partner_transactions       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access" ON pb_products                   FOR ALL USING (true);
CREATE POLICY "Allow all access" ON pb_buy_batches                FOR ALL USING (true);
CREATE POLICY "Allow all access" ON pb_sales                      FOR ALL USING (true);
CREATE POLICY "Allow all access" ON pb_additional_costs           FOR ALL USING (true);
CREATE POLICY "Allow all access" ON pb_assets                     FOR ALL USING (true);
CREATE POLICY "Allow all access" ON pb_partners                   FOR ALL USING (true);
CREATE POLICY "Allow all access" ON pb_partner_shares             FOR ALL USING (true);
CREATE POLICY "Allow all access" ON pb_buy_batch_partner_shares   FOR ALL USING (true);
CREATE POLICY "Allow all access" ON pb_profit_adjustments         FOR ALL USING (true);
CREATE POLICY "Allow all access" ON pb_profit_adjustment_partners FOR ALL USING (true);
CREATE POLICY "Allow all access" ON pb_partner_transactions       FOR ALL USING (true);

GRANT SELECT ON pb_partner_account_summary TO anon, authenticated;
GRANT SELECT ON pb_product_stock           TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
