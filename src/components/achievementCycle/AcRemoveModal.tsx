import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { AlertTriangle, Archive } from 'lucide-react';
import { useLanguage } from '../../lib/LanguageContext';
import { acRpc } from '../../lib/achievementCycle';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

type Counts = { topics: number; cycles: number; logs: number; domains: number };

/**
 * Removes a topic or a domain (pass one) with everything beneath: archived
 * (hidden, restorable) or deleted for good. The counts come from the
 * database's own dry run, so they match what will happen.
 */
export const AcRemoveModal = ({ userId, topicId, domainId, name, alreadyArchived, onClose, onDone }: {
  userId: string;
  topicId?: string;
  domainId?: string;
  name: string;
  alreadyArchived: boolean;
  onClose: () => void;
  onDone: () => void;
}) => {
  const { t } = useLanguage();
  // Archiving is the safe default; something already archived can only be deleted.
  const [archive, setArchive] = useState(!alreadyArchived);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [busy, setBusy] = useState(false);

  const args = { p_user_id: userId, p_topic_id: topicId ?? null, p_domain_id: domainId ?? null, p_archive: archive };

  useEffect(() => {
    setCounts(null);
    void acRpc<Counts>('ac_remove', { ...args, p_dry_run: true }, t('pf.common.loadError')).then(setCounts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archive, topicId, domainId, userId]);

  const confirm = async () => {
    setBusy(true);
    const res = await acRpc<Counts>('ac_remove', { ...args, p_dry_run: false }, archive ? t('ac.archive.error') : t('pf.common.deleteError'));
    setBusy(false);
    if (!res) return;
    toast.success((archive ? t('ac.archive.archivedToast') : t('ac.archive.deletedToast')).replace('{topics}', String(res.topics)));
    onDone();
  };

  const summary = counts && t(archive ? 'ac.archive.willArchive' : 'ac.archive.willDelete')
    .replace('{topics}', String(counts.topics))
    .replace('{cycles}', String(counts.cycles))
    .replace('{logs}', String(counts.logs));

  return (
    <Modal isOpen onClose={() => !busy && onClose()} title={archive ? t('ac.archive.titleArchive') : t('ac.archive.titleDelete')}>
      <div className="space-y-4">
        <div className={`flex items-start gap-3 rounded-lg p-4 text-sm text-gray-700 dark:text-gray-300 border ${archive ? 'bg-warning/5 border-warning/30' : 'bg-danger/5 border-danger/20'}`}>
          {archive ? <Archive size={20} className="text-warning shrink-0" /> : <AlertTriangle size={20} className="text-danger shrink-0" />}
          <div className="space-y-1">
            <div className="font-semibold">{name}</div>
            <div>{summary ?? '…'}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {archive ? t('ac.archive.archiveHint') : alreadyArchived ? t('ac.archive.deleteArchivedHint') : t('ac.archive.deleteHint')}
            </div>
          </div>
        </div>

        {!alreadyArchived && (
          <label className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-700 p-3 cursor-pointer">
            <span className="text-sm">
              <span className="font-medium text-gray-800 dark:text-gray-200">{t('ac.archive.toggle')}</span>
              <span className="block text-xs text-gray-500 dark:text-gray-400">{t('ac.archive.toggleHint')}</span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={archive}
              aria-label={t('ac.archive.toggle')}
              onClick={() => setArchive(a => !a)}
              className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${archive ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}
            >
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${archive ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
          </label>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>{t('pf.common.cancel')}</Button>
          <Button variant={archive ? 'primary' : 'danger'} onClick={() => void confirm()} disabled={busy || !counts}>
            {busy ? t('pf.common.saving') : archive ? t('ac.archive.archiveBtn') : t('ac.archive.deleteBtn')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
