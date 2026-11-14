import { useCallback, useEffect, useState } from 'react';
import { BookText } from 'lucide-react';
import { IsListEditor, IsRowText } from '../../components/islamicStudio/IsListEditor';
import type { IsField } from '../../components/islamicStudio/IsFieldInput';
import { useLanguage } from '../../lib/LanguageContext';
import { supabase } from '../../lib/supabase';
import { isText } from '../../lib/islamicStudio';
import { Badge } from '../../components/ui/Button';
import { PfPageHeader, PfTabs } from '../Portfolio/PfPageHeader';

const CATEGORY_FIELDS: IsField[] = [
  { name: 'slug', label: 'is.common.slug', type: 'text', required: true, hint: 'is.common.slugHint' },
  { name: 'name', label: 'is.common.name', type: 'i18n', required: true },
  { name: 'is_active', label: 'is.common.active', type: 'boolean' },
];

type Tab = 'books' | 'categories';

/**
 * Books read in the app's PDF reader: upload the PDF (up to 50 MB) or link
 * one, with its licence (needed before approval) and where it came from.
 */
export const IsBooks = () => {
  const { t, language } = useLanguage();
  const [tab, setTab] = useState<Tab>('books');
  const [categories, setCategories] = useState<{ value: string; label: string }[]>([]);
  const [reload, setReload] = useState(0);
  const categoriesChanged = useCallback(() => setReload(n => n + 1), []);
  useEffect(() => {
    void supabase.from('is_book_categories').select('id, name').order('sort_order').then(({ data }) =>
      setCategories((data ?? []).map(c => ({ value: String(c.id), label: isText(c.name, language) }))));
  }, [language, reload]);

  const fields: IsField[] = [
    { name: 'category_id', label: 'is.books.category', type: 'select', allowEmpty: true, options: categories },
    { name: 'title', label: 'is.common.title', type: 'i18n', required: true },
    { name: 'author', label: 'is.books.author', type: 'i18n' },
    { name: 'description', label: 'is.common.description', type: 'i18nArea' },
    { name: 'language', label: 'is.media.language', type: 'select', required: true, options: ['bn', 'en', 'ar', 'ur'].map(code => ({ value: code, label: `is.media.languages.${code}` })) },
    { name: 'file_url', label: 'is.books.pdf', type: 'upload', accept: 'application/pdf', required: true, hint: 'is.books.pdfHint' },
    { name: 'cover_path', label: 'is.books.cover', type: 'upload', accept: 'image/*' },
    { name: 'pages', label: 'is.books.pages', type: 'number' },
    { name: 'license', label: 'is.quran.license', type: 'textarea', hint: 'is.books.licenseHint' },
    { name: 'source_url', label: 'is.quran.sourceUrl', type: 'text' },
    { name: 'is_active', label: 'is.common.active', type: 'boolean' },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PfPageHeader title="is.books.pageTitle" subtitle="is.books.pageSubtitle" />
      <PfTabs<Tab> tabs={[{ key: 'books', label: 'is.books.tabBooks' }, { key: 'categories', label: 'is.media.tabCategories' }]} active={tab} onChange={setTab} />
      {tab === 'books' ? (
        <IsListEditor
          table="is_books"
          title="is.books.listTitle"
          fields={fields}
          reviewed
          audited="both"
          searchable
          pageSize={25}
          defaults={{ language: 'bn', is_active: true }}
          filters={[{ name: 'category_id', label: 'is.books.category', options: categories }]}
          renderRow={r => (
            <div className="flex items-center gap-3 min-w-0">
              {r.cover_path
                ? <img src={String(r.cover_path)} alt="" className="h-12 w-9 shrink-0 rounded object-cover" />
                : <span className="grid h-12 w-9 shrink-0 place-items-center rounded bg-gray-100 dark:bg-gray-700"><BookText size={16} /></span>}
              <IsRowText
                primary={isText(r.title, language)}
                secondary={[isText(r.author, language), categories.find(c => c.value === r.category_id)?.label, String(r.language ?? '')].filter(Boolean).join(' · ')}
                extra={!String(r.license ?? '').trim() ? <Badge variant="danger">{t('is.quran.noLicense')}</Badge> : undefined}
              />
            </div>
          )}
        />
      ) : (
        <IsListEditor
          table="is_book_categories"
          title="is.books.categoriesTitle"
          fields={CATEGORY_FIELDS}
          onRowsChange={categoriesChanged}
          renderRow={r => <IsRowText primary={isText(r.name, language)} secondary={String(r.slug)} />}
        />
      )}
    </div>
  );
};
