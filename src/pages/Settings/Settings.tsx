import { useEffect, useState } from 'react';
import { supabase, type AttendanceSetting } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { format } from 'date-fns';
import { Save } from 'lucide-react';
import { toast } from 'react-toastify';

export const SettingsPage = () => {
  const [settings, setSettings] = useState<AttendanceSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [thresholdStr, setThresholdStr] = useState('10:00');
  const [amountStr, setAmountStr] = useState('200');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('attendance_settings').select('*').order('effective_from', { ascending: false });
      if (data) {
        setSettings(data);
        if (data.length > 0) {
          // e.g. "10:00:00" -> "10:00"
          setThresholdStr(data[0].late_threshold.substring(0, 5));
          setAmountStr(data[0].punishment_amount.toString());
        }
      }
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Unable to load settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('attendance_settings').insert({
        late_threshold: `${thresholdStr}:00`,
        punishment_amount: Number(amountStr),
        effective_from: new Date().toISOString()
      });
      if (error) throw error;
      
      await fetchSettings();
      toast.success('Settings saved. These new defaults apply to future records only.');
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Error saving settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Attendance Settings</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Configure organizational rules. Historical records remain unaffected.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Current Active Rules</h3>
        
        <div className="space-y-4 max-w-sm">
           <Input 
             label="Late Threshold (Time)" 
             type="time" 
             value={thresholdStr} 
             onChange={e => setThresholdStr(e.target.value)} 
           />
           <Input 
             label="Default Punishment Amount (৳)" 
             type="number" 
             value={amountStr} 
             onChange={e => setAmountStr(e.target.value)} 
           />
           
           <div className="pt-4">
             <Button onClick={handleSave} disabled={saving}>
               <Save size={18} className="mr-2" /> {saving ? 'Saving...' : 'Save Updated Rules'}
             </Button>
           </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden mt-6">
         <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Settings History (Audit Log)</h3>
         </div>
         {loading ? (
            <div className="p-8 text-center text-gray-500 text-sm">Loading history...</div>
         ) : (
            <table className="w-full text-left">
               <thead>
                 <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="p-4 font-medium text-gray-500 text-sm">Effective From</th>
                    <th className="p-4 font-medium text-gray-500 text-sm">Late Threshold</th>
                    <th className="p-4 font-medium text-gray-500 text-sm">Amount</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-sm">
                 {settings.map((s, idx) => (
                   <tr key={s.id} className={idx === 0 ? "bg-primary/5" : ""}>
                     <td className="p-4 text-gray-900 dark:text-gray-300">
                        {format(new Date(s.effective_from), 'MMM d, yyyy hh:mm a')}
                        {idx === 0 && <span className="ml-2 text-xs text-primary font-bold">(Active)</span>}
                     </td>
                     <td className="p-4 font-medium">{s.late_threshold}</td>
                     <td className="p-4">৳{Number(s.punishment_amount).toFixed(2)}</td>
                   </tr>
                 ))}
               </tbody>
            </table>
         )}
      </div>
    </div>
  );
};
