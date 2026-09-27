import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { formatTaka } from '../ui/SummaryBar';
import { toast } from 'react-toastify';
import { getDhakaDateString } from '../../lib/dhakaTime';
import { PB_TXN_TYPES } from '../../lib/partnerBusiness';
import type { PbPartner, PbPartnerAccount, PbPartnerTxnType } from '../../types/partnerBusiness';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  partners: PbPartner[];
  accounts: PbPartnerAccount[];
  /** Preselected when opened from a specific partner's row. */
  defaultPartnerId?: string;
  /** Preselected when opened from a Deposit / Invest / Withdraw shortcut. */
  defaultType?: PbPartnerTxnType;
  /** Hide the partner picker when the caller already fixed the partner. */
  lockPartner?: boolean;
}

const selectClass =
  'flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:border-gray-700 dark:bg-gray-900 dark:text-gray-50';

export const PartnerTxnModal = ({
  isOpen, onClose, onSaved, partners, accounts, defaultPartnerId, defaultType = 'DEPOSIT', lockPartner,
}: Props) => {
  const { t } = useLanguage();
  const [partnerId, setPartnerId] = useState('');
  const [txnType, setTxnType] = useState<PbPartnerTxnType>(defaultType);
  const [amount, setAmount] = useState('');
  const [txnDate, setTxnDate] = useState(getDhakaDateString());
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setPartnerId(defaultPartnerId ?? partners.find(p => p.is_active)?.id ?? '');
    setTxnType(defaultType);
    setAmount('');
    setTxnDate(getDhakaDateString());
    setDescription('');
  }, [isOpen, defaultPartnerId, defaultType, partners]);

  const account = accounts.find(a => a.partner_id === partnerId);
  const balance = Number(account?.balance ?? 0);
  const invested = Number(account?.investment_amount ?? 0);
  const amountNum = parseFloat(amount) || 0;

  // Where each movement draws from, and therefore what caps it:
  //   INVESTMENT / WITHDRAW  take from the withdrawable balance
  //   RETURN                 takes from capital already invested
  //   DEPOSIT                comes from outside, so it has no ceiling
  const maxAmount =
    txnType === 'INVESTMENT' || txnType === 'WITHDRAW' ? balance
    : txnType === 'RETURN' ? invested
    : null;

  const overMax = maxAmount !== null && amountNum > maxAmount;

  // Prefill with the whole available amount — the common case is moving all of it.
  useEffect(() => {
    if (!isOpen || maxAmount === null) return;
    setAmount(maxAmount > 0 ? String(maxAmount) : '');
  }, [isOpen, txnType, partnerId, maxAmount]);

  const handleSave = async () => {
    if (!partnerId || amountNum <= 0 || overMax) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('pb_partner_transactions').insert([{
        partner_id: partnerId,
        txn_type: txnType,
        amount: amountNum,
        description: description.trim() || null,
        txn_date: txnDate,
      }]);
      if (error) throw error;
      onSaved();
      onClose();
      toast.success(t('pb.ledger.added'));
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : t('pb.ledger.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const partnerName = partners.find(p => p.id === partnerId)?.name ?? '';

  return (
    <Modal isOpen={isOpen} onClose={() => !saving && onClose()} title={t(`pb.txn.${txnType}`)}>
      <div className="space-y-4">
        {lockPartner ? (
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 text-sm flex justify-between">
            <span className="text-gray-500">{t('pb.common.partner')}</span>
            <span className="font-semibold text-gray-900 dark:text-white">{partnerName}</span>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('pb.common.partner')}</label>
            <select value={partnerId} onChange={e => setPartnerId(e.target.value)} className={selectClass}>
              {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('pb.common.type')}</label>
          <select value={txnType} onChange={e => setTxnType(e.target.value as PbPartnerTxnType)} className={selectClass}>
            {PB_TXN_TYPES.filter(x => x !== 'PROFIT').map(x => (
              <option key={x} value={x}>{t(`pb.txn.${x}`)}</option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{t(`pb.txnHint.${txnType}`)}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Input
              label={t('pb.common.amount')}
              type="number"
              min="0"
              max={maxAmount ?? undefined}
              value={amount}
              onChange={e => setAmount(e.target.value)}
              error={overMax ? t('pb.ledger.overMax') : undefined}
              autoFocus
            />
            {maxAmount !== null && (
              <button
                type="button"
                onClick={() => setAmount(String(maxAmount))}
                className="mt-1.5 text-xs text-primary hover:underline"
              >
                {t('pb.ledger.max')}: {formatTaka(maxAmount)}
              </button>
            )}
          </div>
          <Input label={t('pb.common.date')} type="date" value={txnDate} onChange={e => setTxnDate(e.target.value)} />
        </div>
        <Input label={t('pb.common.note')} value={description} onChange={e => setDescription(e.target.value)} />

        {partnerId && (
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">{t('pb.ledger.currentBalance')}</span>
              <span className={`font-semibold ${txnType === 'INVESTMENT' || txnType === 'WITHDRAW' ? 'text-primary' : 'text-gray-900 dark:text-white'}`}>
                {formatTaka(balance)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{t('pb.common.invested')}</span>
              <span className={`font-semibold ${txnType === 'RETURN' ? 'text-primary' : 'text-gray-900 dark:text-white'}`}>
                {formatTaka(invested)}
              </span>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-gray-100 dark:border-gray-700">
          <Button variant="ghost" onClick={onClose} disabled={saving}>{t('pb.common.cancel')}</Button>
          <Button onClick={handleSave} disabled={saving || !partnerId || amountNum <= 0 || overMax}>
            {saving ? t('pb.common.saving') : t('pb.common.save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
