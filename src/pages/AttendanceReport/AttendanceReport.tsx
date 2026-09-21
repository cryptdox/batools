import { useEffect, useMemo, useState } from 'react';
import { supabase, type AttendanceRecord } from '../../lib/supabase';
import { toast } from 'react-toastify';
import { Button } from '../../components/ui/Button';
import { DateRangeFilter, type FilterPreset } from '../../components/ui/DateRangeFilter';
import { PeriodNav } from '../../components/ui/PeriodNav';
import { usePeriodNav } from '../../hooks/usePeriodNav';
import { getDhakaTimeOfDay } from '../../lib/dhakaTime';
import { downloadCsv } from '../../lib/csvExport';
import { Download } from 'lucide-react';
import { startOfMonth, format } from 'date-fns';

type AttendanceSummary = {
  member_id: string;
  member_name: string;
  in_time: number;
  late: number;
  considered: number;
  omitted: number;
  total_recorded: number;
};

type RawMember = { id: string; name: string };

export const AttendanceReportPage = () => {
  const [members, setMembers] = useState<RawMember[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [preset, setPreset] = useState<FilterPreset>('monthly');
  const [customFrom, setCustomFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [customTo, setCustomTo] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { dateRange, shiftPeriod, isNextPeriodDisabled, periodLabel } = usePeriodNav(preset, customFrom, customTo);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: membersData, error: membersError } = await supabase.from('team_members').select('*');
      if (membersError) throw membersError;
      const { data: recordsData, error: recordsError } = await supabase.from('attendance_records').select('*');
      if (recordsError) throw recordsError;

      setMembers(membersData || []);
      setRecords(recordsData || []);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Unable to load attendance data.');
    } finally {
      setLoading(false);
    }
  };

  const summaries = useMemo<AttendanceSummary[]>(() => {
    const scopedRecords = dateRange
      ? records.filter(r => {
          const d = new Date(r.attendance_date);
          return d >= dateRange.from && d <= dateRange.to;
        })
      : records;

    return members
      .map(member => {
        const memberRecords = scopedRecords.filter(r => r.team_member_id === member.id);

        let inTime = 0;
        let late = 0;
        let considered = 0;
        let omitted = 0;

        memberRecords.forEach(r => {
          if (r.state === 'LEAVE') {
            omitted++;
          } else if (r.state === 'CONSIDER_ENTRY') {
            // Recorded and acknowledged, but exempt from the late rule, so it
            // is never counted as in time or late.
            considered++;
          } else if (r.state === 'ENTRY' && r.entry_time && r.threshold_time_used) {
            if (getDhakaTimeOfDay(r.entry_time) >= r.threshold_time_used) late++;
            else inTime++;
          }
        });

        return {
          member_id: member.id,
          member_name: member.name,
          in_time: inTime,
          late,
          considered,
          omitted,
          total_recorded: inTime + late + considered + omitted,
        };
      })
      .filter(s => s.total_recorded > 0);
  }, [members, records, dateRange]);

  const handleExport = () => {
    downloadCsv(
      `attendance-report-${format(new Date(), 'yyyy-MM-dd')}.csv`,
      ['Team Member', 'In Time', 'Late', 'Considered', 'Omitted', 'Total Days'],
      summaries.map(s => [s.member_name, s.in_time, s.late, s.considered, s.omitted, s.total_recorded])
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Attendance Report</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">In time, late, considered and omitted days per team member.</p>
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
          <Button variant="outline" size="sm" onClick={handleExport} disabled={summaries.length === 0}>
            <Download size={16} className="mr-2" /> Export to Excel
          </Button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500 font-medium">Loading report...</div>
        ) : summaries.length === 0 ? (
          <div className="p-12 text-center text-gray-500 font-medium">No attendance recorded for this period.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                  <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm">Team Member</th>
                  <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm text-right">In Time</th>
                  <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm text-right">Late</th>
                  <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm text-right">Considered</th>
                  <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm text-right">Omitted</th>
                  <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm text-right">Total Days</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {summaries.map(s => (
                  <tr key={s.member_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="p-4 font-medium text-gray-900 dark:text-gray-100">{s.member_name}</td>
                    <td className="p-4 text-right text-success font-medium">{s.in_time}</td>
                    <td className="p-4 text-right text-danger font-medium">{s.late}</td>
                    <td className="p-4 text-right text-[#d49a15] dark:text-warning font-medium">{s.considered}</td>
                    <td className="p-4 text-right text-gray-500 dark:text-gray-400 font-medium">{s.omitted}</td>
                    <td className="p-4 text-right text-gray-900 dark:text-gray-100">{s.total_recorded}</td>
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
