import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { getDhakaDateString } from '../../lib/dhakaTime';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { SummaryBar, formatTaka } from '../../components/ui/SummaryBar';
import { Pagination, usePagination } from '../../components/ui/Pagination';
import { toast } from 'react-toastify';
import { Plus, Pencil, Trash2, AlertTriangle, Receipt } from 'lucide-react';
import type { PbAdditionalCost, PbGeneralFund } from '../../types/partnerBusiness';

export const PbCosts = () => {
  const { t } = useLanguage();
  const [costs, setCosts] = useState<PbAdditionalCost[]>([]);
  const [fund, setFund] = useState<PbGeneralFund | null>(null);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<PbAdditionalCost | null>(null);
  const [costDate, setCostDate] = useState(getDhakaDateString());
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const [toDelete, setToDelete] = useState<PbAdditionalCost | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [c, f] = await Promise.all([
        supabase.from('pb_additional_costs').select('*').order('cost_date', { ascending: false }),
        supabase.from('pb_general_fund').select('*').single(),
      ]);
      for (const r of [c, f]) if (r.error) throw r.error;
      setCosts(c.data ?? []);
      setFund(f.data ?? null);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : t('pb.costs.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const sorted = useMemo(
    () => [...costs].sort((a, b) => b.cost_date.localeCompare(a.cost_date)),
    [costs]
  );

  const totals = useMemo(() => ({
    count: costs.length,
    amount: costs.reduce((sum, c) => sum + Number(c.amount), 0),
  }), [costs]);

  const pg = usePagination(sorted);

  // The schema requires amount > 0 and a description, so the button mirrors that.
  // A daily cost is paid out of invested capital, so it has a ceiling like a
  // buy does. While editing, this cost is already inside the figure.
  const available = fund ? Number(fund.remaining) : 0;
  const availableForForm = available + (editing ? Number(editing.amount) : 0);
  const amountNum = Number(amount) || 0;
  const overCapital = amountNum > availableForForm;

  const canSave = !!description.trim() && amount.trim() !== '' && Number(amount) > 0;

  const openAdd = () => {
    setEditing(null);
    setCostDate(getDhakaDateString());
    setAmount('');
    setDescription('');
    setIsModalOpen(true);
  };

  const openEdit = (c: PbAdditionalCost) => {
    setEditing(c);
    setCostDate(c.cost_date);
    setAmount(String(Number(c.amount)));
    setDescription(c.description);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = {
        cost_date: costDate,
        amount: Number(amount),
        description: description.trim(),
        updated_at: new Date().toISOString(),
      };
      const { error } = editing
        ? await supabase.from('pb_additional_costs').update(payload).eq('id', editing.id)
        : await supabase.from('pb_additional_costs').insert([payload]);
      if (error) throw error;

      await fetchAll();
      setIsModalOpen(false);
      toast.success(editing ? t('pb.costs.updated') : t('pb.costs.added'));
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : t('pb.costs.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('pb_additional_costs').delete().eq('id', toDelete.id);
      if (error) throw error;
      await fetchAll();
      setToDelete(null);
      toast.success(t('pb.costs.deleted'));
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : t('pb.costs.deleteError'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">{t('pb.costs.title')}</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{t('pb.costs.subtitle')}</p>
        </div>
        <Button onClick={openAdd}>
          <Plus size={18} className="mr-2" /> {t('pb.costs.add')}
        </Button>
      </div>

      <SummaryBar
        items={[
          { label: t('pb.costs.count'), value: totals.count },
          { label: t('pb.costs.totalAmount'), value: formatTaka(totals.amount), tone: 'text-danger' },
          {
            label: t('pb.costs.capitalLeft'),
            value: formatTaka(available),
            tone: available < 0 ? 'text-danger' : 'text-success',
          },
        ]}
      />

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500 font-medium">{t('pb.common.loading')}</div>
        ) : sorted.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <Receipt size={32} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{t('pb.costs.emptyTitle')}</h3>
            <p className="text-gray-500 mt-2 mb-6">{t('pb.costs.emptyBody')}</p>
            <Button onClick={openAdd}>{t('pb.costs.add')}</Button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                    <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm">{t('pb.common.date')}</th>
                    <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm">{t('pb.costs.description')}</th>
                    <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm text-right">{t('pb.common.amount')}</th>
                    <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm text-right">{t('pb.common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {pg.pageRows.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="p-4 text-gray-700 dark:text-gray-300 whitespace-nowrap">{c.cost_date}</td>
                      <td className="p-4 font-medium text-gray-900 dark:text-gray-100">{c.description}</td>
                      <td className="p-4 text-right font-medium text-danger">{formatTaka(Number(c.amount))}</td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(c)} title={t('pb.common.edit')}>
                            <Pencil size={16} />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setToDelete(c)} title={t('pb.common.delete')}>
                            <Trash2 size={16} className="text-danger" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
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

      <Modal isOpen={isModalOpen} onClose={() => !saving && setIsModalOpen(false)} title={editing ? t('pb.costs.editTitle') : t('pb.costs.addTitle')}>
        <div className="space-y-4">
          <Input label={t('pb.common.date')} type="date" value={costDate} onChange={e => setCostDate(e.target.value)} />
          <Input label={t('pb.common.amount')} type="number" min="0" step="any" value={amount} onChange={e => setAmount(e.target.value)} placeholder="500" />

          <div className="flex items-center justify-between text-sm rounded-lg bg-gray-50 dark:bg-gray-900/50 px-3 py-2">
            <span className="text-gray-500">{t('pb.costs.capitalLeft')}</span>
            <span className={overCapital ? 'text-danger font-semibold' : 'text-gray-500'}>
              {formatTaka(availableForForm)} → {formatTaka(availableForForm - amountNum)}
            </span>
          </div>
          {overCapital && <p className="text-xs text-danger -mt-2">{t('pb.costs.overCapital')}</p>}
          <Input label={t('pb.costs.description')} value={description} onChange={e => setDescription(e.target.value)} placeholder={t('pb.costs.descriptionPlaceholder')} />

          <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-gray-100 dark:border-gray-700">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)} disabled={saving}>{t('pb.common.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving || !canSave}>
              {saving ? t('pb.common.saving') : t('pb.common.save')}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!toDelete} onClose={() => !deleting && setToDelete(null)} title={t('pb.costs.deleteTitle')}>
        {toDelete && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-danger/5 border border-danger/20 rounded-lg p-4">
              <AlertTriangle size={20} className="text-danger shrink-0 mt-0.5" />
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {t('pb.costs.deleteWarn')} <span className="font-semibold">{toDelete.description} — {formatTaka(Number(toDelete.amount))}</span>
              </p>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('pb.costs.deleteHint')}</p>
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
