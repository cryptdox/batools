import { useEffect, useState } from 'react';
import { supabase, type TeamMember, type AttendanceRecord, type AttendanceState, type TeamMemberType } from '../../lib/supabase';
import { Button, Badge } from '../../components/ui/Button';
import { TimeEditor } from '../../components/ui/TimeEditor';
import { Modal } from '../../components/ui/Modal';
import { toast } from 'react-toastify';
import { SortableHeader, useSort } from '../../components/ui/SortableHeader';
import { Clock, Check, Calendar as CalendarIcon, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { format, addDays, subDays, parse, getDay, isToday, isFuture } from 'date-fns';
import { getDhakaTimeOfDay, formatDhakaTime12h, dhakaDateTimeToIso } from '../../lib/dhakaTime';

const isOffDay = (date: Date) => {
  const day = getDay(date); // Sunday = 0 ... Friday = 5, Saturday = 6
  return day === 5 || day === 6;
};

export const LateTracker = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [types, setTypes] = useState<TeamMemberType[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, AttendanceRecord>>({});
  const [defaultThreshold, setDefaultThreshold] = useState<string>('10:00:00');
  const [defaultPunishment, setDefaultPunishment] = useState<number>(200);
  const [loading, setLoading] = useState(true);

  // Confirmation before clearing an existing entry/considered mark
  const [pendingUncheck, setPendingUncheck] = useState<{ member: TeamMember; kind: 'entry' | 'consider' } | null>(null);
  const [confirmingUncheck, setConfirmingUncheck] = useState(false);

  // Time Editor State
  const [editorMember, setEditorMember] = useState<TeamMember | null>(null);
  const [editorInitialTime, setEditorInitialTime] = useState<string | null>(null);

  // Formatting date for db 'YYYY-MM-DD' ignoring timezone shifts easily
  const getDbDateString = (date: Date) => format(date, 'yyyy-MM-dd');

  const { sort, toggleSort, compare } = useSort<'name' | 'type'>('name');

  useEffect(() => {
    fetchSettings();
    fetchTypes();
  }, []);

  const fetchTypes = async () => {
    const { data, error } = await supabase.from('lt_team_member_types').select('*').order('name');
    if (error) {
      console.error(error);
      return;
    }
    setTypes(data || []);
  };

  const typeNameOf = (member: TeamMember) => types.find(t => t.id === member.type_id)?.name ?? '';

  useEffect(() => {
    fetchDataForDate(selectedDate);
  }, [selectedDate]);

  const fetchSettings = async () => {
    const { data } = await supabase.from('lt_attendance_settings').select('*').order('created_at', { ascending: false }).limit(1);
    if (data && data.length > 0) {
      setDefaultThreshold(data[0].late_threshold);
      setDefaultPunishment(data[0].punishment_amount);
    }
  };

  const fetchDataForDate = async (date: Date) => {
    setLoading(true);
    try {
      const dbDate = getDbDateString(date);
      
      const { data: membersData } = await supabase.from('lt_team_members').select('*').eq('is_active', true).eq('is_deleted', false);
      setMembers(membersData || []);

      const { data: recordsData } = await supabase
        .from('lt_attendance_records')
        .select('*')
        .eq('attendance_date', dbDate);
      
      const recordsMap: Record<string, AttendanceRecord> = {};
      recordsData?.forEach(record => {
        recordsMap[record.team_member_id] = record;
      });

      setAttendanceRecords(recordsMap);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const mergeLocalRecord = (memberId: string, patch: Partial<AttendanceRecord>) => {
    const dbDate = getDbDateString(selectedDate);
    const blankRecord: AttendanceRecord = {
      id: memberId,
      team_member_id: memberId,
      attendance_date: dbDate,
      state: 'NO_ENTRY',
      entry_time: null,
      threshold_time_used: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setAttendanceRecords(prev => ({
      ...prev,
      [memberId]: { ...blankRecord, ...prev[memberId], ...patch },
    }));
  };

  const prevDate = () => setSelectedDate(prev => subDays(prev, 1));
  const nextDate = () => setSelectedDate(prev => addDays(prev, 1));
  const pickDate = (value: string) => {
    if (!value) return;
    setSelectedDate(parse(value, 'yyyy-MM-dd', new Date()));
  };

  const handleEntryChange = (member: TeamMember, checked: boolean) => {
    if (!checked) {
      setPendingUncheck({ member, kind: 'entry' });
      return;
    }
    applyEntryChange(member, true);
  };

  const handleConsiderChange = (member: TeamMember, checked: boolean) => {
    if (!checked) {
      setPendingUncheck({ member, kind: 'consider' });
      return;
    }
    applyConsiderChange(member, true);
  };

  const confirmUncheck = async () => {
    if (!pendingUncheck) return;
    setConfirmingUncheck(true);
    try {
      if (pendingUncheck.kind === 'entry') await applyEntryChange(pendingUncheck.member, false);
      else await applyConsiderChange(pendingUncheck.member, false);
      setPendingUncheck(null);
    } finally {
      setConfirmingUncheck(false);
    }
  };

  const applyEntryChange = async (member: TeamMember, checked: boolean) => {
    try {
      const dbDate = getDbDateString(selectedDate);
      
      if (checked) {
        // Mark Entry. A time already on the record (e.g. the day was marked as
        // considered first) is kept as-is — only a day with no time yet gets
        // stamped with the current time.
        const record = attendanceRecords[member.id];
        const entryTime = record?.entry_time || new Date().toISOString();
        const threshold = record?.threshold_time_used || defaultThreshold;

        const { error } = await supabase.rpc('record_attendance', {
          p_team_member_id: member.id,
          p_attendance_date: dbDate,
          p_state: 'ENTRY',
          p_entry_time: entryTime,
          p_threshold_time_used: threshold,
          p_punishment_amount: defaultPunishment
        });
        
        if (error) throw error;
        mergeLocalRecord(member.id, { state: 'ENTRY', entry_time: entryTime, threshold_time_used: threshold });
      } else {
        // Uncheck Entry -> NO_ENTRY
        const { error } = await supabase.rpc('record_attendance', {
          p_team_member_id: member.id,
          p_attendance_date: dbDate,
          p_state: 'NO_ENTRY',
          p_entry_time: null,
          p_threshold_time_used: null,
          p_punishment_amount: defaultPunishment
        });

        if (error) throw error;
        mergeLocalRecord(member.id, { state: 'NO_ENTRY', entry_time: null, threshold_time_used: null });
      }
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Unable to update entry.');
    }
  };

  // "Considered" only decides whether the day is judged against the late
  // threshold — it never touches the recorded time. Unticking it therefore
  // hands the day back to the normal entry rules with the same time, and the
  // penalty (if the time is late) comes back with it.
  const applyConsiderChange = async (member: TeamMember, checked: boolean) => {
    try {
      const dbDate = getDbDateString(selectedDate);
      const record = attendanceRecords[member.id];
      const entryTime = record?.entry_time || (checked ? new Date().toISOString() : null);
      const threshold = entryTime ? (record?.threshold_time_used || defaultThreshold) : null;
      const newState: AttendanceState = checked ? 'CONSIDER_ENTRY' : entryTime ? 'ENTRY' : 'NO_ENTRY';

      const { error } = await supabase.rpc('record_attendance', {
        p_team_member_id: member.id,
        p_attendance_date: dbDate,
        p_state: newState,
        p_entry_time: entryTime,
        p_threshold_time_used: threshold,
        p_punishment_amount: defaultPunishment
      });
        
      if (error) throw error;

      mergeLocalRecord(member.id, { state: newState, entry_time: entryTime, threshold_time_used: threshold });
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Unable to update considered status.');
    }
  };

  const handleTimeEditOpen = (member: TeamMember, record?: AttendanceRecord) => {
    setEditorMember(member);
    setEditorInitialTime(record?.entry_time || null);
  };

  const handleTimeSave = async (timeString: string | null) => {
    if (!editorMember) return;
    try {
      const dbDate = getDbDateString(selectedDate);
      
      const newEntryTime = timeString ? dhakaDateTimeToIso(dbDate, timeString) : null;

      // Editing the time of a considered day leaves it considered: the time is
      // there to be corrected, not to re-open the day to the late rule.
      const wasConsidered = attendanceRecords[editorMember.id]?.state === 'CONSIDER_ENTRY';
      const newState: AttendanceState = !newEntryTime ? 'NO_ENTRY' : wasConsidered ? 'CONSIDER_ENTRY' : 'ENTRY';

      const { error } = await supabase.rpc('record_attendance', {
        p_team_member_id: editorMember.id,
        p_attendance_date: dbDate,
        p_state: newState,
        p_entry_time: newEntryTime,
        p_threshold_time_used: newEntryTime ? defaultThreshold : null,
        p_punishment_amount: defaultPunishment
      });
      
      if (error) throw error;

      mergeLocalRecord(editorMember.id, {
        state: newState,
        entry_time: newEntryTime,
        threshold_time_used: newEntryTime ? defaultThreshold : null,
      });
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Unable to update time.');
    } finally {
      setEditorMember(null);
    }
  };

  // Whether the time on the record is itself past the threshold, regardless of
  // the state the day currently carries — a considered day still holds a late
  // time, and un-considering it brings the penalty back.
  const isTimeLate = (record?: AttendanceRecord) =>
    !!record?.entry_time && !!record.threshold_time_used &&
    getDhakaTimeOfDay(record.entry_time) >= record.threshold_time_used;

  const getStatus = (record?: AttendanceRecord): 'PUNCTUAL' | 'LATE' | 'CONSIDERED' | 'LEAVE' | null => {
    if (!record) return null;
    if (record.state === 'LEAVE') return 'LEAVE';
    // A considered day is never measured against the threshold.
    if (record.state === 'CONSIDER_ENTRY') return 'CONSIDERED';
    if (record.state === 'ENTRY' && record.entry_time && record.threshold_time_used) {
        // Compare using Asia/Dhaka wall-clock time, not the viewer's own timezone.
        return isTimeLate(record) ? 'LATE' : 'PUNCTUAL';
    }
    return null;
  };

  const offDay = isOffDay(selectedDate);
  const isNextDisabled = isToday(selectedDate) || isFuture(selectedDate);

  const sortedMembers = [...members].sort((a, b) =>
    sort.key === 'name' ? compare(a.name, b.name) : compare(typeNameOf(a), typeNameOf(b))
  );

  const summary = members.reduce((acc, m) => {
    const s = getStatus(attendanceRecords[m.id]);
    if (s === 'PUNCTUAL') acc.punctual++;
    if (s === 'LATE') acc.late++;
    if (s === 'CONSIDERED') acc.considered++;
    return acc;
  }, { total: members.length, punctual: 0, late: 0, considered: 0 });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Header / Navigator */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 text-center relative flex justify-between items-center overflow-hidden">
        <Button variant="ghost" className="rounded-full w-12 h-12 p-0 flex items-center justify-center shrink-0" onClick={prevDate}>
          <ChevronLeft size={24} />
        </Button>

        <div className="flex flex-col items-center justify-center">
            <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              {format(selectedDate, 'MMMM d, yyyy')}
            </h2>
            <div className="flex items-center gap-2 mt-2 text-gray-500 font-medium">
               <CalendarIcon size={16} />
               <input
                 type="date"
                 value={format(selectedDate, 'yyyy-MM-dd')}
                 max={format(new Date(), 'yyyy-MM-dd')}
                 onChange={(e) => pickDate(e.target.value)}
                 className="bg-transparent border-none text-sm text-gray-500 dark:text-gray-400 focus:outline-none cursor-pointer"
               />
               {offDay && <Badge variant="muted">Off Day</Badge>}
            </div>
        </div>

        <Button variant="ghost" className="rounded-full w-12 h-12 p-0 flex items-center justify-center shrink-0" onClick={nextDate} disabled={isNextDisabled}>
          <ChevronRight size={24} />
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
           <div className="text-gray-500 dark:text-gray-400 text-sm font-medium">Total Team</div>
           <div className="text-3xl font-bold mt-1 text-gray-900 dark:text-white">{summary.total}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 bg-gradient-to-br from-success/5 to-transparent">
           <div className="text-success text-sm font-medium">In Time</div>
           <div className="text-3xl font-bold mt-1 text-gray-900 dark:text-white">{summary.punctual}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 bg-gradient-to-br from-danger/5 to-transparent">
           <div className="text-danger text-sm font-medium">Late</div>
           <div className="text-3xl font-bold mt-1 text-gray-900 dark:text-white">{summary.late}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
           <div className="text-orange-500 text-sm font-medium">Considered</div>
           <div className="text-3xl font-bold mt-1 text-gray-900 dark:text-white">{summary.considered}</div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        {loading ? (
           <div className="p-12 text-center text-gray-500 font-medium">Loading attendance records...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                  <SortableHeader label="Team Member" sortKey="name" sort={sort} onSort={toggleSort} />
                  <SortableHeader label="Type" sortKey="type" sort={sort} onSort={toggleSort} />
                  <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm text-center">Entry</th>
                  <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm text-center">Considered</th>
                  <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm">Time</th>
                  <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {sortedMembers.map(member => {
                  const record = attendanceRecords[member.id];
                  const state = record?.state || 'NO_ENTRY';
                  const entryChecked = state === 'ENTRY';
                  const considerChecked = state === 'CONSIDER_ENTRY';
                  
                  const status = getStatus(record);
                  
                  return (
                    <tr key={member.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs ring-1 ring-primary/20">
                              {member.name.substring(0,2).toUpperCase()}
                           </div>
                           <span className="font-medium text-gray-900 dark:text-gray-100">{member.name}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        {typeNameOf(member) ? (
                          <Badge variant="default">{typeNameOf(member)}</Badge>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-600 text-sm">&mdash;</span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <label className="relative inline-flex items-center justify-center cursor-pointer group">
                           <input type="checkbox" className="peer sr-only" checked={entryChecked} onChange={(e) => handleEntryChange(member, e.target.checked)} />
                           <div className="w-6 h-6 border-2 border-gray-300 dark:border-gray-600 rounded-md peer-checked:bg-primary peer-checked:border-primary flex items-center justify-center transition-all group-hover:border-primary">
                             <Check size={16} className="text-white opacity-0 group-has-checked:opacity-100 transform scale-50 group-has-checked:scale-100 transition-all" />
                           </div>
                        </label>
                      </td>
                      <td className="p-4 text-center">
                        <label className="relative inline-flex items-center justify-center cursor-pointer group">
                           <input type="checkbox" className="peer sr-only" checked={considerChecked} onChange={(e) => handleConsiderChange(member, e.target.checked)} />
                           <div className="w-6 h-6 border-2 border-gray-300 dark:border-gray-600 rounded-md peer-checked:bg-orange-500 peer-checked:border-orange-500 flex items-center justify-center transition-all group-hover:border-orange-500">
                             <Check size={16} className="text-white opacity-0 group-has-checked:opacity-100 transform scale-50 group-has-checked:scale-100 transition-all" />
                           </div>
                        </label>
                      </td>
                      <td className="p-4" onClick={() => handleTimeEditOpen(member, record)}>
                        {(record?.entry_time) ? (
                          <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300 font-medium cursor-pointer hover:text-primary transition-colors hover:underline">
                            <Clock size={16} />
                            {formatDhakaTime12h(record.entry_time)}
                          </div>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-600 cursor-pointer hover:text-primary transition-colors hover:underline flex items-center gap-1.5"><Clock size={16} /> —</span>
                        )}
                      </td>
                      <td className="p-4">
                        {status === 'PUNCTUAL' && <Badge variant="success">In Time</Badge>}
                        {status === 'LATE' && (
                          <Badge variant={offDay ? 'muted' : 'danger'}>
                            {offDay ? 'Late (No Penalty)' : 'Late'}
                          </Badge>
                        )}
                        {status === 'CONSIDERED' && <Badge variant="warning">Considered</Badge>}
                        {status === 'LEAVE' && <Badge variant="muted">Omitted</Badge>}
                        {!status && <span className="text-gray-400 dark:text-gray-600">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      <Modal
        isOpen={!!pendingUncheck}
        onClose={() => !confirmingUncheck && setPendingUncheck(null)}
        title={pendingUncheck?.kind === 'entry' ? 'Clear Entry' : 'Clear Considered'}
      >
        {pendingUncheck && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-danger/5 border border-danger/20 rounded-lg p-4">
              <AlertTriangle size={20} className="text-danger shrink-0 mt-0.5" />
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {pendingUncheck.kind === 'entry' ? (
                  <>
                    Clear the entry for <span className="font-semibold">{pendingUncheck.member.name}</span> on{' '}
                    <span className="font-semibold">{format(selectedDate, 'MMMM d, yyyy')}</span>? The recorded
                    time and status will be removed.
                  </>
                ) : (
                  <>
                    Clear the considered mark for <span className="font-semibold">{pendingUncheck.member.name}</span> on{' '}
                    <span className="font-semibold">{format(selectedDate, 'MMMM d, yyyy')}</span>? The recorded time is
                    kept and the day goes back to being judged against the late threshold.
                  </>
                )}
              </p>
            </div>

            {pendingUncheck.kind === 'entry' && getStatus(attendanceRecords[pendingUncheck.member.id]) === 'LATE' && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                They are currently marked late, so the penalty for this day will also be removed &mdash; unless a
                payment or waiver has already been recorded against it, which is always kept.
              </p>
            )}

            {pendingUncheck.kind === 'consider' && isTimeLate(attendanceRecords[pendingUncheck.member.id]) && !offDay && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Their recorded time is past the late threshold, so this day will become late again and its penalty
                will be re-applied.
              </p>
            )}

            <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-gray-100 dark:border-gray-700">
              <Button variant="ghost" onClick={() => setPendingUncheck(null)} disabled={confirmingUncheck}>Cancel</Button>
              <Button variant="danger" onClick={confirmUncheck} disabled={confirmingUncheck}>
                {confirmingUncheck ? 'Clearing...' : 'Clear'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <TimeEditor 
        isOpen={!!editorMember}
        onClose={() => setEditorMember(null)}
        initialTime={editorInitialTime}
        onSave={handleTimeSave}
      />
    </div>
  )
}
