import { useCallback, useState } from 'react';
import { ExternalLink, FileText } from 'lucide-react';
import { Badge } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { richPlainText } from '../../components/ui/RichText';
import { PfListEditor, PfRowText } from '../../components/portfolio/PfListEditor';
import { PF_BUCKET } from '../../components/portfolio/PfFileUpload';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { platformOf, youTubeThumbnail } from '../../lib/linkPreview';
import { usePfUserId, type PfField, type PfFormValues, type PfRow } from '../../lib/portfolio';
import { PfPageHeader } from './PfPageHeader';

// Portfolio → Articles (migration 061): posts published elsewhere, linked from
// the portfolio, and articles written here, whose body is an ordered list of
// blocks (pf_post_blocks) edited in a modal, Medium-style.

const PLATFORMS = ['medium', 'linkedin', 'x', 'facebook', 'instagram', 'youtube', 'website', 'other'];
const isExternal = (v: PfFormValues) => v.kind === 'external';
const isArticle = (v: PfFormValues) => v.kind === 'article';

const POST_FIELDS: PfField[] = [
  { name: 'kind', label: 'pf.articles.kind', type: 'select', initial: 'article', options: [
    { value: 'article', label: 'pf.articles.kinds.article' },
    { value: 'external', label: 'pf.articles.kinds.external' },
  ] },
  { name: 'external_url', label: 'pf.articles.externalUrl', type: 'text', required: true, showIf: isExternal, hint: 'pf.articles.externalUrlHint',
    fetchPreview: { title: 'title_en', description: 'summary_en', image: 'cover_url', date: 'published_at' } },
  { name: 'platform', label: 'pf.articles.platform', type: 'select', initial: 'website', showIf: isExternal, hint: 'pf.articles.platformHint',
    options: PLATFORMS.map(value => ({ value, label: `pf.articles.platforms.${value}` })) },
  { name: 'title', label: 'pf.work.title', type: 'i18n', required: true },
  { name: 'slug', label: 'pf.articles.slug', type: 'text', showIf: isArticle, hint: 'pf.articles.slugHint' },
  { name: 'summary', label: 'pf.articles.summary', type: 'i18n', multiline: true, hint: 'pf.articles.summaryHint' },
  { name: 'cover_url', label: 'pf.articles.cover', type: 'text', upload: 'image/*' },
  { name: 'tags', label: 'pf.articles.tags', type: 'tags' },
  { name: 'published_at', label: 'pf.articles.publishedAt', type: 'date' },
  { name: 'status', label: 'pf.articles.status', type: 'select', initial: 'published', options: [
    { value: 'published', label: 'pf.articles.statuses.published' },
    { value: 'draft', label: 'pf.articles.statuses.draft' },
  ], hint: 'pf.articles.statusHint' },
  { name: 'is_featured', label: 'pf.work.featured', type: 'boolean', hint: 'pf.articles.featuredHint' },
];

/** A URL-safe address from a title; Bangla-only titles get a dated fallback. */
const slugify = (title: string) =>
  title.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '')
  || `article-${Date.now().toString(36)}`;

/** Derived columns: an article's platform and address; an external post's platform from its link. */
const shapePost = (row: Record<string, unknown>, values: PfFormValues) => {
  if (values.kind === 'article') {
    const slug = slugify(String(row.slug || row.title_en || ''));
    return { ...row, platform: 'native', external_url: null, slug };
  }
  const url = String(row.external_url ?? '');
  const platform = row.platform === 'website' || !row.platform ? platformOf(url) : row.platform;
  return { ...row, platform, slug: null };
};

const has = (...kinds: string[]) => (v: PfFormValues) => kinds.includes(String(v.kind));
const CODE_LANGUAGES = ['text', 'javascript', 'typescript', 'python', 'java', 'go', 'sql', 'bash', 'json', 'yaml', 'html', 'css'];

const BLOCK_FIELDS: PfField[] = [
  { name: 'kind', label: 'pf.articles.blockKind', type: 'select', initial: 'text',
    options: ['text', 'heading', 'image', 'video', 'quote', 'code', 'link', 'divider'].map(value => ({ value, label: `pf.articles.blocks.${value}` })) },
  { name: 'text', label: 'pf.articles.blockText', type: 'i18n', rich: true, showIf: has('text', 'heading', 'quote'), hint: 'pf.articles.blockTextHint' },
  { name: 'media_url', label: 'pf.articles.image', type: 'text', upload: 'image/*', required: true, showIf: has('image') },
  { name: 'alt_en', label: 'pf.articles.alt', type: 'text', showIf: has('image'), hint: 'pf.articles.altHint' },
  { name: 'link_url', label: 'pf.articles.linkUrl', type: 'text', required: true, showIf: has('video', 'link'), hint: 'pf.articles.linkUrlHint',
    fetchPreview: { title: 'caption_en', image: 'thumbnail_url' } },
  { name: 'thumbnail_url', label: 'pf.articles.thumbnail', type: 'text', upload: 'image/*', showIf: has('video', 'link'), hint: 'pf.articles.thumbnailHint' },
  { name: 'caption', label: 'pf.articles.caption', type: 'i18n', showIf: has('image', 'video', 'link') },
  { name: 'code', label: 'pf.articles.code', type: 'textarea', rows: 10, required: true, showIf: has('code') },
  { name: 'code_language', label: 'pf.articles.codeLanguage', type: 'select', initial: 'text', showIf: has('code'),
    options: CODE_LANGUAGES.map(value => ({ value, label: value })) },
];

