import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { Button, Badge } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { SummaryBar, formatTaka } from '../../components/ui/SummaryBar';
import { Pagination, usePagination } from '../../components/ui/Pagination';
import { toast } from 'react-toastify';
import { Plus, Trash2, AlertTriangle, Tags, X } from 'lucide-react';
import { format } from 'date-fns';
import { getDhakaDateString } from '../../lib/dhakaTime';
import { money } from '../../lib/partnerBusiness';
import type { PbSale, PbBuyBatch, PbBuyBatchItemStock } from '../../types/partnerBusiness';

/** A titled cost of selling, mirroring a buy batch's extra costs. */
type ExtraDraft = { title: string; amount: string };
const blankExtra = (): ExtraDraft => ({ title: '', amount: '' });

const NO_BATCH = '__none__';

/** One sellable line of the chosen batch, with what the user is selling of it. */
type LineDraft = {
  stock: PbBuyBatchItemStock;
  selected: boolean;
  quantity: string;
  unit_price: string;
  total: string;
};

type SaleRow = {
  buy_batch_id: string | null;
  buy_batch_item_id: string | null;
  product_id: string | null;
  product_name: string;
  unit: string | null;
  quantity: number | null;
  unit_price: number | null;
  total_amount: number;
  note: string | null;
  sold_at: string;
};

const inputBase = 'h-9 rounded-md border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:border-gray-700 dark:bg-gray-900 dark:text-gray-50';
const inputClass = `${inputBase} w-full`;
const selectClass = `${inputClass} h-10`;

