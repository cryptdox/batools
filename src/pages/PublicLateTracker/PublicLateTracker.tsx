import { useEffect, useMemo, useState } from 'react';
import { addDays, format, getDay, parse, startOfMonth } from 'date-fns';
import { Moon, Sun } from 'lucide-react';
import { supabase, type AttendanceState } from '../../lib/supabase';
import { Badge } from '../../components/ui/Button';
import { DateRangeFilter, type FilterPreset } from '../../components/ui/DateRangeFilter';
import { PeriodNav } from '../../components/ui/PeriodNav';
import { SortableHeader, useSort } from '../../components/ui/SortableHeader';
import { SummaryBar, formatTaka } from '../../components/ui/SummaryBar';
import { SpendListModal, sumSpends, type SpendRow } from '../../components/spend/SpendTable';
import { usePeriodNav } from '../../hooks/usePeriodNav';
import { getDhakaDateString, getDhakaTimeOfDay } from '../../lib/dhakaTime';

type PublicMember = { id: string; name: string; created_at: string };
type PublicRecord = {
  team_member_id: string;
  attendance_date: string;
  state: AttendanceState;
  entry_time: string | null;
  threshold_time_used: string | null;
};
type PublicPunishment = {
  team_member_id: string;
  attendance_date: string;
  punishment_amount: number;
  paid: number;
  waived: number;
};
type PublicData = { members: PublicMember[]; records: PublicRecord[]; punishments: PublicPunishment[]; spends: SpendRow[] };

type TodayStatus = 'LATE' | 'IN_TIME' | 'CONSIDERED' | 'LEAVE' | 'UNCHECKED' | 'OFF_DAY';

type Row = {
  member_id: string;
  name: string;
  today: TodayStatus;
  total_days: number;
  in_time: number;
  late: number;
  considered: number;
  unchecked: number;
  punishment: number;
  paid: number;
  waived: number;
  due: number;
};

type SortKey = 'name' | 'today' | 'total_days' | 'in_time' | 'late' | 'considered' | 'unchecked' | 'punishment' | 'paid' | 'waived' | 'due';

const APP_NAME = 'Bangla Tools';

const parseDbDate = (s: string) => parse(s, 'yyyy-MM-dd', new Date());
const toDbDate = (d: Date) => format(d, 'yyyy-MM-dd');

// Friday and Saturday are organizational off days (same rule as record_attendance).
const isOffDay = (dbDate: string) => {
  const day = getDay(parseDbDate(dbDate));
  return day === 5 || day === 6;
};

const countWorkingDays = (from: string, to: string) => {
  let count = 0;
  for (let d = parseDbDate(from); toDbDate(d) <= to; d = addDays(d, 1)) {
    if (!isOffDay(toDbDate(d))) count++;
  }
  return count;
};

// "Checked" means the day was marked somewhere; a NO_ENTRY record is the same
// as no record at all.
const isChecked = (r: PublicRecord) => r.state !== 'NO_ENTRY';

const isLate = (r: PublicRecord) =>
  r.state === 'ENTRY' && !!r.entry_time && !!r.threshold_time_used &&
  getDhakaTimeOfDay(r.entry_time) >= r.threshold_time_used;

const TODAY_ORDER: Record<TodayStatus, number> = { LATE: 0, UNCHECKED: 1, CONSIDERED: 2, IN_TIME: 3, LEAVE: 4, OFF_DAY: 5 };

