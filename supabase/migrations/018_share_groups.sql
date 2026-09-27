-- Migration: 018_share_groups.sql
--
-- A share group is a named set of partners with percentages — "Shop A is
-- Ashik 50 / Munna 50", "Import run is all three at 30/35/35". Picking one at
-- buy time fills in exactly those partners at exactly those percentages,
-- because a batch is rarely funded by everyone.
--
-- IMPORTANT: a group is a CONVENIENCE FOR FILLING THE FORM, not a source of
-- truth for money. The batch still gets its own frozen rows in
-- pb_buy_batch_partner_shares, exactly as before, so editing or deleting a
-- group later cannot move what an old batch paid — and selling and profit
-- adjustment keep working off the batch snapshot with no change at all.

CREATE TABLE IF NOT EXISTS pb_share_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  note TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pb_share_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_group_id UUID NOT NULL REFERENCES pb_share_groups(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES pb_partners(id) ON DELETE CASCADE,
  share_percent NUMERIC(6,3) NOT NULL CHECK (share_percent >= 0 AND share_percent <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (share_group_id, partner_id)
);

CREATE INDEX IF NOT EXISTS idx_pb_share_group_members_group ON pb_share_group_members(share_group_id);

-- Which group filled a batch's shares, kept for display only. ON DELETE SET
-- NULL: losing the label must never disturb the frozen share rows.
ALTER TABLE pb_buy_batches
  ADD COLUMN IF NOT EXISTS share_group_id UUID REFERENCES pb_share_groups(id) ON DELETE SET NULL;

------------------------------------------------------------------------------
-- A group's standing: how many members, and what they hold between them
------------------------------------------------------------------------------

CREATE OR REPLACE VIEW pb_share_group_summary AS
SELECT
  g.id   AS share_group_id,
  g.name,
  g.is_active,
  COUNT(m.id)                              AS member_count,
  COALESCE(SUM(m.share_percent), 0)        AS total_percent,
  COALESCE(SUM(acc.balance), 0)            AS group_balance,
  COALESCE(SUM(acc.investment_amount), 0)  AS group_invested
FROM pb_share_groups g
LEFT JOIN pb_share_group_members m ON m.share_group_id = g.id
LEFT JOIN pb_partner_account_summary acc ON acc.partner_id = m.partner_id
GROUP BY g.id, g.name, g.is_active;

ALTER TABLE pb_share_groups        ENABLE ROW LEVEL SECURITY;
ALTER TABLE pb_share_group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON pb_share_groups        FOR ALL USING (true);
CREATE POLICY "Allow all access" ON pb_share_group_members FOR ALL USING (true);

GRANT SELECT ON pb_share_group_summary TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
