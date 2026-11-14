import { useEffect, useMemo, useState } from 'react';
import { IsListEditor, IsRowText } from '../../components/islamicStudio/IsListEditor';
import type { IsField } from '../../components/islamicStudio/IsFieldInput';
import { useLanguage } from '../../lib/LanguageContext';
import { supabase } from '../../lib/supabase';
import { isText, type IsRow } from '../../lib/islamicStudio';
import { PfPageHeader, PfTabs } from '../Portfolio/PfPageHeader';

const arabicClass = 'text-xl leading-loose text-gray-900 dark:text-gray-100 truncate';
const arabicStyle = { fontFamily: '"Amiri", "Scheherazade New", "Noto Naskh Arabic", serif' };

const CATEGORY_FIELDS: IsField[] = [
  { name: 'slug', label: 'is.common.slug', type: 'text', required: true, hint: 'is.common.slugHint' },
  { name: 'name', label: 'is.common.name', type: 'i18n', required: true },
  { name: 'icon', label: 'is.common.icon', type: 'text', hint: 'is.common.iconHint' },
  { name: 'is_active', label: 'is.common.active', type: 'boolean' },
];

const DHIKR_FIELDS: IsField[] = [
  { name: 'arabic', label: 'is.duas.arabic', type: 'arabic', required: true },
  { name: 'transliteration', label: 'is.duas.transliteration', type: 'i18n' },
  { name: 'translation', label: 'is.duas.translation', type: 'i18nArea', required: true },
  { name: 'default_target', label: 'is.duas.defaultTarget', type: 'number', required: true },
  { name: 'virtue', label: 'is.duas.virtue', type: 'i18nArea' },
  { name: 'source_ref', label: 'is.duas.source', type: 'text', required: true, hint: 'is.duas.sourceHint' },
  { name: 'is_active', label: 'is.common.active', type: 'boolean' },
];

type Tab = 'duas' | 'categories' | 'dhikr';

/** A dua's categories live in is_dua_category_items; the form edits them as `categories`. */
async function saveDuaCategories(duaId: string, categoryIds: string[]) {
  const { data: current, error } = await supabase.from('is_dua_category_items').select('category_id').eq('dua_id', duaId);
  if (error) throw error;
  const have = new Set((current ?? []).map(c => String(c.category_id)));
  const removed = [...have].filter(id => !categoryIds.includes(id));
  const added = categoryIds.filter(id => !have.has(id));
  if (removed.length) {
    const { error: e } = await supabase.from('is_dua_category_items').delete().eq('dua_id', duaId).in('category_id', removed);
    if (e) throw e;
  }
  if (added.length) {
    // Added last in each category.
    const { error: e } = await supabase.from('is_dua_category_items').insert(added.map(category_id => ({ category_id, dua_id: duaId, sort_order: 1000 })));
    if (e) throw e;
  }
}

