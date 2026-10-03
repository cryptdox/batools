import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { Trash2, Inbox, FileText, CheckCircle2, Eye, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { errorMessage } from '../../lib/portfolio';
import { labelsFrom, useOrgEditor, useOrgRows } from '../../lib/orgSite';
import { Badge, Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { pfInputClass } from '../../components/portfolio/PfFieldInput';
import { OrgPage } from './OrgList';

/**
 * Rows the public site's forms write (contact messages, job applications):
 * loaded newest first for the signed-in org, patched with an updated_by stamp.
 */
function useInbox<T extends { id: string }>(table: string) {
  const { t } = useLanguage();
  const { orgId, userId } = useOrgEditor();
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRows = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const { data, error } = await supabase.from(table).select('*').eq('org_id', orgId).order('created_at', { ascending: false });
    if (error) toast.error(error.message);
    setRows((data ?? []) as T[]);
    setLoading(false);
  }, [table, orgId]);

  useEffect(() => { void fetchRows(); }, [fetchRows]);

  const patch = async (row: T, changes: Partial<T>) => {
    const { error } = await supabase.from(table)
      .update({ ...changes, updated_by: userId, updated_at: new Date().toISOString() })
      .eq('id', row.id).eq('org_id', orgId);
    if (error) return toast.error(errorMessage(error, t('pf.common.saveError')));
    setRows(prev => prev.map(r => (r.id === row.id ? { ...r, ...changes } : r)));
  };

  const remove = async (row: T) => {
    const { error } = await supabase.from(table).delete().eq('id', row.id).eq('org_id', orgId);
    if (error) {
      toast.error(errorMessage(error, t('pf.common.deleteError')));
      return false;
    }
    setRows(prev => prev.filter(r => r.id !== row.id));
    toast.success(t('pf.common.deleted'));
    return true;
  };

  return { rows, loading, patch, remove };
}

const DeleteModal = ({ open, onCancel, onConfirm }: { open: boolean; onCancel: () => void; onConfirm: () => Promise<void> }) => {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  return (
    <Modal isOpen={open} onClose={() => !busy && onCancel()} title={t('pf.common.deleteTitle')}>
      <p className="text-sm text-gray-600 dark:text-gray-300">{t('org.common.deleteInboxHint')}</p>
      <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-gray-100 dark:border-gray-700">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>{t('pf.common.cancel')}</Button>
        <Button variant="danger" disabled={busy} onClick={async () => { setBusy(true); await onConfirm(); setBusy(false); }}>
          {busy ? t('pf.common.deleting') : t('pf.common.delete')}
        </Button>
      </div>
    </Modal>
  );
};

const Empty = ({ text }: { text: string }) => (
  <div className="p-12 text-center text-gray-500">
    <Inbox size={32} className="mx-auto mb-2 text-gray-400" />
    {text}
  </div>
);

const card = 'bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden';
const when = (iso: string) => format(new Date(iso), 'dd MMM yyyy, h:mm a');

type Contact = { id: string; name: string; email: string; message: string; status: 'unread' | 'read' | 'replied'; created_at: string };
const STATUSES = ['unread', 'read', 'replied'] as const;
const STATUS_BADGE = { unread: 'warning', read: 'muted', replied: 'success' } as const;

