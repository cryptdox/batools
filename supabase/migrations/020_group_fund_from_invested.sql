-- Migration: 020_group_fund_from_invested.sql
--
-- Corrects how a group fund is filled and emptied.
--
-- 019 moved money with INVESTMENT / RETURN rows, which raised and lowered each
-- partner's BALANCE. That was wrong. The money in a group fund is already
-- invested -- putting it behind a group does not invest it again, and handing
-- the leftover back does not pay anyone out. Both are moves BETWEEN POTS of
-- capital that is invested either way, so no balance may change:
--
--   invested capital
--     |-- general pot          <-- ungrouped batches spend from here
--     |-- group "Shop A" pot   <-- Shop A's batches spend from here
--     '-- group "g1" pot
--
--   add 4,000 to a group  : general -4,000, group +4,000. Balance unchanged.
--   buy a batch for 3,500 : group -3,500 (spent).          Balance unchanged.
--   give back the 500     : group -500, general +500.      Balance unchanged.
--
-- A partner's balance now moves only where it genuinely should: DEPOSIT and
-- PROFIT in, WITHDRAW out, INVESTMENT out to capital, RETURN back from capital.
-- Those five stay exactly as they were, which is why pb_partner_account_summary
-- is not touched by this migration at all.
--
-- The give-back split is unchanged in spirit and still the point of the
-- feature: it defaults to what each partner actually PUT IN to that group, not
-- to their ownership share percent. Only the destination changed -- their
-- invested capital rather than their spendable balance.

------------------------------------------------------------------------------
-- Allocations: which pot a partner's invested capital is sitting in
------------------------------------------------------------------------------
-- Deliberately NOT pb_partner_transactions. That table is the record of money
-- entering and leaving a partner's pocket; an allocation moves nothing in or
-- out, so putting it there would mean teaching every balance view to ignore it.

