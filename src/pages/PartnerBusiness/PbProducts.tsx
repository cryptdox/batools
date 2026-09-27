import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { Button, Badge } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { SummaryBar, formatTaka } from '../../components/ui/SummaryBar';
import { Pagination, usePagination } from '../../components/ui/Pagination';
import { SortableHeader, useSort } from '../../components/ui/SortableHeader';
import { toast } from 'react-toastify';
import { Plus, Pencil, Trash2, AlertTriangle, Package } from 'lucide-react';
import type { PbProduct, PbProductStock } from '../../types/partnerBusiness';

export const PbProducts = () => {
  const { t } = useLanguage();
  const [products, setProducts] = useState<PbProduct[]>([]);
  const [stock, setStock] = useState<PbProductStock[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<PbProduct | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [defaultUnit, setDefaultUnit] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isRemaining, setIsRemaining] = useState(true);
  const [saving, setSaving] = useState(false);

  const [toDelete, setToDelete] = useState<PbProduct | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { sort, toggleSort, compare } = useSort<'name' | 'unit'>('name');

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [{ data: prods, error: prodError }, { data: st, error: stError }] = await Promise.all([
        supabase.from('pb_products').select('*').order('created_at', { ascending: false }),
        supabase.from('pb_product_stock').select('*'),
      ]);
      if (prodError) throw prodError;
      if (stError) throw stError;
      setProducts(prods ?? []);
      setStock(st ?? []);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : t('pb.products.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const stockOf = (id: string) => stock.find(s => s.product_id === id);

  const sorted = useMemo(
    () => [...products].sort((a, b) =>
      sort.key === 'name' ? compare(a.name, b.name) : compare(a.default_unit ?? '', b.default_unit ?? '')
    ),
    [products, sort, compare]
  );

  const totals = useMemo(() => ({
    count: products.length,
    active: products.filter(p => p.is_active).length,
    buyCost: stock.reduce((sum, s) => sum + Number(s.total_buy_cost), 0),
    saleAmount: stock.reduce((sum, s) => sum + Number(s.total_sale_amount), 0),
  }), [products, stock]);

  const pg = usePagination(sorted);

  const openAdd = () => {
    setEditing(null);
    setName(''); setCode(''); setDefaultUnit(''); setDescription('');
    setIsActive(true); setIsRemaining(true);
    setIsModalOpen(true);
  };

  const openEdit = (p: PbProduct) => {
    setEditing(p);
    setName(p.name);
    setCode(p.code ?? '');
    setDefaultUnit(p.default_unit ?? '');
    setDescription(p.description ?? '');
    setIsActive(p.is_active);
    setIsRemaining(p.is_remaining);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        code: code.trim() || null,
        default_unit: defaultUnit.trim() || null,
        description: description.trim() || null,
        is_active: isActive,
        is_remaining: isRemaining,
        updated_at: new Date().toISOString(),
      };
      const { error } = editing
        ? await supabase.from('pb_products').update(payload).eq('id', editing.id)
        : await supabase.from('pb_products').insert([payload]);
      if (error) throw error;

      await fetchAll();
      setIsModalOpen(false);
      toast.success(editing ? t('pb.products.updated') : t('pb.products.added'));
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : t('pb.products.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('pb_products').delete().eq('id', toDelete.id);
      if (error) throw error;
      await fetchAll();
      setToDelete(null);
      toast.success(t('pb.products.deleted'));
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : t('pb.products.deleteError'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">{t('pb.products.title')}</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{t('pb.products.subtitle')}</p>
        </div>
        <Button onClick={openAdd}>
          <Plus size={18} className="mr-2" /> {t('pb.products.add')}
        </Button>
      </div>

      <SummaryBar
        items={[
          { label: t('pb.products.total'), value: totals.count },
          { label: t('pb.common.active'), value: totals.active, tone: 'text-success' },
          { label: t('pb.common.buyCost'), value: formatTaka(totals.buyCost), tone: 'text-danger' },
          { label: t('pb.common.saleAmount'), value: formatTaka(totals.saleAmount), tone: 'text-success' },
        ]}
      />

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500 font-medium">{t('pb.common.loading')}</div>
        ) : sorted.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package size={32} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{t('pb.products.emptyTitle')}</h3>
            <p className="text-gray-500 mt-2 mb-6">{t('pb.products.emptyBody')}</p>
            <Button onClick={openAdd}>{t('pb.products.add')}</Button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                    <SortableHeader label={t('pb.common.name')} sortKey="name" sort={sort} onSort={toggleSort} />
                    <SortableHeader label={t('pb.common.unit')} sortKey="unit" sort={sort} onSort={toggleSort} />
                    <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm text-right">{t('pb.common.bought')}</th>
                    <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm text-right">{t('pb.common.sold')}</th>
                    <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm text-right">{t('pb.common.remaining')}</th>
                    <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm">{t('pb.common.status')}</th>
                    <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm text-right">{t('pb.common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {pg.pageRows.map(p => {
                    const s = stockOf(p.id);
                    return (
                      <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="p-4">
                          <div className="font-medium text-gray-900 dark:text-gray-100">{p.name}</div>
                          {p.code && <div className="text-xs text-gray-500">{p.code}</div>}
                        </td>
                        <td className="p-4 text-gray-500">{p.default_unit || '—'}</td>
                        <td className="p-4 text-right text-gray-700 dark:text-gray-300">{Number(s?.bought_quantity ?? 0)}</td>
                        <td className="p-4 text-right text-gray-700 dark:text-gray-300">{Number(s?.sold_quantity ?? 0)}</td>
                        <td className="p-4 text-right font-medium text-gray-900 dark:text-gray-100">{Number(s?.remaining_quantity ?? 0)}</td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-1.5">
                            <Badge variant={p.is_active ? 'success' : 'muted'}>
                              {p.is_active ? t('pb.common.active') : t('pb.common.inactive')}
                            </Badge>
                            {!p.is_remaining && <Badge variant="warning">{t('pb.products.outOfStock')}</Badge>}
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1">
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

      <Modal isOpen={isModalOpen} onClose={() => !saving && setIsModalOpen(false)} title={editing ? t('pb.products.editTitle') : t('pb.products.addTitle')}>
        <div className="space-y-4">
          <Input label={t('pb.common.name')} value={name} onChange={e => setName(e.target.value)} autoFocus />
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('pb.products.code')} value={code} onChange={e => setCode(e.target.value)} placeholder="SKU-01" />
            <Input label={t('pb.products.defaultUnit')} value={defaultUnit} onChange={e => setDefaultUnit(e.target.value)} placeholder="kg" />
          </div>
          <Input label={t('pb.common.note')} value={description} onChange={e => setDescription(e.target.value)} />

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('pb.common.active')}</span>
          </label>

          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={isRemaining} onChange={e => setIsRemaining(e.target.checked)} className="w-4 h-4 mt-0.5 text-primary rounded border-gray-300 focus:ring-primary" />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              <span className="font-medium">{t('pb.products.hasStock')}</span>
              <br />
              <span className="text-gray-500">{t('pb.products.hasStockHint')}</span>
            </span>
          </label>

          <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-gray-100 dark:border-gray-700">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)} disabled={saving}>{t('pb.common.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? t('pb.common.saving') : t('pb.common.save')}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!toDelete} onClose={() => !deleting && setToDelete(null)} title={t('pb.products.deleteTitle')}>
        {toDelete && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-danger/5 border border-danger/20 rounded-lg p-4">
              <AlertTriangle size={20} className="text-danger shrink-0 mt-0.5" />
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {t('pb.products.deleteWarn')} <span className="font-semibold">{toDelete.name}</span>
              </p>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('pb.products.deleteHint')}</p>
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
