import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { Ban, Check, EyeOff, Eye, Flag, ImagePlus, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { useAccess } from '../../lib/permissions';
import { errorMessage, uploadFileName } from '../../lib/portfolio';
import { useIsReviewer } from '../../lib/islamicStudio';
import { Badge, Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { RichEditor, RichView, richPlainText } from '../../components/ui/RichText';
import { pfInputClass } from '../../components/portfolio/PfFieldInput';
import { PfPageHeader, PfTabs } from '../Portfolio/PfPageHeader';

export const BLOG_BUCKET = 'is-blog-images';
const PAGE = 20;
const MAX_IMAGE = 1024 * 1024;

type Post = {
  id: string; source: 'team' | 'user'; device_id: string | null; author_name: string; language: string; title: string; summary: string | null;
  body_html: string; cover_path: string | null; image_paths: string[]; tags: string[]; review_status: 'draft' | 'in_review' | 'approved' | 'rejected';
  review_note: string | null; published_at: string | null; is_active: boolean; created_at: string; updated_at: string;
};
type Report = { id: string; post_id: string; reason: string; note: string | null; status: 'new' | 'closed'; created_at: string; is_blog_posts: { title: string } | null };
type Tab = 'review' | 'posts' | 'reports';

/** A picture from the private blog bucket, loaded with batools' access. */
export function BlogImage({ path, className }: { path: string | null; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!path) return;
    let alive = true;
    let objectUrl: string | null = null;
    void supabase.storage.from(BLOG_BUCKET).download(path).then(({ data }) => {
      if (!alive || !data) return;
      objectUrl = URL.createObjectURL(data);
      setUrl(objectUrl);
    });
    return () => { alive = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [path]);
  return path && url ? <img src={url} alt="" className={className} /> : null;
}

/**
 * Blog: posts written by the team here, and posts written by readers in the
 * app, which wait in Review until approved (or sent back with a note). Readers'
 * reports of published posts are listed under Reports.
 */
export const IsBlog = () => {
  const { t } = useLanguage();
  const { has } = useAccess();
  const isReviewer = useIsReviewer();
  const canEdit = has('ISLAMIC_STUDIO_BLOG', 'UPDATE') || has('ISLAMIC_STUDIO_BLOG', 'CREATE');
  const canDelete = has('ISLAMIC_STUDIO_BLOG', 'DELETE');
  const [tab, setTab] = useState<Tab>('review');
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState('');
  const [source, setSource] = useState('');
  const [status, setStatus] = useState('');
  const [lang, setLang] = useState('');
  const [reports, setReports] = useState<Report[]>([]);
  const [editing, setEditing] = useState<Partial<Post> | null>(null);
  const [reading, setReading] = useState<Post | null>(null);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    if (tab === 'reports') {
      const { data, error } = await supabase.from('is_blog_reports').select('*, is_blog_posts(title)').order('created_at', { ascending: false }).limit(200);
      if (error) toast.error(errorMessage(error, t('pf.common.loadError')));
      setReports((data ?? []) as Report[]);
      return;
    }
    let q = supabase.from('is_blog_posts').select('*', { count: 'exact' });
    if (tab === 'review') q = q.eq('review_status', 'in_review');
    if (source) q = q.eq('source', source);
    if (status && tab === 'posts') q = q.eq('review_status', status);
    if (lang) q = q.eq('language', lang);
    const needle = query.trim().toLowerCase();
    if (needle) q = q.ilike('search_text', `%${needle.replace(/[%_]/g, '')}%`);
    const { data, error, count: total } = await q.order(tab === 'review' ? 'updated_at' : 'created_at', { ascending: tab === 'review' }).range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) toast.error(errorMessage(error, t('pf.common.loadError')));
    setPosts((data ?? []) as Post[]);
    setCount(total ?? 0);
  }, [tab, source, status, lang, query, page, t]);

  useEffect(() => { void load(); }, [load]);

  const patch = async (post: Post, changes: Partial<Post>, done: string) => {
    setBusy(post.id);
    const { error } = await supabase.from('is_blog_posts').update(changes).eq('id', post.id);
    setBusy('');
    if (error) return toast.error(errorMessage(error, t('pf.common.saveError')));
    toast.success(t(done));
    setReading(null);
    void load();
  };
  const approve = (post: Post) => patch(post, { review_status: 'approved', review_note: null }, 'is.blog.approved');
  const sendBack = (post: Post) => {
    const note = window.prompt(t('is.blog.rejectNote'));
    if (note === null) return;
    void patch(post, { review_status: 'rejected', review_note: note.trim() || null }, 'is.blog.rejected');
  };
  const remove = async (post: Post) => {
    if (!window.confirm(t('is.blog.deleteConfirm'))) return;
    const { error } = await supabase.from('is_blog_posts').delete().eq('id', post.id);
    if (error) return toast.error(errorMessage(error, t('pf.common.deleteError')));
    const files = [post.cover_path, ...post.image_paths].filter((p): p is string => !!p);
    if (files.length) await supabase.storage.from(BLOG_BUCKET).remove(files);
    toast.success(t('is.blog.deleted'));
    setReading(null);
    void load();
  };
  /** Stops (or lets again) this post's writer from writing; their published posts stay until hidden. */
  const blockWriter = async (post: Post, block: boolean) => {
    if (!post.device_id || (block && !window.confirm(t('is.blog.blockConfirm')))) return;
    const { error } = await supabase.from('is_devices').update({ can_post: !block }).eq('device_id', post.device_id);
    if (error) return toast.error(errorMessage(error, t('pf.common.saveError')));
    toast.success(t(block ? 'is.blog.blocked' : 'is.blog.unblocked'));
  };
  const closeReport = async (r: Report) => {
    const { error } = await supabase.from('is_blog_reports').update({ status: 'closed' }).eq('id', r.id);
    if (error) return toast.error(errorMessage(error, t('pf.common.saveError')));
    void load();
  };
  const openPost = async (id: string) => {
    const { data } = await supabase.from('is_blog_posts').select('*').eq('id', id).maybeSingle();
    if (data) setReading(data as Post);
  };

  const statusBadge = (s: Post['review_status']) => <Badge variant={s === 'approved' ? 'success' : s === 'rejected' ? 'danger' : s === 'in_review' ? 'warning' : 'muted'}>{t(`is.review.${s}`)}</Badge>;
  const card = 'bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PfPageHeader title="is.blog.pageTitle" subtitle="is.blog.pageSubtitle" />
      <PfTabs<Tab> tabs={[{ key: 'review', label: 'is.blog.tabReview' }, { key: 'posts', label: 'is.blog.tabPosts' }, { key: 'reports', label: 'is.blog.tabReports' }]}
        active={tab} onChange={v => { setTab(v); setPage(0); }} />

      {tab !== 'reports' && (
        <div className={`${card} p-4 flex flex-wrap items-center gap-3`}>
          <div className="relative flex-1 min-w-[12rem]">
            <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} placeholder={t('pf.common.search')} className={`${pfInputClass} h-10 pl-8`} />
          </div>
          <select value={source} onChange={e => { setSource(e.target.value); setPage(0); }} className={`${pfInputClass} h-10 w-auto`}>
            <option value="">{t('is.blog.allSources')}</option>
            <option value="team">{t('is.blog.team')}</option>
            <option value="user">{t('is.blog.readers')}</option>
          </select>
          {tab === 'posts' && (
            <select value={status} onChange={e => { setStatus(e.target.value); setPage(0); }} className={`${pfInputClass} h-10 w-auto`}>
              <option value="">{t('is.blog.allStatuses')}</option>
              {['draft', 'in_review', 'approved', 'rejected'].map(st => <option key={st} value={st}>{t(`is.review.${st}`)}</option>)}
            </select>
          )}
          <select value={lang} onChange={e => { setLang(e.target.value); setPage(0); }} className={`${pfInputClass} h-10 w-auto`}>
            <option value="">{t('is.blog.allLanguages')}</option>
            {['bn', 'en', 'ar'].map(l => <option key={l} value={l}>{t(`is.media.languages.${l}`)}</option>)}
          </select>
          <span className="text-sm text-gray-500">{count} {t('is.blog.posts')}</span>
          {canEdit && <Button onClick={() => setEditing({ source: 'team', language: 'bn', review_status: 'draft', image_paths: [], tags: [], body_html: '' })}><Plus size={16} className="mr-1" /> {t('is.blog.new')}</Button>}
        </div>
      )}

      {tab === 'reports' ? (
        <div className={`${card} overflow-hidden`}>
          {reports.length === 0 ? <div className="p-8 text-center text-gray-500">{t('is.blog.noReports')}</div> : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {reports.map(r => (
                <li key={r.id} className="p-4 flex flex-wrap items-center gap-3">
                  <Flag size={16} className={r.status === 'new' ? 'text-red-500' : 'text-gray-400'} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{r.is_blog_posts?.title ?? '—'}</p>
                    <p className="text-xs text-gray-500">{t(`is.blog.reasons.${r.reason}`)}{r.note ? ` · ${r.note}` : ''} · {new Date(r.created_at).toLocaleString()}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => void openPost(r.post_id)}>{t('is.text.read')}</Button>
                  {r.status === 'new' && <Button size="sm" variant="ghost" onClick={() => void closeReport(r)}>{t('is.blog.closeReport')}</Button>}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className={`${card} overflow-hidden`}>
          {!posts ? <div className="p-8 text-center text-gray-500">{t('pf.common.loading')}</div> : posts.length === 0 ? (
            <div className="p-8 text-center text-gray-500">{t(tab === 'review' ? 'is.blog.nothingWaiting' : 'is.text.empty')}</div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {posts.map(post => (
                <li key={post.id} className="p-4 flex items-center gap-3">
                  {post.cover_path ? <BlogImage path={post.cover_path} className="h-12 w-16 shrink-0 rounded object-cover" /> : <span className="h-12 w-16 shrink-0 rounded bg-gray-100 dark:bg-gray-700" />}
                  <button onClick={() => setReading(post)} className="min-w-0 flex-1 text-left">
                    <p className="font-medium truncate">{post.title}</p>
                    <p className="text-xs text-gray-500 truncate">{post.author_name} · {t(post.source === 'team' ? 'is.blog.team' : 'is.blog.readers')} · {new Date(post.updated_at).toLocaleDateString()} · {richPlainText(post.summary || post.body_html).slice(0, 90)}</p>
                  </button>
                  {!post.is_active && <Badge variant="muted">{t('is.blog.hidden')}</Badge>}
                  {statusBadge(post.review_status)}
                </li>
              ))}
            </ul>
          )}
          {count > PAGE && (
            <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-700 p-3 text-sm">
              <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage(p => p - 1)}>{t('is.blog.prev')}</Button>
              <span className="text-gray-500">{page + 1} / {Math.ceil(count / PAGE)}</span>
              <Button size="sm" variant="ghost" disabled={(page + 1) * PAGE >= count} onClick={() => setPage(p => p + 1)}>{t('is.blog.next')}</Button>
            </div>
          )}
        </div>
      )}

      <Modal isOpen={!!reading} onClose={() => setReading(null)} title={reading?.title ?? ''} className="max-w-3xl">
        {reading && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
              {statusBadge(reading.review_status)}
              <span>{reading.author_name} · {t(reading.source === 'team' ? 'is.blog.team' : 'is.blog.readers')} · {reading.language}</span>
              {reading.device_id && <span className="font-mono">{reading.device_id.slice(0, 8)}</span>}
            </div>
            {reading.review_note && <p className="rounded-lg bg-amber-50 dark:bg-amber-900/20 p-3 text-sm">{t('is.blog.noteSent')}: {reading.review_note}</p>}
            <BlogImage path={reading.cover_path} className="max-h-64 w-full rounded-lg object-cover" />
            {reading.summary && <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{reading.summary}</p>}
            <RichView html={reading.body_html} className="text-[15px] leading-relaxed" />
            <div className="grid grid-cols-2 gap-2">{reading.image_paths.map(p => <BlogImage key={p} path={p} className="w-full rounded-lg object-cover" />)}</div>
            <div className="flex flex-wrap gap-2 border-t border-gray-100 dark:border-gray-700 pt-3">
              {isReviewer && reading.review_status !== 'approved' && <Button size="sm" disabled={busy === reading.id} onClick={() => void approve(reading)}><Check size={14} className="mr-1" /> {t('is.review.approve')}</Button>}
              {isReviewer && reading.review_status !== 'rejected' && <Button size="sm" variant="outline" disabled={busy === reading.id} onClick={() => sendBack(reading)}><X size={14} className="mr-1" /> {t('is.blog.sendBack')}</Button>}
              {canEdit && <Button size="sm" variant="outline" onClick={() => { setEditing(reading); setReading(null); }}><Pencil size={14} className="mr-1" /> {t('pf.common.edit')}</Button>}
              {canEdit && (
                <Button size="sm" variant="ghost" onClick={() => void patch(reading, { is_active: !reading.is_active }, reading.is_active ? 'is.blog.hiddenDone' : 'is.blog.shownDone')}>
                  {reading.is_active ? <EyeOff size={14} className="mr-1" /> : <Eye size={14} className="mr-1" />} {t(reading.is_active ? 'is.blog.hide' : 'is.blog.show')}
                </Button>
              )}
              {canEdit && reading.source === 'user' && reading.device_id && (
                <Button size="sm" variant="ghost" onClick={() => void blockWriter(reading, true)}><Ban size={14} className="mr-1" /> {t('is.blog.block')}</Button>
              )}
              {canDelete && <Button size="sm" variant="danger" onClick={() => void remove(reading)}><Trash2 size={14} className="mr-1" /> {t('pf.common.delete')}</Button>}
            </div>
          </div>
        )}
      </Modal>

      {editing && <PostEditor post={editing} isReviewer={isReviewer} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load(); }} />}
    </div>
  );
};