CREATE TABLE IF NOT EXISTS pb_group_fund_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_group_id UUID NOT NULL REFERENCES pb_share_groups(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES pb_partners(id) ON DELETE RESTRICT,

  -- Positive: capital moved from the general pot into this group.
  -- Negative: the group handed it back to the general pot.
  amount NUMERIC(14,2) NOT NULL CHECK (amount <> 0),

  allocated_at DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pb_group_alloc_group   ON pb_group_fund_allocations(share_group_id);
CREATE INDEX IF NOT EXISTS idx_pb_group_alloc_partner ON pb_group_fund_allocations(partner_id);

-- 019's column never carried a row (verified before writing this), so there is
-- nothing to migrate across -- it simply goes. 019's three views read that
-- column, so they are dropped first and rebuilt below on the new table.
DROP VIEW IF EXISTS pb_share_group_partner_fund;
DROP VIEW IF EXISTS pb_share_group_fund;
DROP VIEW IF EXISTS pb_general_fund;
DROP INDEX IF EXISTS idx_pb_partner_txn_group;
ALTER TABLE pb_partner_transactions DROP COLUMN IF EXISTS share_group_id;

------------------------------------------------------------------------------
-- What each partner has in one group's pot
------------------------------------------------------------------------------

DROP VIEW IF EXISTS pb_share_group_partner_fund;
CREATE VIEW pb_share_group_partner_fund AS
SELECT
  a.share_group_id,
  a.partner_id,
  p.name AS partner_name,
  COALESCE(SUM(a.amount) FILTER (WHERE a.amount > 0), 0)  AS allocated_in,
  COALESCE(-SUM(a.amount) FILTER (WHERE a.amount < 0), 0) AS allocated_back,
  -- Drives the give-back default, and caps it: nobody can take back more than
  -- they still have in this pot.
  COALESCE(SUM(a.amount), 0) AS net_allocated
FROM pb_group_fund_allocations a
JOIN pb_partners p ON p.id = a.partner_id
GROUP BY a.share_group_id, a.partner_id, p.name;

------------------------------------------------------------------------------
-- What one group's pot holds
------------------------------------------------------------------------------

DROP VIEW IF EXISTS pb_share_group_fund;
CREATE VIEW pb_share_group_fund AS
SELECT
  g.id   AS share_group_id,
  g.name,
  COALESCE(f.allocated_in, 0)   AS allocated_in,
  COALESCE(f.allocated_back, 0) AS allocated_back,
  COALESCE(f.net_allocated, 0)  AS net_allocated,
  COALESCE(b.spent, 0)          AS spent,
  COALESCE(f.net_allocated, 0) - COALESCE(b.spent, 0) AS remaining
FROM pb_share_groups g
LEFT JOIN (
  SELECT share_group_id,
    SUM(amount) FILTER (WHERE amount > 0)  AS allocated_in,
    -SUM(amount) FILTER (WHERE amount < 0) AS allocated_back,
    SUM(amount)                            AS net_allocated
  FROM pb_group_fund_allocations
  GROUP BY share_group_id
) f ON f.share_group_id = g.id
LEFT JOIN (
  SELECT bb.share_group_id, SUM(tt.total_cost) AS spent
  FROM pb_buy_batches bb
  JOIN pb_buy_batch_totals tt ON tt.buy_batch_id = bb.id
  WHERE bb.share_group_id IS NOT NULL
  GROUP BY bb.share_group_id
) b ON b.share_group_id = g.id;

------------------------------------------------------------------------------
-- The general pot: invested capital that no group is holding
------------------------------------------------------------------------------
-- remaining = invested - held by groups - spent by ungrouped batches.
-- Keeping the pots disjoint is what stops the same capital being spent twice.

DROP VIEW IF EXISTS pb_general_fund;
CREATE VIEW pb_general_fund AS
SELECT
  (SELECT COALESCE(SUM(CASE txn_type
      WHEN 'INVESTMENT' THEN  amount
      WHEN 'RETURN'     THEN -amount
      ELSE 0 END), 0)
   FROM pb_partner_transactions)                        AS invested_total,
  (SELECT COALESCE(SUM(amount), 0)
   FROM pb_group_fund_allocations)                      AS allocated_to_groups,
  (SELECT COALESCE(SUM(tt.total_cost), 0)
   FROM pb_buy_batches bb
   JOIN pb_buy_batch_totals tt ON tt.buy_batch_id = bb.id
   WHERE bb.share_group_id IS NULL)                     AS spent,
  (SELECT COALESCE(SUM(CASE txn_type
      WHEN 'INVESTMENT' THEN  amount
      WHEN 'RETURN'     THEN -amount
      ELSE 0 END), 0)
   FROM pb_partner_transactions)
  - (SELECT COALESCE(SUM(amount), 0) FROM pb_group_fund_allocations)
  - (SELECT COALESCE(SUM(tt.total_cost), 0)
     FROM pb_buy_batches bb
     JOIN pb_buy_batch_totals tt ON tt.buy_batch_id = bb.id
     WHERE bb.share_group_id IS NULL)                   AS remaining;

------------------------------------------------------------------------------
-- How much of one partner's invested capital no group is holding
------------------------------------------------------------------------------
-- Shown beside each row when filling a fund. It is advisory, not a block:
-- ungrouped batches were split by ownership percent rather than by who actually
-- advanced the cash, so a partner can already read as negative here. That is
-- pre-existing drift between the two figures, not an error in this fund.

CREATE OR REPLACE VIEW pb_partner_free_capital AS
SELECT
  a.partner_id,
  a.partner_name,
  a.investment_amount,
  COALESCE(g.in_groups, 0)     AS in_groups,
  COALESCE(u.in_ungrouped, 0)  AS in_ungrouped_batches,
  a.investment_amount - COALESCE(g.in_groups, 0) - COALESCE(u.in_ungrouped, 0) AS free_capital
FROM pb_partner_account_summary a
LEFT JOIN (
  SELECT partner_id, SUM(amount) AS in_groups
  FROM pb_group_fund_allocations GROUP BY partner_id
) g ON g.partner_id = a.partner_id
LEFT JOIN (
  SELECT bps.partner_id, SUM(bps.invested_amount) AS in_ungrouped
  FROM pb_buy_batch_partner_shares bps
  JOIN pb_buy_batches b ON b.id = bps.buy_batch_id
  WHERE b.share_group_id IS NULL
  GROUP BY bps.partner_id
) u ON u.partner_id = a.partner_id;

ALTER TABLE pb_group_fund_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON pb_group_fund_allocations FOR ALL USING (true);

GRANT SELECT ON pb_share_group_partner_fund TO anon, authenticated;
GRANT SELECT ON pb_share_group_fund         TO anon, authenticated;
GRANT SELECT ON pb_general_fund             TO anon, authenticated;
GRANT SELECT ON pb_partner_free_capital     TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
