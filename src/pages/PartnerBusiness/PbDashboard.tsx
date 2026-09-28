import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { Badge } from '../../components/ui/Button';
import { SummaryBar, formatTaka } from '../../components/ui/SummaryBar';
import { DateRangeFilter, type FilterPreset } from '../../components/ui/DateRangeFilter';
import { PeriodNav } from '../../components/ui/PeriodNav';
import { usePeriodNav } from '../../hooks/usePeriodNav';
import { toast } from 'react-toastify';
import { format, startOfMonth } from 'date-fns';
import { money , unspentCapital } from '../../lib/partnerBusiness';
import type { PbPartnerAccount, PbProductStock, PbBusinessCash , PbShareGroupFund } from '../../types/partnerBusiness';

export const PbDashboard = () => {
  const { t } = useLanguage();
  const [preset, setPreset] = useState<FilterPreset>('monthly');
  const [customFrom, setCustomFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [customTo, setCustomTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const { dateRange, shiftPeriod, isNextPeriodDisabled, periodLabel } = usePeriodNav(preset, customFrom, customTo);

  const [sales, setSales] = useState<{ total_amount: number; sold_at: string }[]>([]);
  const [buys, setBuys] = useState<{ total_cost: number; purchased_at: string }[]>([]);
  const [costs, setCosts] = useState<{ amount: number; cost_date: string }[]>([]);
  const [assetTotal, setAssetTotal] = useState(0);
  const [accounts, setAccounts] = useState<PbPartnerAccount[]>([]);
  const [stock, setStock] = useState<PbProductStock[]>([]);
  const [cash, setCash] = useState<PbBusinessCash | null>(null);
  const [groupFunds, setGroupFunds] = useState<PbShareGroupFund[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [s, b, c, a, acc, st, ch, gf] = await Promise.all([
        supabase.from('pb_sales').select('total_amount, sold_at'),
        supabase.from('pb_buy_batch_totals').select('total_cost, purchased_at'),
        supabase.from('pb_additional_costs').select('amount, cost_date'),
        supabase.from('pb_assets').select('amount'),
        supabase.from('pb_partner_account_summary').select('*'),
        supabase.from('pb_product_stock').select('*'),
        supabase.from('pb_business_cash').select('*').single(),
        supabase.from('pb_share_group_fund').select('*'),
      ]);
      for (const r of [s, b, c, a, acc, st, ch, gf]) if (r.error) throw r.error;
      setGroupFunds(gf.data ?? []);
      setSales(s.data ?? []);
      setBuys(b.data ?? []);
      setCosts(c.data ?? []);
      setAssetTotal((a.data ?? []).reduce((sum, r) => sum + Number(r.amount), 0));
      setAccounts(acc.data ?? []);
      setStock(st.data ?? []);
      setCash(ch.data ?? null);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : t('pb.dash.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const inRange = (d: string) => {
    if (!dateRange) return true;
    const date = new Date(d);
    return date >= dateRange.from && date <= dateRange.to;
  };

  const period = useMemo(() => {
    const totalSales = money(sales.filter(s => inRange(s.sold_at)).reduce((sum, s) => sum + Number(s.total_amount), 0));
    const totalBuy = money(buys.filter(b => inRange(b.purchased_at)).reduce((sum, b) => sum + Number(b.total_cost), 0));
    const totalCosts = money(costs.filter(c => inRange(c.cost_date)).reduce((sum, c) => sum + Number(c.amount), 0));
    return { totalSales, totalBuy, totalCosts, profit: money(totalSales - totalBuy - totalCosts) };
  }, [sales, buys, costs, dateRange]);

  const partnerTotals = useMemo(() => ({
    invested: accounts.reduce((s, a) => s + Number(a.investment_amount), 0),
    balance: accounts.reduce((s, a) => s + Number(a.balance), 0),
  }), [accounts]);

  const inStock = useMemo(() => stock.filter(s => Number(s.remaining_quantity) > 0), [stock]);

  // Part of the unspent figure above, shown separately because it is already
  // earmarked for a group's batches rather than free for any purchase.
  const inGroupFunds = useMemo(
    () => groupFunds.reduce((s, f) => s + Number(f.remaining), 0),
    [groupFunds]
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">{t('pb.dash.title')}</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{t('pb.dash.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <PeriodNav label={periodLabel} onPrev={() => shiftPeriod(-1)} onNext={() => shiftPeriod(1)} nextDisabled={isNextPeriodDisabled} />
          <DateRangeFilter
            preset={preset}
            onPresetChange={setPreset}
            customFrom={customFrom}
            customTo={customTo}
            onCustomFromChange={setCustomFrom}
            onCustomToChange={setCustomTo}
          />
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-500 font-medium bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          {t('pb.common.loading')}
        </div>
      ) : (
        <>
          <SummaryBar
            items={[
              { label: t('pb.common.saleAmount'), value: formatTaka(period.totalSales), tone: 'text-success' },
              { label: t('pb.common.buyCost'), value: formatTaka(period.totalBuy), tone: 'text-danger' },
              { label: t('pb.adjust.additionalCost'), value: formatTaka(period.totalCosts), tone: 'text-danger' },
              { label: t('pb.common.profit'), value: formatTaka(period.profit), tone: period.profit >= 0 ? 'text-success' : 'text-danger' },
            ]}
          />

          <SummaryBar
            items={[
              { label: t('pb.common.invested'), value: formatTaka(partnerTotals.invested) },
              { label: t('pb.buy.available'), value: formatTaka(unspentCapital(cash)), tone: 'text-secondary' },
              { label: t('pb.groups.inGroupFunds'), value: formatTaka(inGroupFunds) },
              { label: t('pb.dash.partnerBalance'), value: formatTaka(partnerTotals.balance), tone: partnerTotals.balance >= 0 ? 'text-success' : 'text-danger' },
              { label: t('pb.dash.assetValue'), value: formatTaka(assetTotal) },
              { label: t('pb.dash.productsInStock'), value: inStock.length },
            ]}
          />

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">{t('pb.dash.stock')}</h3>
                <Link to="/pb/products" className="text-xs text-primary hover:underline">{t('pb.common.viewAll')}</Link>
              </div>
              {inStock.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm">{t('pb.dash.noStock')}</div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {inStock.slice(0, 6).map(s => (
                    <div key={s.product_id} className="flex items-center justify-between px-4 py-3 text-sm">
                      <span className="text-gray-900 dark:text-gray-100">{s.product_name}</span>
                      <span className="font-medium text-gray-700 dark:text-gray-300">{Number(s.remaining_quantity)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">{t('pb.dash.partners')}</h3>
                <Link to="/pb/partners" className="text-xs text-primary hover:underline">{t('pb.common.viewAll')}</Link>
              </div>
              {accounts.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm">{t('pb.dash.noPartners')}</div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {accounts.map(a => (
                    <div key={a.partner_id} className="flex items-center justify-between px-4 py-3 text-sm">
                      <span className="text-gray-900 dark:text-gray-100">{a.partner_name}</span>
                      <Badge variant="default">{Number(a.current_share_percent)}%</Badge>
                      <span className={`font-medium ${Number(a.balance) >= 0 ? 'text-gray-700 dark:text-gray-300' : 'text-danger'}`}>
                        {formatTaka(Number(a.balance))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
