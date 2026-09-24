import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-toastify';
import { Button } from '../../components/ui/Button';
import { DateRangeFilter, type FilterPreset } from '../../components/ui/DateRangeFilter';
import { PeriodNav } from '../../components/ui/PeriodNav';
import { usePeriodNav } from '../../hooks/usePeriodNav';
import { downloadCsv } from '../../lib/csvExport';
import { Download } from 'lucide-react';
import { SummaryBar, formatTaka } from '../../components/ui/SummaryBar';
import { startOfMonth, format } from 'date-fns';

type ReportSummary = {
  member_id: string;
  member_name: string;
  total_punishment: number;
  paid: number;
  discount: number;
  remaining: number;
};

type RawPunishment = { id: string; team_member_id: string; attendance_date: string; punishment_amount: number };
type RawTransaction = { punishment_id: string; transaction_type: string; amount: number };
type RawMember = { id: string; name: string };

export const ReportsPage = () => {
  const [members, setMembers] = useState<RawMember[]>([]);
  const [punishments, setPunishments] = useState<RawPunishment[]>([]);
  const [transactions, setTransactions] = useState<RawTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [preset, setPreset] = useState<FilterPreset>('monthly');
  const [customFrom, setCustomFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [customTo, setCustomTo] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { dateRange, shiftPeriod, isNextPeriodDisabled, periodLabel } = usePeriodNav(preset, customFrom, customTo);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const { data: membersData, error: membersError } = await supabase.from('lt_team_members').select('*');
      if (membersError) throw membersError;
      const { data: punishmentsData, error: punishmentsError } = await supabase.from('lt_punishments').select('*');
      if (punishmentsError) throw punishmentsError;
      const { data: transactionsData, error: transactionsError } = await supabase.from('lt_punishment_transactions').select('*');
      if (transactionsError) throw transactionsError;

      setMembers(membersData || []);
      setPunishments(punishmentsData || []);
      setTransactions(transactionsData || []);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Unable to load report data.');
    } finally {
      setLoading(false);
    }
  };

  const reports = useMemo<ReportSummary[]>(() => {
    const scopedPunishments = dateRange
      ? punishments.filter(p => {
          const d = new Date(p.attendance_date);
          return d >= dateRange.from && d <= dateRange.to;
        })
      : punishments;

    return members
      .map(member => {
        const memberPunishments = scopedPunishments.filter(p => p.team_member_id === member.id);

        let total = 0;
        let paid = 0;
        let discount = 0;

        memberPunishments.forEach(p => {
          total += Number(p.punishment_amount);

          const pTrans = transactions.filter(t => t.punishment_id === p.id);
          pTrans.forEach(t => {
            if (t.transaction_type === 'PAID') paid += Number(t.amount);
            if (t.transaction_type === 'DISCOUNT') discount += Number(t.amount);
          });
        });

        return {
          member_id: member.id,
          member_name: member.name,
          total_punishment: total,
          paid,
          discount,
          remaining: total - paid - discount
        };
      })
      .filter(s => s.total_punishment > 0);
  }, [members, punishments, transactions, dateRange]);

  const totals = useMemo(() => reports.reduce(
    (acc, r) => ({
      total_punishment: acc.total_punishment + r.total_punishment,
      paid: acc.paid + r.paid,
      discount: acc.discount + r.discount,
      remaining: acc.remaining + r.remaining,
    }),
    { total_punishment: 0, paid: 0, discount: 0, remaining: 0 }
  ), [reports]);

  const handleExport = () => {
    downloadCsv(
      `collection-report-${format(new Date(), 'yyyy-MM-dd')}.csv`,
      ['Team Member', 'Total Punishment', 'Paid', 'Waived', 'Remaining'],
      reports.map(r => [r.member_name, r.total_punishment.toFixed(2), r.paid.toFixed(2), r.discount.toFixed(2), r.remaining.toFixed(2)])
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Collection Report</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Punishments collected, waived and still due per team member.</p>
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
          <Button variant="outline" size="sm" onClick={handleExport} disabled={reports.length === 0}>
            <Download size={16} className="mr-2" /> Export to Excel
          </Button>
        </div>
      </div>

      <SummaryBar
        items={[
          { label: 'Members', value: reports.length },
          { label: 'Total Punishment', value: formatTaka(totals.total_punishment) },
          { label: 'Paid', value: formatTaka(totals.paid), tone: 'text-success' },
          { label: 'Waived', value: formatTaka(totals.discount), tone: 'text-[#d49a15] dark:text-warning' },
          { label: 'Remaining', value: formatTaka(totals.remaining), tone: 'text-danger' },
        ]}
      />

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        {loading ? (
             <div className="p-12 text-center text-gray-500 font-medium">Loading report...</div>
        ) : reports.length === 0 ? (
             <div className="p-12 text-center text-gray-500 font-medium">No recorded punishments to report on yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                  <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm">Team Member</th>
                  <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm text-right">Total Punishment</th>
                  <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm text-right">Paid</th>
                  <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm text-right">Waived</th>
                  <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm text-right">Remaining</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {reports.map(r => (
                  <tr key={r.member_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="p-4 font-medium text-gray-900 dark:text-gray-100">{r.member_name}</td>
                    <td className="p-4 text-right">৳{r.total_punishment.toFixed(2)}</td>
                    <td className="p-4 text-right text-success">৳{r.paid.toFixed(2)}</td>
                    <td className="p-4 text-right text-[#d49a15] dark:text-warning">৳{r.discount.toFixed(2)}</td>
                    <td className="p-4 text-right font-bold text-danger">৳{r.remaining.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
