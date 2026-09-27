export type PbProduct = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  default_unit: string | null;
  is_active: boolean;
  is_remaining: boolean;
  created_at: string;
  updated_at: string;
};

/** Header only — the money lives on its item and extra-cost lines. */
export type PbBuyBatch = {
  id: string;
  title: string | null;
  note: string | null;
  is_remaining: boolean;
  purchased_at: string;
  /** Which share group filled this batch's shares, and whose fund paid for it. */
  share_group_id: string | null;
  created_at: string;
  updated_at: string;
};

export type PbBuyBatchItem = {
  id: string;
  buy_batch_id: string;
  product_id: string | null;
  product_name: string;
  unit: string | null;
  quantity: number | null;
  unit_cost: number | null;
  line_total: number;
  is_remaining: boolean;
  sort_order: number;
  created_at: string;
};

/** A named cost on top of the product amounts: transport, labour, ... */
export type PbBuyBatchExtraCost = {
  id: string;
  buy_batch_id: string;
  title: string;
  amount: number;
  sort_order: number;
  created_at: string;
};

/** View: pb_buy_batch_totals — never stored, always summed from the lines. */
export type PbBuyBatchTotals = {
  buy_batch_id: string;
  purchased_at: string;
  items_total: number;
  extra_total: number;
  total_cost: number;
};

/** View: pb_business_cash */
export type PbBusinessCash = {
  invested_total: number;
  spent_on_buys: number;
  sales_total: number;
  costs_total: number;
};

export type PbSale = {
  id: string;
  buy_batch_item_id: string | null;
  product_id: string | null;
  product_name: string;
  unit: string | null;
  quantity: number | null;
  unit_price: number | null;
  total_amount: number;
  buy_batch_id: string | null;
  note: string | null;
  sold_at: string;
  created_at: string;
  updated_at: string;
};

export type PbAdditionalCost = {
  id: string;
  cost_date: string;
  amount: number;
  description: string;
  created_at: string;
  updated_at: string;
};

export type PbAsset = {
  id: string;
  name: string;
  quantity: number;
  unit: string | null;
  amount: number;
  note: string | null;
  acquired_at: string;
  created_at: string;
  updated_at: string;
};

export type PbPartner = {
  id: string;
  name: string;
  phone: string | null;
  note: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PbPartnerShare = {
  id: string;
  partner_id: string;
  share_percent: number;
  effective_from: string;
  effective_to: string | null;
  created_at: string;
};

export type PbBuyBatchPartnerShare = {
  id: string;
  buy_batch_id: string;
  partner_id: string;
  share_percent: number;
  invested_amount: number;
  created_at: string;
};

export type PbPartnerTxnType = 'DEPOSIT' | 'INVESTMENT' | 'WITHDRAW' | 'PROFIT' | 'RETURN';

export type PbPartnerTransaction = {
  id: string;
  partner_id: string;
  txn_type: PbPartnerTxnType;
  amount: number;
  reference_type: string | null;
  reference_id: string | null;
  /** Which group's fund the money moved through; null = the ungrouped fund. */
  share_group_id: string | null;
  description: string | null;
  txn_date: string;
  created_at: string;
};

export type PbProfitAdjustment = {
  id: string;
  period_start: string;
  period_end: string;
  total_sales: number;
  total_buy_cost: number;
  total_additional_cost: number;
  total_profit: number;
  note: string | null;
  adjusted_at: string;
  created_at: string;
};

export type PbProfitAdjustmentPartner = {
  id: string;
  profit_adjustment_id: string;
  partner_id: string;
  share_percent: number;
  profit_amount: number;
  created_at: string;
};

/** View: pb_partner_account_summary — balance derived from the ledger. */
export type PbPartnerAccount = {
  partner_id: string;
  partner_name: string;
  is_active: boolean;
  current_share_percent: number;
  balance: number;
  investment_amount: number;
  profit_total: number;
};

/** View: pb_product_stock */
export type PbProductStock = {
  product_id: string;
  product_name: string;
  is_remaining: boolean;
  bought_quantity: number;
  sold_quantity: number;
  total_buy_cost: number;
  total_sale_amount: number;
  remaining_quantity: number;
};

/** View: pb_buy_batch_item_stock — what is left of each bought line. */
export type PbBuyBatchItemStock = {
  buy_batch_item_id: string;
  buy_batch_id: string;
  product_id: string | null;
  product_name: string;
  unit: string | null;
  bought_quantity: number | null;
  line_total: number;
  is_remaining: boolean;
  sold_quantity: number;
  sold_amount: number;
  /** null for a direct-cost line that has no units at all. */
  remaining_quantity: number | null;
};

/** View: pb_batch_profit — revenue minus cost for one batch. */
export type PbBatchProfit = {
  buy_batch_id: string;
  title: string | null;
  purchased_at: string;
  total_cost: number;
  revenue: number;
  profit: number;
  last_sold_at: string | null;
  is_fully_sold: boolean;
};

/** View: pb_batch_unadjusted_profit — what of each batch's profit is still owed. */
export type PbBatchUnadjustedProfit = {
  buy_batch_id: string;
  title: string | null;
  purchased_at: string;
  total_cost: number;
  revenue: number;
  lifetime_profit: number;
  adjusted_profit: number;
  remaining_profit: number;
  is_fully_sold: boolean;
  last_sold_at: string | null;
};

export type PbShareGroup = {
  id: string;
  name: string;
  note: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PbShareGroupMember = {
  id: string;
  share_group_id: string;
  partner_id: string;
  share_percent: number;
  created_at: string;
};

/** View: pb_share_group_summary — members, total %, and what they hold. */
export type PbShareGroupSummary = {
  share_group_id: string;
  name: string;
  is_active: boolean;
  member_count: number;
  total_percent: number;
  group_balance: number;
  group_invested: number;
};

/** A group's fund: what partners advanced, what its batches spent, what is left. */
export type PbShareGroupFund = {
  share_group_id: string;
  name: string;
  contributed: number;
  returned: number;
  net_contributed: number;
  spent: number;
  remaining: number;
};

/**
 * One partner's standing in one group's fund. `net_contributed` drives the
 * give-back default — capital goes back by what each partner actually put in,
 * not by their ownership share percent.
 */
export type PbShareGroupPartnerFund = {
  share_group_id: string;
  partner_id: string;
  partner_name: string;
  contributed: number;
  returned: number;
  net_contributed: number;
};

/** Money not tied to any group; what an ungrouped batch may spend. */
export type PbGeneralFund = {
  net_contributed: number;
  spent: number;
};