/** Writes or edits a post: title, summary, rich text body, a cover and two more pictures (1 MB each). */
function PostEditor({ post, isReviewer, onClose, onSaved }: { post: Partial<Post>; isReviewer: boolean; onClose: () => void; onSaved: () => void }) {
  const { t } = useLanguage();
  const [form, setForm] = useState<Partial<Post>>(post);
  const [saving, setSaving] = useState(false);
  const set = (changes: Partial<Post>) => setForm(f => ({ ...f, ...changes }));

  const upload = async (file: File): Promise<string | null> => {
    if (file.size > MAX_IMAGE) {
      toast.error(t('is.blog.imageTooBig'));
      return null;
    }
    const path = `team/${uploadFileName(file, 'image')}`;
    const { error } = await supabase.storage.from(BLOG_BUCKET).upload(path, file, { contentType: file.type });
    if (error) {
      toast.error(errorMessage(error, t('pf.common.saveError')));
      return null;
    }
    return path;
  };
  const pick = (onPath: (path: string) => void) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.onchange = async () => { const f = input.files?.[0]; if (f) { const p = await upload(f); if (p) onPath(p); } };
    input.click();
  };

  const save = async () => {
    setSaving(true);
    const row = {
      source: form.source ?? 'team', author_name: form.author_name?.trim() || 'Islamic Studio', language: form.language ?? 'bn',
      title: (form.title ?? '').trim(), summary: form.summary?.trim() || null, body_html: form.body_html ?? '',
      cover_path: form.cover_path ?? null, image_paths: form.image_paths ?? [], tags: form.tags ?? [], review_status: form.review_status ?? 'draft',
    };
    const { error } = form.id
      ? await supabase.from('is_blog_posts').update(row).eq('id', form.id)
      : await supabase.from('is_blog_posts').insert(row);
    setSaving(false);
    if (error) return toast.error(errorMessage(error, t('pf.common.saveError')));
    toast.success(t('is.blog.savedDone'));
    onSaved();
  };

  const field = 'block text-sm font-medium mb-1.5';
  return (
    <Modal isOpen onClose={() => !saving && onClose()} title={t(form.id ? 'is.blog.edit' : 'is.blog.new')} className="max-w-3xl">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
          <label><span className={field}>{t('is.common.title')}</span><input value={form.title ?? ''} onChange={e => set({ title: e.target.value })} maxLength={160} className={`${pfInputClass} h-10`} /></label>
          <label><span className={field}>{t('is.media.language')}</span>
            <select value={form.language ?? 'bn'} onChange={e => set({ language: e.target.value })} className={`${pfInputClass} h-10`}>
              {['bn', 'en', 'ar'].map(l => <option key={l} value={l}>{t(`is.media.languages.${l}`)}</option>)}
            </select>
          </label>
        </div>
        {form.source !== 'user' && (
          <label className="block"><span className={field}>{t('is.blog.author')}</span><input value={form.author_name ?? ''} onChange={e => set({ author_name: e.target.value })} placeholder="Islamic Studio" maxLength={60} className={`${pfInputClass} h-10`} /></label>
        )}
        <label className="block"><span className={field}>{t('is.blog.summary')}</span><textarea value={form.summary ?? ''} onChange={e => set({ summary: e.target.value })} maxLength={300} rows={2} className={pfInputClass} /></label>
        <div><span className={field}>{t('is.blog.body')}</span><RichEditor value={form.body_html ?? ''} onChange={html => set({ body_html: html })} /></div>
        <div>
          <span className={field}>{t('is.blog.images')}</span>
          <div className="flex flex-wrap gap-3">
            {[form.cover_path ?? null, ...(form.image_paths ?? [])].map((p, i) => p && (
              <div key={p} className="relative">
                <BlogImage path={p} className="h-20 w-28 rounded object-cover" />
                <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[10px] text-white">{i === 0 && form.cover_path ? t('is.blog.cover') : `${i}`}</span>
                <button onClick={() => (i === 0 && form.cover_path ? set({ cover_path: null }) : set({ image_paths: (form.image_paths ?? []).filter(x => x !== p) }))}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white" aria-label={t('pf.common.delete')}><X size={12} /></button>
              </div>
            ))}
            {!form.cover_path && <Button variant="outline" onClick={() => pick(path => set({ cover_path: path }))}><ImagePlus size={16} className="mr-1" /> {t('is.blog.cover')}</Button>}
            {(form.image_paths ?? []).length < 2 && <Button variant="outline" onClick={() => pick(path => set({ image_paths: [...(form.image_paths ?? []), path] }))}><ImagePlus size={16} className="mr-1" /> {t('is.blog.addImage')}</Button>}
          </div>
          <p className="mt-1 text-xs text-gray-500">{t('is.blog.imagesHint')}</p>
        </div>
        <label className="block"><span className={field}>{t('is.media.tags')}</span>
          <input value={(form.tags ?? []).join(', ')} onChange={e => set({ tags: e.target.value.split(',').map(x => x.trim()).filter(Boolean).slice(0, 5) })} className={`${pfInputClass} h-10`} />
        </label>
        <label className="block"><span className={field}>{t('is.blog.status')}</span>
          <select value={form.review_status ?? 'draft'} onChange={e => set({ review_status: e.target.value as Post['review_status'] })} className={`${pfInputClass} h-10 w-auto`}>
            {(['draft', 'in_review', ...(isReviewer ? ['approved', 'rejected'] : [])] as Post['review_status'][]).map(s => <option key={s} value={s}>{t(`is.review.${s}`)}</option>)}
          </select>
        </label>
        <div className="flex justify-end gap-3 border-t border-gray-100 dark:border-gray-700 pt-3">
          <Button variant="ghost" onClick={onClose} disabled={saving}>{t('pf.common.cancel')}</Button>
          <Button onClick={() => void save()} disabled={saving || (form.title ?? '').trim().length < 3 || !richPlainText(form.body_html ?? '')}>{saving ? t('pf.common.saving') : t('pf.common.save')}</Button>
        </div>
      </div>
    </Modal>
  );
}
