import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Button';
import { formatTaka } from '../ui/SummaryBar';
import { getDhakaDateString } from '../../lib/dhakaTime';
import { money } from '../../lib/partnerBusiness';
import type {
  PbPartner, PbShareGroup, PbShareGroupMember,
  PbShareGroupFund, PbShareGroupPartnerFund, PbPartnerFreeCapital,
} from '../../types/partnerBusiness';

export type FundMode = 'ADD' | 'RETURN';

interface Props {
  isOpen: boolean;
  mode: FundMode;
  group: PbShareGroup | null;
  members: PbShareGroupMember[];
  partners: PbPartner[];
  /** Advisory only — a partner's free capital may already read negative. */
  freeCapital: PbPartnerFreeCapital[];
  /** Ceiling when filling the pot: invested capital no group is holding. */
  generalRemaining: number;
  fund: PbShareGroupFund | undefined;
  partnerFund: PbShareGroupPartnerFund[];
  onClose: () => void;
  onSaved: () => void;
}

/**
 * `ceiling` caps the row; `context` is the figure shown beside it (free capital
 * when filling, what they hold in this pot when handing back).
 */
type Row = {
  partner_id: string;
  name: string;
  amount: string;
  ceiling: number | null;
  context: number;
  isMember: boolean;
};

const inputBase =
  'h-9 rounded-md border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:border-gray-700 dark:bg-gray-900 dark:text-gray-50';

