import { useEffect, useState } from 'react';
import { IsListEditor, IsRowText } from '../../components/islamicStudio/IsListEditor';
import type { IsField } from '../../components/islamicStudio/IsFieldInput';
import { Badge } from '../../components/ui/Button';
import { useLanguage } from '../../lib/LanguageContext';
import { supabase } from '../../lib/supabase';
import { isText } from '../../lib/islamicStudio';
import { PfPageHeader, PfTabs } from '../Portfolio/PfPageHeader';

const PACK_KINDS = ['quran_translation', 'tafsir', 'word_by_word', 'transliteration', 'hadith', 'audio_timings'];

const RECITER_FIELDS: IsField[] = [
  { name: 'name', label: 'is.common.name', type: 'i18n', required: true },
  { name: 'style', label: 'is.quran.style', type: 'select', allowEmpty: true,
    options: ['murattal', 'mujawwad', 'muallim'].map(s => ({ value: s, label: `is.quran.styles.${s}` })) },
  { name: 'audio_url_template', label: 'is.quran.audioTemplate', type: 'text', required: true, hint: 'is.quran.audioTemplateHint' },
  { name: 'photo_url', label: 'is.common.image', type: 'upload', accept: 'image/*' },
  { name: 'license', label: 'is.quran.license', type: 'text' },
  { name: 'is_default', label: 'is.common.default', type: 'boolean' },
  { name: 'is_active', label: 'is.common.active', type: 'boolean' },
];

const DAILY_FIELDS: IsField[] = [
  { name: 'kind', label: 'is.quran.dailyKind', type: 'select', required: true,
    options: ['ayah', 'hadith', 'dua'].map(k => ({ value: k, label: `is.quran.daily.${k}` })) },
  { name: 'ref', label: 'is.quran.ref', type: 'text', required: true, hint: 'is.quran.refHint' },
  { name: 'show_on', label: 'is.quran.showOn', type: 'date', hint: 'is.quran.showOnHint' },
  { name: 'note', label: 'is.common.note', type: 'i18nArea' },
  { name: 'is_active', label: 'is.common.active', type: 'boolean' },
];

const COLLECTION_FIELDS: IsField[] = [
  { name: 'slug', label: 'is.common.slug', type: 'text', required: true, hint: 'is.common.slugHint' },
  { name: 'name', label: 'is.common.name', type: 'i18n', required: true },
  { name: 'compiler', label: 'is.quran.compiler', type: 'i18n' },
  { name: 'hadith_count', label: 'is.quran.hadithCount', type: 'number' },
  { name: 'description', label: 'is.common.description', type: 'i18nArea' },
  { name: 'is_active', label: 'is.common.active', type: 'boolean' },
];

type Tab = 'packs' | 'daily' | 'reciters' | 'hadith';

