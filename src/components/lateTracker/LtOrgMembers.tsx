import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { Crown, Trash2, UserPlus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useLtOrg } from '../../lib/LtOrgContext';
import { Badge, Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';

// The current organization's members. Owners add users by email, make or
// unmake owners and remove members; the database refuses any change that
// would leave the organization without an owner (migration 054).

type Member = {
  id: string;
  email: string;
  iam_user_id: string | null;
  is_owner: boolean;
  is_me: boolean;
  created_at: string;
};

export const LtOrgMembers = () => {
  const { current, reload: reloadOrgs } = useLtOrg();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [asOwner, setAsOwner] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [toRemove, setToRemove] = useState<Member | null>(null);

  const orgId = current?.id ?? null;
  const isOwner = !!current?.is_owner;
  const ownerCount = members.filter(m => m.is_owner).length;

  const fetchMembers = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const { data, error } = await supabase.rpc('lt_organization_members', { p_organization_id: orgId });
    if (error) toast.error(error.message);
    else setMembers((data ?? []) as Member[]);
    setLoading(false);
  }, [orgId]);

  useEffect(() => { void fetchMembers(); }, [fetchMembers]);

  /** Runs a change, then refreshes; a change to my own membership also refreshes my organizations. */
  const run = async (key: string, call: () => PromiseLike<{ error: { message: string } | null }>, done: string, mine = false) => {
    setBusy(key);
    try {
      const { error } = await call();
      if (error) throw new Error(error.message);
      toast.success(done);
      await fetchMembers();
      if (mine) await reloadOrgs();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Unable to update members.');
      return false;
    } finally {
      setBusy(null);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !email.trim()) return;
    const ok = await run('add', () => supabase.rpc('lt_add_organization_member', {
      p_organization_id: orgId, p_email: email.trim(), p_is_owner: asOwner,
    }), `${email.trim()} added.`);
    if (ok) { setEmail(''); setAsOwner(false); }
  };

  const toggleOwner = (m: Member) => run(m.id, () => supabase.rpc('lt_set_organization_owner', {
    p_member_id: m.id, p_is_owner: !m.is_owner,
  }), m.is_owner ? `${m.email} is no longer an owner.` : `${m.email} is now an owner.`, m.is_me);

  const handleRemove = async () => {
    if (!toRemove) return;
    const m = toRemove;
    const ok = await run(m.id, () => supabase.rpc('lt_remove_organization_member', { p_member_id: m.id }), `${m.email} removed.`, m.is_me);
    if (ok) setToRemove(null);
  };

  if (!current) return null;
  /** The last owner can neither step down nor be removed. */
  const lastOwner = (m: Member) => m.is_owner && ownerCount <= 1;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Organization: {current.name}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        {isOwner
          ? 'Add users by their IAM email. Owners can manage members; there is always at least one owner.'
          : 'Only an owner can change who belongs to this organization.'}
      </p>

      {isOwner && (
        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3 mb-5">
          <div className="flex-1 min-w-[220px]">
            <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 h-10">
            <input type="checkbox" checked={asOwner} onChange={e => setAsOwner(e.target.checked)} className="rounded border-gray-300" />
            Owner
          </label>
          <Button type="submit" disabled={!email.trim() || busy === 'add'}>
            <UserPlus size={16} className="mr-2" />{busy === 'add' ? 'Adding…' : 'Add user'}
          </Button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading members…</p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
          {members.map(m => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {m.email}{m.is_me && <span className="text-gray-400 font-normal"> (you)</span>}
                </div>
                {!m.iam_user_id && <div className="text-xs text-gray-500">Joins when they next sign in</div>}
              </div>
              {m.is_owner ? <Badge>Owner</Badge> : <Badge variant="muted">Member</Badge>}
              {isOwner && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy === m.id || lastOwner(m)}
                    title={lastOwner(m) ? 'Make someone else an owner first' : undefined}
                    onClick={() => void toggleOwner(m)}
                  >
                    <Crown size={14} className="mr-1" />{m.is_owner ? 'Remove owner' : 'Make owner'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy === m.id || lastOwner(m)}
                    title={lastOwner(m) ? 'Make someone else an owner first' : 'Remove from organization'}
                    onClick={() => setToRemove(m)}
                    className="text-danger"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal isOpen={!!toRemove} onClose={() => setToRemove(null)} title="Remove member">
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-5">
          Remove <strong>{toRemove?.email}</strong> from {current.name}?
          {toRemove?.is_me && ' You will lose access to this organization.'} Its Late Tracker data is not affected.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setToRemove(null)}>Cancel</Button>
          <Button variant="danger" disabled={busy === toRemove?.id} onClick={() => void handleRemove()}>Remove</Button>
        </div>
      </Modal>
    </div>
  );
};
