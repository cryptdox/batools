import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { Button, Badge } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { SummaryBar, formatTaka } from '../../components/ui/SummaryBar';
import { Pagination, usePagination } from '../../components/ui/Pagination';
import { toast } from 'react-toastify';
import { Plus, Pencil, Trash2, AlertTriangle, ShoppingCart, Users, X } from 'lucide-react';
import { format } from 'date-fns';
import { getDhakaDateString } from '../../lib/dhakaTime';
import { splitByShares, money } from '../../lib/partnerBusiness';
import type {
  PbBuyBatch, PbBuyBatchItem, PbBuyBatchExtraCost, PbBuyBatchTotals, PbBusinessCash,
  PbShareGroupFund, PbGeneralFund,
  PbProduct, PbPartner, PbPartnerShare, PbBuyBatchPartnerShare,
  PbShareGroup, PbShareGroupMember,
} from '../../types/partnerBusiness';

// Preset sources for the share rows, beside the saved groups.
const SHARE_CURRENT = '__current__';   // each partner's standing share
const SHARE_EQUAL   = '__equal__';     // all active partners, split evenly
const SHARE_CUSTOM  = '__custom__';    // typed by hand

const CUSTOM = '__custom__';

type ItemDraft = { product_id: string; product_name: string; unit: string; quantity: string; unit_cost: string; line_total: string };
type ExtraDraft = { title: string; amount: string };
type ShareInput = { partner_id: string; name: string; percent: string };

const blankItem = (): ItemDraft => ({ product_id: CUSTOM, product_name: '', unit: '', quantity: '', unit_cost: '', line_total: '' });
const blankExtra = (): ExtraDraft => ({ title: '', amount: '' });

const inputBase = 'h-9 rounded-md border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:border-gray-700 dark:bg-gray-900 dark:text-gray-50';
const inputClass = `${inputBase} w-full`;

