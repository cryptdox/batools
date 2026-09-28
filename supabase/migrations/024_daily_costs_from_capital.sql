-- Migration: 024_daily_costs_from_capital.sql
--
-- Daily costs now come out of invested capital as well as out of profit.
--
-- This is NOT double counting -- the two measure different things:
--   * profit          = revenue - costs. A ৳500 cost lowers it by ৳500.
--   * capital left    = money still available to spend. The same ৳500 was
--                       paid out, so there is ৳500 less to spend.
-- Both are true at once. An asset is the case that differs: it lowers capital
-- but not profit, because the money became something the business still owns.
--
--   asset        -> capital down, profit unchanged
--   daily cost   -> capital down, profit down
--   sale extra   -> profit down          (capital NOT touched -- see below)

DROP VIEW IF EXISTS pb_general_fund;
CREATE VIEW pb_general_fund AS
WITH invested AS (
  SELECT COALESCE(SUM(CASE txn_type
    WHEN 'INVESTMENT' THEN  amount
    WHEN 'RETURN'     THEN -amount
    ELSE 0 END), 0) AS total
  FROM pb_partner_transactions
),
in_groups  AS (SELECT COALESCE(SUM(amount), 0) AS total FROM pb_group_fund_allocations),
on_assets  AS (SELECT COALESCE(SUM(amount), 0) AS total FROM pb_assets),
on_costs   AS (SELECT COALESCE(SUM(amount), 0) AS total FROM pb_additional_costs),
on_batches AS (
  SELECT COALESCE(SUM(tt.total_cost), 0) AS total
  FROM pb_buy_batches bb
  JOIN pb_buy_batch_totals tt ON tt.buy_batch_id = bb.id
  WHERE bb.share_group_id IS NULL
)
SELECT
  invested.total   AS invested_total,
  in_groups.total  AS allocated_to_groups,
  on_batches.total AS spent,
  on_assets.total  AS assets,
  on_costs.total   AS daily_costs,
  invested.total - in_groups.total - on_batches.total - on_assets.total - on_costs.total AS remaining
FROM invested, in_groups, on_batches, on_assets, on_costs;

GRANT SELECT ON pb_general_fund TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
