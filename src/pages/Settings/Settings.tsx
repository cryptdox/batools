import { useEffect, useState } from 'react';
import { supabase, type AttendanceSetting, type TeamMemberType } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { format } from 'date-fns';
import { Save, Plus, Trash2, AlertTriangle, Tag, Pencil, Check, X, Link2, Copy, RefreshCw } from 'lucide-react';
import { toast } from 'react-toastify';

export const SettingsPage = () => {
  const [settings, setSettings] = useState<AttendanceSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [thresholdStr, setThresholdStr] = useState('10:00');
  const [amountStr, setAmountStr] = useState('200');

  const [types, setTypes] = useState<TeamMemberType[]>([]);
  const [typeCounts, setTypeCounts] = useState<Record<string, number>>({});
  const [newTypeName, setNewTypeName] = useState('');
  const [addingType, setAddingType] = useState(false);
  const [typeToDelete, setTypeToDelete] = useState<TeamMemberType | null>(null);
  const [deletingType, setDeletingType] = useState(false);
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editingTypeName, setEditingTypeName] = useState('');
  const [savingType, setSavingType] = useState(false);

  const [shareKey, setShareKey] = useState<string | null>(null);
  const [isRegenerateOpen, setIsRegenerateOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const shareUrl = shareKey ? `${window.location.origin}/late-tracker/${shareKey}` : null;

  useEffect(() => {
    fetchSettings();
    fetchTypes();
    fetchShareKey();
  }, []);

  const fetchShareKey = async () => {
    const { data, error } = await supabase.rpc('get_public_share_key');
    if (error) {
      console.error(error);
      return;
    }
    setShareKey(data ?? null);
  };

  // Replacing the key is what revokes old links, so an existing link asks first.
  const handleRegenerateKey = async () => {
    setRegenerating(true);
    try {
      const { data, error } = await supabase.rpc('regenerate_public_share_key');
      if (error) throw error;
      setShareKey(data);
      setIsRegenerateOpen(false);
      toast.success(shareKey ? 'New public link generated. The old link no longer works.' : 'Public link generated.');
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Unable to generate public link.');
    } finally {
      setRegenerating(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied.');
    } catch {
      toast.error('Unable to copy. Select the link and copy it manually.');
    }
  };

  const fetchTypes = async () => {
    try {
      const { data, error } = await supabase.from('lt_team_member_types').select('*').order('name');
      if (error) throw error;
      setTypes(data || []);

      const { data: members, error: membersError } = await supabase
        .from('lt_team_members')
        .select('type_id')
        .eq('is_deleted', false);
      if (membersError) throw membersError;

      const counts: Record<string, number> = {};
      (members || []).forEach(m => {
        if (m.type_id) counts[m.type_id] = (counts[m.type_id] ?? 0) + 1;
      });
      setTypeCounts(counts);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Unable to load member types.');
    }
  };

  const handleAddType = async () => {
    const name = newTypeName.trim();
    if (!name) return;
    setAddingType(true);
    try {
      const { error } = await supabase.from('lt_team_member_types').insert({ name });
      if (error) throw error;
      setNewTypeName('');
      await fetchTypes();
      toast.success(`Type "${name}" added.`);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Unable to add type.');
    } finally {
      setAddingType(false);
    }
  };

  const startEditType = (type: TeamMemberType) => {
    setEditingTypeId(type.id);
    setEditingTypeName(type.name);
  };

  const cancelEditType = () => {
    setEditingTypeId(null);
    setEditingTypeName('');
  };

  const handleSaveType = async () => {
    const name = editingTypeName.trim();
    if (!editingTypeId || !name) return;

    const original = types.find(t => t.id === editingTypeId);
    if (original && original.name === name) {
      cancelEditType();
      return;
    }

    setSavingType(true);
    try {
      const { error } = await supabase
        .from('lt_team_member_types')
        .update({ name, updated_at: new Date().toISOString() })
        .eq('id', editingTypeId);
      if (error) throw error;

      await fetchTypes();
      cancelEditType();
      toast.success('Type renamed.');
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Unable to rename type.');
    } finally {
      setSavingType(false);
    }
  };

  const handleDeleteType = async () => {
    if (!typeToDelete) return;
    setDeletingType(true);
    try {
      const { error } = await supabase.from('lt_team_member_types').delete().eq('id', typeToDelete.id);
      if (error) throw error;
      await fetchTypes();
      toast.success(`Type "${typeToDelete.name}" deleted.`);
      setTypeToDelete(null);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Unable to delete type.');
    } finally {
      setDeletingType(false);
    }
  };

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('lt_attendance_settings').select('*').order('effective_from', { ascending: false });
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
      const { error } = await supabase.from('lt_attendance_settings').insert({
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

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Public Late Tracker Link</h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
          A read-only page showing today's late status and per-member totals. Anyone with the link can view it without signing in.
        </p>

        {shareUrl ? (
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex-1 min-w-[16rem] flex items-center gap-2 h-10 rounded-md border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3">
              <Link2 size={16} className="text-primary shrink-0" />
              <input
                readOnly
                value={shareUrl}
                onFocus={e => e.target.select()}
                className="flex-1 min-w-0 bg-transparent text-sm text-gray-700 dark:text-gray-300 focus:outline-none"
              />
            </div>
            <Button variant="outline" onClick={handleCopyLink}>
              <Copy size={16} className="mr-2" /> Copy
            </Button>
            <Button variant="outline" onClick={() => setIsRegenerateOpen(true)}>
              <RefreshCw size={16} className="mr-2" /> Regenerate
            </Button>
          </div>
        ) : (
          <Button onClick={handleRegenerateKey} disabled={regenerating}>
            <Link2 size={18} className="mr-2" /> {regenerating ? 'Generating...' : 'Generate Public Link'}
          </Button>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Team Member Types</h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
          Designations you can assign to team members, e.g. Developer, Designer, Intern.
        </p>

        <div className="flex flex-wrap gap-2 items-end mb-5 max-w-md">
          <div className="flex-1 min-w-[12rem]">
            <Input
              label="New type"
              value={newTypeName}
              onChange={e => setNewTypeName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddType(); }}
              placeholder="e.g. Developer"
            />
          </div>
          <Button onClick={handleAddType} disabled={addingType || !newTypeName.trim()}>
            <Plus size={18} className="mr-2" /> {addingType ? 'Adding...' : 'Add'}
          </Button>
        </div>

        {types.length === 0 ? (
          <div className="text-sm text-gray-500 dark:text-gray-400 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg p-6 text-center">
            No types yet. Add one above to start assigning types to team members.
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700 border border-gray-100 dark:border-gray-700 rounded-lg overflow-hidden">
            {types.map(t => (
              <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                {editingTypeId === t.id ? (
                  <>
                    <input
                      value={editingTypeName}
                      onChange={e => setEditingTypeName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleSaveType();
                        if (e.key === 'Escape') cancelEditType();
                      }}
                      autoFocus
                      className="flex-1 min-w-0 h-9 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:border-gray-700 dark:bg-gray-900 dark:text-gray-50"
                    />
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="sm" onClick={handleSaveType} disabled={savingType || !editingTypeName.trim()} title="Save">
                        <Check size={16} className="text-success" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={cancelEditType} disabled={savingType} title="Cancel">
                        <X size={16} />
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 min-w-0">
                      <Tag size={16} className="text-primary shrink-0" />
                      <span className="font-medium text-gray-900 dark:text-gray-100 truncate">{t.name}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
                        {typeCounts[t.id] ?? 0} member{(typeCounts[t.id] ?? 0) === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => startEditType(t)} title="Rename type">
                        <Pencil size={16} />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setTypeToDelete(t)} title="Delete type">
                        <Trash2 size={16} className="text-danger" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
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

      <Modal isOpen={isRegenerateOpen} onClose={() => !regenerating && setIsRegenerateOpen(false)} title="Regenerate Public Link">
        <div className="space-y-4">
          <div className="flex items-start gap-3 bg-danger/5 border border-danger/20 rounded-lg p-4">
            <AlertTriangle size={20} className="text-danger shrink-0 mt-0.5" />
            <p className="text-sm text-gray-700 dark:text-gray-300">
              The current link will stop working immediately. Anyone using it will need the new one.
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-gray-100 dark:border-gray-700">
            <Button variant="ghost" onClick={() => setIsRegenerateOpen(false)} disabled={regenerating}>Cancel</Button>
            <Button variant="danger" onClick={handleRegenerateKey} disabled={regenerating}>
              {regenerating ? 'Regenerating...' : 'Regenerate Link'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!typeToDelete} onClose={() => !deletingType && setTypeToDelete(null)} title="Delete Type">
        {typeToDelete && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-danger/5 border border-danger/20 rounded-lg p-4">
              <AlertTriangle size={20} className="text-danger shrink-0 mt-0.5" />
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Delete the type <span className="font-semibold">{typeToDelete.name}</span>?
                {(typeCounts[typeToDelete.id] ?? 0) > 0 && (
                  <> <span className="font-semibold">{typeCounts[typeToDelete.id]} member(s)</span> currently use it and will become untyped.</>
                )}
              </p>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No team members or attendance history are deleted &mdash; only the label is removed.
            </p>
            <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-gray-100 dark:border-gray-700">
              <Button variant="ghost" onClick={() => setTypeToDelete(null)} disabled={deletingType}>Cancel</Button>
              <Button variant="danger" onClick={handleDeleteType} disabled={deletingType}>
                {deletingType ? 'Deleting...' : 'Delete Type'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
