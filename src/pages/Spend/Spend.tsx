import { useEffect, useMemo, useState } from 'react';
import { supabase, type Spend } from '../../lib/supabase';
import { toast } from 'react-toastify';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { DateRangeFilter, type FilterPreset } from '../../components/ui/DateRangeFilter';
import { PeriodNav } from '../../components/ui/PeriodNav';
import { SummaryBar, formatTaka } from '../../components/ui/SummaryBar';
import { SpendTable, sortSpendsDesc, sumSpends } from '../../components/spend/SpendTable';
import { usePeriodNav } from '../../hooks/usePeriodNav';
import { downloadCsv } from '../../lib/csvExport';
import { getDhakaDateString } from '../../lib/dhakaTime';
import { AlertTriangle, Download, Plus } from 'lucide-react';
import { format, parse, startOfMonth } from 'date-fns';

export const SpendPage = () => {
  const [spends, setSpends] = useState<Spend[]>([]);
  const [loading, setLoading] = useState(true);

  const [preset, setPreset] = useState<FilterPreset>('monthly');
  const [customFrom, setCustomFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [customTo, setCustomTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const { dateRange, shiftPeriod, isNextPeriodDisabled, periodLabel } = usePeriodNav(preset, customFrom, customTo);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<Spend | null>(null);
  const [spendDate, setSpendDate] = useState(getDhakaDateString());
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const [spendToDelete, setSpendToDelete] = useState<Spend | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchSpends();
  }, []);

  const fetchSpends = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('lt_spends').select('*').order('spend_date', { ascending: false });
      if (error) throw error;
      setSpends(data || []);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Unable to load spending.');
    } finally {
      setLoading(false);
    }
  };

  const filteredSpends = useMemo(() => {
    if (!dateRange) return spends;
    const from = format(dateRange.from, 'yyyy-MM-dd');
    const to = format(dateRange.to, 'yyyy-MM-dd');
    return spends.filter(s => s.spend_date >= from && s.spend_date <= to);
  }, [spends, dateRange]);

  const openAdd = () => {
    setEditing(null);
    setSpendDate(getDhakaDateString());
    setAmount('');
    setDescription('');
    setIsFormOpen(true);
  };

  const openEdit = (spend: Spend) => {
    setEditing(spend);
    setSpendDate(spend.spend_date);
    setAmount(String(Number(spend.amount)));
    setDescription(spend.description);
    setIsFormOpen(true);
  };

  const isFormValid = !!spendDate && Number(amount) > 0 && !!description.trim();

  const handleSave = async () => {
    if (!isFormValid) return;
    setSaving(true);
    try {
      const payload = { spend_date: spendDate, amount: Number(amount), description: description.trim() };
      const { error } = editing
        ? await supabase.from('lt_spends').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editing.id)
        : await supabase.from('lt_spends').insert(payload);
      if (error) throw error;

      await fetchSpends();
      setIsFormOpen(false);
      toast.success(editing ? 'Spend updated.' : 'Spend added.');
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Unable to save spend.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!spendToDelete) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('lt_spends').delete().eq('id', spendToDelete.id);
      if (error) throw error;
      await fetchSpends();
      setSpendToDelete(null);
      toast.success('Spend deleted.');
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Unable to delete spend.');
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = () => {
    downloadCsv(
      `spend-${format(new Date(), 'yyyy-MM-dd')}.csv`,
      ['Date', 'Description', 'Amount'],
      sortSpendsDesc(filteredSpends).map(s => [s.spend_date, s.description, Number(s.amount).toFixed(2)])
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Spend</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Track money spent from the collected fund.</p>
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
          <Button variant="outline" size="sm" onClick={handleExport} disabled={filteredSpends.length === 0}>
            <Download size={16} className="mr-2" /> Export to Excel
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus size={16} className="mr-2" /> Add Spend
          </Button>
        </div>
      </div>

      <SummaryBar
        items={[
          { label: 'Entries', value: filteredSpends.length },
          { label: 'Total Spend', value: formatTaka(sumSpends(filteredSpends)), tone: 'text-danger' },
        ]}
      />

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500 font-medium">Loading spending...</div>
        ) : (
          <SpendTable spends={filteredSpends} onEdit={openEdit} onDelete={setSpendToDelete} />
        )}
      </div>

      <Modal isOpen={isFormOpen} onClose={() => !saving && setIsFormOpen(false)} title={editing ? 'Edit Spend' : 'Add Spend'}>
        <div className="space-y-4">
          <Input label="Date" type="date" value={spendDate} max={getDhakaDateString()} onChange={e => setSpendDate(e.target.value)} />
          <Input label="Amount (৳)" type="number" min="1" step="any" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 500" />
          <Input
            label="Description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
            placeholder="e.g. Team snacks"
          />
          <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-gray-100 dark:border-gray-700">
            <Button variant="ghost" onClick={() => setIsFormOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !isFormValid}>
              {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Spend'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!spendToDelete} onClose={() => !deleting && setSpendToDelete(null)} title="Delete Spend">
        {spendToDelete && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-danger/5 border border-danger/20 rounded-lg p-4">
              <AlertTriangle size={20} className="text-danger shrink-0 mt-0.5" />
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Delete <span className="font-semibold">{spendToDelete.description}</span> ({formatTaka(Number(spendToDelete.amount))}) on{' '}
                <span className="font-semibold">{format(parse(spendToDelete.spend_date, 'yyyy-MM-dd', new Date()), 'MMMM d, yyyy')}</span>? This cannot be undone.
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-gray-100 dark:border-gray-700">
              <Button variant="ghost" onClick={() => setSpendToDelete(null)} disabled={deleting}>Cancel</Button>
              <Button variant="danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
