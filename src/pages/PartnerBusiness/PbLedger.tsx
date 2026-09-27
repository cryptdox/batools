import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { Button, Badge } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { SummaryBar, formatTaka } from '../../components/ui/SummaryBar';
import { Pagination, usePagination } from '../../components/ui/Pagination';
import { toast } from 'react-toastify';
import { Trash2, AlertTriangle, Wallet, ArrowDownToLine, TrendingUp, ArrowUpFromLine, Undo2 } from 'lucide-react';
import { PartnerTxnModal } from '../../components/partnerBusiness/PartnerTxnModal';
import { format } from 'date-fns';
import { PB_TXN_LABEL, txnBalanceSign, money } from '../../lib/partnerBusiness';
import type { PbPartner, PbPartnerAccount, PbPartnerTransaction, PbPartnerTxnType } from '../../types/partnerBusiness';

export const PbLedger = () => {
  const { t } = useLanguage();
  const [partners, setPartners] = useState<PbPartner[]>([]);
  const [accounts, setAccounts] = useState<PbPartnerAccount[]>([]);
  const [txns, setTxns] = useState<PbPartnerTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPartner, setFilterPartner] = useState<string>('');

  const [txnType, setTxnType] = useState<PbPartnerTxnType | null>(null);

  const [toDelete, setToDelete] = useState<PbPartnerTransaction | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [p, a, tx] = await Promise.all([
        supabase.from('pb_partners').select('*').order('name'),
        supabase.from('pb_partner_account_summary').select('*'),
        supabase.from('pb_partner_transactions').select('*').order('txn_date', { ascending: false }).order('created_at', { ascending: false }),
      ]);
      for (const r of [p, a, tx]) if (r.error) throw r.error;
      setPartners(p.data ?? []);
      setAccounts(a.data ?? []);
      setTxns(tx.data ?? []);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : t('pb.ledger.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const partnerName = (id: string) => partners.find(p => p.id === id)?.name ?? '—';

  const visible = useMemo(
    () => filterPartner ? txns.filter(x => x.partner_id === filterPartner) : txns,
    [txns, filterPartner]
  );

  // Running balance only reads as a statement when a single partner is in view;
  // mixing partners in one column would be meaningless.
  const runningById = useMemo(() => {
    if (!filterPartner) return null;
    const oldestFirst = [...visible].reverse();
    let running = 0;
    const out = new Map<string, number>();
    for (const x of oldestFirst) {
      running = money(running + Number(x.amount) * txnBalanceSign(x.txn_type));
      out.set(x.id, running);
    }
    return out;
  }, [visible, filterPartner]);

  const pg = usePagination(visible);

  const totals = useMemo(() => {
    const scope = filterPartner ? accounts.filter(a => a.partner_id === filterPartner) : accounts;
    return {
      balance: scope.reduce((s, a) => s + Number(a.balance), 0),
      invested: scope.reduce((s, a) => s + Number(a.investment_amount), 0),
      profit: scope.reduce((s, a) => s + Number(a.profit_total), 0),
    };
  }, [accounts, filterPartner]);

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('pb_partner_transactions').delete().eq('id', toDelete.id);
      if (error) throw error;
      await fetchAll();
      setToDelete(null);
      toast.success(t('pb.ledger.deleted'));
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : t('pb.ledger.deleteError'));
    } finally {
      setDeleting(false);
    }
  };

  const toneOf = (type: PbPartnerTxnType) =>
    type === 'PROFIT' ? 'success' : type === 'WITHDRAW' ? 'danger' : type === 'INVESTMENT' ? 'default' : 'muted';

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">{t('pb.ledger.title')}</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{t('pb.ledger.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={filterPartner}
            onChange={e => setFilterPartner(e.target.value)}
            className="h-10 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 dark:text-gray-50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">{t('pb.ledger.allPartners')}</option>
            {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <Button variant="outline" size="sm" onClick={() => setTxnType('DEPOSIT')} disabled={partners.length === 0}>
            <ArrowDownToLine size={16} className="mr-2 text-success" /> {t('pb.txn.DEPOSIT')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setTxnType('INVESTMENT')} disabled={partners.length === 0}>
            <TrendingUp size={16} className="mr-2 text-primary" /> {t('pb.txn.INVESTMENT')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setTxnType('RETURN')} disabled={partners.length === 0}>
            <Undo2 size={16} className="mr-2 text-secondary" /> {t('pb.txn.RETURN')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setTxnType('WITHDRAW')} disabled={partners.length === 0}>
            <ArrowUpFromLine size={16} className="mr-2 text-[#d49a15] dark:text-warning" /> {t('pb.txn.WITHDRAW')}
          </Button>
        </div>
      </div>

      <SummaryBar
        items={[
          { label: t('pb.ledger.entries'), value: visible.length },
          { label: t('pb.common.invested'), value: formatTaka(totals.invested) },
          { label: t('pb.common.profit'), value: formatTaka(totals.profit), tone: 'text-success' },
          { label: t('pb.common.balance'), value: formatTaka(totals.balance), tone: totals.balance >= 0 ? 'text-success' : 'text-danger' },
        ]}
      />

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500 font-medium">{t('pb.common.loading')}</div>
        ) : visible.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <Wallet size={32} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{t('pb.ledger.emptyTitle')}</h3>
            <p className="text-gray-500 mt-2 mb-6">{t('pb.ledger.emptyBody')}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                    <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm">{t('pb.common.date')}</th>
                    <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm">{t('pb.common.partner')}</th>
                    <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm">{t('pb.common.type')}</th>
                    <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm">{t('pb.common.note')}</th>
                    <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm text-right">{t('pb.common.amount')}</th>
                    {runningById && <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm text-right">{t('pb.ledger.runningBalance')}</th>}
                    <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm text-right">{t('pb.common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {pg.pageRows.map(x => {
                    const signed = Number(x.amount) * (x.txn_type === 'PROFIT' ? 1 : txnBalanceSign(x.txn_type));
                    return (
                      <tr key={x.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="p-4 text-gray-900 dark:text-gray-100 font-medium whitespace-nowrap">
                          {format(new Date(x.txn_date), 'MMM d, yyyy')}
                        </td>
                        <td className="p-4 text-gray-700 dark:text-gray-300">{partnerName(x.partner_id)}</td>
                        <td className="p-4">
                          <Badge variant={toneOf(x.txn_type)}>{t(`pb.txn.${x.txn_type}`)}</Badge>
                          {x.reference_type === 'PROFIT_ADJUSTMENT' && (
                            <span className="ml-2 text-xs text-gray-500">{t('pb.ledger.auto')}</span>
                          )}
                        </td>
                        <td className="p-4 text-sm text-gray-500 max-w-xs truncate">{x.description || '—'}</td>
                        <td className={`p-4 text-right font-semibold ${signed >= 0 ? 'text-success' : 'text-danger'}`}>
                          {signed >= 0 ? '+' : '−'}{formatTaka(Math.abs(Number(x.amount)))}
                        </td>
                        {runningById && (
                          <td className="p-4 text-right font-medium text-gray-900 dark:text-gray-100">
                            {formatTaka(runningById.get(x.id) ?? 0)}
                          </td>
                        )}
                        <td className="p-4 text-right">
                          <Button variant="ghost" size="sm" onClick={() => setToDelete(x)} title={t('pb.common.delete')}>
                            <Trash2 size={16} className="text-danger" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              page={pg.page}
              pageCount={pg.pageCount}
              pageSize={pg.pageSize}
              total={pg.total}
              onPageChange={pg.setPage}
              onPageSizeChange={pg.setPageSize}
            />
          </>
        )}
      </div>

      <PartnerTxnModal
        isOpen={!!txnType}
        onClose={() => setTxnType(null)}
        onSaved={fetchAll}
        partners={partners}
        accounts={accounts}
        defaultType={txnType ?? 'DEPOSIT'}
      />

      <Modal isOpen={!!toDelete} onClose={() => !deleting && setToDelete(null)} title={t('pb.ledger.deleteTitle')}>
        {toDelete && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-danger/5 border border-danger/20 rounded-lg p-4">
              <AlertTriangle size={20} className="text-danger shrink-0 mt-0.5" />
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {t('pb.ledger.deleteWarn')} <span className="font-semibold">{PB_TXN_LABEL[toDelete.txn_type]} {formatTaka(Number(toDelete.amount))}</span> — {partnerName(toDelete.partner_id)}
              </p>
            </div>
            {toDelete.reference_type === 'PROFIT_ADJUSTMENT' && (
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('pb.ledger.deleteAutoHint')}</p>
            )}
            <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-gray-100 dark:border-gray-700">
              <Button variant="ghost" onClick={() => setToDelete(null)} disabled={deleting}>{t('pb.common.cancel')}</Button>
              <Button variant="danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? t('pb.common.deleting') : t('pb.common.delete')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
