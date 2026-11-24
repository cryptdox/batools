import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { BookOpen, CheckCheck } from 'lucide-react';
import { IsListEditor, IsRowText } from '../../components/islamicStudio/IsListEditor';
import { IsGuidePreview } from '../../components/islamicStudio/IsGuidePreview';
import type { IsField } from '../../components/islamicStudio/IsFieldInput';
import { Badge, Button } from '../../components/ui/Button';
import { useLanguage } from '../../lib/LanguageContext';
import { supabase } from '../../lib/supabase';
import { errorMessage } from '../../lib/portfolio';
import { isText, useIsReviewer, useIsUserId } from '../../lib/islamicStudio';
import { PfPageHeader, PfTabs } from '../Portfolio/PfPageHeader';

type Tab = 'guides' | 'topics' | 'allah' | 'names';

const TOPIC_FIELDS: IsField[] = [
  { name: 'slug', label: 'is.common.slug', type: 'text', required: true, hint: 'is.common.slugHint' },
  { name: 'title', label: 'is.common.title', type: 'i18n', required: true },
  { name: 'description', label: 'is.common.description', type: 'i18n' },
  { name: 'icon', label: 'is.guides.icon', type: 'text', hint: 'is.guides.iconHint' },
  { name: 'color', label: 'is.guides.color', type: 'text', hint: 'is.guides.colorHint' },
  { name: 'is_active', label: 'is.common.active', type: 'boolean' },
];

const ALLAH_FIELDS: IsField[] = [
  { name: 'n', label: 'is.guides.number', type: 'number', required: true },
  { name: 'ar', label: 'is.guides.arabic', type: 'arabic', required: true },
  { name: 'pron', label: 'is.guides.pron', type: 'i18n', required: true },
  { name: 'meaning', label: 'is.guides.meaning', type: 'i18nArea', required: true },
  { name: 'note', label: 'is.guides.note', type: 'i18nArea' },
  { name: 'ref', label: 'is.guides.ref', type: 'i18n' },
  { name: 'is_active', label: 'is.common.active', type: 'boolean' },
];

const NAME_FIELDS: IsField[] = [
  { name: 'gender', label: 'is.guides.gender', type: 'select', required: true, options: [{ value: 'boy', label: 'is.guides.boy' }, { value: 'girl', label: 'is.guides.girl' }] },
  { name: 'bn', label: 'is.guides.nameBn', type: 'text', required: true },
  { name: 'en', label: 'is.guides.nameEn', type: 'text', required: true },
  { name: 'ar', label: 'is.guides.arabic', type: 'arabic' },
  { name: 'meaning', label: 'is.guides.meaning', type: 'i18nArea', required: true },
  { name: 'note', label: 'is.guides.note', type: 'i18n' },
  { name: 'is_active', label: 'is.common.active', type: 'boolean' },
];

