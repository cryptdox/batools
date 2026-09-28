import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { Button, Badge } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { formatTaka } from '../ui/SummaryBar';
import { Pagination, usePagination } from '../ui/Pagination';
import { toast } from 'react-toastify';
import { Plus, Pencil, Trash2, AlertTriangle, Users2, Equal, Wallet, Undo2 } from 'lucide-react';
import { GroupFundModal, type FundMode } from './GroupFundModal';
import type {
  PbPartner, PbShareGroup, PbShareGroupMember, PbShareGroupSummary,
  PbShareGroupFund, PbShareGroupPartnerFund, PbPartnerFreeCapital, PbGeneralFund,
} from '../../types/partnerBusiness';

type MemberDraft = { partner_id: string; name: string; included: boolean; percent: string };

const inputBase = 'h-9 rounded-md border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:border-gray-700 dark:bg-gray-900 dark:text-gray-50';

interface Props {
  partners: PbPartner[];
  /** Invested capital moves between pots, so the page's figures reload too. */
  onFundChanged: () => void;
}

export const ShareGroupsCard = ({ partners, onFundChanged }: Props) => {
  const { t } = useLanguage();
  const [groups, setGroups] = useState<PbShareGroup[]>([]);
  const [members, setMembers] = useState<PbShareGroupMember[]>([]);
  const [summary, setSummary] = useState<PbShareGroupSummary[]>([]);
  const [funds, setFunds] = useState<PbShareGroupFund[]>([]);
  const [partnerFunds, setPartnerFunds] = useState<PbShareGroupPartnerFund[]>([]);
  const [freeCapital, setFreeCapital] = useState<PbPartnerFreeCapital[]>([]);
  const [general, setGeneral] = useState<PbGeneralFund | null>(null);
  const [loading, setLoading] = useState(true);

  const [fundMode, setFundMode] = useState<FundMode>('ADD');
  const [fundGroup, setFundGroup] = useState<PbShareGroup | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<PbShareGroup | null>(null);
  const [name, setName] = useState('');
  const [drafts, setDrafts] = useState<MemberDraft[]>([]);
  const [saving, setSaving] = useState(false);

  const [toDelete, setToDelete] = useState<PbShareGroup | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [g, m, s, f, pf, fc, gen] = await Promise.all([
        supabase.from('pb_share_groups').select('*').order('name'),
        supabase.from('pb_share_group_members').select('*'),
        supabase.from('pb_share_group_summary').select('*'),
        supabase.from('pb_share_group_fund').select('*'),
        supabase.from('pb_share_group_partner_fund').select('*'),
        supabase.from('pb_partner_free_capital').select('*'),
        supabase.from('pb_general_fund').select('*').single(),
      ]);
      for (const r of [g, m, s, f, pf, fc, gen]) if (r.error) throw r.error;
      setGroups(g.data ?? []);
      setMembers(m.data ?? []);
      setSummary(s.data ?? []);
      setFunds(f.data ?? []);
      setPartnerFunds(pf.data ?? []);
      setFreeCapital(fc.data ?? []);
      setGeneral(gen.data ?? null);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : t('pb.groups.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const summaryOf = (id: string) => summary.find(s => s.share_group_id === id);
  const fundOf = (id: string) => funds.find(f => f.share_group_id === id);

  const openFund = (g: PbShareGroup, mode: FundMode) => { setFundGroup(g); setFundMode(mode); };
  const memberNames = (id: string) =>
    members.filter(m => m.share_group_id === id)
      .map(m => `${partners.find(p => p.id === m.partner_id)?.name ?? '—'} ${Number(m.share_percent)}%`)
      .join(' · ');

  const included = drafts.filter(d => d.included);
  const percentTotal = included.reduce((s, d) => s + (parseFloat(d.percent) || 0), 0);
  const valid = name.trim() !== '' && included.length > 0 && Math.abs(percentTotal - 100) < 0.01;

  const setDraft = (i: number, patch: Partial<MemberDraft>) =>
    setDrafts(prev => prev.map((d, idx) => idx === i ? { ...d, ...patch } : d));

  /** Spreads 100% evenly over whoever is ticked, remainder onto the first. */
  const splitEqually = () => {
    const chosen = drafts.filter(d => d.included);
    if (chosen.length === 0) return;
    const each = Math.floor((100 / chosen.length) * 1000) / 1000;
    const remainder = Math.round((100 - each * chosen.length) * 1000) / 1000;
    let first = true;
    setDrafts(prev => prev.map(d => {
      if (!d.included) return { ...d, percent: '' };
      const value = first ? each + remainder : each;
      first = false;
      return { ...d, percent: String(Number(value.toFixed(3))) };
    }));
  };

  const openAdd = () => {
    setEditing(null);
    setName('');
    setDrafts(partners.filter(p => p.is_active).map(p => ({ partner_id: p.id, name: p.name, included: false, percent: '' })));
    setIsOpen(true);
  };

  const openEdit = (g: PbShareGroup) => {
    setEditing(g);
    setName(g.name);
    const mine = members.filter(m => m.share_group_id === g.id);
    setDrafts(partners.filter(p => p.is_active || mine.some(m => m.partner_id === p.id)).map(p => {
      const m = mine.find(x => x.partner_id === p.id);
      return { partner_id: p.id, name: p.name, included: !!m, percent: m ? String(Number(m.share_percent)) : '' };
    }));
    setIsOpen(true);
  };

  const handleSave = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      let groupId = editing?.id;
      const payload = { name: name.trim(), updated_at: new Date().toISOString() };
      if (editing) {
        const { error } = await supabase.from('pb_share_groups').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('pb_share_groups').insert([payload]).select('id').single();
        if (error) throw error;
        groupId = data.id;
      }
      if (!groupId) throw new Error('No group id');

      const { error: delError } = await supabase.from('pb_share_group_members').delete().eq('share_group_id', groupId);
      if (delError) throw delError;

      const { error: insError } = await supabase.from('pb_share_group_members').insert(
        included.map(d => ({ share_group_id: groupId, partner_id: d.partner_id, share_percent: parseFloat(d.percent) || 0 }))
      );
      if (insError) throw insError;

      await fetchAll();
      setIsOpen(false);
      toast.success(editing ? t('pb.groups.updated') : t('pb.groups.added'));
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : t('pb.groups.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('pb_share_groups').delete().eq('id', toDelete.id);
      if (error) throw error;
      await fetchAll();
      setToDelete(null);
      toast.success(t('pb.groups.deleted'));
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : t('pb.groups.deleteError'));
    } finally {
      setDeleting(false);
    }
  };

  const sorted = useMemo(() => [...groups].sort((a, b) => a.name.localeCompare(b.name)), [groups]);
  const pg = usePagination(sorted);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">{t('pb.groups.all')}</h3>
        <Button size="sm" onClick={openAdd} disabled={partners.filter(p => p.is_active).length === 0}>
          <Plus size={16} className="mr-1.5" /> {t('pb.groups.add')}
        </Button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-500 text-sm">{t('pb.common.loading')}</div>
      ) : sorted.length === 0 ? (
        <div className="p-8 text-center">
          <Users2 size={28} className="text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500">{t('pb.groups.empty')}</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {pg.pageRows.map(g => {
            const s = summaryOf(g.id);
            const f = fundOf(g.id);
            const fundRemaining = Number(f?.remaining ?? 0);
            const pct = Number(s?.total_percent ?? 0);
            return (
              <div key={g.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-gray-100">{g.name}</span>
                    <Badge variant={Math.abs(pct - 100) < 0.01 ? 'default' : 'danger'}>{pct}%</Badge>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 truncate">{memberNames(g.id) || t('pb.groups.noMembers')}</div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-xs text-gray-500">{t('pb.groups.groupBalance')}</div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatTaka(Number(s?.group_balance ?? 0))}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">{t('pb.groups.fundRemaining')}</div>
                    <div className={`text-sm font-semibold ${fundRemaining < 0 ? 'text-danger' : 'text-gray-900 dark:text-gray-100'}`}>
                      {formatTaka(fundRemaining)}
                    </div>
                    <div className="text-[11px] text-gray-400">
                      {t('pb.groups.fundBreakdown')
                        .replace('{in}', formatTaka(Number(f?.net_allocated ?? 0)))
                        .replace('{out}', formatTaka(Number(f?.spent ?? 0)))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openFund(g, 'ADD')} title={t('pb.groups.fundAdd')}><Wallet size={16} /></Button>
                    <Button variant="ghost" size="sm" onClick={() => openFund(g, 'RETURN')} disabled={fundRemaining <= 0} title={t('pb.groups.fundReturn')}><Undo2 size={16} /></Button>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(g)} title={t('pb.common.edit')}><Pencil size={16} /></Button>
                    <Button variant="ghost" size="sm" onClick={() => setToDelete(g)} title={t('pb.common.delete')}><Trash2 size={16} className="text-danger" /></Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && sorted.length > 0 && (
        <Pagination
          page={pg.page} pageCount={pg.pageCount} total={pg.total} pageSize={pg.pageSize}
          onPageChange={pg.setPage} onPageSizeChange={pg.setPageSize}
        />
      )}

      <Modal isOpen={isOpen} onClose={() => !saving && setIsOpen(false)} title={editing ? t('pb.groups.editTitle') : t('pb.groups.addTitle')} className="max-w-lg">
        <div className="space-y-4">
          <Input label={t('pb.common.name')} value={name} onChange={e => setName(e.target.value)} placeholder={t('pb.groups.namePlaceholder')} autoFocus />

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('pb.groups.members')}</span>
              <Button size="sm" variant="outline" onClick={splitEqually} disabled={included.length === 0}>
                <Equal size={14} className="mr-1.5" /> {t('pb.groups.equalSplit')}
              </Button>
            </div>
            <div className="space-y-2">
              {drafts.map((d, i) => (
                <div key={d.partner_id} className="flex items-center gap-3">
                  <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={d.included}
                      onChange={e => setDraft(i, { included: e.target.checked, percent: e.target.checked ? d.percent : '' })}
                      className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{d.name}</span>
                  </label>
                  <input
                    type="number"
                    value={d.percent}
                    disabled={!d.included}
                    onChange={e => setDraft(i, { percent: e.target.value })}
                    className={`${inputBase} w-20 text-right disabled:opacity-40`}
                  />
                  <span className="text-xs text-gray-500 w-3">%</span>
                </div>
              ))}
            </div>
            <div className={`flex justify-between text-sm font-semibold mt-3 ${Math.abs(percentTotal - 100) < 0.01 ? 'text-success' : 'text-danger'}`}>
              <span>{t('pb.common.shareTotal')}</span>
              <span>{percentTotal.toFixed(2)}%</span>
            </div>
            {included.length > 0 && Math.abs(percentTotal - 100) >= 0.01 && (
              <p className="text-xs text-danger mt-1">{t('pb.groups.mustBe100')}</p>
            )}
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400">{t('pb.groups.hint')}</p>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
            <Button variant="ghost" onClick={() => setIsOpen(false)} disabled={saving}>{t('pb.common.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving || !valid}>{saving ? t('pb.common.saving') : t('pb.common.save')}</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!toDelete} onClose={() => !deleting && setToDelete(null)} title={t('pb.groups.deleteTitle')}>
        {toDelete && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-danger/5 border border-danger/20 rounded-lg p-4">
              <AlertTriangle size={20} className="text-danger shrink-0 mt-0.5" />
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {t('pb.groups.deleteWarn')} <span className="font-semibold">{toDelete.name}</span>
              </p>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('pb.groups.deleteHint')}</p>
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
              <Button variant="ghost" onClick={() => setToDelete(null)} disabled={deleting}>{t('pb.common.cancel')}</Button>
              <Button variant="danger" onClick={handleDelete} disabled={deleting}>{deleting ? t('pb.common.deleting') : t('pb.common.delete')}</Button>
            </div>
          </div>
        )}
      </Modal>
      <GroupFundModal
        isOpen={!!fundGroup}
        mode={fundMode}
        group={fundGroup}
        members={members}
        partners={partners}
        freeCapital={freeCapital}
        generalRemaining={Number(general?.remaining ?? 0)}
        fund={fundGroup ? fundOf(fundGroup.id) : undefined}
        partnerFund={partnerFunds}
        onClose={() => setFundGroup(null)}
        onSaved={() => { fetchAll(); onFundChanged(); }}
      />

    </div>
  );
};
