import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { Mail, MailOpen, Trash2, Inbox, Reply } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { usePfUserId } from '../../lib/portfolio';
import { Badge, Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { PfPageHeader } from './PfPageHeader';
import { PfPager, pageOf } from '../../components/portfolio/PfPager';

const PAGE_SIZE = 10;
/** Filter values besides version slugs. */
const ALL = '__all', NONE = '__none', UNREAD = '__unread';

type PfMessage = {
  id: string;
  name: string | null;
  contact: string;
  subject: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
  /** Slug of the portfolio version it was sent from (066). */
  version?: string | null;
};

/** What visitors sent through the portfolio's contact form. */
export const PfMessages = () => {
  const { t } = useLanguage();
  const userId = usePfUserId();
  const [messages, setMessages] = useState<PfMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [toDelete, setToDelete] = useState<PfMessage | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Version names by slug, for the tag on each message.
  const [versionNames, setVersionNames] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState(ALL);
  const [page, setPage] = useState(0);
  // The message open in full.
  const [open, setOpen] = useState<PfMessage | null>(null);

  useEffect(() => {
    if (!userId) return;
    void supabase.from('pf_versions').select('slug, name_en').eq('user_id', userId).then(({ data }) =>
      setVersionNames(Object.fromEntries((data ?? []).map(v => [v.slug as string, v.name_en as string]))));
  }, [userId]);

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

  // All / Unread / one per version that has messages / No version.
  const filters = [
    { key: ALL, label: t('pf.messages.all'), count: messages.length },
    { key: UNREAD, label: t('pf.messages.unreadTab'), count: unread },
    ...[...new Set(messages.map(m => m.version).filter((v): v is string => !!v))]
      .map(v => ({ key: v, label: versionNames[v] ?? v, count: messages.filter(m => m.version === v).length })),
    ...(messages.some(m => !m.version) && messages.some(m => m.version)
      ? [{ key: NONE, label: t('pf.messages.noVersion'), count: messages.filter(m => !m.version).length }] : []),
  ];
  const shown = messages.filter(m =>
    filter === ALL ? true : filter === UNREAD ? !m.is_read : filter === NONE ? !m.version : m.version === filter);
  const { pages, current, slice } = pageOf(shown, page, PAGE_SIZE);
  const pick = (key: string) => { setFilter(key); setPage(0); };

  /** Opens a message in full; opening it marks it read. */
  const openMessage = (m: PfMessage) => {
    setOpen(m);
    if (!m.is_read) void setRead(m, true);
  };

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
          <>
          <div className="flex flex-wrap gap-2 p-4 border-b border-gray-100 dark:border-gray-700">
            {filters.map(f => (
              <button key={f.key} onClick={() => pick(f.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${filter === f.key
                  ? 'bg-primary text-white'
                  : 'bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                {f.label} <span className="opacity-70">{f.count}</span>
              </button>
            ))}
          </div>
          {shown.length === 0 && <div className="p-10 text-center text-gray-500">{t('pf.common.empty')}</div>}
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {slice.map(m => (
              <li key={m.id} className={`p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60 ${m.is_read ? '' : 'bg-primary/5'}`} onClick={() => openMessage(m)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900 dark:text-gray-100 flex flex-wrap items-center gap-2">
                      {m.subject || '—'}
                      {m.version && <Badge variant="default">{versionNames[m.version] ?? m.version}</Badge>}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {m.name || '—'} · <a href={`mailto:${m.contact}`} className="text-primary hover:underline">{m.contact}</a>
                      {' · '}{format(new Date(m.created_at), 'dd MMM yyyy, h:mm a')}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
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
                <p className="mt-2 text-sm text-gray-700 dark:text-gray-300 line-clamp-2">{m.message}</p>
              </li>
            ))}
          </ul>
          <PfPager page={current} pages={pages} onChange={setPage} />
          </>
        )}
      </div>

      <Modal isOpen={!!open} onClose={() => setOpen(null)} title={open?.subject || t('pf.messages.message')} className="max-w-2xl">
        {open && (
          <div className="space-y-4">
            <dl className="grid grid-cols-[6rem_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-gray-500">{t('pf.messages.from')}</dt><dd className="text-gray-900 dark:text-gray-100">{open.name || '—'}</dd>
              <dt className="text-gray-500">{t('pf.messages.contact')}</dt>
              <dd><a href={`mailto:${open.contact}`} className="text-primary hover:underline break-all">{open.contact}</a></dd>
              <dt className="text-gray-500">{t('pf.messages.sent')}</dt><dd className="text-gray-900 dark:text-gray-100">{format(new Date(open.created_at), 'dd MMM yyyy, h:mm a')}</dd>
              <dt className="text-gray-500">{t('pf.versions.field')}</dt>
              <dd>{open.version ? <Badge variant="default">{versionNames[open.version] ?? open.version}</Badge> : <span className="text-gray-400">—</span>}</dd>
            </dl>
            <p className="text-sm leading-relaxed text-gray-800 dark:text-gray-200 whitespace-pre-wrap rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 p-4 max-h-[50vh] overflow-y-auto">{open.message}</p>
            <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
              <Button variant="ghost" onClick={() => { void setRead(open, false); setOpen(null); }}><Mail size={15} className="mr-1.5" />{t('pf.messages.markUnread')}</Button>
              <Button variant="ghost" onClick={() => { setToDelete(open); setOpen(null); }}><Trash2 size={15} className="mr-1.5 text-danger" />{t('pf.common.delete')}</Button>
              <a href={`mailto:${open.contact}?subject=${encodeURIComponent(`Re: ${open.subject ?? ''}`)}`}>
                <Button><Reply size={15} className="mr-1.5" />{t('pf.messages.reply')}</Button>
              </a>
            </div>
          </div>
        )}
      </Modal>

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
