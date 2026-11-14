import { useCallback, useEffect, useState } from 'react';
import { PlayCircle, Headphones } from 'lucide-react';
import { IsListEditor, IsRowText } from '../../components/islamicStudio/IsListEditor';
import type { IsField, IsFormValues } from '../../components/islamicStudio/IsFieldInput';
import { useLanguage } from '../../lib/LanguageContext';
import { supabase } from '../../lib/supabase';
import { isText, type IsRow } from '../../lib/islamicStudio';
import { Badge } from '../../components/ui/Button';
import { PfPageHeader, PfTabs } from '../Portfolio/PfPageHeader';

/** The 11-character id from any YouTube link (watch, youtu.be, shorts, embed, live) or a bare id. */
export function youtubeId(link: string): string | null {
  const s = link.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  return s.match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([\w-]{11})/)?.[1] ?? null;
}

const LANGUAGES = ['bn', 'en', 'ar', 'ur'].map(code => ({ value: code, label: `is.media.languages.${code}` }));
const CATEGORY_FIELDS: IsField[] = [
  { name: 'slug', label: 'is.common.slug', type: 'text', required: true, hint: 'is.common.slugHint' },
  { name: 'name', label: 'is.common.name', type: 'i18n', required: true },
  { name: 'is_active', label: 'is.common.active', type: 'boolean' },
];

type Tab = 'items' | 'categories';

/**
 * Audio & Video: YouTube videos (paste the link) and audio talks (upload up to
 * 50 MB, or paste an https link to audio hosted elsewhere), in categories such
 * as lectures, waz mahfil and debates. Reviewed before the app shows them.
 */
export const IsMedia = () => {
  const { t, language } = useLanguage();
  const [tab, setTab] = useState<Tab>('items');
  const [categories, setCategories] = useState<{ value: string; label: string }[]>([]);
  const [reload, setReload] = useState(0);
  const categoriesChanged = useCallback(() => setReload(n => n + 1), []);
  useEffect(() => {
    void supabase.from('is_media_categories').select('id, name').order('sort_order').then(({ data }) =>
      setCategories((data ?? []).map(c => ({ value: String(c.id), label: isText(c.name, language) }))));
  }, [language, reload]);

  const fields: IsField[] = [
    { name: 'kind', label: 'is.media.kind', type: 'select', required: true, options: [{ value: 'video', label: 'is.media.video' }, { value: 'audio', label: 'is.media.audio' }] },
    { name: 'category_id', label: 'is.media.category', type: 'select', allowEmpty: true, options: categories.map(c => ({ ...c, label: c.label })) },
    { name: 'title', label: 'is.common.title', type: 'i18n', required: true },
    { name: 'speaker', label: 'is.media.speaker', type: 'i18n' },
    { name: 'description', label: 'is.common.description', type: 'i18nArea' },
    { name: 'youtube_id', label: 'is.media.youtube', type: 'text', hint: 'is.media.youtubeHint', when: v => v.kind === 'video' },
    { name: 'audio_url', label: 'is.media.audioFile', type: 'upload', accept: 'audio/*', hint: 'is.media.audioHint', when: v => v.kind === 'audio' },
    { name: 'duration_seconds', label: 'is.media.minutes', type: 'number' },
    { name: 'language', label: 'is.media.language', type: 'select', allowEmpty: true, options: LANGUAGES },
    { name: 'thumbnail_url', label: 'is.media.thumbnail', type: 'upload', accept: 'image/*', hint: 'is.media.thumbnailHint' },
    { name: 'tags', label: 'is.media.tags', type: 'tags' },
    { name: 'is_featured', label: 'is.media.featured', type: 'boolean' },
    { name: 'is_active', label: 'is.common.active', type: 'boolean' },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PfPageHeader title="is.media.pageTitle" subtitle="is.media.pageSubtitle" />
      <PfTabs<Tab> tabs={[{ key: 'items', label: 'is.media.tabItems' }, { key: 'categories', label: 'is.media.tabCategories' }]} active={tab} onChange={setTab} />
      {tab === 'items' ? (
        <IsListEditor
          table="is_media_items"
          title="is.media.itemsTitle"
          fields={fields}
          reviewed
          audited="both"
          searchable
          pageSize={25}
          defaults={{ kind: 'video', is_active: true }}
          filters={[
            { name: 'kind', label: 'is.media.kind', options: [{ value: 'video', label: 'is.media.video' }, { value: 'audio', label: 'is.media.audio' }] },
            { name: 'category_id', label: 'is.media.category', options: categories.map(c => ({ value: c.value, label: c.label })) },
          ]}
          // Minutes in the form, seconds in the table; any YouTube link becomes its id.
          formFromRow={(r: IsRow): IsFormValues => ({ duration_seconds: r.duration_seconds ? String(Math.round(Number(r.duration_seconds) / 60)) : '' })}
          transform={(row: IsRow, v: IsFormValues) => ({
            ...row,
            youtube_id: v.kind === 'video' ? youtubeId(String(v.youtube_id ?? '')) : null,
            audio_url: v.kind === 'audio' ? (String(v.audio_url ?? '').trim() || null) : null,
            duration_seconds: Number(v.duration_seconds) > 0 ? Math.round(Number(v.duration_seconds) * 60) : null,
          })}
          renderRow={r => (
            <div className="flex items-center gap-3 min-w-0">
              {r.kind === 'video' && r.youtube_id
                ? <img src={`https://i.ytimg.com/vi/${r.youtube_id}/default.jpg`} alt="" className="h-10 w-16 shrink-0 rounded object-cover" />
                : <span className="grid h-10 w-16 shrink-0 place-items-center rounded bg-gray-100 dark:bg-gray-700">{r.kind === 'video' ? <PlayCircle size={18} /> : <Headphones size={18} />}</span>}
              <IsRowText
                primary={isText(r.title, language)}
                secondary={[isText(r.speaker, language), categories.find(c => c.value === r.category_id)?.label, r.duration_seconds ? `${Math.round(Number(r.duration_seconds) / 60)} min` : ''].filter(Boolean).join(' · ')}
                extra={r.is_featured ? <Badge>{t('is.media.featured')}</Badge> : undefined}
              />
            </div>
          )}
        />
      ) : (
        <IsListEditor
          table="is_media_categories"
          title="is.media.categoriesTitle"
          fields={CATEGORY_FIELDS}
          onRowsChange={categoriesChanged}
          renderRow={r => <IsRowText primary={isText(r.name, language)} secondary={String(r.slug)} />}
        />
      )}
    </div>
  );
};
