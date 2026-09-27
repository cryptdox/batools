-- Migration: 019_group_funds.sql
--
-- Gives a share group a FUND of its own: partners put money into the group,
-- the group's batches spend out of it, and whatever is left over can be handed
-- back. Worked example, which is the whole feature in four lines:
--
--   add 4,000 to the group        -> group fund 4,000
--   buy a batch for 3,500         -> group fund 500
--   give back the remaining 500   -> group fund 0, balances up by 500
--
-- HOW THE GIVE-BACK IS SPLIT -- the important bit.
--   By CONTRIBUTED percent, not by share percent. If Ashik put in 2,000 and
--   Munna and Shanto 1,000 each, the 500 goes back 250 / 125 / 125, even when
--   the group's ownership split is 30/35/35. Capital returns to whoever
--   actually advanced it; only PROFIT follows the batch's frozen share
--   percent, and that is untouched here. The split is a default and stays
--   editable, because a partner can agree to take back less.
--
-- NO NEW MONEY MATHS. A contribution is an ordinary INVESTMENT row and a
-- give-back an ordinary RETURN row -- the two types pb_partner_account_summary
-- has always understood. All that is new is share_group_id saying which fund
-- the money moved through, so balance and invested stay correct with the view
-- untouched.

ALTER TABLE pb_partner_transactions
  ADD COLUMN IF NOT EXISTS share_group_id UUID REFERENCES pb_share_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pb_partner_txn_group
  ON pb_partner_transactions(share_group_id)
  WHERE share_group_id IS NOT NULL;

-- ON DELETE SET NULL keeps money conserved rather than attributed: deleting a
-- group drops its contributions AND its batches (018 already sets that null)
-- into the ungrouped fund together, so the remaining figure is unchanged and
-- no partner's balance moves. The group's own frozen batch shares, and every
-- balance, are untouched either way -- only the label is lost.

------------------------------------------------------------------------------
-- What each partner has advanced to one group
------------------------------------------------------------------------------

CREATE OR REPLACE VIEW pb_share_group_partner_fund AS
SELECT
  t.share_group_id,
  t.partner_id,
  p.name AS partner_name,
  COALESCE(SUM(CASE t.txn_type WHEN 'INVESTMENT' THEN t.amount ELSE 0 END), 0) AS contributed,
  COALESCE(SUM(CASE t.txn_type WHEN 'RETURN'     THEN t.amount ELSE 0 END), 0) AS returned,
  -- What is still advanced, and therefore the ceiling on a give-back: nobody
  -- can be handed back more than they have in.
  COALESCE(SUM(CASE t.txn_type
    WHEN 'INVESTMENT' THEN  t.amount
    WHEN 'RETURN'     THEN -t.amount
    ELSE 0 END), 0) AS net_contributed
FROM pb_partner_transactions t
JOIN pb_partners p ON p.id = t.partner_id
WHERE t.share_group_id IS NOT NULL
  AND t.txn_type IN ('INVESTMENT', 'RETURN')
GROUP BY t.share_group_id, t.partner_id, p.name;

------------------------------------------------------------------------------
-- What one group's fund holds
------------------------------------------------------------------------------

CREATE OR REPLACE VIEW pb_share_group_fund AS
SELECT
  g.id   AS share_group_id,
  g.name,
  COALESCE(f.contributed, 0)     AS contributed,
  COALESCE(f.returned, 0)        AS returned,
  COALESCE(f.net_contributed, 0) AS net_contributed,
  COALESCE(b.spent, 0)           AS spent,
  COALESCE(f.net_contributed, 0) - COALESCE(b.spent, 0) AS remaining
FROM pb_share_groups g
LEFT JOIN (
  SELECT share_group_id,
    SUM(CASE txn_type WHEN 'INVESTMENT' THEN amount ELSE 0 END) AS contributed,
    SUM(CASE txn_type WHEN 'RETURN'     THEN amount ELSE 0 END) AS returned,
    SUM(CASE txn_type
      WHEN 'INVESTMENT' THEN  amount
      WHEN 'RETURN'     THEN -amount
      ELSE 0 END) AS net_contributed
  FROM pb_partner_transactions
  WHERE share_group_id IS NOT NULL AND txn_type IN ('INVESTMENT', 'RETURN')
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
-- The ungrouped fund: everything not tied to a group
------------------------------------------------------------------------------
-- pb_business_cash still reports the business-wide totals and is left exactly
-- as it was. This view is the slice a buy with no group may spend, so grouped
-- and ungrouped money can never be spent twice.

CREATE OR REPLACE VIEW pb_general_fund AS
SELECT
  (SELECT COALESCE(SUM(CASE txn_type
      WHEN 'INVESTMENT' THEN  amount
      WHEN 'RETURN'     THEN -amount
      ELSE 0 END), 0)
   FROM pb_partner_transactions
   WHERE share_group_id IS NULL)                  AS net_contributed,
  (SELECT COALESCE(SUM(tt.total_cost), 0)
   FROM pb_buy_batches bb
   JOIN pb_buy_batch_totals tt ON tt.buy_batch_id = bb.id
   WHERE bb.share_group_id IS NULL)               AS spent;

GRANT SELECT ON pb_share_group_partner_fund TO anon, authenticated;
GRANT SELECT ON pb_share_group_fund         TO anon, authenticated;
GRANT SELECT ON pb_general_fund             TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