/** Approves every row of `table` still waiting (draft or in review) — for long lists checked as a whole. */
function ApproveAll({ table, onDone }: { table: string; onDone: () => void }) {
  const { t } = useLanguage();
  const isReviewer = useIsReviewer();
  const userId = useIsUserId();
  const [waiting, setWaiting] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const count = useCallback(() => {
    void supabase.from(table).select('id', { count: 'exact', head: true }).in('review_status', ['draft', 'in_review'])
      .then(({ count: n }) => setWaiting(n ?? 0));
  }, [table]);
  useEffect(count, [count]);

  if (!isReviewer || !waiting) return null;
  const approve = async () => {
    if (!window.confirm(t('is.guides.approveAllConfirm').replace('{n}', String(waiting)))) return;
    setBusy(true);
    try {
      const { error } = await supabase.from(table)
        .update({ review_status: 'approved', reviewed_by: userId, reviewed_at: new Date().toISOString(), updated_by: userId })
        .in('review_status', ['draft', 'in_review']);
      if (error) throw error;
      toast.success(t('is.review.approvedToast'));
      count();
      onDone();
    } catch (e) {
      console.error(e);
      toast.error(errorMessage(e, t('pf.common.saveError')));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
      <span className="flex-1">{t('is.guides.waiting').replace('{n}', String(waiting))}</span>
      <Button size="sm" onClick={() => void approve()} disabled={busy}><CheckCheck size={14} className="mr-1" /> {t('is.guides.approveAll')}</Button>
    </div>
  );
}

/**
 * The app's Guide (step-by-step learning by topic), the 99 Names of Allah and
 * Islamic names. All of it is religious content: the app shows a row once it
 * is approved. A guide's blocks are JSON (supabase/data/guides/FORMAT.md);
 * "Read" shows them as the app does.
 */
export const IsGuides = () => {
  const { t, language } = useLanguage();
  const [tab, setTab] = useState<Tab>('guides');
  const [topics, setTopics] = useState<{ value: string; label: string }[]>([]);
  const [topicsChanged, setTopicsChanged] = useState(0);
  const [reload, setReload] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const onTopics = useCallback(() => setTopicsChanged(n => n + 1), []);
  useEffect(() => {
    void supabase.from('is_guide_topics').select('id, title').order('sort_order').then(({ data }) =>
      setTopics((data ?? []).map(c => ({ value: String(c.id), label: isText(c.title, language) }))));
  }, [language, topicsChanged]);

  const guideFields: IsField[] = [
    { name: 'topic_id', label: 'is.guides.topic', type: 'select', required: true, options: topics },
    { name: 'slug', label: 'is.common.slug', type: 'text', required: true, hint: 'is.common.slugHint' },
    { name: 'title', label: 'is.common.title', type: 'i18n', required: true },
    { name: 'summary', label: 'is.guides.summary', type: 'i18nArea' },
    { name: 'level', label: 'is.guides.level', type: 'select', required: true, options: [{ value: 'basic', label: 'is.guides.basic' }, { value: 'detail', label: 'is.guides.detail' }] },
    { name: 'blocks', label: 'is.guides.blocks', type: 'json', required: true, hint: 'is.guides.blocksHint' },
    { name: 'is_active', label: 'is.common.active', type: 'boolean' },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PfPageHeader title="is.guides.pageTitle" subtitle="is.guides.pageSubtitle" />
      <PfTabs<Tab> tabs={[
        { key: 'guides', label: 'is.guides.tabGuides' }, { key: 'topics', label: 'is.guides.tabTopics' },
        { key: 'allah', label: 'is.guides.tabAllah' }, { key: 'names', label: 'is.guides.tabNames' },
      ]} active={tab} onChange={setTab} />
      {tab === 'guides' && (
        <IsListEditor
          table="is_guides"
          title="is.guides.listTitle"
          fields={guideFields}
          reviewed
          audited="both"
          ordered
          searchable
          pageSize={30}
          defaults={{ level: 'basic', blocks: '[]', is_active: true }}
          filters={[{ name: 'topic_id', label: 'is.guides.topic', options: topics }]}
          renderRow={r => (
            <div className="min-w-0 space-y-2">
              <IsRowText
                primary={isText(r.title, language)}
                secondary={[topics.find(c => c.value === r.topic_id)?.label, String(r.slug), t(`is.guides.${r.level}`), `${Array.isArray(r.blocks) ? r.blocks.length : 0} ${t('is.guides.blocksCount')}`].filter(Boolean).join(' · ')}
                extra={r.needs_check ? <Badge variant="warning">{t('is.guides.needsCheck')}</Badge> : undefined}
              />
              {open === String(r.id) && <IsGuidePreview blocks={r.blocks} />}
            </div>
          )}
          rowActions={r => (
            <Button size="sm" variant="outline" onClick={() => setOpen(open === String(r.id) ? null : String(r.id))}>
              <BookOpen size={14} className="mr-1" /> {t('is.text.read')}
            </Button>
          )}
        />
      )}
      {tab === 'topics' && (
        <IsListEditor
          table="is_guide_topics"
          title="is.guides.topicsTitle"
          fields={TOPIC_FIELDS}
          ordered
          onRowsChange={onTopics}
          renderRow={r => (
            <div className="flex items-center gap-3 min-w-0">
              <span className="h-6 w-6 shrink-0 rounded-full" style={{ background: String(r.color ?? '#44bd32') }} />
              <IsRowText primary={isText(r.title, language)} secondary={[String(r.slug), String(r.icon ?? '')].filter(Boolean).join(' · ')} />
            </div>
          )}
        />
      )}
      {tab === 'allah' && (
        <>
          <ApproveAll table="is_allah_names" onDone={() => setReload(n => n + 1)} />
          <IsListEditor
            table="is_allah_names"
            title="is.guides.allahTitle"
            fields={ALLAH_FIELDS}
            reviewed
            activeToggle
            searchable
            orderBy={['n']}
            pageSize={33}
            reloadSignal={reload}
            renderRow={r => (
              <div className="flex items-center gap-3 min-w-0">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-warning/15 text-sm font-semibold">{String(r.n)}</span>
                <span dir="rtl" lang="ar" className="text-xl" style={{ fontFamily: '"Amiri", "Noto Naskh Arabic", serif' }}>{String(r.ar)}</span>
                <IsRowText primary={isText(r.pron, language)} secondary={isText(r.meaning, language)} />
              </div>
            )}
          />
        </>
      )}
      {tab === 'names' && (
        <>
          <ApproveAll table="is_islamic_names" onDone={() => setReload(n => n + 1)} />
          <IsListEditor
            table="is_islamic_names"
            title="is.guides.namesTitle"
            fields={NAME_FIELDS}
            reviewed
            activeToggle
            searchable
            orderBy={['gender', 'en']}
            pageSize={50}
            reloadSignal={reload}
            defaults={{ gender: 'boy', is_active: true }}
            filters={[{ name: 'gender', label: 'is.guides.gender', options: [{ value: 'boy', label: 'is.guides.boy' }, { value: 'girl', label: 'is.guides.girl' }] }]}
            renderRow={r => (
              <IsRowText
                primary={`${String(r.bn)} · ${String(r.en)}${r.ar ? ` · ${String(r.ar)}` : ''}`}
                secondary={isText(r.meaning, language)}
                extra={<Badge variant="default">{t(`is.guides.${r.gender}`)}</Badge>}
              />
            )}
          />
        </>
      )}
    </div>
  );
};
