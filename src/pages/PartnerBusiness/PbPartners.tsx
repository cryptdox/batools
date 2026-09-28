import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { Button, Badge } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { SummaryBar, formatTaka } from '../../components/ui/SummaryBar';
import { Pagination, usePagination } from '../../components/ui/Pagination';
import { toast } from 'react-toastify';
import { Plus, Pencil, Trash2, AlertTriangle, Users, Percent, ArrowDownToLine, TrendingUp, ArrowUpFromLine, Undo2 } from 'lucide-react';
import { PartnerTxnModal } from '../../components/partnerBusiness/PartnerTxnModal';
import { replaceCurrentShares } from '../../lib/partnerBusiness';
import type { PbPartner, PbPartnerAccount, PbPartnerTxnType } from '../../types/partnerBusiness';

export const PbPartners = () => {
  const { t } = useLanguage();
  const [partners, setPartners] = useState<PbPartner[]>([]);
  const [accounts, setAccounts] = useState<PbPartnerAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<PbPartner | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const [toDelete, setToDelete] = useState<PbPartner | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [txnFor, setTxnFor] = useState<{ partnerId: string; type: PbPartnerTxnType } | null>(null);

  const [isShareOpen, setIsShareOpen] = useState(false);
  const [shareDraft, setShareDraft] = useState<{ partner_id: string; name: string; percent: string }[]>([]);
  const [savingShares, setSavingShares] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [p, a] = await Promise.all([
        supabase.from('pb_partners').select('*').order('name'),
        supabase.from('pb_partner_account_summary').select('*'),
      ]);
      if (p.error) throw p.error;
      if (a.error) throw a.error;
      setPartners(p.data ?? []);
      setAccounts(a.data ?? []);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : t('pb.partners.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const accountOf = (id: string) => accounts.find(a => a.partner_id === id);

  const totals = useMemo(() => ({
    count: partners.length,
    balance: accounts.reduce((s, a) => s + Number(a.balance), 0),
    invested: accounts.reduce((s, a) => s + Number(a.investment_amount), 0),
    share: accounts.reduce((s, a) => s + Number(a.current_share_percent), 0),
  }), [partners, accounts]);

  const pg = usePagination(partners);

  const openAdd = () => {
    setEditing(null);
    setName(''); setPhone(''); setNote(''); setIsActive(true);
    setIsModalOpen(true);
  };

  const openEdit = (p: PbPartner) => {
    setEditing(p);
    setName(p.name); setPhone(p.phone ?? ''); setNote(p.note ?? ''); setIsActive(p.is_active);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        phone: phone.trim() || null,
        note: note.trim() || null,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      };
      const { error } = editing
        ? await supabase.from('pb_partners').update(payload).eq('id', editing.id)
        : await supabase.from('pb_partners').insert([payload]);
      if (error) throw error;
      await fetchAll();
      setIsModalOpen(false);
      toast.success(editing ? t('pb.partners.updated') : t('pb.partners.added'));
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : t('pb.partners.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('pb_partners').delete().eq('id', toDelete.id);
      if (error) throw error;
      await fetchAll();
      setToDelete(null);
      toast.success(t('pb.partners.deleted'));
    } catch (e) {
      console.error(e);
      // ON DELETE RESTRICT on the ledger: a partner with money history cannot vanish.
      toast.error(t('pb.partners.deleteBlocked'));
    } finally {
      setDeleting(false);
    }
  };

  const openShares = () => {
    setShareDraft(
      partners.filter(p => p.is_active).map(p => ({
        partner_id: p.id,
        name: p.name,
        percent: String(accountOf(p.id)?.current_share_percent ?? 0),
      }))
    );
    setIsShareOpen(true);
  };

  const shareTotal = shareDraft.reduce((s, d) => s + (parseFloat(d.percent) || 0), 0);
  const sharesValid = Math.abs(shareTotal - 100) < 0.01;

  const handleSaveShares = async () => {
    if (!sharesValid) return;
    setSavingShares(true);
    try {
      await replaceCurrentShares(
        shareDraft.map(d => ({ partner_id: d.partner_id, share_percent: parseFloat(d.percent) || 0 }))
      );
      await fetchAll();
      setIsShareOpen(false);
      toast.success(t('pb.partners.sharesSaved'));
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : t('pb.partners.sharesError'));
    } finally {
      setSavingShares(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">{t('pb.partners.title')}</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{t('pb.partners.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={openShares} disabled={partners.filter(p => p.is_active).length === 0}>
            <Percent size={16} className="mr-2" /> {t('pb.partners.setShares')}
          </Button>
          <Button onClick={openAdd}>
            <Plus size={18} className="mr-2" /> {t('pb.partners.add')}
          </Button>
        </div>
      </div>

      <SummaryBar
        items={[
          { label: t('pb.partners.count'), value: totals.count },
          { label: t('pb.common.shareTotal'), value: `${totals.share.toFixed(2)}%`, tone: Math.abs(totals.share - 100) < 0.01 ? 'text-success' : 'text-danger' },
          { label: t('pb.common.invested'), value: formatTaka(totals.invested) },
          { label: t('pb.common.balance'), value: formatTaka(totals.balance), tone: totals.balance >= 0 ? 'text-success' : 'text-danger' },
        ]}
      />

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500 font-medium">{t('pb.common.loading')}</div>
        ) : partners.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users size={32} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{t('pb.partners.emptyTitle')}</h3>
            <p className="text-gray-500 mt-2 mb-6">{t('pb.partners.emptyBody')}</p>
            <Button onClick={openAdd}>{t('pb.partners.add')}</Button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                    <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm">{t('pb.common.name')}</th>
                    <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm text-right">{t('pb.common.share')}</th>
                    <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm text-right">{t('pb.common.invested')}</th>
                    <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm text-right">{t('pb.common.profit')}</th>
                    <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm text-right">{t('pb.common.balance')}</th>
                    <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm text-right">{t('pb.common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {pg.pageRows.map(p => {
                    const a = accountOf(p.id);
                    const balance = Number(a?.balance ?? 0);
                    return (
                      <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 dark:text-gray-100">{p.name}</span>
                            {!p.is_active && <Badge variant="muted">{t('pb.common.inactive')}</Badge>}
                          </div>
                          {p.phone && <div className="text-xs text-gray-500">{p.phone}</div>}
                        </td>
                        <td className="p-4 text-right text-gray-700 dark:text-gray-300">{Number(a?.current_share_percent ?? 0)}%</td>
                        <td className="p-4 text-right text-gray-700 dark:text-gray-300">{formatTaka(Number(a?.investment_amount ?? 0))}</td>
                        <td className="p-4 text-right text-success">{formatTaka(Number(a?.profit_total ?? 0))}</td>
                        <td className={`p-4 text-right font-semibold ${balance >= 0 ? 'text-gray-900 dark:text-gray-100' : 'text-danger'}`}>
                          {formatTaka(balance)}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => setTxnFor({ partnerId: p.id, type: 'DEPOSIT' })} title={t('pb.txn.DEPOSIT')}>
                              <ArrowDownToLine size={16} className="text-success" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setTxnFor({ partnerId: p.id, type: 'INVESTMENT' })} title={t('pb.txn.INVESTMENT')}>
                              <TrendingUp size={16} className="text-primary" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setTxnFor({ partnerId: p.id, type: 'RETURN' })} title={t('pb.txn.RETURN')}>
                              <Undo2 size={16} className="text-secondary" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setTxnFor({ partnerId: p.id, type: 'WITHDRAW' })} title={t('pb.txn.WITHDRAW')}>
                              <ArrowUpFromLine size={16} className="text-[#d49a15] dark:text-warning" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => openEdit(p)} title={t('pb.common.edit')}>
                              <Pencil size={16} />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setToDelete(p)} title={t('pb.common.delete')}>
                              <Trash2 size={16} className="text-danger" />
                            </Button>
                          </div>
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
        isOpen={!!txnFor}
        onClose={() => setTxnFor(null)}
        onSaved={fetchAll}
        partners={partners}
        accounts={accounts}
        defaultPartnerId={txnFor?.partnerId}
        defaultType={txnFor?.type}
        lockPartner
      />

      <Modal isOpen={isModalOpen} onClose={() => !saving && setIsModalOpen(false)} title={editing ? t('pb.partners.editTitle') : t('pb.partners.addTitle')}>
        <div className="space-y-4">
          <Input label={t('pb.common.name')} value={name} onChange={e => setName(e.target.value)} autoFocus />
          <Input label={t('pb.partners.phone')} value={phone} onChange={e => setPhone(e.target.value)} />
          <Input label={t('pb.common.note')} value={note} onChange={e => setNote(e.target.value)} />
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('pb.common.active')}</span>
          </label>
          <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-gray-100 dark:border-gray-700">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)} disabled={saving}>{t('pb.common.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()}>{saving ? t('pb.common.saving') : t('pb.common.save')}</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isShareOpen} onClose={() => !savingShares && setIsShareOpen(false)} title={t('pb.partners.shareTitle')}>
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('pb.partners.shareHint')}</p>
          <div className="space-y-2">
            {shareDraft.map((d, i) => (
              <div key={d.partner_id} className="flex items-center gap-3">
                <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">{d.name}</span>
                <input
                  type="number"
                  value={d.percent}
                  onChange={e => setShareDraft(prev => prev.map((p, idx) => idx === i ? { ...p, percent: e.target.value } : p))}
                  className="w-24 h-9 rounded-md border border-gray-300 bg-white px-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary dark:border-gray-700 dark:bg-gray-900 dark:text-gray-50"
                />
                <span className="text-sm text-gray-500 w-4">%</span>
              </div>
            ))}
          </div>
          <div className={`flex items-center justify-between text-sm font-semibold ${sharesValid ? 'text-success' : 'text-danger'}`}>
            <span>{t('pb.common.shareTotal')}</span>
            <span>{shareTotal.toFixed(2)}%</span>
          </div>
          {!sharesValid && <p className="text-xs text-danger">{t('pb.partners.shareMustBe100')}</p>}
          <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-gray-100 dark:border-gray-700">
            <Button variant="ghost" onClick={() => setIsShareOpen(false)} disabled={savingShares}>{t('pb.common.cancel')}</Button>
            <Button onClick={handleSaveShares} disabled={savingShares || !sharesValid}>
              {savingShares ? t('pb.common.saving') : t('pb.common.save')}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!toDelete} onClose={() => !deleting && setToDelete(null)} title={t('pb.partners.deleteTitle')}>
        {toDelete && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-danger/5 border border-danger/20 rounded-lg p-4">
              <AlertTriangle size={20} className="text-danger shrink-0 mt-0.5" />
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {t('pb.partners.deleteWarn')} <span className="font-semibold">{toDelete.name}</span>
              </p>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('pb.partners.deleteHint')}</p>
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