export const GroupFundModal = ({
  isOpen, mode, group, members, partners, freeCapital, generalRemaining, fund, partnerFund, onClose, onSaved,
}: Props) => {
  const { t } = useLanguage();
  const [rows, setRows] = useState<Row[]>([]);
  const [txnDate, setTxnDate] = useState(getDhakaDateString());
  const [saving, setSaving] = useState(false);

  const isAdd = mode === 'ADD';
  const remaining = Number(fund?.remaining ?? 0);

  /**
   * Amounts are typed per partner, never derived from a percentage. Who puts
   * money behind a batch is not the same question as who owns what share of it
   * — only PROFIT follows the share percent. The same goes in reverse: what a
   * partner gets back is what they choose to take out, capped at what they
   * still hold in this pot.
   */
  const basis = useMemo<Row[]>(() => {
    if (!group) return [];
    const memberIds = new Set(members.filter(m => m.share_group_id === group.id).map(m => m.partner_id));

    if (isAdd) {
      // Every active partner, not just members: in practice one partner often
      // fronts the cash for a batch the others own a share of.
      return partners.map(p => ({
        partner_id: p.id,
        name: p.name,
        amount: '',
        ceiling: null,
        context: Number(freeCapital.find(f => f.partner_id === p.id)?.free_capital ?? 0),
        isMember: memberIds.has(p.id),
      }));
    }

    return partnerFund
      .filter(f => f.share_group_id === group.id && Number(f.net_allocated) > 0)
      .map(f => ({
        partner_id: f.partner_id,
        name: f.partner_name,
        amount: '',
        ceiling: Number(f.net_allocated),
        context: Number(f.net_allocated),
        isMember: memberIds.has(f.partner_id),
      }));
  }, [group, isAdd, members, partners, freeCapital, partnerFund]);

  useEffect(() => {
    if (!isOpen) return;
    setRows(basis);
    setTxnDate(getDhakaDateString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, mode, group?.id]);

  const setRowAmount = (i: number, value: string) =>
    setRows(prev => prev.map((r, idx) => (idx === i ? { ...r, amount: value } : r)));

  const rowsTotal = money(rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0));
  // Filling draws on the general pot; handing back is limited by this pot.
  const cap = isAdd ? generalRemaining : remaining;
  const overCap = rowsTotal > cap + 0.001;
  const overCeiling = rows.filter(r => r.ceiling !== null && (parseFloat(r.amount) || 0) > r.ceiling);
  // Soft: ungrouped batches were split by ownership rather than by who advanced
  // the cash, so a partner's free capital can already be negative.
  const lowFree = isAdd ? rows.filter(r => (parseFloat(r.amount) || 0) > r.context) : [];
  const canSave = !!group && rowsTotal > 0 && !overCap && overCeiling.length === 0;

  const handleSave = async () => {
    if (!group || !canSave) return;
    setSaving(true);
    try {
      const payload = rows
        .filter(r => (parseFloat(r.amount) || 0) > 0)
        .map(r => ({
          share_group_id: group.id,
          partner_id: r.partner_id,
          // Sign is the direction: into the group, or back to the general pot.
          amount: isAdd ? Number(r.amount) : -Number(r.amount),
          allocated_at: txnDate,
          note: isAdd ? t('pb.groups.fundAdd') : t('pb.groups.fundReturn'),
        }));
      const { error } = await supabase.from('pb_group_fund_allocations').insert(payload);
      if (error) throw error;
      toast.success(isAdd ? t('pb.groups.fundAdded') : t('pb.groups.fundReturned'));
      onSaved();
      onClose();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : t('pb.groups.fundError'));
    } finally {
      setSaving(false);
    }
  };

  const fillMax = () =>
    setRows(prev => prev.map(r => (r.ceiling !== null ? { ...r, amount: String(r.ceiling) } : r)));

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !saving && onClose()}
      title={`${isAdd ? t('pb.groups.fundAddTitle') : t('pb.groups.fundReturnTitle')}${group ? ` — ${group.name}` : ''}`}
      className="max-w-lg"
    >
      <div className="space-y-4">
        <div className="rounded-lg bg-gray-50 dark:bg-gray-900/50 px-3 py-2 space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">
              {isAdd ? t('pb.groups.generalAvailable') : t('pb.groups.fundRemaining')}
            </span>
            <span className={`font-semibold ${cap < 0 ? 'text-danger' : 'text-gray-900 dark:text-gray-100'}`}>
              {formatTaka(cap)}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {isAdd ? t('pb.groups.fromInvested') : t('pb.groups.backToInvested')}
          </p>
        </div>

        <Input label={t('pb.common.date')} type="date" value={txnDate} onChange={e => setTxnDate(e.target.value)} />

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('pb.groups.perPartner')}</span>
            {!isAdd && rows.length > 0 && (
              <Button size="sm" variant="outline" onClick={fillMax}>{t('pb.groups.fillMax')}</Button>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            {isAdd ? t('pb.groups.addHint') : t('pb.groups.returnHint')}
          </p>

          {rows.length === 0 ? (
            <p className="text-sm text-gray-500">{isAdd ? t('pb.groups.noMembers') : t('pb.groups.nothingToReturn')}</p>
          ) : (
            <div className="space-y-2">
              {rows.map((r, i) => {
                const over = r.ceiling !== null && (parseFloat(r.amount) || 0) > r.ceiling;
                return (
                  <div key={r.partner_id} className="flex items-center gap-3">
                    <span className="flex-1 flex items-center gap-1.5 min-w-0 text-sm text-gray-700 dark:text-gray-300">
                      <span className="truncate">{r.name}</span>
                      {isAdd && r.isMember && <Badge variant="default">{t('pb.groups.memberTag')}</Badge>}
                    </span>
                    <input
                      type="number"
                      value={r.amount}
                      placeholder="0"
                      onChange={e => setRowAmount(i, e.target.value)}
                      className={`${inputBase} w-28 text-right ${over ? 'border-danger' : ''}`}
                    />
                    <span className={`text-xs w-36 text-right ${r.context < 0 ? 'text-danger' : 'text-gray-500'}`}>
                      {isAdd
                        ? `${t('pb.groups.free')} ${formatTaka(r.context)}`
                        : `${t('pb.groups.inPot')} ${formatTaka(r.context)}`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between text-sm pt-3 mt-2 border-t border-gray-100 dark:border-gray-700">
            <span className="text-gray-500">{t('pb.groups.splitTotal')}</span>
            <span className={`font-semibold ${overCap ? 'text-danger' : 'text-gray-900 dark:text-gray-100'}`}>
              {formatTaka(rowsTotal)}
            </span>
          </div>
          {overCap && (
            <p className="text-xs text-danger mt-1">
              {isAdd ? t('pb.groups.overGeneral') : t('pb.groups.overRemaining')}
            </p>
          )}
          {overCeiling.length > 0 && (
            <p className="text-xs text-danger mt-1">
              {t('pb.groups.overContributed').replace('{names}', overCeiling.map(r => r.name).join(', '))}
            </p>
          )}
          {lowFree.length > 0 && !overCap && (
            <p className="text-xs text-warning mt-1">
              {t('pb.groups.lowFree').replace('{names}', lowFree.map(r => r.name).join(', '))}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
          <Button variant="ghost" onClick={onClose} disabled={saving}>{t('pb.common.cancel')}</Button>
          <Button onClick={handleSave} disabled={!canSave || saving}>
            {saving ? t('pb.common.saving') : t('pb.common.save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
