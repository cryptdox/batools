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
import { Plus, Pencil, Trash2, AlertTriangle, Boxes } from 'lucide-react';
import type { PbAsset, PbGeneralFund } from '../../types/partnerBusiness';

export const PbAssets = () => {
  const { t } = useLanguage();
  const [assets, setAssets] = useState<PbAsset[]>([]);
  const [fund, setFund] = useState<PbGeneralFund | null>(null);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<PbAsset | null>(null);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('');
  const [amount, setAmount] = useState('');
  const [acquiredAt, setAcquiredAt] = useState(getDhakaDateString());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const [toDelete, setToDelete] = useState<PbAsset | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [a, f] = await Promise.all([
        supabase.from('pb_assets').select('*').order('acquired_at', { ascending: false }),
        supabase.from('pb_general_fund').select('*').single(),
      ]);
      for (const r of [a, f]) if (r.error) throw r.error;
      setAssets(a.data ?? []);
      setFund(f.data ?? null);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : t('pb.assets.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const sorted = useMemo(
    () => [...assets].sort((a, b) => b.acquired_at.localeCompare(a.acquired_at)),
    [assets]
  );

  const totals = useMemo(() => ({
    count: assets.length,
    quantity: assets.reduce((sum, a) => sum + Number(a.quantity), 0),
    amount: assets.reduce((sum, a) => sum + Number(a.amount), 0),
  }), [assets]);

  const pg = usePagination(sorted);

  // Capital an asset can draw on. While editing, this asset's own cost is
  // already inside the figure, so add it back or it counts against itself.
  const available = fund ? Number(fund.remaining) : 0;
  const availableForForm = available + (editing ? Number(editing.amount) : 0);
  const amountNum = Number(amount) || 0;
  const overCapital = amountNum > availableForForm;

  const canSave =
    !!name.trim() &&
    amount.trim() !== '' &&
    Number.isFinite(Number(amount)) &&
    Number(amount) >= 0 &&
    (quantity.trim() === '' || Number(quantity) >= 0);

  const openAdd = () => {
    setEditing(null);
    setName(''); setQuantity('1'); setUnit(''); setAmount('');
    setAcquiredAt(getDhakaDateString());
    setNote('');
    setIsModalOpen(true);
  };

  const openEdit = (a: PbAsset) => {
    setEditing(a);
    setName(a.name);
    setQuantity(String(Number(a.quantity)));
    setUnit(a.unit ?? '');
    setAmount(String(Number(a.amount)));
    setAcquiredAt(a.acquired_at);
    setNote(a.note ?? '');
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        // Column is NOT NULL DEFAULT 1, so a blank box means one whole holding.
        quantity: quantity.trim() === '' ? 1 : Number(quantity),
        unit: unit.trim() || null,
        amount: Number(amount),
        note: note.trim() || null,
        acquired_at: acquiredAt,
        updated_at: new Date().toISOString(),
      };
      const { error } = editing
        ? await supabase.from('pb_assets').update(payload).eq('id', editing.id)
        : await supabase.from('pb_assets').insert([payload]);
      if (error) throw error;

      await fetchAll();
      setIsModalOpen(false);
      toast.success(editing ? t('pb.assets.updated') : t('pb.assets.added'));
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : t('pb.assets.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('pb_assets').delete().eq('id', toDelete.id);
      if (error) throw error;
      await fetchAll();
      setToDelete(null);
      toast.success(t('pb.assets.deleted'));
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : t('pb.assets.deleteError'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">{t('pb.assets.title')}</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{t('pb.assets.subtitle')}</p>
        </div>
        <Button onClick={openAdd}>
          <Plus size={18} className="mr-2" /> {t('pb.assets.add')}
        </Button>
      </div>

      <SummaryBar
        items={[
          { label: t('pb.assets.count'), value: totals.count },
          { label: t('pb.assets.totalQuantity'), value: totals.quantity },
          { label: t('pb.assets.totalValue'), value: formatTaka(totals.amount), tone: 'text-success' },
          {
            label: t('pb.assets.capitalLeft'),
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
              <Boxes size={32} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{t('pb.assets.emptyTitle')}</h3>
            <p className="text-gray-500 mt-2 mb-6">{t('pb.assets.emptyBody')}</p>
            <Button onClick={openAdd}>{t('pb.assets.add')}</Button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                    <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm">{t('pb.common.name')}</th>
                    <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm text-right">{t('pb.common.quantity')}</th>
                    <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm">{t('pb.common.unit')}</th>
                    <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm text-right">{t('pb.common.amount')}</th>
                    <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm">{t('pb.assets.acquiredAt')}</th>
                    <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm text-right">{t('pb.common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {pg.pageRows.map(a => (
                    <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="p-4">
                        <div className="font-medium text-gray-900 dark:text-gray-100">{a.name}</div>
                        {a.note && <div className="text-xs text-gray-500">{a.note}</div>}
                      </td>
                      <td className="p-4 text-right text-gray-700 dark:text-gray-300">{Number(a.quantity)}</td>
                      <td className="p-4 text-gray-500">{a.unit || '—'}</td>
                      <td className="p-4 text-right font-medium text-gray-900 dark:text-gray-100">{formatTaka(Number(a.amount))}</td>
                      <td className="p-4 text-gray-700 dark:text-gray-300 whitespace-nowrap">{a.acquired_at}</td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(a)} title={t('pb.common.edit')}>
                            <Pencil size={16} />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setToDelete(a)} title={t('pb.common.delete')}>
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

      <Modal isOpen={isModalOpen} onClose={() => !saving && setIsModalOpen(false)} title={editing ? t('pb.assets.editTitle') : t('pb.assets.addTitle')}>
        <div className="space-y-4">
          <Input label={t('pb.common.name')} value={name} onChange={e => setName(e.target.value)} autoFocus />
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('pb.common.quantity')} type="number" min="0" step="any" value={quantity} onChange={e => setQuantity(e.target.value)} />
            <Input label={t('pb.common.unit')} value={unit} onChange={e => setUnit(e.target.value)} placeholder="pcs" />
          </div>
          <Input label={t('pb.common.amount')} type="number" min="0" step="any" value={amount} onChange={e => setAmount(e.target.value)} />
          <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">{t('pb.assets.amountHint')}</p>

          <div className="flex items-center justify-between text-sm rounded-lg bg-gray-50 dark:bg-gray-900/50 px-3 py-2">
            <span className="text-gray-500">{t('pb.assets.capitalLeft')}</span>
            <span className={overCapital ? 'text-danger font-semibold' : 'text-gray-500'}>
              {formatTaka(availableForForm)} → {formatTaka(availableForForm - amountNum)}
            </span>
          </div>
          {overCapital && <p className="text-xs text-danger -mt-2">{t('pb.assets.overCapital')}</p>}

          <Input label={t('pb.assets.acquiredAt')} type="date" value={acquiredAt} onChange={e => setAcquiredAt(e.target.value)} />
          <Input label={t('pb.common.note')} value={note} onChange={e => setNote(e.target.value)} />

          <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-gray-100 dark:border-gray-700">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)} disabled={saving}>{t('pb.common.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving || !canSave}>
              {saving ? t('pb.common.saving') : t('pb.common.save')}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!toDelete} onClose={() => !deleting && setToDelete(null)} title={t('pb.assets.deleteTitle')}>
        {toDelete && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-danger/5 border border-danger/20 rounded-lg p-4">
              <AlertTriangle size={20} className="text-danger shrink-0 mt-0.5" />
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {t('pb.assets.deleteWarn')} <span className="font-semibold">{toDelete.name}</span>
              </p>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('pb.assets.deleteHint')}</p>
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
