import { useState, type ReactNode } from 'react';
import { toast } from 'react-toastify';
import { Building2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { useLtOrg, type LtOrganizationInput } from '../../lib/LtOrgContext';

// Late Tracker pages open only inside an organization. A user who belongs to
// none is asked to create one first; they become its owner and go straight in.

const EMPTY: Required<LtOrganizationInput> = { name: '', description: '', email: '', phone: '', address: '', website: '' };

export const LtCreateOrgModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const { create } = useLtOrg();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const set = (key: keyof LtOrganizationInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const org = await create(form);
      toast.success(`${org.name} created.`);
      setForm(EMPTY);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Unable to create the organization.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create your organization">
      <form onSubmit={handleSave} className="space-y-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Late Tracker keeps its team, attendance and fund under an organization. You will be its owner.
        </p>
        <Input label="Name *" value={form.name} onChange={set('name')} maxLength={120} required autoFocus />
        <div className="w-full">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Description</label>
          <textarea
            value={form.description}
            onChange={set('description')}
            rows={2}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:border-gray-700 dark:bg-gray-900 dark:text-gray-50"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Email" type="email" value={form.email} onChange={set('email')} />
          <Input label="Phone" value={form.phone} onChange={set('phone')} />
        </div>
        <Input label="Address" value={form.address} onChange={set('address')} />
        <Input label="Website" value={form.website} onChange={set('website')} placeholder="https://" />
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={saving || !form.name.trim()}>{saving ? 'Creating…' : 'Create and enter'}</Button>
        </div>
      </form>
    </Modal>
  );
};

export const LtOrgGate = ({ children }: { children: ReactNode }) => {
  const { current, state, error, reload } = useLtOrg();
  const [modalOpen, setModalOpen] = useState(true);

  if (state === 'idle' || state === 'loading') {
    return <p className="max-w-md mx-auto mt-16 text-center text-gray-500">Loading your organization…</p>;
  }
  if (state === 'error') {
    return (
      <div className="max-w-md mx-auto mt-16 text-center space-y-3">
        <p className="font-semibold text-gray-900 dark:text-gray-100">Couldn&apos;t load your organizations</p>
        {error && <p className="text-sm text-gray-500 break-words">{error}</p>}
        <Button onClick={() => void reload()}>Try again</Button>
      </div>
    );
  }
  if (current) return <>{children}</>;

  return (
    <div className="max-w-md mx-auto mt-16 text-center space-y-4">
      <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
        <Building2 size={24} />
      </div>
      <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">No organization yet</p>
      <p className="text-sm text-gray-500">Create one to start using Late Tracker.</p>
      <Button onClick={() => setModalOpen(true)}>Create organization</Button>
      <LtCreateOrgModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
};
