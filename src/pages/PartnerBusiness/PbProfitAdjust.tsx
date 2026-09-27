import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { Button, Badge } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { SummaryBar, formatTaka } from '../../components/ui/SummaryBar';
import { toast } from 'react-toastify';
import { Calculator, AlertTriangle, Scale } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { splitByShares, money } from '../../lib/partnerBusiness';
import type {
  PbPartnerAccount, PbProfitAdjustment, PbProfitAdjustmentPartner,
  PbBatchUnadjustedProfit, PbBuyBatchPartnerShare,
} from '../../types/partnerBusiness';

/** One batch's outstanding profit, split by that batch's own share snapshot. */
type BatchRow = PbBatchUnadjustedProfit & {
  allocations: { partner_id: string; share_percent: number; amount: number }[];
};

export const PbProfitAdjust = () => {
  const { t } = useLanguage();
  const [from, setFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  const [accounts, setAccounts] = useState<PbPartnerAccount[]>([]);
  const [history, setHistory] = useState<PbProfitAdjustment[]>([]);
  const [allocations, setAllocations] = useState<PbProfitAdjustmentPartner[]>([]);
  const [loading, setLoading] = useState(true);

  const [calc, setCalc] = useState<{
    batches: BatchRow[];
    batchProfit: number;
    costs: number;
    costRows: { id: string; amount: number }[];
    revenue: number;
    buyCost: number;
    netProfit: number;
    perPartner: { partner_id: string; name: string; fromBatches: number; fromCosts: number; total: number }[];
  } | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [a, h, al] = await Promise.all([
        supabase.from('pb_partner_account_summary').select('*'),
        supabase.from('pb_profit_adjustments').select('*').order('period_start', { ascending: false }),
        supabase.from('pb_profit_adjustment_partners').select('*'),
      ]);
      for (const r of [a, h, al]) if (r.error) throw r.error;
      setAccounts(a.data ?? []);
      setHistory(h.data ?? []);
      setAllocations(al.data ?? []);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : t('pb.adjust.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const nameOf = (id: string) => accounts.find(a => a.partner_id === id)?.partner_name ?? '—';

  // Current shares still matter for costs, which belong to no single batch.
  const sharePartners = useMemo(() => accounts.filter(a => Number(a.current_share_percent) > 0), [accounts]);
  const shareTotal = sharePartners.reduce((s, a) => s + Number(a.current_share_percent), 0);
  const sharesValid = Math.abs(shareTotal - 100) < 0.01;

  const handleCalculate = async () => {
    setCalculating(true);
    try {
      const [bp, bs, costs] = await Promise.all([
        // Every batch with profit still owed, whenever it was bought — a batch
        // that sold more since its last adjustment shows a fresh remainder.
        supabase.from('pb_batch_unadjusted_profit').select('*'),
        supabase.from('pb_buy_batch_partner_shares').select('*'),
        supabase.from('pb_unadjusted_costs').select('id, amount').gte('cost_date', from).lte('cost_date', to),
      ]);
      for (const r of [bp, bs, costs]) if (r.error) throw r.error;

      const shares = (bs.data ?? []) as PbBuyBatchPartnerShare[];

      // Each batch is split by the shares frozen onto it when it was bought —
      // not by today's shares, which may since have changed.
      const batches: BatchRow[] = (bp.data ?? [])
        .filter((b: PbBatchUnadjustedProfit) => money(Number(b.remaining_profit)) !== 0)
        .map((b: PbBatchUnadjustedProfit) => {
        const mine = shares.filter(s => s.buy_batch_id === b.buy_batch_id);
        const profit = money(Number(b.remaining_profit));
        const allocs = splitByShares(profit, mine.map(s => ({
          partner_id: s.partner_id,
          share_percent: Number(s.share_percent),
        })));
        return { ...b, allocations: allocs.map(a => ({ partner_id: a.partner_id, share_percent: a.share_percent, amount: a.amount })) };
      });

      const batchProfit = money(batches.reduce((s, b) => s + Number(b.remaining_profit), 0));
      const revenue = money(batches.reduce((s, b) => s + Number(b.revenue), 0));
      const buyCost = money(batches.reduce((s, b) => s + Number(b.total_cost), 0));
      const costRows = (costs.data ?? []) as { id: string; amount: number }[];
      const totalCosts = money(costRows.reduce((s, r) => s + Number(r.amount), 0));

      // Daily costs belong to no batch, so they fall on the current shares.
      const costSplit = splitByShares(-totalCosts, sharePartners.map(p => ({
        partner_id: p.partner_id,
        share_percent: Number(p.current_share_percent),
      })));

      const ids = new Set<string>([
        ...batches.flatMap(b => b.allocations.map(a => a.partner_id)),
        ...costSplit.map(c => c.partner_id),
      ]);
      const perPartner = [...ids].map(id => {
        const fromBatches = money(batches.reduce(
          (s, b) => s + (b.allocations.find(a => a.partner_id === id)?.amount ?? 0), 0));
        const fromCosts = money(costSplit.find(c => c.partner_id === id)?.amount ?? 0);
        return { partner_id: id, name: nameOf(id), fromBatches, fromCosts, total: money(fromBatches + fromCosts) };
      }).sort((a, b) => a.name.localeCompare(b.name));

      setCalc({
        batches, batchProfit, costs: totalCosts, costRows, revenue, buyCost,
        netProfit: money(batchProfit - totalCosts),
        perPartner,
      });
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : t('pb.adjust.calcError'));
    } finally {
      setCalculating(false);
    }
  };

  const unsoldBatches = calc?.batches.filter(b => !b.is_fully_sold) ?? [];

  const handleCommit = async () => {
    if (!calc) return;
    setCommitting(true);
    try {
      const { data: adj, error: adjError } = await supabase
        .from('pb_profit_adjustments')
        .insert([{
          period_start: from,
          period_end: to,
          total_sales: calc.revenue,
          total_buy_cost: calc.buyCost,
          total_additional_cost: calc.costs,
          total_profit: calc.netProfit,
          note: note.trim() || null,
        }])
        .select('id')
        .single();

      if (adjError) throw adjError;

      // Without this the next calculation would offer the same profit again.
      const batchRows = calc.batches
        .filter(b => money(Number(b.remaining_profit)) !== 0)
        .map(b => ({
          profit_adjustment_id: adj.id,
          buy_batch_id: b.buy_batch_id,
          profit_amount: money(Number(b.remaining_profit)),
        }));
      if (batchRows.length > 0) {
        const { error: batchError } = await supabase.from('pb_profit_adjustment_batches').insert(batchRows);
        if (batchError) throw batchError;
      }

      if (calc.costRows.length > 0) {
        const { error: costError } = await supabase.from('pb_profit_adjustment_costs').insert(
          calc.costRows.map(c => ({
            profit_adjustment_id: adj.id,
            additional_cost_id: c.id,
            amount: Number(c.amount),
          }))
        );
        if (costError) throw costError;
      }

      const rows = calc.perPartner.filter(p => p.total !== 0);
      if (rows.length > 0) {
        // share_percent here is the partner's effective slice of this period,
        // which is a blend of per-batch snapshots rather than one number.
        const effective = (p: typeof rows[number]) =>
          calc.netProfit === 0 ? 0 : money((p.total / calc.netProfit) * 100);

        const { error: allocError } = await supabase.from('pb_profit_adjustment_partners').insert(
          rows.map(p => ({
            profit_adjustment_id: adj.id,
            partner_id: p.partner_id,
            share_percent: Math.min(Math.max(effective(p), 0), 100),
            profit_amount: p.total,
          }))
        );
        if (allocError) throw allocError;

        const { error: txnError } = await supabase.from('pb_partner_transactions').insert(
          rows.map(p => ({
            partner_id: p.partner_id,
            txn_type: 'PROFIT' as const,
            amount: p.total,
            reference_type: 'PROFIT_ADJUSTMENT',
            reference_id: adj.id,
            description: `${from} → ${to}`,
            txn_date: to,
          }))
        );
        if (txnError) throw txnError;
      }

      await fetchAll();
      setCalc(null);
      setNote('');
      setConfirmOpen(false);
      toast.success(t('pb.adjust.committed'));
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : t('pb.adjust.commitError'));
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">{t('pb.adjust.title')}</h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{t('pb.adjust.subtitleBatch')}</p>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-44"><Input label={t('pb.adjust.from')} type="date" value={from} onChange={e => { setFrom(e.target.value); setCalc(null); }} /></div>
          <div className="w-44"><Input label={t('pb.adjust.to')} type="date" value={to} onChange={e => { setTo(e.target.value); setCalc(null); }} /></div>
          <Button onClick={handleCalculate} disabled={calculating || !from || !to || to < from}>
            <Calculator size={18} className="mr-2" /> {calculating ? t('pb.adjust.calculating') : t('pb.adjust.calculate')}
          </Button>
        </div>
        {!sharesValid && (
          <div className="mt-4 flex items-start gap-3 bg-danger/5 border border-danger/20 rounded-lg p-4">
            <AlertTriangle size={20} className="text-danger shrink-0 mt-0.5" />
            <p className="text-sm text-gray-700 dark:text-gray-300">{t('pb.adjust.sharesInvalid')} ({shareTotal.toFixed(2)}%)</p>
          </div>
        )}
      </div>

      {calc && (
        <>
          <SummaryBar
            items={[
              { label: t('pb.common.saleAmount'), value: formatTaka(calc.revenue), tone: 'text-success' },
              { label: t('pb.common.buyCost'), value: formatTaka(calc.buyCost), tone: 'text-danger' },
              { label: t('pb.adjust.batchProfit'), value: formatTaka(calc.batchProfit), tone: calc.batchProfit >= 0 ? 'text-success' : 'text-danger' },
              { label: t('pb.adjust.additionalCost'), value: formatTaka(calc.costs), tone: 'text-danger' },
              { label: t('pb.common.profit'), value: formatTaka(calc.netProfit), tone: calc.netProfit >= 0 ? 'text-success' : 'text-danger' },
            ]}
          />

          {unsoldBatches.length > 0 && (
            <div className="flex items-start gap-3 bg-[#d49a15]/5 border border-[#d49a15]/30 rounded-lg p-4">
              <AlertTriangle size={20} className="text-[#d49a15] dark:text-warning shrink-0 mt-0.5" />
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {unsoldBatches.length} {t('pb.adjust.unsoldWarn')}
              </p>
            </div>
          )}

          {/* per batch */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">{t('pb.adjust.outstandingByBatch')}</h3>
            </div>
            {calc.batches.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">{t('pb.adjust.nothingOutstanding')}</div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {calc.batches.map(b => (
                  <div key={b.buy_batch_id} className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {format(new Date(b.purchased_at), 'MMM d')} · {b.title || t('pb.buy.batchLabel')}
                        {!b.is_fully_sold && <Badge variant="warning" className="ml-2">{t('pb.adjust.partlySold')}</Badge>}
                      </div>
                      <Badge variant={Number(b.remaining_profit) >= 0 ? 'success' : 'danger'}>{formatTaka(Number(b.remaining_profit))}</Badge>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {t('pb.common.saleAmount')} {formatTaka(Number(b.revenue))} − {t('pb.common.buyCost')} {formatTaka(Number(b.total_cost))}
                      {Number(b.adjusted_profit) !== 0 && (
                        <> · {t('pb.adjust.alreadyPaid')} {formatTaka(Number(b.adjusted_profit))}</>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                      {b.allocations.map(a => (
                        <span key={a.partner_id} className="text-xs text-gray-600 dark:text-gray-400">
                          {nameOf(a.partner_id)} {a.share_percent}% → <span className="font-medium">{formatTaka(a.amount)}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* per partner */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">{t('pb.adjust.preview')}</h3>
              <Button size="sm" onClick={() => setConfirmOpen(true)} disabled={calc.perPartner.length === 0}>
                <Scale size={16} className="mr-2" /> {t('pb.adjust.apply')}
              </Button>
            </div>
            {calc.perPartner.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">{t('pb.adjust.noPartners')}</div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="p-4 font-medium text-gray-500 text-sm">{t('pb.common.partner')}</th>
                    <th className="p-4 font-medium text-gray-500 text-sm text-right">{t('pb.adjust.fromBatches')}</th>
                    <th className="p-4 font-medium text-gray-500 text-sm text-right">{t('pb.adjust.fromCosts')}</th>
                    <th className="p-4 font-medium text-gray-500 text-sm text-right">{t('pb.common.total')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {calc.perPartner.map(p => (
                    <tr key={p.partner_id}>
                      <td className="p-4 font-medium text-gray-900 dark:text-gray-100">{p.name}</td>
                      <td className={`p-4 text-right ${p.fromBatches >= 0 ? 'text-success' : 'text-danger'}`}>{formatTaka(p.fromBatches)}</td>
                      <td className="p-4 text-right text-danger">{formatTaka(p.fromCosts)}</td>
                      <td className={`p-4 text-right font-semibold ${p.total >= 0 ? 'text-success' : 'text-danger'}`}>{formatTaka(p.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">{t('pb.adjust.history')}</h3>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">{t('pb.common.loading')}</div>
        ) : history.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">{t('pb.adjust.noHistory')}</div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {history.map(h => (
              <div key={h.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    {format(new Date(h.period_start), 'MMM d, yyyy')} → {format(new Date(h.period_end), 'MMM d, yyyy')}
                  </div>
                  <Badge variant={Number(h.total_profit) >= 0 ? 'success' : 'danger'}>{formatTaka(Number(h.total_profit))}</Badge>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {t('pb.common.saleAmount')} {formatTaka(Number(h.total_sales))} · {t('pb.common.buyCost')} {formatTaka(Number(h.total_buy_cost))} · {t('pb.adjust.additionalCost')} {formatTaka(Number(h.total_additional_cost))}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                  {allocations.filter(a => a.profit_adjustment_id === h.id).map(a => (
                    <span key={a.id} className="text-xs text-gray-600 dark:text-gray-400">
                      {nameOf(a.partner_id)} → <span className="font-medium">{formatTaka(Number(a.profit_amount))}</span>
                    </span>
                  ))}
                </div>
                {h.note && <div className="text-xs text-gray-500 mt-1 italic">{h.note}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={confirmOpen} onClose={() => !committing && setConfirmOpen(false)} title={t('pb.adjust.confirmTitle')}>
        {calc && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-danger/5 border border-danger/20 rounded-lg p-4">
              <AlertTriangle size={20} className="text-danger shrink-0 mt-0.5" />
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {t('pb.adjust.confirmBody')} <span className="font-semibold">{formatTaka(calc.netProfit)}</span>{' '}
                ({format(new Date(from), 'MMM d')} → {format(new Date(to), 'MMM d, yyyy')})
              </p>
            </div>
            {unsoldBatches.length > 0 && (
              <p className="text-sm text-[#d49a15] dark:text-warning">{unsoldBatches.length} {t('pb.adjust.unsoldWarn')}</p>
            )}
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('pb.adjust.confirmHintBatch')}</p>
            <Input label={t('pb.common.note')} value={note} onChange={e => setNote(e.target.value)} />
            <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-gray-100 dark:border-gray-700">
              <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={committing}>{t('pb.common.cancel')}</Button>
              <Button onClick={handleCommit} disabled={committing}>{committing ? t('pb.adjust.applying') : t('pb.adjust.apply')}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
