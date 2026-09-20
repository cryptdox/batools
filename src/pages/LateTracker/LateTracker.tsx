import { useEffect, useState } from 'react';
import { supabase, type TeamMember, type AttendanceRecord, type AttendanceState } from '../../lib/supabase';
import { Button, Badge } from '../../components/ui/Button';
import { TimeEditor } from '../../components/ui/TimeEditor';
import { toast } from 'react-toastify';
import { Clock, Check, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addDays, subDays, parse, getDay, isToday, isFuture } from 'date-fns';
import { getDhakaTimeOfDay, formatDhakaTime12h, dhakaDateTimeToIso } from '../../lib/dhakaTime';

const isOffDay = (date: Date) => {
  const day = getDay(date); // Sunday = 0 ... Friday = 5, Saturday = 6
  return day === 5 || day === 6;
};

export const LateTracker = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, AttendanceRecord>>({});
  const [defaultThreshold, setDefaultThreshold] = useState<string>('10:00:00');
  const [defaultPunishment, setDefaultPunishment] = useState<number>(200);
  const [loading, setLoading] = useState(true);

  // Time Editor State
  const [editorMember, setEditorMember] = useState<TeamMember | null>(null);
  const [editorInitialTime, setEditorInitialTime] = useState<string | null>(null);

  // Formatting date for db 'YYYY-MM-DD' ignoring timezone shifts easily
  const getDbDateString = (date: Date) => format(date, 'yyyy-MM-dd');

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    fetchDataForDate(selectedDate);
  }, [selectedDate]);

  const fetchSettings = async () => {
    const { data } = await supabase.from('attendance_settings').select('*').order('created_at', { ascending: false }).limit(1);
    if (data && data.length > 0) {
      setDefaultThreshold(data[0].late_threshold);
      setDefaultPunishment(data[0].punishment_amount);
    }
  };

  const fetchDataForDate = async (date: Date) => {
    setLoading(true);
    try {
      const dbDate = getDbDateString(date);
      
      const { data: membersData } = await supabase.from('team_members').select('*').eq('is_active', true).eq('is_deleted', false);
      setMembers(membersData || []);

      const { data: recordsData } = await supabase
        .from('attendance_records')
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

  const handleEntryChange = async (member: TeamMember, checked: boolean) => {
    try {
      const dbDate = getDbDateString(selectedDate);
      
      if (checked) {
        // Mark Entry
        const now = new Date();
        const entryTime = now.toISOString();

        const { error } = await supabase.rpc('record_attendance', {
          p_team_member_id: member.id,
          p_attendance_date: dbDate,
          p_state: 'ENTRY',
          p_entry_time: entryTime,
          p_threshold_time_used: defaultThreshold,
          p_punishment_amount: defaultPunishment
        });
        
        if (error) throw error;
        mergeLocalRecord(member.id, { state: 'ENTRY', entry_time: entryTime, threshold_time_used: defaultThreshold });
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

  const handleLeaveChange = async (member: TeamMember, checked: boolean) => {
    try {
      const dbDate = getDbDateString(selectedDate);
      const newState: AttendanceState = checked ? 'LEAVE' : 'NO_ENTRY';

      const { error } = await supabase.rpc('record_attendance', {
        p_team_member_id: member.id,
        p_attendance_date: dbDate,
        p_state: newState,
        p_entry_time: null,
        p_threshold_time_used: null,
        p_punishment_amount: defaultPunishment
      });
        
      if (error) throw error;

      mergeLocalRecord(member.id, { state: newState, entry_time: null, threshold_time_used: null });
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Unable to update omitted status.');
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

      const { error } = await supabase.rpc('record_attendance', {
        p_team_member_id: editorMember.id,
        p_attendance_date: dbDate,
        p_state: newEntryTime ? 'ENTRY' : 'NO_ENTRY',
        p_entry_time: newEntryTime,
        p_threshold_time_used: newEntryTime ? defaultThreshold : null,
        p_punishment_amount: defaultPunishment
      });
      
      if (error) throw error;

      mergeLocalRecord(editorMember.id, {
        state: newEntryTime ? 'ENTRY' : 'NO_ENTRY',
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

  const getStatus = (record?: AttendanceRecord): 'PUNCTUAL' | 'LATE' | 'LEAVE' | null => {
    if (!record) return null;
    if (record.state === 'LEAVE') return 'LEAVE';
    if (record.state === 'ENTRY' && record.entry_time && record.threshold_time_used) {
        // Compare using Asia/Dhaka wall-clock time, not the viewer's own timezone.
        return getDhakaTimeOfDay(record.entry_time) >= record.threshold_time_used ? 'LATE' : 'PUNCTUAL';
    }
    return null;
  };

  const offDay = isOffDay(selectedDate);
  const isNextDisabled = isToday(selectedDate) || isFuture(selectedDate);

  const summary = members.reduce((acc, m) => {
    const s = getStatus(attendanceRecords[m.id]);
    if (s === 'PUNCTUAL') acc.punctual++;
    if (s === 'LATE') acc.late++;
    if (s === 'LEAVE') acc.leave++;
    return acc;
  }, { total: members.length, punctual: 0, late: 0, leave: 0 });

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
           <div className="text-orange-500 text-sm font-medium">Omitted</div>
           <div className="text-3xl font-bold mt-1 text-gray-900 dark:text-white">{summary.leave}</div>
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
                  <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm">Team Member</th>
                  <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm text-center">Entry</th>
                  <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm text-center">Omitted</th>
                  <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm">Time</th>
                  <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {members.map(member => {
                  const record = attendanceRecords[member.id];
                  const state = record?.state || 'NO_ENTRY';
                  const entryChecked = state === 'ENTRY';
                  const leaveChecked = state === 'LEAVE';
                  
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
                           <input type="checkbox" className="peer sr-only" checked={leaveChecked} onChange={(e) => handleLeaveChange(member, e.target.checked)} />
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
                        {status === 'LEAVE' && <Badge variant="warning">Omitted</Badge>}
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
      
      <TimeEditor 
        isOpen={!!editorMember}
        onClose={() => setEditorMember(null)}
        initialTime={editorInitialTime}
        onSave={handleTimeSave}
      />
    </div>
  )
}
