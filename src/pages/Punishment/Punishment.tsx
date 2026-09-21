import { useEffect, useMemo, useState } from 'react';
import { supabase, type TeamMember, type Punishment, type AttendanceRecord } from '../../lib/supabase';
import { Button, Badge } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { toast } from 'react-toastify';
import { DateRangeFilter, type FilterPreset } from '../../components/ui/DateRangeFilter';
import { PeriodNav } from '../../components/ui/PeriodNav';
import { RotateCcw, AlertTriangle } from 'lucide-react';
import { usePeriodNav } from '../../hooks/usePeriodNav';
import { format, startOfMonth } from 'date-fns';
import { formatDhakaTime12h } from '../../lib/dhakaTime';

type PunishmentWithDetails = Punishment & {
  team_member: TeamMember;
  attendance_record: AttendanceRecord;
  paid_amount: number;
  waived_amount: number;
  remaining_amount: number;
};

export const PunishmentPage = () => {
  const [punishments, setPunishments] = useState<PunishmentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const [preset, setPreset] = useState<FilterPreset>('all');
  const [customFrom, setCustomFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [customTo, setCustomTo] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Transaction Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPunishment, setSelectedPunishment] = useState<PunishmentWithDetails | null>(null);
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'PAID' | 'DISCOUNT'>('PAID');
  const [saving, setSaving] = useState(false);

  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    fetchPunishments();
  }, []);

  const { dateRange, shiftPeriod, isNextPeriodDisabled, periodLabel } = usePeriodNav(preset, customFrom, customTo);

  const filteredPunishments = useMemo(() => {
    if (!dateRange) return punishments;
    return punishments.filter(p => {
      const d = new Date(p.attendance_date);
      return d >= dateRange.from && d <= dateRange.to;
    });
  }, [punishments, dateRange]);

  const fetchPunishments = async () => {
    setLoading(true);
    try {
      // Because we don't have deeply nested foreign keys configured properly generated on the fly, 
      // we'll fetch them separately or use a custom join/view in production. For now, fetch matching manually if needed, or rely on Postgrest join syntax
      
      const { data, error } = await supabase
        .from('punishments')
        .select(`
          *,
          team_members (*),
          attendance_records (*)
        `)
        .order('attendance_date', { ascending: false });

      if (error) throw error;

      // also fetch transactions to calculate totals properly without view
      const { data: transactions } = await supabase.from('punishment_transactions').select('*');

      const formattedData: PunishmentWithDetails[] = (data || []).map(p => {
        const trans = (transactions || []).filter(t => t.punishment_id === p.id);
        const paid = trans.filter(t => t.transaction_type === 'PAID').reduce((sum, t) => sum + Number(t.amount), 0);
        const waived = trans.filter(t => t.transaction_type === 'DISCOUNT').reduce((sum, t) => sum + Number(t.amount), 0);
        return {
          ...p,
          team_member: p.team_members,
          attendance_record: p.attendance_records,
          paid_amount: paid,
          waived_amount: waived,
          remaining_amount: Number(p.punishment_amount) - paid - waived
        };
      });

      setPunishments(formattedData);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Unable to load punishment records.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeduct = async () => {
    if (!selectedPunishment || !amount) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc('add_punishment_transaction', {
        p_punishment_id: selectedPunishment.id,
        p_type: type,
        p_amount: Number(amount),
        p_note: ''
      });

      if (error) throw error;
      
      await fetchPunishments();
      setIsModalOpen(false);
      setAmount('');
      toast.success('Punishment updated.');
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Error updating Adjustment. Check remaining balance.');
    } finally {
      setSaving(false);
    }
  };

  const outstanding = useMemo(() => {
    const rows = filteredPunishments.filter(p => p.remaining_amount > 0);
    return { count: rows.length, total: rows.reduce((sum, p) => sum + p.remaining_amount, 0) };
  }, [filteredPunishments]);

  const handleResetDues = async () => {
    setResetting(true);
    try {
      const { data, error } = await supabase.rpc('waive_all_remaining', {
        p_from: dateRange ? format(dateRange.from, 'yyyy-MM-dd') : null,
        p_to: dateRange ? format(dateRange.to, 'yyyy-MM-dd') : null,
        p_note: 'Bulk waiver (reset dues)',
      });

      if (error) throw error;

      await fetchPunishments();
      setIsResetOpen(false);
      toast.success(`${data ?? 0} punishment record(s) waived.`);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Unable to reset dues.');
    } finally {
      setResetting(false);
    }
  };

  const openDeductModal = (p: PunishmentWithDetails) => {
    setSelectedPunishment(p);
    setAmount('');
    setType('PAID');
    setIsModalOpen(true);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Punishment Records</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Manage and reconcile late attendance penalties.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <PeriodNav label={periodLabel} onPrev={() => shiftPeriod(-1)} onNext={() => shiftPeriod(1)} nextDisabled={isNextPeriodDisabled} />
          <DateRangeFilter
            preset={preset}
            onPresetChange={setPreset}
            customFrom={customFrom}
            customTo={customTo}
            onCustomFromChange={setCustomFrom}
            onCustomToChange={setCustomTo}
          />
          <Button variant="danger" size="sm" onClick={() => setIsResetOpen(true)} disabled={outstanding.count === 0}>
            <RotateCcw size={16} className="mr-2" /> Reset Dues
          </Button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        {loading ? (
           <div className="p-12 text-center text-gray-500 font-medium">Loading records...</div>
        ) : filteredPunishments.length === 0 ? (
          <div className="p-12 text-center text-gray-500 font-medium">No punishment records found for this period.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                  <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm">Date</th>
                  <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm">Member</th>
                  <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm">Entry Time</th>
                  <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm">Punishment</th>
                  <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm">Paid</th>
                  <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm">Waived</th>
                  <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm">Remaining</th>
                  <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredPunishments.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="p-4 text-gray-900 dark:text-gray-100 font-medium">
                      {format(new Date(p.attendance_date), 'MMM d, yyyy')}
                    </td>
                    <td className="p-4">
                      {p.team_member?.name}
                    </td>
                    <td className="p-4 text-gray-500">
                       {formatDhakaTime12h(p.entry_time)}
                    </td>
                    <td className="p-4 font-medium text-gray-900 dark:text-gray-100">
                      ৳{p.punishment_amount.toFixed(2)}
                    </td>
                    <td className="p-4 text-success font-medium">
                      ৳{p.paid_amount.toFixed(2)}
                    </td>
                    <td className="p-4 text-[#d49a15] dark:text-warning font-medium">
                      ৳{p.waived_amount.toFixed(2)}
                    </td>
                    <td className="p-4">
                      <Badge variant={p.remaining_amount === 0 ? 'success' : 'danger'}>
                         ৳{p.remaining_amount.toFixed(2)}
                      </Badge>
                    </td>
                    <td className="p-4 text-right">
                      <Button size="sm" onClick={() => openDeductModal(p)} disabled={p.remaining_amount <= 0}>
                        Adjust
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => !saving && setIsModalOpen(false)} title="Deduct Punishment">
        {selectedPunishment && (
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
               <div>
                 <span className="block text-gray-500">Total Penalty</span>
                 <span className="font-semibold text-gray-900 dark:text-white">৳{Number(selectedPunishment.punishment_amount).toFixed(2)}</span>
               </div>
               <div>
                 <span className="block text-gray-500">Paid</span>
                 <span className="font-semibold text-success">৳{selectedPunishment.paid_amount.toFixed(2)}</span>
               </div>
               <div>
                 <span className="block text-gray-500">Waived</span>
                 <span className="font-semibold text-[#d49a15] dark:text-warning">৳{selectedPunishment.waived_amount.toFixed(2)}</span>
               </div>
               <div className="text-right sm:text-left">
                 <span className="block text-gray-500">Remaining</span>
                 <span className="font-bold text-danger">৳{selectedPunishment.remaining_amount.toFixed(2)}</span>
               </div>
            </div>

            <Input 
              label="Amount to Adjust" 
              type="number" 
              step="1"
              min="1"
              max={selectedPunishment.remaining_amount}
              value={amount}
              onChange={e => setAmount(e.target.value)} 
              placeholder="e.g. 100"
            />
            
            <div>
               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Type</label>
               <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={type === 'PAID'} onChange={() => setType('PAID')} className="text-primary focus:ring-primary h-4 w-4" />
                    <span className="text-sm">Paid</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={type === 'DISCOUNT'} onChange={() => setType('DISCOUNT')} className="text-primary focus:ring-primary h-4 w-4" />
                    <span className="text-sm">Waived</span>
                  </label>
               </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-gray-100 dark:border-gray-700">
              <Button variant="ghost" onClick={() => setIsModalOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={handleDeduct} disabled={saving || !amount || Number(amount) <= 0 || Number(amount) > selectedPunishment.remaining_amount}>
                {saving ? 'Confirming...' : 'Confirm Adjustment'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={isResetOpen} onClose={() => !resetting && setIsResetOpen(false)} title="Reset Dues">
        <div className="space-y-4">
          <div className="flex items-start gap-3 bg-danger/5 border border-danger/20 rounded-lg p-4">
            <AlertTriangle size={20} className="text-danger shrink-0 mt-0.5" />
            <p className="text-sm text-gray-700 dark:text-gray-300">
              This waives the entire remaining balance on{' '}
              <span className="font-semibold">{outstanding.count} punishment record(s)</span>, clearing{' '}
              <span className="font-semibold">৳{outstanding.total.toFixed(2)}</span> of dues
              {periodLabel ? <> for <span className="font-semibold">{periodLabel}</span></> : ' across all time'}.
            </p>
          </div>

          <p className="text-sm text-gray-500 dark:text-gray-400">
            Each cleared balance is recorded as a waived transaction, so the original penalty amounts and
            existing payment history stay intact in the audit trail. This cannot be undone from the app.
          </p>

          <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-gray-100 dark:border-gray-700">
            <Button variant="ghost" onClick={() => setIsResetOpen(false)} disabled={resetting}>Cancel</Button>
            <Button variant="danger" onClick={handleResetDues} disabled={resetting}>
              {resetting ? 'Waiving...' : `Waive ৳${outstanding.total.toFixed(2)}`}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
