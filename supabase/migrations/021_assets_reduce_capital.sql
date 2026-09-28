-- Migration: 021_assets_reduce_capital.sql
--
-- An asset purchase spends invested capital, so it has to come off the pot.
--
-- Until now pb_general_fund counted only ungrouped buy batches as spend, so
-- buying a ৳20,000 machine left the available figure untouched and the money
-- could be committed twice -- once on the machine and again on stock.
--
-- An asset is a CAPITAL purchase, not an expense: it reduces the capital that
-- is free to spend, but it is deliberately NOT deducted from profit the way
-- pb_additional_costs is. Buying a machine does not make the business poorer,
-- it turns cash into a machine. Daily costs are left alone here and keep
-- reducing profit at adjustment time -- the two must not be mixed up.
--
-- Assets come out of the GENERAL pot, never a group's. A group's pot funds the
-- batches that group owns a share of; a machine belongs to the business as a
-- whole, so charging it to one group would quietly make that group's partners
-- pay for something everyone uses.

DROP VIEW IF EXISTS pb_general_fund;
CREATE VIEW pb_general_fund AS
WITH invested AS (
  SELECT COALESCE(SUM(CASE txn_type
    WHEN 'INVESTMENT' THEN  amount
    WHEN 'RETURN'     THEN -amount
    ELSE 0 END), 0) AS total
  FROM pb_partner_transactions
),
in_groups AS (
  SELECT COALESCE(SUM(amount), 0) AS total FROM pb_group_fund_allocations
),
on_batches AS (
  SELECT COALESCE(SUM(tt.total_cost), 0) AS total
  FROM pb_buy_batches bb
  JOIN pb_buy_batch_totals tt ON tt.buy_batch_id = bb.id
  WHERE bb.share_group_id IS NULL
),
on_assets AS (
  SELECT COALESCE(SUM(amount), 0) AS total FROM pb_assets
)
SELECT
  invested.total   AS invested_total,
  in_groups.total  AS allocated_to_groups,
  on_batches.total AS spent,
  on_assets.total  AS assets,
  invested.total - in_groups.total - on_batches.total - on_assets.total AS remaining
FROM invested, in_groups, on_batches, on_assets;

-- Business-wide totals gain the same figure, for the dashboard. Appended at the
-- end so every existing consumer of this view keeps working unchanged.
CREATE OR REPLACE VIEW pb_business_cash AS
SELECT
  (SELECT COALESCE(SUM(CASE txn_type
      WHEN 'INVESTMENT' THEN amount
      WHEN 'RETURN'     THEN -amount
      ELSE 0 END), 0) FROM pb_partner_transactions)        AS invested_total,
  (SELECT COALESCE(SUM(total_cost), 0) FROM pb_buy_batch_totals) AS spent_on_buys,
  (SELECT COALESCE(SUM(total_amount), 0) FROM pb_sales)    AS sales_total,
  (SELECT COALESCE(SUM(amount), 0) FROM pb_additional_costs) AS costs_total,
  (SELECT COALESCE(SUM(amount), 0) FROM pb_assets)         AS assets_total;

GRANT SELECT ON pb_general_fund  TO anon, authenticated;
GRANT SELECT ON pb_business_cash TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