export const PbBuy = () => {
  const { t } = useLanguage();
  const [batches, setBatches] = useState<PbBuyBatch[]>([]);
  const [items, setItems] = useState<PbBuyBatchItem[]>([]);
  const [extras, setExtras] = useState<PbBuyBatchExtraCost[]>([]);
  const [totals, setTotals] = useState<PbBuyBatchTotals[]>([]);
  const [cash, setCash] = useState<PbBusinessCash | null>(null);
  const [products, setProducts] = useState<PbProduct[]>([]);
  const [partners, setPartners] = useState<PbPartner[]>([]);
  const [currentShares, setCurrentShares] = useState<PbPartnerShare[]>([]);
  const [batchShares, setBatchShares] = useState<PbBuyBatchPartnerShare[]>([]);
  const [groups, setGroups] = useState<PbShareGroup[]>([]);
  const [groupMembers, setGroupMembers] = useState<PbShareGroupMember[]>([]);
  const [groupFunds, setGroupFunds] = useState<PbShareGroupFund[]>([]);
  const [generalFund, setGeneralFund] = useState<PbGeneralFund | null>(null);
  const [shareSource, setShareSource] = useState<string>(SHARE_CURRENT);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<PbBuyBatch | null>(null);
  const [title, setTitle] = useState('');
  const [purchasedAt, setPurchasedAt] = useState(getDhakaDateString());
  const [note, setNote] = useState('');
  const [isRemaining, setIsRemaining] = useState(true);
  const [itemDrafts, setItemDrafts] = useState<ItemDraft[]>([blankItem()]);
  const [extraDrafts, setExtraDrafts] = useState<ExtraDraft[]>([]);
  const [shareInputs, setShareInputs] = useState<ShareInput[]>([]);
  const [saving, setSaving] = useState(false);

  const [toDelete, setToDelete] = useState<PbBuyBatch | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [detailOf, setDetailOf] = useState<PbBuyBatch | null>(null);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const r = await Promise.all([
        supabase.from('pb_buy_batches').select('*').order('purchased_at', { ascending: false }),
        supabase.from('pb_buy_batch_items').select('*').order('sort_order'),
        supabase.from('pb_buy_batch_extra_costs').select('*').order('sort_order'),
        supabase.from('pb_buy_batch_totals').select('*'),
        supabase.from('pb_business_cash').select('*').single(),
        supabase.from('pb_products').select('*').eq('is_active', true).order('name'),
        supabase.from('pb_partners').select('*').eq('is_active', true).order('name'),
        supabase.from('pb_partner_shares').select('*').is('effective_to', null),
        supabase.from('pb_buy_batch_partner_shares').select('*'),
        supabase.from('pb_share_groups').select('*').eq('is_active', true).order('name'),
        supabase.from('pb_share_group_members').select('*'),
        supabase.from('pb_share_group_fund').select('*'),
        supabase.from('pb_general_fund').select('*').single(),
      ]);
      for (const x of r) if (x.error) throw x.error;
      setBatches(r[0].data ?? []);
      setItems(r[1].data ?? []);
      setExtras(r[2].data ?? []);
      setTotals(r[3].data ?? []);
      setCash(r[4].data ?? null);
      setProducts(r[5].data ?? []);
      setPartners(r[6].data ?? []);
      setCurrentShares(r[7].data ?? []);
      setBatchShares(r[8].data ?? []);
      setGroups(r[9].data ?? []);
      setGroupMembers(r[10].data ?? []);
      setGroupFunds(r[11].data ?? []);
      setGeneralFund(r[12].data ?? null);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : t('pb.buy.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const totalOf = (id: string) => totals.find(x => x.buy_batch_id === id);
  const itemsOf = (id: string) => items.filter(i => i.buy_batch_id === id);
  const extrasOf = (id: string) => extras.filter(e => e.buy_batch_id === id);

  // Business-wide: everything put in that has not yet gone out on stock.
  const available = cash ? Number(cash.invested_total) - Number(cash.spent_on_buys) : 0;

  // A batch spends from ONE pot: the picked group's fund, or the ungrouped fund
  // for a batch with no group. Keeping them separate is what stops the same
  // money being spent twice from two different places.
  const activeGroupId = groups.some(g => g.id === shareSource) ? shareSource : null;
  const fundAvailable = activeGroupId
    ? Number(groupFunds.find(f => f.share_group_id === activeGroupId)?.remaining ?? 0)
    : generalFund
      ? Number(generalFund.net_contributed) - Number(generalFund.spent)
      : 0;
  // While editing, this batch's own cost is already counted as spent in its pot,
  // so add it back before projecting — but only while it stays in that same pot.
  const editingSamePot = editing ? (editing.share_group_id ?? null) === activeGroupId : false;
  const availableForForm =
    fundAvailable + (editingSamePot ? Number(totalOf(editing!.id)?.total_cost ?? 0) : 0);

  const pageTotals = useMemo(() => ({
    count: batches.length,
    cost: totals.reduce((s, x) => s + Number(x.total_cost), 0),
    extra: totals.reduce((s, x) => s + Number(x.extra_total), 0),
  }), [batches, totals]);

  const pg = usePagination(batches);

  // ---- draft line maths -----------------------------------------------------
  const lineTotalOf = (d: ItemDraft) => {
    const explicit = parseFloat(d.line_total);
    if (!isNaN(explicit)) return explicit;
    const q = parseFloat(d.quantity), u = parseFloat(d.unit_cost);
    return !isNaN(q) && !isNaN(u) ? money(q * u) : 0;
  };
  const itemsSubtotal = itemDrafts.reduce((s, d) => s + lineTotalOf(d), 0);
  const extrasSubtotal = extraDrafts.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0);
  const batchTotal = money(itemsSubtotal + extrasSubtotal);

  const nameOfDraft = (d: ItemDraft) =>
    d.product_id === CUSTOM ? d.product_name.trim() : (products.find(p => p.id === d.product_id)?.name ?? '');

  const validItems = itemDrafts.filter(d => nameOfDraft(d) && lineTotalOf(d) >= 0 && (d.line_total !== '' || (d.quantity !== '' && d.unit_cost !== '')));
  const sharePercentTotal = shareInputs.reduce((s, x) => s + (parseFloat(x.percent) || 0), 0);
  const shareValid = shareInputs.length === 0 || Math.abs(sharePercentTotal - 100) < 0.01;
  const canSave = validItems.length > 0 && batchTotal > 0 && shareValid;

  const setItem = (i: number, patch: Partial<ItemDraft>) =>
    setItemDrafts(prev => prev.map((d, idx) => idx === i ? { ...d, ...patch } : d));
  const setExtra = (i: number, patch: Partial<ExtraDraft>) =>
    setExtraDrafts(prev => prev.map((d, idx) => idx === i ? { ...d, ...patch } : d));

  /** Share rows for a given preset/group, over the active partners. */
  const sharesFrom = (source: string): ShareInput[] => {
    const base = partners.map(p => ({ partner_id: p.id, name: p.name, percent: '0' }));

    if (source === SHARE_EQUAL) {
      const each = Math.floor((100 / Math.max(base.length, 1)) * 1000) / 1000;
      const remainder = Math.round((100 - each * base.length) * 1000) / 1000;
      return base.map((b, i) => ({ ...b, percent: String(Number(((i === 0 ? each + remainder : each)).toFixed(3))) }));
    }

    if (source === SHARE_CURRENT) {
      return base.map(b => ({
        ...b,
        percent: String(currentShares.find(s => s.partner_id === b.partner_id)?.share_percent ?? 0),
      }));
    }

    // A saved group: only its members carry a percentage, everyone else is 0.
    const mine = groupMembers.filter(m => m.share_group_id === source);
    return base.map(b => ({
      ...b,
      percent: String(mine.find(m => m.partner_id === b.partner_id)?.share_percent ?? 0),
    }));
  };

  const applyShareSource = (source: string) => {
    setShareSource(source);
    if (source !== SHARE_CUSTOM) setShareInputs(sharesFrom(source));
  };

  const openAdd = () => {
    setEditing(null);
    setTitle(''); setNote(''); setIsRemaining(true);
    setPurchasedAt(getDhakaDateString());
    setItemDrafts([blankItem()]);
    setExtraDrafts([]);
    setShareInputs(partners.map(p => ({
      partner_id: p.id,
      name: p.name,
      percent: String(currentShares.find(s => s.partner_id === p.id)?.share_percent ?? 0),
    })));
    setIsModalOpen(true);
  };

  const openEdit = (b: PbBuyBatch) => {
    setEditing(b);
    setTitle(b.title ?? ''); setNote(b.note ?? ''); setIsRemaining(b.is_remaining);
    setPurchasedAt(b.purchased_at);
    const its = itemsOf(b.id);
    setItemDrafts(its.length ? its.map(i => ({
      product_id: i.product_id ?? CUSTOM,
      product_name: i.product_name,
      unit: i.unit ?? '',
      quantity: i.quantity != null ? String(i.quantity) : '',
      unit_cost: i.unit_cost != null ? String(i.unit_cost) : '',
      line_total: String(i.line_total),
    })) : [blankItem()]);
    setExtraDrafts(extrasOf(b.id).map(e => ({ title: e.title, amount: String(e.amount) })));
    // Point the form at the pot this batch actually spends from, so the
    // available figure below is the right one.
    setShareSource(b.share_group_id ?? SHARE_CUSTOM);
    // Frozen snapshot, not today's shares.
    const frozen = batchShares.filter(s => s.buy_batch_id === b.id);
    setShareInputs(partners.map(p => ({
      partner_id: p.id,
      name: p.name,
      percent: String(frozen.find(s => s.partner_id === p.id)?.share_percent ?? 0),
    })));
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const header = {
        title: title.trim() || null,
        note: note.trim() || null,
        is_remaining: isRemaining,
        purchased_at: purchasedAt,
        share_group_id: groups.some(g => g.id === shareSource) ? shareSource : null,
        updated_at: new Date().toISOString(),
      };

      let batchId = editing?.id;
      if (editing) {
        const { error } = await supabase.from('pb_buy_batches').update(header).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('pb_buy_batches').insert([header]).select('id').single();
        if (error) throw error;
        batchId = data.id;
      }
      if (!batchId) throw new Error('No batch id');

      // Lines are replaced wholesale — simpler than diffing, and the batch is
      // the unit of meaning here, not the individual row.
      for (const table of ['pb_buy_batch_items', 'pb_buy_batch_extra_costs', 'pb_buy_batch_partner_shares']) {
        const { error } = await supabase.from(table).delete().eq('buy_batch_id', batchId);
        if (error) throw error;
      }

      const itemRows = validItems.map((d, idx) => ({
        buy_batch_id: batchId,
        product_id: d.product_id === CUSTOM ? null : d.product_id,
        product_name: nameOfDraft(d),
        unit: d.unit.trim() || null,
        quantity: d.quantity ? Number(d.quantity) : null,
        unit_cost: d.unit_cost ? Number(d.unit_cost) : null,
        line_total: money(lineTotalOf(d)),
        sort_order: idx,
      }));
      const { error: itemError } = await supabase.from('pb_buy_batch_items').insert(itemRows);
      if (itemError) throw itemError;

      const extraRows = extraDrafts
        .filter(d => d.title.trim() && (parseFloat(d.amount) || 0) > 0)
        .map((d, idx) => ({ buy_batch_id: batchId, title: d.title.trim(), amount: Number(d.amount), sort_order: idx }));
      if (extraRows.length) {
        const { error } = await supabase.from('pb_buy_batch_extra_costs').insert(extraRows);
        if (error) throw error;
      }

      const activeShares = shareInputs
        .map(s => ({ ...s, share_percent: parseFloat(s.percent) || 0 }))
        .filter(s => s.share_percent > 0);
      if (activeShares.length) {
        const rows = splitByShares(batchTotal, activeShares).map(s => ({
          buy_batch_id: batchId,
          partner_id: s.partner_id,
          share_percent: s.share_percent,
          invested_amount: s.amount,
        }));
        const { error } = await supabase.from('pb_buy_batch_partner_shares').insert(rows);
        if (error) throw error;
      }

      await fetchAll();
      setIsModalOpen(false);
      toast.success(editing ? t('pb.buy.updated') : t('pb.buy.added'));
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : t('pb.buy.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('pb_buy_batches').delete().eq('id', toDelete.id);
      if (error) throw error;
      await fetchAll();
      setToDelete(null);
      toast.success(t('pb.buy.deleted'));
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : t('pb.buy.deleteError'));
    } finally {
      setDeleting(false);
    }
  };

  const partnerName = (id: string) => partners.find(p => p.id === id)?.name ?? '—';

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">{t('pb.buy.title')}</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{t('pb.buy.subtitle')}</p>
        </div>
        <Button onClick={openAdd}>
          <Plus size={18} className="mr-2" /> {t('pb.buy.add')}
        </Button>
      </div>

      <SummaryBar
        items={[
          { label: t('pb.buy.batches'), value: pageTotals.count },
          { label: t('pb.common.buyCost'), value: formatTaka(pageTotals.cost), tone: 'text-danger' },
          { label: t('pb.buy.extraCost'), value: formatTaka(pageTotals.extra) },
          { label: t('pb.common.invested'), value: formatTaka(Number(cash?.invested_total ?? 0)) },
          { label: t('pb.buy.available'), value: formatTaka(available), tone: available >= 0 ? 'text-success' : 'text-danger' },
        ]}
      />

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500 font-medium">{t('pb.common.loading')}</div>
        ) : batches.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingCart size={32} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{t('pb.buy.emptyTitle')}</h3>
            <p className="text-gray-500 mt-2 mb-6">{t('pb.buy.emptyBody')}</p>
            <Button onClick={openAdd}>{t('pb.buy.add')}</Button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                    <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm">{t('pb.common.date')}</th>
                    <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm">{t('pb.buy.batchLabel')}</th>
                    <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm text-right">{t('pb.buy.items')}</th>
                    <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm text-right">{t('pb.buy.extraCost')}</th>
                    <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm text-right">{t('pb.common.total')}</th>
                    <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm text-right">{t('pb.common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {pg.pageRows.map(b => {
                    const tot = totalOf(b.id);
                    const its = itemsOf(b.id);
                    return (
                      <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="p-4 text-gray-900 dark:text-gray-100 font-medium whitespace-nowrap">
                          {format(new Date(b.purchased_at), 'MMM d, yyyy')}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-gray-900 dark:text-gray-100">
                              {b.title || its.map(i => i.product_name).join(', ') || '—'}
                            </span>
                            {!b.is_remaining && <Badge variant="warning">{t('pb.products.outOfStock')}</Badge>}
                          </div>
                          {b.note && <div className="text-xs text-gray-500 mt-0.5">{b.note}</div>}
                        </td>
                        <td className="p-4 text-right text-gray-700 dark:text-gray-300">
                          {its.length} · {formatTaka(Number(tot?.items_total ?? 0))}
                        </td>
                        <td className="p-4 text-right text-gray-700 dark:text-gray-300">{formatTaka(Number(tot?.extra_total ?? 0))}</td>
                        <td className="p-4 text-right font-medium text-gray-900 dark:text-gray-100">{formatTaka(Number(tot?.total_cost ?? 0))}</td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => setDetailOf(b)} title={t('pb.buy.viewShares')}>
                              <Users size={16} />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => openEdit(b)} title={t('pb.common.edit')}>
                              <Pencil size={16} />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setToDelete(b)} title={t('pb.common.delete')}>
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

      {/* ---------------- add / edit ---------------- */}
      <Modal isOpen={isModalOpen} onClose={() => !saving && setIsModalOpen(false)} title={editing ? t('pb.buy.editTitle') : t('pb.buy.addTitle')} className="max-w-3xl">
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input label={t('pb.buy.batchLabel')} value={title} onChange={e => setTitle(e.target.value)} placeholder={t('pb.buy.batchPlaceholder')} />
            <Input label={t('pb.common.date')} type="date" value={purchasedAt} onChange={e => setPurchasedAt(e.target.value)} />
            <Input label={t('pb.common.note')} value={note} onChange={e => setNote(e.target.value)} />
          </div>

          {/* products */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('pb.buy.products')}</span>
              <Button size="sm" variant="outline" onClick={() => setItemDrafts(prev => [...prev, blankItem()])}>
                <Plus size={14} className="mr-1" /> {t('pb.buy.addProduct')}
              </Button>
            </div>
            <div className="space-y-2">
              {itemDrafts.map((d, i) => (
                <div key={i} className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)_minmax(0,1fr)_minmax(0,2fr)_minmax(0,2fr)_minmax(0,2fr)_auto] gap-2 items-center">
                  <select value={d.product_id} onChange={e => setItem(i, { product_id: e.target.value })} className={inputClass}>
                    <option value={CUSTOM}>{t('pb.common.customProduct')}</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  {d.product_id === CUSTOM ? (
                    <input value={d.product_name} onChange={e => setItem(i, { product_name: e.target.value })} placeholder={t('pb.common.productName')} className={inputClass} />
                  ) : <div />}
                  <input value={d.unit} onChange={e => setItem(i, { unit: e.target.value })} placeholder={t('pb.common.unit')} className={inputClass} />
                  <input type="number" value={d.quantity} onChange={e => setItem(i, { quantity: e.target.value })} placeholder={t('pb.common.quantity')} className={`${inputClass} text-right`} />
                  <input type="number" value={d.unit_cost} onChange={e => setItem(i, { unit_cost: e.target.value })} placeholder={t('pb.common.unitCost')} className={`${inputClass} text-right`} />
                  <input type="number" value={d.line_total} onChange={e => setItem(i, { line_total: e.target.value })} placeholder={formatTaka(lineTotalOf(d))} className={`${inputClass} text-right`} />
                  <button
                    onClick={() => setItemDrafts(prev => prev.length === 1 ? [blankItem()] : prev.filter((_, idx) => idx !== i))}
                    title={t('pb.common.delete')}
                    className="px-1 flex items-center justify-center text-gray-400 hover:text-danger transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{t('pb.buy.lineHint')}</p>
          </div>

          {/* extra costs */}
          <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('pb.buy.extraCosts')}</span>
              <Button size="sm" variant="outline" onClick={() => setExtraDrafts(prev => [...prev, blankExtra()])}>
                <Plus size={14} className="mr-1" /> {t('pb.buy.addExtraCost')}
              </Button>
            </div>
            {extraDrafts.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('pb.buy.noExtraCosts')}</p>
            ) : (
              <div className="space-y-2">
                {extraDrafts.map((d, i) => (
                  <div key={i} className="grid grid-cols-[minmax(0,1fr)_10rem_auto] gap-2 items-center">
                    <input value={d.title} onChange={e => setExtra(i, { title: e.target.value })} placeholder={t('pb.buy.costTitlePlaceholder')} className={inputClass} />
                    <input type="number" value={d.amount} onChange={e => setExtra(i, { amount: e.target.value })} placeholder={t('pb.common.amount')} className={`${inputClass} text-right`} />
                    <button onClick={() => setExtraDrafts(prev => prev.filter((_, idx) => idx !== i))} title={t('pb.common.delete')} className="px-1 flex items-center justify-center text-gray-400 hover:text-danger transition-colors">
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{t('pb.buy.extraHint')}</p>
          </div>

          {/* totals */}
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 space-y-1 text-sm">
            <div className="flex justify-between text-gray-500"><span>{t('pb.buy.itemsSubtotal')}</span><span>{formatTaka(itemsSubtotal)}</span></div>
            <div className="flex justify-between text-gray-500"><span>{t('pb.buy.extraCost')}</span><span>{formatTaka(extrasSubtotal)}</span></div>
            <div className="flex justify-between font-semibold text-gray-900 dark:text-white pt-1 border-t border-gray-200 dark:border-gray-700">
              <span>{t('pb.common.total')}</span><span>{formatTaka(batchTotal)}</span>
            </div>
            <div className="flex justify-between text-xs pt-1">
              <span className="text-gray-500">
                {t('pb.buy.available')}
                <span className="text-xs text-gray-400 ml-1.5">
                  {activeGroupId
                    ? groups.find(g => g.id === activeGroupId)?.name
                    : t('pb.buy.generalFund')}
                </span>
              </span>
              <span className={availableForForm - batchTotal < 0 ? 'text-danger font-semibold' : 'text-gray-500'}>
                {formatTaka(availableForForm)} → {formatTaka(availableForForm - batchTotal)}
              </span>
            </div>
            {availableForForm - batchTotal < 0 && <p className="text-xs text-danger pt-1">{t('pb.buy.overInvestment')}</p>}
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isRemaining} onChange={e => setIsRemaining(e.target.checked)} className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary" />
            <span className="text-sm text-gray-700 dark:text-gray-300">{t('pb.buy.stillInStock')}</span>
          </label>

          {/* partner share */}
          {shareInputs.length > 0 && (
            <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('pb.buy.partnerShare')}</span>
                <span className={`text-xs font-semibold ${shareValid ? 'text-success' : 'text-danger'}`}>{sharePercentTotal.toFixed(2)}%</span>
              </div>

              <select
                value={shareSource}
                onChange={e => applyShareSource(e.target.value)}
                className={`${inputClass} h-10 mb-2`}
              >
                <option value={SHARE_CURRENT}>{t('pb.buy.shareCurrent')}</option>
                <option value={SHARE_EQUAL}>{t('pb.buy.shareEqual')}</option>
                {groups.length > 0 && (
                  <optgroup label={t('pb.groups.title')}>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </optgroup>
                )}
                <option value={SHARE_CUSTOM}>{t('pb.buy.shareCustom')}</option>
              </select>

              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{t('pb.buy.shareHint')}</p>
              <div className="space-y-2">
                {shareInputs.map((s, i) => (
                  <div key={s.partner_id} className="flex items-center gap-3">
                    <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">{s.name}</span>
                    <input
                      type="number"
                      value={s.percent}
                      onChange={e => { setShareSource(SHARE_CUSTOM); setShareInputs(prev => prev.map((p, idx) => idx === i ? { ...p, percent: e.target.value } : p)); }}
                      className={`${inputBase} w-20 text-right`}
                    />
                    <span className="text-xs text-gray-500 w-24 text-right">
                      {formatTaka(money((batchTotal * (parseFloat(s.percent) || 0)) / 100))}
                    </span>
                  </div>
                ))}
              </div>
              {!shareValid && <p className="text-xs text-danger mt-2">{t('pb.buy.shareMustBe100')}</p>}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)} disabled={saving}>{t('pb.common.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving || !canSave}>{saving ? t('pb.common.saving') : t('pb.common.save')}</Button>
          </div>
        </div>
      </Modal>

      {/* ---------------- detail ---------------- */}
      <Modal isOpen={!!detailOf} onClose={() => setDetailOf(null)} title={t('pb.buy.sharesTitle')} className="max-w-lg">
        {detailOf && (
          <div className="space-y-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">{t('pb.buy.products')}</div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700 border border-gray-100 dark:border-gray-700 rounded-lg">
                {itemsOf(detailOf.id).map(i => (
                  <div key={i.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="text-gray-900 dark:text-gray-100">{i.product_name}</span>
                    <span className="text-gray-500 text-xs">
                      {i.quantity != null ? `${Number(i.quantity)} ${i.unit ?? ''}` : ''}
                      {i.unit_cost != null ? ` × ${formatTaka(Number(i.unit_cost))}` : ''}
                    </span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{formatTaka(Number(i.line_total))}</span>
                  </div>
                ))}
              </div>
            </div>

            {extrasOf(detailOf.id).length > 0 && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">{t('pb.buy.extraCosts')}</div>
                <div className="divide-y divide-gray-100 dark:divide-gray-700 border border-gray-100 dark:border-gray-700 rounded-lg">
                  {extrasOf(detailOf.id).map(e => (
                    <div key={e.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className="text-gray-900 dark:text-gray-100">{e.title}</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{formatTaka(Number(e.amount))}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">{t('pb.buy.partnerShare')}</div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{t('pb.buy.sharesHint')}</p>
              {batchShares.filter(s => s.buy_batch_id === detailOf.id).length === 0 ? (
                <p className="text-sm text-gray-500">{t('pb.buy.noShares')}</p>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-700 border border-gray-100 dark:border-gray-700 rounded-lg">
                  {batchShares.filter(s => s.buy_batch_id === detailOf.id).map(s => (
                    <div key={s.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className="text-gray-900 dark:text-gray-100">{partnerName(s.partner_id)}</span>
                      <span className="text-gray-500">{Number(s.share_percent)}%</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{formatTaka(Number(s.invested_amount))}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-gray-100 dark:border-gray-700">
              <Button variant="ghost" onClick={() => setDetailOf(null)}>{t('pb.common.close')}</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={!!toDelete} onClose={() => !deleting && setToDelete(null)} title={t('pb.buy.deleteTitle')}>
        {toDelete && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-danger/5 border border-danger/20 rounded-lg p-4">
              <AlertTriangle size={20} className="text-danger shrink-0 mt-0.5" />
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {t('pb.buy.deleteWarn')} <span className="font-semibold">{toDelete.title || itemsOf(toDelete.id).map(i => i.product_name).join(', ')}</span> — {formatTaka(Number(totalOf(toDelete.id)?.total_cost ?? 0))}
              </p>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('pb.buy.deleteHint')}</p>
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
