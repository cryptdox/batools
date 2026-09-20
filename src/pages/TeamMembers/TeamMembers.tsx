import { useEffect, useState } from 'react';
import { supabase, type TeamMember, type TeamMemberType } from '../../lib/supabase';
import { Button, Badge } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Pencil, Plus, ShieldCheck, ShieldAlert, Users, Trash2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import { SortableHeader, useSort } from '../../components/ui/SortableHeader';

export const TeamMembers = () => {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [typeId, setTypeId] = useState<string>('');
  const [types, setTypes] = useState<TeamMemberType[]>([]);
  const [saving, setSaving] = useState(false);

  const [memberToDelete, setMemberToDelete] = useState<TeamMember | null>(null);
  const [keepDataOnDelete, setKeepDataOnDelete] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const { sort, toggleSort, compare } = useSort<'name' | 'type'>('name');

  useEffect(() => {
    fetchMembers();
    fetchTypes();
  }, []);

  const fetchTypes = async () => {
    const { data, error } = await supabase.from('team_member_types').select('*').order('name');
    if (error) {
      console.error(error);
      return;
    }
    setTypes(data || []);
  };

  const typeNameOf = (member: TeamMember) => types.find(t => t.id === member.type_id)?.name ?? '';

  const sortedMembers = [...members].sort((a, b) =>
    sort.key === 'name' ? compare(a.name, b.name) : compare(typeNameOf(a), typeNameOf(b))
  );

  const fetchMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMembers(data || []);
    } catch (error) {
      console.error('Error fetching members:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to load team members.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    
    try {
      if (editingMember) {
        const { error } = await supabase
          .from('team_members')
          .update({ name, is_active: isActive, type_id: typeId || null })
          .eq('id', editingMember.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('team_members')
          .insert([{ name, is_active: isActive, type_id: typeId || null }]);
        if (error) throw error;
      }
      
      await fetchMembers();
      setIsModalOpen(false);
      resetForm();
      toast.success(editingMember ? 'Team member updated.' : 'Team member added.');
    } catch (error) {
      console.error('Error saving member:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to save team member.');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (member: TeamMember) => {
    try {
      const { error } = await supabase
        .from('team_members')
        .update({ is_active: !member.is_active })
        .eq('id', member.id);

      if (error) throw error;
      await fetchMembers();
      toast.success(member.is_active ? 'Member deactivated.' : 'Member activated.');
    } catch (error) {
      console.error('Error toggling status:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to update status.');
    }
  };

  const openDeleteConfirm = (member: TeamMember) => {
    setMemberToDelete(member);
    setKeepDataOnDelete(true);
  };

  const handleDelete = async () => {
    if (!memberToDelete) return;
    setDeleting(true);
    try {
      if (keepDataOnDelete) {
        const { error } = await supabase
          .from('team_members')
          .update({ is_deleted: true })
          .eq('id', memberToDelete.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('team_members')
          .delete()
          .eq('id', memberToDelete.id);
        if (error) throw error;
      }

      await fetchMembers();
      toast.success(
        keepDataOnDelete
          ? 'Team member deleted. Their attendance and punishment history was kept.'
          : 'Team member and all their records were permanently deleted.'
      );
      setMemberToDelete(null);
    } catch (error) {
      console.error('Error deleting member:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to delete team member.');
    } finally {
      setDeleting(false);
    }
  };

  const resetForm = () => {
    setEditingMember(null);
    setName('');
    setIsActive(true);
    setTypeId('');
  };

  const openEdit = (member: TeamMember) => {
    setEditingMember(member);
    setName(member.name);
    setIsActive(member.is_active);
    setTypeId(member.type_id ?? '');
    setIsModalOpen(true);
  };

  const openAdd = () => {
    resetForm();
    setIsModalOpen(true);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Team Directory</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Manage active and inactive staff members.</p>
        </div>
        <Button onClick={openAdd}>
          <Plus size={18} className="mr-2" /> Add Member
        </Button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading team members...</div>
        ) : members.length === 0 ? (
          <div className="p-12 text-center">
             <div className="w-16 h-16 bg-gray-100 dark:bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users size={32} className="text-gray-400" />
             </div>
             <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">No team members yet</h3>
             <p className="text-gray-500 mt-2 mb-6">Add your first team member to begin tracking attendance.</p>
             <Button onClick={openAdd}>Add Team Member</Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                  <SortableHeader label="Name" sortKey="name" sort={sort} onSort={toggleSort} />
                  <SortableHeader label="Type" sortKey="type" sort={sort} onSort={toggleSort} />
                  <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm">Status</th>
                  <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm">Created</th>
                  <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {sortedMembers.map(member => (
                  <tr key={member.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
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
                    <td className="p-4">
                      {member.is_active ? (
                        <Badge variant="success" className="inline-flex items-center gap-1">
                           <ShieldCheck size={12} /> Active
                        </Badge>
                      ) : (
                        <Badge variant="muted" className="inline-flex items-center gap-1">
                           <ShieldAlert size={12} /> Inactive
                        </Badge>
                      )}
                    </td>
                    <td className="p-4 text-sm text-gray-500">
                      {format(new Date(member.created_at), 'MMM d, yyyy')}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => toggleStatus(member)} title={member.is_active ? 'Deactivate' : 'Activate'}>
                           {member.is_active ? <ShieldAlert size={16} className="text-[#d49a15] dark:text-warning" /> : <ShieldCheck size={16} className="text-success" />}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(member)}>
                           <Pencil size={16} />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openDeleteConfirm(member)} title="Delete">
                           <Trash2 size={16} className="text-danger" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => !saving && setIsModalOpen(false)}
        title={editingMember ? 'Edit Team Member' : 'Add Team Member'}
      >
        <div className="space-y-4">
          <Input 
            label="Full Name" 
            value={name} 
            onChange={e => setName(e.target.value)} 
            placeholder="e.g. Abir Hosen"
            autoFocus
          />
          
          <div className="w-full">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Type</label>
            <select
              value={typeId}
              onChange={e => setTypeId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:border-gray-700 dark:bg-gray-900 dark:text-gray-50"
            >
              <option value="">No type</option>
              {types.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {types.length === 0 && (
              <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                No types defined yet &mdash; add them in Settings.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input 
              type="checkbox" 
              id="activeStatus"
              checked={isActive}
              onChange={e => setIsActive(e.target.checked)}
              className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
            />
            <label htmlFor="activeStatus" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Active Employee
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-gray-100 dark:border-gray-700">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? 'Saving...' : 'Save Member'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!memberToDelete}
        onClose={() => !deleting && setMemberToDelete(null)}
        title="Delete Team Member"
      >
        {memberToDelete && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-danger/5 border border-danger/20 rounded-lg p-4">
              <AlertTriangle size={20} className="text-danger shrink-0 mt-0.5" />
              <p className="text-sm text-gray-700 dark:text-gray-300">
                You're about to delete <span className="font-semibold">{memberToDelete.name}</span>.
                This removes them from the Team Members list and Late Tracker.
              </p>
            </div>

            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                id="keepData"
                checked={keepDataOnDelete}
                onChange={e => setKeepDataOnDelete(e.target.checked)}
                className="w-4 h-4 mt-0.5 text-primary rounded border-gray-300 focus:ring-primary"
              />
              <label htmlFor="keepData" className="text-sm text-gray-700 dark:text-gray-300">
                <span className="font-medium">Keep their attendance & punishment history</span>
                <br />
                <span className="text-gray-500">
                  {keepDataOnDelete
                    ? 'Recommended. Their past records stay intact for reports and audits.'
                    : 'Unchecked: all of their attendance records, punishments, and payment history will be permanently deleted too. This cannot be undone.'}
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-gray-100 dark:border-gray-700">
              <Button variant="ghost" onClick={() => setMemberToDelete(null)} disabled={deleting}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting...' : keepDataOnDelete ? 'Delete Member' : 'Delete Everything'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