export const IsDuas = () => {
  const { t, language } = useLanguage();
  const [tab, setTab] = useState<Tab>('duas');
  const [categories, setCategories] = useState<IsRow[]>([]);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    void supabase.from('is_dua_categories').select('id, name, slug').order('sort_order').then(({ data }) => setCategories(data ?? []));
  }, [reload, tab]);
  const categoryOptions = useMemo(() => categories.map(c => ({ value: String(c.id), label: isText(c.name, language) })), [categories, language]);
  const categoryName = (id: unknown) => categoryOptions.find(o => o.value === id)?.label ?? '';

  const duaFields: IsField[] = [
    { name: 'title', label: 'is.common.title', type: 'i18n', required: true },
    { name: 'categories', label: 'is.duas.categories', type: 'multi', options: categoryOptions, virtual: true },
    { name: 'arabic', label: 'is.duas.arabic', type: 'arabic', required: true },
    { name: 'transliteration', label: 'is.duas.transliteration', type: 'i18nArea' },
    { name: 'translation', label: 'is.duas.translation', type: 'i18nArea', required: true },
    { name: 'when_to_read', label: 'is.duas.whenToRead', type: 'i18n' },
    { name: 'repeat_count', label: 'is.duas.repeat', type: 'number', required: true },
    { name: 'virtue', label: 'is.duas.virtue', type: 'i18nArea' },
    { name: 'source_ref', label: 'is.duas.source', type: 'text', required: true, hint: 'is.duas.sourceHint' },
    { name: 'grade', label: 'is.duas.grade', type: 'select', allowEmpty: true,
      options: ['quran', 'sahih', 'hasan', 'daif'].map(g => ({ value: g, label: `is.duas.grades.${g}` })) },
    { name: 'audio_url', label: 'is.common.audio', type: 'upload', accept: 'audio/*' },
    { name: 'is_active', label: 'is.common.active', type: 'boolean' },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PfPageHeader title="is.duas.pageTitle" subtitle="is.duas.pageSubtitle" />
      <PfTabs<Tab>
        tabs={[{ key: 'duas', label: 'is.duas.tabDuas' }, { key: 'categories', label: 'is.duas.tabCategories' }, { key: 'dhikr', label: 'is.duas.tabDhikr' }]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'duas' && (
        <IsListEditor
          table="is_duas"
          title="is.duas.duasTitle"
          subtitle="is.duas.duasSubtitle"
          select="*, is_dua_category_items(category_id)"
          fields={duaFields}
          ordered={false}
          activeToggle
          reviewed
          audited="both"
          orderBy={['-created_at']}
          searchable
          pageSize={20}
          defaults={{ repeat_count: '1' }}
          filters={[{ name: 'review_status', label: 'is.review.status', options: ['draft', 'in_review', 'approved', 'rejected'].map(s => ({ value: s, label: `is.review.${s}` })) }]}
          formFromRow={r => ({ categories: ((r.is_dua_category_items as { category_id: string }[] | undefined) ?? []).map(c => c.category_id).join(',') })}
          afterSave={async (row, values) => {
            await saveDuaCategories(String(row.id), String(values.categories ?? '').split(',').filter(Boolean));
          }}
          renderRow={r => (
            <div className="min-w-0 space-y-1">
              <IsRowText
                primary={isText(r.title, language)}
                secondary={[
                  ((r.is_dua_category_items as { category_id: string }[] | undefined) ?? []).map(c => categoryName(c.category_id)).filter(Boolean).join(', '),
                  r.source_ref,
                ].filter(Boolean).join(' · ')}
              />
              <p dir="rtl" lang="ar" className={arabicClass} style={arabicStyle}>{String(r.arabic ?? '')}</p>
            </div>
          )}
        />
      )}
      {tab === 'categories' && (
        <IsListEditor
          table="is_dua_categories"
          title="is.duas.categoriesTitle"
          fields={CATEGORY_FIELDS}
          afterSave={async () => setReload(n => n + 1)}
          renderRow={r => <IsRowText primary={isText(r.name, language)} secondary={String(r.slug)} />}
        />
      )}
      {tab === 'dhikr' && (
        <IsListEditor
          table="is_dhikr_presets"
          title="is.duas.dhikrTitle"
          subtitle="is.duas.dhikrSubtitle"
          fields={DHIKR_FIELDS}
          reviewed
          audited="both"
          defaults={{ default_target: '33' }}
          renderRow={r => (
            <div className="min-w-0 space-y-1">
              <p dir="rtl" lang="ar" className={arabicClass} style={arabicStyle}>{String(r.arabic ?? '')}</p>
              <IsRowText primary={isText(r.translation, language)} secondary={`× ${r.default_target} · ${r.source_ref ?? '—'}`} />
            </div>
          )}
        />
      )}
      <p className="text-xs text-gray-500 dark:text-gray-400">{t('is.duas.footnote')}</p>
    </div>
  );
};
