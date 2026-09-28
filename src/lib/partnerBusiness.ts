import { supabase } from './supabase';
import type { PbPartnerShare, PbPartnerTxnType , PbBusinessCash } from '../types/partnerBusiness';

export const PB_TXN_TYPES: PbPartnerTxnType[] = ['DEPOSIT', 'INVESTMENT', 'WITHDRAW', 'PROFIT', 'RETURN'];

/**
 * Direction each transaction type moves the partner's withdrawable balance.
 * Mirrors the CASE in the pb_partner_account_summary view — keep both in step.
 */
export const txnBalanceSign = (type: PbPartnerTxnType): 1 | -1 =>
  type === 'INVESTMENT' || type === 'WITHDRAW' ? -1 : 1;

export const PB_TXN_LABEL: Record<PbPartnerTxnType, string> = {
  DEPOSIT: 'Deposit',
  INVESTMENT: 'Investment',
  WITHDRAW: 'Withdraw',
  PROFIT: 'Profit',
  RETURN: 'Capital Return',
};

/** Current (open) share rows, i.e. effective_to IS NULL. */
export async function fetchCurrentShares(): Promise<PbPartnerShare[]> {
  const { data, error } = await supabase
    .from('pb_partner_shares')
    .select('*')
    .is('effective_to', null);
  if (error) throw error;
  return data ?? [];
}

/**
 * Replaces the whole current share set: closes every open row as of today and
 * opens new ones. Done as a set because shares only make sense together — you
 * cannot change one partner's percentage without the others absorbing it.
 */
export async function replaceCurrentShares(shares: { partner_id: string; share_percent: number }[]) {
  const today = new Date().toISOString().slice(0, 10);

  const { error: closeError } = await supabase
    .from('pb_partner_shares')
    .update({ effective_to: today })
    .is('effective_to', null);
  if (closeError) throw closeError;

  const rows = shares
    .filter(s => s.share_percent > 0)
    .map(s => ({ partner_id: s.partner_id, share_percent: s.share_percent, effective_from: today }));

  if (rows.length === 0) return;

  const { error: insertError } = await supabase.from('pb_partner_shares').insert(rows);
  if (insertError) throw insertError;
}

/** Rounds to 2dp the way money should be, avoiding 0.1+0.2 drift. */
export const money = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Splits an amount by percentages and pushes any rounding remainder onto the
 * largest share, so the parts always add back up to the whole.
 */
export function splitByShares<T extends { share_percent: number }>(
  total: number,
  parts: T[]
): (T & { amount: number })[] {
  if (parts.length === 0) return [];
  const raw = parts.map(p => ({ ...p, amount: money((total * p.share_percent) / 100) }));
  const diff = money(total - raw.reduce((sum, r) => sum + r.amount, 0));
  if (diff !== 0) {
    let biggest = 0;
    raw.forEach((r, i) => {
      if (r.share_percent > raw[biggest].share_percent) biggest = i;
    });
    raw[biggest].amount = money(raw[biggest].amount + diff);
  }
  return raw;
}

/**
 * Next sequential code in a `PREFIX-001` series, from whatever already exists.
 *
 * Only values matching the prefix count, so a hand-typed name never blocks the
 * series, and the width of the widest existing number is kept so BATCH-099 is
 * followed by BATCH-100 rather than BATCH-0100. The result is a suggestion the
 * form pre-fills and the user can always overwrite.
 */
export function nextSequentialCode(existing: (string | null | undefined)[], prefix: string): string {
  const pattern = new RegExp(`^${prefix}-(\\d+)$`, 'i');
  let max = 0;
  let width = 3;
  for (const value of existing) {
    const match = value?.trim().match(pattern);
    if (!match) continue;
    const n = parseInt(match[1], 10);
    if (Number.isNaN(n)) continue;
    if (n > max) max = n;
    if (match[1].length > width) width = match[1].length;
  }
  return `${prefix}-${String(max + 1).padStart(width, '0')}`;
}

/**
 * Invested capital that has not gone out yet — the one figure every page must
 * agree on, which is why it lives here rather than being re-derived per page.
 *
 * Buys and assets and daily costs all consume it; only an asset leaves profit
 * untouched. Money parked in a share group's pot is still unspent and so is
 * still counted, because a grouped batch has not been bought yet.
 */
export function unspentCapital(cash: PbBusinessCash | null | undefined): number {
  if (!cash) return 0;
  return money(
    Number(cash.invested_total)
    - Number(cash.spent_on_buys)
    - Number(cash.assets_total)
    - Number(cash.costs_total)
  );
}