/** Messages from the site's contact form. */
export const OrgContacts = () => {
  const { t } = useLanguage();
  const { rows, loading, patch, remove } = useInbox<Contact>('org_contacts');
  const [toDelete, setToDelete] = useState<Contact | null>(null);
  const unread = rows.filter(r => r.status === 'unread').length;

  return (
    <OrgPage
      title="org.contacts.pageTitle"
      subtitle="org.contacts.pageSubtitle"
      action={unread > 0 ? <Badge variant="warning">{unread} {t('pf.messages.unread')}</Badge> : undefined}
    >
      <div className={card}>
        {loading ? (
          <div className="p-12 text-center text-gray-500">{t('pf.common.loading')}</div>
        ) : rows.length === 0 ? (
          <Empty text={t('pf.messages.empty')} />
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {rows.map(m => (
              <li key={m.id} className={`p-4 ${m.status === 'unread' ? 'bg-primary/5' : ''}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900 dark:text-gray-100">{m.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      <a href={`mailto:${m.email}`} className="text-primary hover:underline">{m.email}</a> · {when(m.created_at)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={STATUS_BADGE[m.status]}>{t(`org.contacts.status.${m.status}`)}</Badge>
                    <select
                      value={m.status}
                      onChange={e => void patch(m, { status: e.target.value as Contact['status'] })}
                      className={`${pfInputClass} h-8 py-0 w-28`}
                      aria-label={t('org.contacts.statusLabel')}
                    >
                      {STATUSES.map(s => <option key={s} value={s}>{t(`org.contacts.status.${s}`)}</option>)}
                    </select>
                    <button className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700" onClick={() => setToDelete(m)} title={t('pf.common.delete')}>
                      <Trash2 size={16} className="text-danger" />
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{m.message}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
      <DeleteModal
        open={!!toDelete}
        onCancel={() => setToDelete(null)}
        onConfirm={async () => { if (toDelete && await remove(toDelete)) setToDelete(null); }}
      />
    </OrgPage>
  );
};

type Application = {
  id: string; job_id: string; applicant_name: string; email: string; objective: string | null;
  cv_url: string | null; is_reviewed: boolean; is_approved: boolean; created_at: string;
};

/** Applications from the site's job form, filterable by job. */
export const OrgApplications = () => {
  const { t } = useLanguage();
  const { rows, loading, patch, remove } = useInbox<Application>('org_job_applications');
  const jobs = useOrgRows('org_jobs', 'created_at');
  const jobTitles = labelsFrom(jobs, 'title');
  const [jobFilter, setJobFilter] = useState('');
  const [toDelete, setToDelete] = useState<Application | null>(null);
  const shown = useMemo(() => (jobFilter ? rows.filter(r => r.job_id === jobFilter) : rows), [rows, jobFilter]);
  const pending = rows.filter(r => !r.is_reviewed).length;

  const toggle = (label: string, on: boolean, onClick: () => void, Icon: typeof Eye) => (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
        on ? 'bg-success/10 text-success border-success/20' : 'text-gray-500 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
      }`}
    >
      <Icon size={12} /> {label}
    </button>
  );

  return (
    <OrgPage
      title="org.applications.pageTitle"
      subtitle="org.applications.pageSubtitle"
      action={pending > 0 ? <Badge variant="warning">{pending} {t('org.applications.pending')}</Badge> : undefined}
    >
      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('org.applications.title')}</h3>
          <select value={jobFilter} onChange={e => setJobFilter(e.target.value)} className={`${pfInputClass} h-9 w-64`}>
            <option value="">{t('org.applications.allJobs')}</option>
            {jobs.map(j => <option key={j.id} value={j.id}>{String(j.title)}</option>)}
          </select>
        </div>
        {loading ? (
          <div className="p-12 text-center text-gray-500">{t('pf.common.loading')}</div>
        ) : shown.length === 0 ? (
          <Empty text={t('org.applications.empty')} />
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {shown.map(a => (
              <li key={a.id} className={`p-4 ${a.is_reviewed ? '' : 'bg-primary/5'}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900 dark:text-gray-100">{a.applicant_name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {jobTitles[a.job_id] ?? '—'} · <a href={`mailto:${a.email}`} className="text-primary hover:underline">{a.email}</a> · {when(a.created_at)}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {a.cv_url && (
                      <a href={a.cv_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                        <FileText size={14} /> CV <ExternalLink size={12} />
                      </a>
                    )}
                    {toggle(t('org.applications.reviewed'), a.is_reviewed, () => void patch(a, { is_reviewed: !a.is_reviewed }), Eye)}
                    {toggle(t('org.applications.approved'), a.is_approved, () => void patch(a, { is_approved: !a.is_approved, is_reviewed: true }), CheckCircle2)}
                    <button className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700" onClick={() => setToDelete(a)} title={t('pf.common.delete')}>
                      <Trash2 size={16} className="text-danger" />
                    </button>
                  </div>
                </div>
                {a.objective && <p className="mt-2 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{a.objective}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <DeleteModal
        open={!!toDelete}
        onCancel={() => setToDelete(null)}
        onConfirm={async () => { if (toDelete && await remove(toDelete)) setToDelete(null); }}
      />
    </OrgPage>
  );
};
