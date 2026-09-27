import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { Equal } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { formatTaka } from '../ui/SummaryBar';
import { getDhakaDateString } from '../../lib/dhakaTime';
import { money, splitByShares } from '../../lib/partnerBusiness';
import type {
  PbPartner, PbPartnerAccount, PbShareGroup, PbShareGroupMember,
  PbShareGroupFund, PbShareGroupPartnerFund,
} from '../../types/partnerBusiness';

export type FundMode = 'ADD' | 'RETURN';

interface Props {
  isOpen: boolean;
  mode: FundMode;
  group: PbShareGroup | null;
  members: PbShareGroupMember[];
  partners: PbPartner[];
  accounts: PbPartnerAccount[];
  fund: PbShareGroupFund | undefined;
  partnerFund: PbShareGroupPartnerFund[];
  onClose: () => void;
  onSaved: () => void;
}

type Row = { partner_id: string; name: string; amount: string; ceiling: number | null };

const inputBase =
  'h-9 rounded-md border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:border-gray-700 dark:bg-gray-900 dark:text-gray-50';

export const GroupFundModal = ({
  isOpen, mode, group, members, partners, accounts, fund, partnerFund, onClose, onSaved,
}: Props) => {
  const { t } = useLanguage();
  const [total, setTotal] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [txnDate, setTxnDate] = useState(getDhakaDateString());
  const [saving, setSaving] = useState(false);

  const isAdd = mode === 'ADD';
  const remaining = Number(fund?.remaining ?? 0);

  /**
   * Who takes part, and the weight their default amount is split by.
   *
   * Adding: the group's members, weighted by the group's share percent.
   * Giving back: whoever actually has money in this fund, weighted by what
   * they put in — NOT by share percent, because capital returns to whoever
   * advanced it.
   */
  const basis = useMemo(() => {
    if (!group) return [] as { partner_id: string; name: string; weight: number; ceiling: number | null }[];

    if (isAdd) {
      return members
        .filter(m => m.share_group_id === group.id)
        .map(m => ({
          partner_id: m.partner_id,
          name: partners.find(p => p.id === m.partner_id)?.name ?? '—',
          weight: Number(m.share_percent),
          // A partner cannot put in more than they hold.
          ceiling: Number(accounts.find(a => a.partner_id === m.partner_id)?.balance ?? 0),
        }));
    }

    return partnerFund
      .filter(f => f.share_group_id === group.id && Number(f.net_contributed) > 0)
      .map(f => ({
        partner_id: f.partner_id,
        name: f.partner_name,
        weight: Number(f.net_contributed),
        // Nobody can be handed back more than they still have in.
        ceiling: Number(f.net_contributed),
      }));
  }, [group, isAdd, members, partners, accounts, partnerFund]);

  const weightTotal = basis.reduce((s, b) => s + b.weight, 0);

  /** Spreads `amount` over the basis, remainder to the largest, and keeps the ceilings visible. */
  const spread = (amount: number): Row[] => {
    if (!basis.length) return [];
    if (!(amount > 0) || weightTotal <= 0) {
      return basis.map(b => ({ partner_id: b.partner_id, name: b.name, amount: '', ceiling: b.ceiling }));
    }
    const split = splitByShares(
      amount,
      basis.map(b => ({ partner_id: b.partner_id, share_percent: (b.weight / weightTotal) * 100 })),
    );
    return basis.map(b => ({
      partner_id: b.partner_id,
      name: b.name,
      amount: String(split.find(s => s.partner_id === b.partner_id)?.amount ?? 0),
      ceiling: b.ceiling,
    }));
  };

  useEffect(() => {
    if (!isOpen) return;
    // Giving back defaults to the whole remainder; adding starts blank.
    const start = isAdd ? '' : (remaining > 0 ? String(remaining) : '');
    setTotal(start);
    setRows(spread(parseFloat(start) || 0));
    setTxnDate(getDhakaDateString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, mode, group?.id]);

  const applyTotal = (value: string) => {
    setTotal(value);
    setRows(spread(parseFloat(value) || 0));
  };

  const setRowAmount = (i: number, value: string) =>
    setRows(prev => prev.map((r, idx) => (idx === i ? { ...r, amount: value } : r)));

  const rowsTotal = money(rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0));
  const totalNum = money(parseFloat(total) || 0);
  const overCeiling = rows.filter(r => r.ceiling !== null && (parseFloat(r.amount) || 0) > r.ceiling!);
  const overRemaining = !isAdd && rowsTotal > remaining + 0.001;
  const matches = Math.abs(rowsTotal - totalNum) < 0.01;
  const canSave =
    !!group && rowsTotal > 0 && matches && overCeiling.length === 0 && !overRemaining;

  const handleSave = async () => {
    if (!group || !canSave) return;
    setSaving(true);
    try {
      const payload = rows
        .filter(r => (parseFloat(r.amount) || 0) > 0)
        .map(r => ({
          partner_id: r.partner_id,
          txn_type: isAdd ? 'INVESTMENT' : 'RETURN',
          amount: Number(r.amount),
          share_group_id: group.id,
          reference_type: 'GROUP_FUND',
          reference_id: group.id,
          txn_date: txnDate,
          description: `${isAdd ? t('pb.groups.fundAdd') : t('pb.groups.fundReturn')} — ${group.name}`,
        }));
      const { error } = await supabase.from('pb_partner_transactions').insert(payload);
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

  const splitAgain = () => setRows(spread(parseFloat(total) || 0));

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !saving && onClose()}
      title={`${isAdd ? t('pb.groups.fundAddTitle') : t('pb.groups.fundReturnTitle')}${group ? ` — ${group.name}` : ''}`}
      className="max-w-lg"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between text-sm rounded-lg bg-gray-50 dark:bg-gray-900/50 px-3 py-2">
          <span className="text-gray-500">{t('pb.groups.fundRemaining')}</span>
          <span className="font-semibold text-gray-900 dark:text-gray-100">{formatTaka(remaining)}</span>
        </div>

        <Input
          label={isAdd ? t('pb.groups.fundAddAmount') : t('pb.groups.fundReturnAmount')}
          type="number"
          value={total}
          onChange={e => applyTotal(e.target.value)}
          autoFocus
        />
        <Input label={t('pb.common.date')} type="date" value={txnDate} onChange={e => setTxnDate(e.target.value)} />

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('pb.groups.perPartner')}</span>
            <Button size="sm" variant="outline" onClick={splitAgain} disabled={!(parseFloat(total) > 0)}>
              <Equal size={14} className="mr-1.5" /> {t('pb.groups.resetSplit')}
            </Button>
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
                const pct = weightTotal > 0
                  ? ((basis.find(b => b.partner_id === r.partner_id)?.weight ?? 0) / weightTotal) * 100
                  : 0;
                return (
                  <div key={r.partner_id} className="flex items-center gap-3">
                    <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">
                      {r.name}
                      <span className="text-xs text-gray-400 ml-1.5">{pct.toFixed(2)}%</span>
                    </span>
                    <input
                      type="number"
                      value={r.amount}
                      onChange={e => setRowAmount(i, e.target.value)}
                      className={`${inputBase} w-28 text-right ${over ? 'border-danger' : ''}`}
                    />
                    <span className="text-xs text-gray-500 w-24 text-right">
                      {r.ceiling !== null ? `${t('pb.groups.max')} ${formatTaka(r.ceiling)}` : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between text-sm pt-3 mt-2 border-t border-gray-100 dark:border-gray-700">
            <span className="text-gray-500">{t('pb.groups.splitTotal')}</span>
            <span className={`font-semibold ${matches ? 'text-success' : 'text-danger'}`}>{formatTaka(rowsTotal)}</span>
          </div>
          {!matches && rows.length > 0 && <p className="text-xs text-danger mt-1">{t('pb.groups.mustMatchTotal')}</p>}
          {overCeiling.length > 0 && (
            <p className="text-xs text-danger mt-1">
              {(isAdd ? t('pb.groups.overBalance') : t('pb.groups.overContributed'))
                .replace('{names}', overCeiling.map(r => r.name).join(', '))}
            </p>
          )}
          {overRemaining && <p className="text-xs text-danger mt-1">{t('pb.groups.overRemaining')}</p>}
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