export const IsQuran = () => {
  const { t, language } = useLanguage();
  const [tab, setTab] = useState<Tab>('packs');
  const [languages, setLanguages] = useState<{ value: string; label: string }[]>([]);
  const [collections, setCollections] = useState<{ value: string; label: string }[]>([]);
  useEffect(() => {
    void supabase.from('is_languages').select('code, name').order('sort_order').then(({ data }) =>
      setLanguages((data ?? []).map(l => ({ value: String(l.code), label: `${l.name} (${l.code})` }))));
    void supabase.from('is_hadith_collections').select('id, name').order('sort_order').then(({ data }) =>
      setCollections((data ?? []).map(c => ({ value: String(c.id), label: isText(c.name, language) }))));
  }, [language, tab]);

  const packFields: IsField[] = [
    { name: 'kind', label: 'is.quran.packKind', type: 'select', required: true, options: PACK_KINDS.map(k => ({ value: k, label: `is.quran.kinds.${k}` })) },
    { name: 'hadith_collection_id', label: 'is.quran.collection', type: 'select', options: collections, required: true, when: v => v.kind === 'hadith' },
    { name: 'slug', label: 'is.common.slug', type: 'text', required: true, hint: 'is.quran.packSlugHint' },
    { name: 'language', label: 'is.quran.language', type: 'select', options: languages, allowEmpty: true },
    { name: 'name', label: 'is.common.name', type: 'i18n', required: true },
    { name: 'author', label: 'is.quran.author', type: 'text' },
    { name: 'source_url', label: 'is.quran.sourceUrl', type: 'text' },
    { name: 'license', label: 'is.quran.license', type: 'text', hint: 'is.quran.licenseHint' },
    { name: 'is_stored', label: 'is.quran.stored', type: 'boolean', hint: 'is.quran.storedHint' },
    { name: 'api_edition', label: 'is.quran.apiEdition', type: 'text', hint: 'is.quran.apiEditionHint', when: v => v.is_stored !== true },
    { name: 'file_url', label: 'is.quran.file', type: 'upload', accept: '.json,.sqlite,.db,.zip,application/json', hint: 'is.quran.fileHint', when: v => v.is_stored !== true },
    { name: 'file_size_bytes', label: 'is.quran.fileSize', type: 'number' },
    { name: 'sha256', label: 'is.quran.sha256', type: 'text' },
    { name: 'version', label: 'is.quran.version', type: 'number', required: true },
    { name: 'min_version_code', label: 'is.features.minVersion', type: 'number' },
    { name: 'is_default', label: 'is.common.default', type: 'boolean', hint: 'is.quran.defaultHint' },
    { name: 'is_active', label: 'is.common.active', type: 'boolean' },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PfPageHeader title="is.quran.pageTitle" subtitle="is.quran.pageSubtitle" />
      <PfTabs<Tab>
        tabs={[
          { key: 'packs', label: 'is.quran.tabPacks' },
          { key: 'daily', label: 'is.quran.tabDaily' },
          { key: 'reciters', label: 'is.quran.tabReciters' },
          { key: 'hadith', label: 'is.quran.tabHadith' },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'packs' && (
        <IsListEditor
          table="is_content_packs"
          title="is.quran.packsTitle"
          subtitle="is.quran.packsSubtitle"
          fields={packFields}
          reviewed
          audited="both"
          defaults={{ kind: 'quran_translation', version: '1' }}
          filters={[{ name: 'kind', label: 'is.quran.packKind', options: PACK_KINDS.map(k => ({ value: k, label: `is.quran.kinds.${k}` })) }]}
          renderRow={r => (
            <IsRowText
              primary={isText(r.name, language)}
              secondary={`${t(`is.quran.kinds.${r.kind}`)} · ${r.language ?? '—'} · v${r.version} · ${r.is_stored ? t('is.quran.stored') : r.api_edition ? `${t('is.quran.apiEdition')}: ${r.api_edition}` : t('is.quran.file')}`}
              extra={!String(r.license ?? '').trim() ? <Badge variant="danger">{t('is.quran.noLicense')}</Badge> : r.is_default ? <Badge>{t('is.common.default')}</Badge> : undefined}
            />
          )}
        />
      )}
      {tab === 'daily' && (
        <IsListEditor
          table="is_daily_items"
          title="is.quran.dailyTitle"
          subtitle="is.quran.dailySubtitle"
          fields={DAILY_FIELDS}
          defaults={{ kind: 'ayah' }}
          filters={[{ name: 'kind', label: 'is.quran.dailyKind', options: ['ayah', 'hadith', 'dua'].map(k => ({ value: k, label: `is.quran.daily.${k}` })) }]}
          renderRow={r => (
            <IsRowText primary={`${t(`is.quran.daily.${r.kind}`)} ${r.ref}`} secondary={r.show_on ? `${t('is.quran.showOn')}: ${r.show_on}` : t('is.quran.inRotation')} />
          )}
        />
      )}
      {tab === 'reciters' && (
        <IsListEditor
          table="is_reciters"
          title="is.quran.recitersTitle"
          subtitle="is.quran.recitersSubtitle"
          fields={RECITER_FIELDS}
          renderRow={r => <IsRowText primary={isText(r.name, language)} secondary={[r.style ? t(`is.quran.styles.${r.style}`) : '', r.is_default ? t('is.common.default') : ''].filter(Boolean).join(' · ')} />}
        />
      )}
      {tab === 'hadith' && (
        <IsListEditor
          table="is_hadith_collections"
          title="is.quran.hadithTitle"
          subtitle="is.quran.hadithSubtitle"
          fields={COLLECTION_FIELDS}
          renderRow={r => <IsRowText primary={isText(r.name, language)} secondary={`${r.slug}${r.hadith_count ? ` · ${r.hadith_count}` : ''}`} />}
        />
      )}
    </div>
  );
};