export const PbSell = () => {
  const { t } = useLanguage();
  const [sales, setSales] = useState<PbSale[]>([]);
  const [batches, setBatches] = useState<PbBuyBatch[]>([]);
  const [stock, setStock] = useState<PbBuyBatchItemStock[]>([]);
  const [extraDrafts, setExtraDrafts] = useState<ExtraDraft[]>([]);
  /** Batches this sale draws on, in the order they were added. */
  const [pickedBatches, setPickedBatches] = useState<string[]>([]);
  /** Set when the sale also includes an item that is not from any batch. */
  const [withCustom, setWithCustom] = useState(false);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [customName, setCustomName] = useState('');
  const [customQty, setCustomQty] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customTotal, setCustomTotal] = useState('');
  const [soldAt, setSoldAt] = useState(getDhakaDateString());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const [toDelete, setToDelete] = useState<PbSale | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [s, b, st] = await Promise.all([
        supabase.from('pb_sales').select('*').order('sold_at', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('pb_buy_batches').select('*').order('purchased_at', { ascending: false }),
        supabase.from('pb_buy_batch_item_stock').select('*'),
      ]);
      for (const r of [s, b, st]) if (r.error) throw r.error;
      setSales(s.data ?? []);
      setBatches(b.data ?? []);
      setStock(st.data ?? []);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : t('pb.sell.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const batchLabel = (b: PbBuyBatch) => {
    const names = stock.filter(s => s.buy_batch_id === b.id).map(s => s.product_name).join(', ');
    return `${format(new Date(b.purchased_at), 'MMM d')} · ${b.title || names || '—'}`;
  };

  const totals = useMemo(() => ({
    count: sales.length,
    quantity: sales.reduce((s, x) => s + Number(x.quantity ?? 0), 0),
    amount: sales.reduce((s, x) => s + Number(x.total_amount), 0),
  }), [sales]);

  const pg = usePagination(sales);

  // Batches that still have something left to sell.
  const sellableBatches = useMemo(
    () => batches.filter(b => stock.some(s => s.buy_batch_id === b.id && (s.remaining_quantity === null || Number(s.remaining_quantity) > 0))),
    [batches, stock]
  );

  const openAdd = () => {
    setPickedBatches([]);
    setWithCustom(false);
    setLines([]);
    setCustomName(''); setCustomQty(''); setCustomPrice(''); setCustomTotal('');
    setSoldAt(getDhakaDateString());
    setNote('');
    setExtraDrafts([]);
    setIsModalOpen(true);
  };

  /**
   * Lines stay one flat list across every picked batch; each carries its own
   * stock row, so buy_batch_id travels with it all the way to the insert and
   * the display just groups by batch.
   */
  const addBatch = (id: string) => {
    if (!id || id === NO_BATCH || pickedBatches.includes(id)) return;
    setPickedBatches(prev => [...prev, id]);
    setLines(prev => [
      ...prev,
      ...stock
        .filter(x => x.buy_batch_id === id)
        .map(x => ({ stock: x, selected: false, quantity: '', unit_price: '', total: '' })),
    ]);
  };

  const removeBatch = (id: string) => {
    setPickedBatches(prev => prev.filter(x => x !== id));
    setLines(prev => prev.filter(l => l.stock.buy_batch_id !== id));
  };

  const linesOfBatch = (id: string) => lines.filter(l => l.stock.buy_batch_id === id);

  const setLine = (itemId: string, patch: Partial<LineDraft>) =>
    setLines(prev => prev.map(l => l.stock.buy_batch_item_id === itemId ? { ...l, ...patch } : l));

  const lineTotal = (l: LineDraft) => {
    const explicit = parseFloat(l.total);
    if (!isNaN(explicit)) return explicit;
    const q = parseFloat(l.quantity), p = parseFloat(l.unit_price);
    return !isNaN(q) && !isNaN(p) ? money(q * p) : 0;
  };

  const overSold = (l: LineDraft) =>
    l.stock.remaining_quantity !== null && (parseFloat(l.quantity) || 0) > Number(l.stock.remaining_quantity);

  const chosen = lines.filter(l => l.selected);
  const customTotalNum = parseFloat(customTotal) || (parseFloat(customQty) || 0) * (parseFloat(customPrice) || 0);
  const customAmount = withCustom ? money(customTotalNum) : 0;
  const salesSubtotal = money(chosen.reduce((s, l) => s + lineTotal(l), 0) + customAmount);
  const setExtra = (i: number, patch: Partial<ExtraDraft>) =>
    setExtraDrafts(prev => prev.map((d, idx) => idx === i ? { ...d, ...patch } : d));
  const extrasSubtotal = money(extraDrafts.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0));
  // What the sale is actually worth once the cost of selling comes off. This is
  // the figure that reaches profit.
  const grandTotal = money(salesSubtotal - extrasSubtotal);

  const customValid = !withCustom || (customName.trim() !== '' && customTotalNum > 0);
  const canSave =
    (chosen.length > 0 || (withCustom && customTotalNum > 0)) &&
    chosen.every(l => lineTotal(l) > 0) &&
    !chosen.some(overSold) &&
    customValid;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const batchRows: SaleRow[] = chosen.map(l => ({
        buy_batch_id: l.stock.buy_batch_id,
        buy_batch_item_id: l.stock.buy_batch_item_id,
        product_id: l.stock.product_id,
        product_name: l.stock.product_name,
        unit: l.stock.unit,
        quantity: l.quantity ? Number(l.quantity) : null,
        unit_price: l.unit_price ? Number(l.unit_price) : null,
        total_amount: money(lineTotal(l)),
        note: note.trim() || null,
        sold_at: soldAt,
      }));

      const customRows: SaleRow[] = withCustom && customTotalNum > 0
        ? [{
            buy_batch_id: null,
            buy_batch_item_id: null,
            product_id: null,
            product_name: customName.trim(),
            unit: null,
            quantity: customQty ? Number(customQty) : null,
            unit_price: customPrice ? Number(customPrice) : null,
            total_amount: money(customTotalNum),
            note: note.trim() || null,
            sold_at: soldAt,
          }]
        : [];

      const rows = [...batchRows, ...customRows];

      // The event is the header the extras hang off, and it is what ties a
      // delivery charge to the whole sale rather than to one line of it.
      const { data: ev, error: evError } = await supabase
        .from('pb_sale_events')
        .insert([{
          // Only meaningful for a single-batch sale; the money split is derived
          // from the sale rows, never from this column.
          buy_batch_id: pickedBatches.length === 1 ? pickedBatches[0] : null,
          sold_at: soldAt,
          note: note.trim() || null,
        }])
        .select('id')
        .single();
      if (evError) throw evError;

      const { error } = await supabase
        .from('pb_sales')
        .insert(rows.map(r => ({ ...r, sale_event_id: ev.id })));
      if (error) throw error;

      const extraRows = extraDrafts
        .filter(d => d.title.trim() && (parseFloat(d.amount) || 0) > 0)
        .map((d, idx) => ({ sale_event_id: ev.id, title: d.title.trim(), amount: Number(d.amount), sort_order: idx }));
      if (extraRows.length) {
        const { error: exError } = await supabase.from('pb_sale_extra_costs').insert(extraRows);
        if (exError) throw exError;
      }

      await fetchAll();
      setIsModalOpen(false);
      toast.success(t('pb.sell.added'));
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : t('pb.sell.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('pb_sales').delete().eq('id', toDelete.id);
      if (error) throw error;
      await fetchAll();
      setToDelete(null);
      toast.success(t('pb.sell.deleted'));
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : t('pb.sell.deleteError'));
    } finally {
      setDeleting(false);
    }
  };

  const batchOf = (id: string | null) => batches.find(b => b.id === id);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">{t('pb.sell.title')}</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{t('pb.sell.subtitle')}</p>
        </div>
        <Button onClick={openAdd}>
          <Plus size={18} className="mr-2" /> {t('pb.sell.add')}
        </Button>
      </div>

      <SummaryBar
        items={[
          { label: t('pb.sell.count'), value: totals.count },
          { label: t('pb.sell.totalQuantity'), value: totals.quantity },
          { label: t('pb.common.saleAmount'), value: formatTaka(totals.amount), tone: 'text-success' },
        ]}
      />

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500 font-medium">{t('pb.common.loading')}</div>
        ) : sales.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <Tags size={32} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{t('pb.sell.emptyTitle')}</h3>
            <p className="text-gray-500 mt-2 mb-6">{t('pb.sell.emptyBody')}</p>
            <Button onClick={openAdd}>{t('pb.sell.add')}</Button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                    <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm">{t('pb.common.date')}</th>
                    <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm">{t('pb.sell.product')}</th>
                    <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm">{t('pb.buy.batchLabel')}</th>
                    <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm text-right">{t('pb.common.quantity')}</th>
                    <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm text-right">{t('pb.sell.unitPrice')}</th>
                    <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm text-right">{t('pb.sell.totalAmount')}</th>
                    <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm text-right">{t('pb.common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {pg.pageRows.map(s => {
                    const b = batchOf(s.buy_batch_id);
                    return (
                      <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="p-4 text-gray-900 dark:text-gray-100 font-medium whitespace-nowrap">{s.sold_at}</td>
                        <td className="p-4 text-gray-900 dark:text-gray-100">{s.product_name}</td>
                        <td className="p-4 text-sm">
                          {b ? <Badge variant="default">{batchLabel(b)}</Badge> : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="p-4 text-right text-gray-700 dark:text-gray-300">
                          {s.quantity != null ? `${Number(s.quantity)} ${s.unit ?? ''}`.trim() : '—'}
                        </td>
                        <td className="p-4 text-right text-gray-700 dark:text-gray-300">
                          {s.unit_price != null ? formatTaka(Number(s.unit_price)) : '—'}
                        </td>
                        <td className="p-4 text-right font-medium text-success">{formatTaka(Number(s.total_amount))}</td>
                        <td className="p-4 text-right">
                          <Button variant="ghost" size="sm" onClick={() => setToDelete(s)} title={t('pb.common.delete')}>
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

      <Modal isOpen={isModalOpen} onClose={() => !saving && setIsModalOpen(false)} title={t('pb.sell.addTitle')} className="max-w-3xl">
        <div className="space-y-5">
          {/* batch sections -- a sale may draw on several batches at once */}
          <div>
            <div className="flex flex-wrap items-end justify-between gap-2 mb-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('pb.sell.batches')}</label>
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={withCustom}
                  onChange={e => setWithCustom(e.target.checked)}
                  className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                />
                {t('pb.sell.includeCustom')}
              </label>
            </div>
            <select value="" onChange={e => addBatch(e.target.value)} className={selectClass}>
              <option value="">{t('pb.sell.addBatch')}</option>
              {sellableBatches
                .filter(b => !pickedBatches.includes(b.id))
                .map(b => <option key={b.id} value={b.id}>{batchLabel(b)}</option>)}
            </select>
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{t('pb.sell.batchHint')}</p>
          </div>

          {pickedBatches.length === 0 && !withCustom && (
            <p className="text-sm text-gray-500">{t('pb.sell.pickAtLeastOne')}</p>
          )}

          {pickedBatches.map(bid => {
            const batch = batchOf(bid);
            const rows = linesOfBatch(bid);
            const subtotal = money(rows.filter(l => l.selected).reduce((a, l) => a + lineTotal(l), 0));
            return (
              <div key={bid} className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-3 py-2 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="default">{batch ? batchLabel(batch) : bid.slice(0, 8)}</Badge>
                    <span className="text-xs text-gray-500">{t('pb.sell.subtotal')} {formatTaka(subtotal)}</span>
                  </div>
                  <button
                    onClick={() => removeBatch(bid)}
                    title={t('pb.common.delete')}
                    className="px-1 text-gray-400 hover:text-danger transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>

                {rows.length === 0 ? (
                  <p className="p-3 text-sm text-gray-500">{t('pb.sell.batchEmpty')}</p>
                ) : (
                  <div className="p-3 space-y-2">
                    {rows.map(l => {
                      const remaining = l.stock.remaining_quantity;
                      const id = l.stock.buy_batch_item_id;
                      return (
                        <div key={id} className={`rounded-lg border p-3 ${l.selected ? 'border-primary/40 bg-primary/5' : 'border-gray-200 dark:border-gray-700'}`}>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={l.selected}
                              onChange={e => setLine(id, { selected: e.target.checked })}
                              className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                            />
                            <span className="font-medium text-gray-900 dark:text-gray-100">{l.stock.product_name}</span>
                            <span className="text-xs text-gray-500">
                              {remaining === null
                                ? t('pb.sell.noUnits')
                                : `${t('pb.common.remaining')}: ${Number(remaining)} ${l.stock.unit ?? ''}`}
                            </span>
                          </label>

                          {l.selected && (
                            <div className="grid grid-cols-3 gap-2 mt-3">
                              <input type="number" value={l.quantity} onChange={e => setLine(id, { quantity: e.target.value })} placeholder={t('pb.common.quantity')} className={`${inputClass} text-right`} />
                              <input type="number" value={l.unit_price} onChange={e => setLine(id, { unit_price: e.target.value })} placeholder={t('pb.sell.unitPrice')} className={`${inputClass} text-right`} />
                              <input type="number" value={l.total} onChange={e => setLine(id, { total: e.target.value })} placeholder={formatTaka(lineTotal(l))} className={`${inputClass} text-right`} />
                              {overSold(l) && (
                                <p className="col-span-3 text-xs text-danger">
                                  {t('pb.sell.overSold')} {Number(remaining)} {l.stock.unit ?? ''}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {withCustom && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
              <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('pb.sell.noBatch')}</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="col-span-2"><Input label={t('pb.sell.customProductName')} value={customName} onChange={e => setCustomName(e.target.value)} /></div>
                <Input label={t('pb.common.quantity')} type="number" value={customQty} onChange={e => setCustomQty(e.target.value)} />
                <Input label={t('pb.sell.unitPrice')} type="number" value={customPrice} onChange={e => setCustomPrice(e.target.value)} />
                <div className="col-span-2">
                  <Input label={t('pb.sell.totalAmount')} type="number" value={customTotal} onChange={e => setCustomTotal(e.target.value)} placeholder={formatTaka(customTotalNum)} />
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input label={t('pb.common.date')} type="date" value={soldAt} onChange={e => setSoldAt(e.target.value)} />
            <Input label={t('pb.common.note')} value={note} onChange={e => setNote(e.target.value)} />
          </div>

          {/* extra costs */}
          <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('pb.sell.extraCosts')}</span>
              <Button size="sm" variant="outline" onClick={() => setExtraDrafts(prev => [...prev, blankExtra()])}>
                <Plus size={14} className="mr-1" /> {t('pb.sell.addExtraCost')}
              </Button>
            </div>
            {extraDrafts.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('pb.sell.noExtraCosts')}</p>
            ) : (
              <div className="space-y-2">
                {extraDrafts.map((d, i) => (
                  <div key={i} className="grid grid-cols-[minmax(0,1fr)_10rem_auto] gap-2 items-center">
                    <input value={d.title} onChange={e => setExtra(i, { title: e.target.value })} placeholder={t('pb.sell.costTitlePlaceholder')} className={inputClass} />
                    <input type="number" value={d.amount} onChange={e => setExtra(i, { amount: e.target.value })} placeholder={t('pb.common.amount')} className={`${inputClass} text-right`} />
                    <button onClick={() => setExtraDrafts(prev => prev.filter((_, idx) => idx !== i))} title={t('pb.common.delete')} className="px-1 flex items-center justify-center text-gray-400 hover:text-danger transition-colors">
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{t('pb.sell.extraHint')}</p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 space-y-1 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>{t('pb.sell.salesSubtotal')}</span><span>{formatTaka(salesSubtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>{t('pb.sell.extraCosts')}</span><span>&minus;{formatTaka(extrasSubtotal)}</span>
            </div>
            <div className="flex justify-between pt-1 mt-1 border-t border-gray-200 dark:border-gray-700 font-semibold text-gray-900 dark:text-white">
              <span>{t('pb.sell.netRevenue')}</span><span>{formatTaka(grandTotal)}</span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)} disabled={saving}>{t('pb.common.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving || !canSave}>{saving ? t('pb.common.saving') : t('pb.common.save')}</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!toDelete} onClose={() => !deleting && setToDelete(null)} title={t('pb.sell.deleteTitle')}>
        {toDelete && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-danger/5 border border-danger/20 rounded-lg p-4">
              <AlertTriangle size={20} className="text-danger shrink-0 mt-0.5" />
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {t('pb.sell.deleteWarn')} <span className="font-semibold">{toDelete.product_name}</span> — {formatTaka(Number(toDelete.total_amount))}
              </p>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('pb.sell.deleteHint')}</p>
            <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-gray-100 dark:border-gray-700">
              <Button variant="ghost" onClick={() => setToDelete(null)} disabled={deleting}>{t('pb.common.cancel')}</Button>
              <Button variant="danger" onClick={handleDelete} disabled={deleting}>{deleting ? t('pb.common.deleting') : t('pb.common.delete')}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