/** A video's thumbnail from its link when none was given (YouTube only, no request). */
const shapeBlock = (row: Record<string, unknown>) =>
  row.kind === 'video' && !row.thumbnail_url && row.link_url ? { ...row, thumbnail_url: youTubeThumbnail(String(row.link_url)) ?? null } : row;

const blockPreview = (r: PfRow) => {
  switch (r.kind) {
    case 'image': return String(r.alt_en || r.caption_en || r.media_url || '');
    case 'video': case 'link': return String(r.caption_en || r.link_url || '');
    case 'code': return String(r.code ?? '').split('\n')[0];
    case 'divider': return '———';
    default: return richPlainText(String(r.text_en ?? ''));
  }
};

/** Roughly 200 words a minute over the visible text blocks. */
const readingMinutes = (blocks: PfRow[]) => {
  const words = blocks
    .filter(b => b.is_visible !== false && ['text', 'heading', 'quote', 'code'].includes(String(b.kind)))
    .map(b => (b.kind === 'code' ? String(b.code ?? '') : richPlainText(String(b.text_en ?? ''))))
    .join(' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
};

export const PfArticles = () => {
  const { t } = useLanguage();
  const userId = usePfUserId();
  const [article, setArticle] = useState<PfRow | null>(null);
  const [reload, setReload] = useState(0);
  const upload = userId ? { bucket: PF_BUCKET, folder: `${userId}/posts` } : undefined;

  // Keeps the article's reading time in step with its body.
  const onBlocks = useCallback(async (blocks: PfRow[]) => {
    if (!article || !userId) return;
    const minutes = readingMinutes(blocks);
    if (minutes === article.reading_minutes) return;
    const { error } = await supabase.from('pf_posts').update({ reading_minutes: minutes }).eq('id', article.id).eq('user_id', userId);
    if (!error) { setArticle(a => (a ? { ...a, reading_minutes: minutes } : a)); setReload(n => n + 1); }
  }, [article, userId]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PfPageHeader title="pf.articles.pageTitle" subtitle="pf.articles.pageSubtitle" />
      <PfListEditor
        table="pf_posts"
        title="pf.articles.posts"
        fields={POST_FIELDS}
        transform={shapePost}
        upload={upload}
        searchable
        reloadSignal={reload}
        renderRow={r => (
          <PfRowText
            primary={String(r.title_en)}
            secondary={[
              t(`pf.articles.platforms.${r.kind === 'article' ? 'native' : r.platform}`),
              r.published_at,
              r.kind === 'article' ? `/articles/${r.slug}` : r.external_url,
              r.reading_minutes ? `${r.reading_minutes} min` : null,
            ].filter(Boolean).join(' · ')}
            extra={<>
              <Badge variant="default">{t(`pf.articles.kinds.${r.kind}`)}</Badge>
              {r.status === 'draft' && <Badge variant="warning">{t('pf.articles.statuses.draft')}</Badge>}
              {r.is_featured === true && <Badge variant="success">{t('pf.work.featured')}</Badge>}
            </>}
          />
        )}
        rowActions={r => r.kind === 'article' ? (
          <button className="p-1.5 rounded-md text-primary hover:bg-primary/10" onClick={() => setArticle(r)} title={t('pf.articles.editBody')}>
            <FileText size={16} />
          </button>
        ) : (
          <a className="p-1.5 rounded-md text-primary hover:bg-primary/10" href={String(r.external_url)} target="_blank" rel="noopener noreferrer" title={t('pf.articles.openLink')}>
            <ExternalLink size={16} />
          </a>
        )}
      />

      <Modal isOpen={!!article} onClose={() => setArticle(null)} title={`${t('pf.articles.body')} · ${article?.title_en ?? ''}`} className="max-w-4xl">
        {article && (
          <PfListEditor
            key={article.id}
            table="pf_post_blocks"
            title="pf.articles.blocksTitle"
            subtitle="pf.articles.blocksHint"
            fields={BLOCK_FIELDS}
            scope={{ post_id: article.id }}
            transform={shapeBlock}
            upload={upload}
            onRowsChange={blocks => void onBlocks(blocks)}
            renderRow={r => (
              <PfRowText
                primary={blockPreview(r) || '—'}
                extra={<Badge variant="muted">{t(`pf.articles.blocks.${r.kind}`)}</Badge>}
              />
            )}
          />
        )}
      </Modal>
    </div>
  );
};
