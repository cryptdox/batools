import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { Mail, MailOpen, Trash2, Inbox } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { usePfUserId } from '../../lib/portfolio';
import { Badge, Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { PfPageHeader } from './PfPageHeader';

type PfMessage = {
  id: string;
  name: string | null;
  contact: string;
  subject: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
};

/** What visitors sent through the portfolio's contact form. */
export const PfMessages = () => {
  const { t } = useLanguage();
  const userId = usePfUserId();
  const [messages, setMessages] = useState<PfMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [toDelete, setToDelete] = useState<PfMessage | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchMessages = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('pf_messages').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) toast.error(error.message);
    setMessages(data ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { void fetchMessages(); }, [fetchMessages]);

  const setRead = async (m: PfMessage, isRead: boolean) => {
    const { error } = await supabase.from('pf_messages').update({ is_read: isRead }).eq('id', m.id).eq('user_id', userId);
    if (error) return toast.error(error.message);
    setMessages(prev => prev.map(x => (x.id === m.id ? { ...x, is_read: isRead } : x)));
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    const { error } = await supabase.from('pf_messages').delete().eq('id', toDelete.id).eq('user_id', userId);
    setDeleting(false);
    if (error) return toast.error(error.message);
    setToDelete(null);
    toast.success(t('pf.common.deleted'));
    await fetchMessages();
  };

  const unread = messages.filter(m => !m.is_read).length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PfPageHeader
        title="pf.messages.pageTitle"
        subtitle="pf.messages.pageSubtitle"
        action={unread > 0 ? <Badge variant="warning">{unread} {t('pf.messages.unread')}</Badge> : undefined}
      />

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">{t('pf.common.loading')}</div>
        ) : messages.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Inbox size={32} className="mx-auto mb-2 text-gray-400" />
            {t('pf.messages.empty')}
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {messages.map(m => (
              <li key={m.id} className={`p-4 ${m.is_read ? '' : 'bg-primary/5'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900 dark:text-gray-100">{m.subject || '—'}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {m.name || '—'} · <a href={`mailto:${m.contact}`} className="text-primary hover:underline">{m.contact}</a>
                      {' · '}{format(new Date(m.created_at), 'dd MMM yyyy, h:mm a')}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                      onClick={() => void setRead(m, !m.is_read)}
                      title={m.is_read ? t('pf.messages.markUnread') : t('pf.messages.markRead')}
                    >
                      {m.is_read ? <MailOpen size={16} /> : <Mail size={16} className="text-primary" />}
                    </button>
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

      <Modal isOpen={!!toDelete} onClose={() => !deleting && setToDelete(null)} title={t('pf.common.deleteTitle')}>
        <p className="text-sm text-gray-600 dark:text-gray-300">{t('pf.common.deleteHint')}</p>
        <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-gray-100 dark:border-gray-700">
          <Button variant="ghost" onClick={() => setToDelete(null)} disabled={deleting}>{t('pf.common.cancel')}</Button>
          <Button variant="danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? t('pf.common.deleting') : t('pf.common.delete')}
          </Button>
        </div>
      </Modal>
    </div>
  );
};