export const PublicLateTracker = () => {
  const [data, setData] = useState<PublicData | null>(null);
  const [isSpendListOpen, setIsSpendListOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  const [preset, setPreset] = useState<FilterPreset>('monthly');
  const [customFrom, setCustomFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [customTo, setCustomTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const { dateRange, shiftPeriod, isNextPeriodDisabled, periodLabel } = usePeriodNav(preset, customFrom, customTo);

  const { sort, toggleSort, compare } = useSort<SortKey>('name');

  const today = getDhakaDateString();

  useEffect(() => {
    document.title = `Late Tracker · ${APP_NAME}`;
  }, []);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [membersRes, recordsRes, punishmentsRes, transactionsRes, spendsRes] = await Promise.all([
          supabase.from('lt_team_members').select('id, name, created_at').eq('is_active', true).eq('is_deleted', false).order('name'),
          supabase.from('lt_attendance_records').select('team_member_id, attendance_date, state, entry_time, threshold_time_used'),
          supabase.from('lt_punishments').select('id, team_member_id, attendance_date, punishment_amount'),
          supabase.from('lt_punishment_transactions').select('punishment_id, transaction_type, amount'),
          supabase.from('lt_spends').select('id, spend_date, amount, description, created_at'),
        ]);
        // Spend is secondary here: a failure shouldn't hide the attendance table.
        if (spendsRes.error) console.error(spendsRes.error);
        const failed = [membersRes, recordsRes, punishmentsRes, transactionsRes].find(r => r.error);
        if (failed?.error) throw failed.error;

        const transactions = transactionsRes.data || [];
        const sumOf = (punishmentId: string, type: string) => transactions
          .filter(t => t.punishment_id === punishmentId && t.transaction_type === type)
          .reduce((sum, t) => sum + Number(t.amount), 0);

        setData({
          members: membersRes.data || [],
          records: recordsRes.data || [],
          punishments: (punishmentsRes.data || []).map(p => ({
            team_member_id: p.team_member_id,
            attendance_date: p.attendance_date,
            punishment_amount: Number(p.punishment_amount),
            paid: sumOf(p.id, 'PAID'),
            waived: sumOf(p.id, 'DISCOUNT'),
          })),
          spends: spendsRes.data || [],
        });
      } catch (e) {
        console.error(e);
        setError('Unable to load the late tracker right now.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const rows = useMemo<Row[]>(() => {
    if (!data) return [];

    const earliestRecord = data.records.reduce<string | null>(
      (min, r) => (min === null || r.attendance_date < min ? r.attendance_date : min), null
    );
    const rangeFrom = dateRange ? toDbDate(dateRange.from) : (earliestRecord ?? today);
    const rangeToRaw = dateRange ? toDbDate(dateRange.to) : today;
    // Days that haven't happened yet can't be unchecked.
    const rangeTo = rangeToRaw < today ? rangeToRaw : today;
    const inRange = (d: string) => d >= rangeFrom && d <= rangeTo;

    return data.members.map(member => {
      const memberRecords = data.records.filter(r => r.team_member_id === member.id);

      // A member's history starts at whichever comes first: when they were
      // added, or their first recorded day (records can be backfilled).
      const createdOn = getDhakaDateString(new Date(member.created_at));
      const firstRecord = memberRecords.reduce((min, r) => (r.attendance_date < min ? r.attendance_date : min), createdOn);
      const from = firstRecord > rangeFrom ? firstRecord : rangeFrom;
      const workingDays = from <= rangeTo ? countWorkingDays(from, rangeTo) : 0;

      let inTime = 0, late = 0, considered = 0, checkedWorkingDays = 0, checkedOffDays = 0;
      memberRecords.forEach(r => {
        if (!inRange(r.attendance_date) || !isChecked(r)) return;
        if (isOffDay(r.attendance_date)) checkedOffDays++;
        else if (r.attendance_date >= from) checkedWorkingDays++;

        if (r.state === 'CONSIDER_ENTRY') considered++;
        else if (r.state === 'ENTRY') {
          if (isLate(r)) late++;
          else inTime++;
        }
      });

      let punishment = 0, paid = 0, waived = 0;
      data.punishments.forEach(p => {
        if (p.team_member_id !== member.id || !inRange(p.attendance_date)) return;
        punishment += Number(p.punishment_amount);
        paid += Number(p.paid);
        waived += Number(p.waived);
      });

      const todayRecord = memberRecords.find(r => r.attendance_date === today);
      let todayStatus: TodayStatus;
      if (!todayRecord || !isChecked(todayRecord)) todayStatus = isOffDay(today) ? 'OFF_DAY' : 'UNCHECKED';
      else if (todayRecord.state === 'LEAVE') todayStatus = 'LEAVE';
      else if (todayRecord.state === 'CONSIDER_ENTRY') todayStatus = 'CONSIDERED';
      else todayStatus = isLate(todayRecord) ? 'LATE' : 'IN_TIME';

      return {
        member_id: member.id,
        name: member.name,
        today: todayStatus,
        // Off days only count when someone actually came in.
        total_days: workingDays + checkedOffDays,
        in_time: inTime,
        late,
        considered,
        unchecked: Math.max(workingDays - checkedWorkingDays, 0),
        punishment,
        paid,
        waived,
        due: punishment - paid - waived,
      };
    });
  }, [data, dateRange, today]);

  const sortedRows = useMemo(() => {
    const dir = sort.direction === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (sort.key === 'name') return compare(a.name, b.name);
      if (sort.key === 'today') return (TODAY_ORDER[a.today] - TODAY_ORDER[b.today]) * dir || a.name.localeCompare(b.name);
      return (a[sort.key] - b[sort.key]) * dir || a.name.localeCompare(b.name);
    });
  }, [rows, sort, compare]);

  const filteredSpends = useMemo(() => {
    if (!data) return [];
    if (!dateRange) return data.spends;
    const from = toDbDate(dateRange.from);
    const to = toDbDate(dateRange.to);
    return data.spends.filter(s => s.spend_date >= from && s.spend_date <= to);
  }, [data, dateRange]);

  const totals = useMemo(() => {
    const sum = (k: Exclude<SortKey, 'name' | 'today'>) => rows.reduce((acc, r) => acc + r[k], 0);
    const lateToday = rows.filter(r => r.today === 'LATE').length;
    const notLateToday = rows.filter(r => r.today === 'IN_TIME').length;
    return {
      lateToday,
      notLateToday,
      total_days: sum('total_days'),
      in_time: sum('in_time'),
      late: sum('late'),
      considered: sum('considered'),
      unchecked: sum('unchecked'),
      punishment: sum('punishment'),
      paid: sum('paid'),
      waived: sum('waived'),
      due: sum('due'),
    };
  }, [rows]);

  const numHeader = (label: string, k: SortKey) => (
    <SortableHeader label={label} sortKey={k} sort={sort} onSort={toggleSort} className="text-right whitespace-nowrap" />
  );

  return (
    <div className="min-h-screen bg-theme-main text-theme-main font-sans">
      <header className="bg-gradient-to-b from-[#1e3162] to-[#131d3d] text-white h-16 flex items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-bold shadow-lg shrink-0">B</div>
          <span className="text-lg font-bold tracking-tight whitespace-nowrap">{APP_NAME}</span>
        </div>
        <button
          onClick={() => setTheme(prev => (prev === 'light' ? 'dark' : 'light'))}
          className="p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Toggle dark mode"
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        {loading ? (
          <div className="p-12 text-center text-gray-500 font-medium">Loading late tracker...</div>
        ) : error ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-12 text-center text-gray-500 font-medium">
            {error}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap justify-between items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Late Tracker</h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 flex items-center gap-2 flex-wrap">
                  Today's status for {format(parseDbDate(today), 'MMMM d, yyyy')}; totals cover the selected period.
                  {isOffDay(today) && <Badge variant="muted">Off Day</Badge>}
                </p>
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
              </div>
            </div>

            <SummaryBar
              items={[
                { label: 'Late Today', value: totals.lateToday, tone: 'text-danger' },
                { label: 'Not Late Today', value: totals.notLateToday, tone: 'text-success' },
                { label: 'Total Counts', value: totals.total_days },
                { label: 'In Time', value: totals.in_time, tone: 'text-success' },
                { label: 'Late', value: totals.late, tone: 'text-danger' },
                { label: 'Considered', value: totals.considered, tone: 'text-[#d49a15] dark:text-warning' },
                { label: 'Unchecked', value: totals.unchecked },
                { label: 'Punishment', value: formatTaka(totals.punishment) },
                { label: 'Paid', value: formatTaka(totals.paid), tone: 'text-success' },
                { label: 'Waived', value: formatTaka(totals.waived), tone: 'text-[#d49a15] dark:text-warning' },
                { label: 'Due', value: formatTaka(totals.due), tone: 'text-danger' },
                { label: 'Total Spend', value: formatTaka(sumSpends(filteredSpends)), tone: 'text-primary', onClick: () => setIsSpendListOpen(true) },
              ]}
            />

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
              {rows.length === 0 ? (
                <div className="p-12 text-center text-gray-500 font-medium">No team members to show.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                        <SortableHeader label="Team Member" sortKey="name" sort={sort} onSort={toggleSort} />
                        <SortableHeader label="Today" sortKey="today" sort={sort} onSort={toggleSort} />
                        {numHeader('Total Days', 'total_days')}
                        {numHeader('In Time', 'in_time')}
                        {numHeader('Late', 'late')}
                        {numHeader('Considered', 'considered')}
                        {numHeader('Unchecked', 'unchecked')}
                        {numHeader('Punishment', 'punishment')}
                        {numHeader('Paid', 'paid')}
                        {numHeader('Waived', 'waived')}
                        {numHeader('Due', 'due')}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {sortedRows.map(r => (
                        <tr key={r.member_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                          <td className="p-4 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">{r.name}</td>
                          <td className="p-4 whitespace-nowrap">
                            {r.today === 'LATE' && <Badge variant="danger">Late</Badge>}
                            {r.today === 'IN_TIME' && <Badge variant="success">Not Late</Badge>}
                            {r.today === 'CONSIDERED' && <Badge variant="warning">Considered</Badge>}
                            {r.today === 'LEAVE' && <Badge variant="muted">Omitted</Badge>}
                            {r.today === 'UNCHECKED' && <Badge variant="muted">Unchecked</Badge>}
                            {r.today === 'OFF_DAY' && <span className="text-gray-400 dark:text-gray-600">&mdash;</span>}
                          </td>
                          <td className="p-4 text-right text-gray-900 dark:text-gray-100">{r.total_days}</td>
                          <td className="p-4 text-right text-success font-medium">{r.in_time}</td>
                          <td className="p-4 text-right text-danger font-medium">{r.late}</td>
                          <td className="p-4 text-right text-[#d49a15] dark:text-warning font-medium">{r.considered}</td>
                          <td className="p-4 text-right text-gray-500 dark:text-gray-400 font-medium">{r.unchecked}</td>
                          <td className="p-4 text-right whitespace-nowrap">{formatTaka(r.punishment)}</td>
                          <td className="p-4 text-right text-success whitespace-nowrap">{formatTaka(r.paid)}</td>
                          <td className="p-4 text-right text-[#d49a15] dark:text-warning whitespace-nowrap">{formatTaka(r.waived)}</td>
                          <td className="p-4 text-right font-bold text-danger whitespace-nowrap">{formatTaka(r.due)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <SpendListModal isOpen={isSpendListOpen} onClose={() => setIsSpendListOpen(false)} spends={filteredSpends} periodLabel={periodLabel} />
          </>
        )}
      </main>
    </div>
  );
};
