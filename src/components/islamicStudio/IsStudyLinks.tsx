import { useEffect, useMemo, useState } from 'react';
import { IsListEditor, IsRowText } from './IsListEditor';
import type { IsField } from './IsFieldInput';
import { Badge } from '../ui/Button';
import { useLanguage } from '../../lib/LanguageContext';
import { supabase } from '../../lib/supabase';
import { isText } from '../../lib/islamicStudio';

// Study resources (is_study_links, migration 087) for an Academy section or a
// quiz: blog posts, books, audio talks and videos the app lists with it.

type Resource = { value: string; label: string; kind: 'blog' | 'book' | 'video' | 'audio' };

/** Every post, book and media item, as "<type>:<id>" choices. */
function useResources(language: string): Resource[] {
  const [list, setList] = useState<Resource[]>([]);
  useEffect(() => {
    void Promise.all([
      supabase.from('is_books').select('id, title').order('sort_order'),
      supabase.from('is_media_items').select('id, kind, title').order('sort_order'),
      supabase.from('is_blog_posts').select('id, title').eq('review_status', 'approved').order('created_at', { ascending: false }).limit(500),
    ]).then(([books, media, posts]) => setList([
      ...(books.data ?? []).map(b => ({ value: `book:${b.id}`, label: `📕 ${isText(b.title, language)}`, kind: 'book' as const })),
      ...(media.data ?? []).map(m => ({ value: `media:${m.id}`, label: `${m.kind === 'video' ? '🎬' : '🎧'} ${isText(m.title, language)}`, kind: m.kind as 'video' | 'audio' })),
      ...(posts.data ?? []).map(p => ({ value: `blog:${p.id}`, label: `📝 ${String(p.title)}`, kind: 'blog' as const })),
    ]));
  }, [language]);
  return list;
}

export const IsStudyLinks = ({ targetType, targetId }: { targetType: 'section' | 'quiz'; targetId: string }) => {
  const { t, language } = useLanguage();
  const resources = useResources(language);
  const byValue = useMemo(() => new Map(resources.map(r => [r.value, r])), [resources]);
  const fields: IsField[] = [
    { name: 'resource', label: 'is.study.resource', type: 'select', required: true, virtual: true, options: resources.map(r => ({ value: r.value, label: r.label })) },
    { name: 'note', label: 'is.study.note', type: 'i18n', hint: 'is.study.noteHint' },
    { name: 'is_active', label: 'is.common.active', type: 'boolean' },
  ];
  return (
    <IsListEditor
      key={`${targetType}-${targetId}`}
      table="is_study_links"
      title="is.study.title"
      subtitle="is.study.subtitle"
      scope={{ target_type: targetType, target_id: targetId }}
      fields={fields}
      formFromRow={r => ({ resource: `${String(r.resource_type)}:${String(r.resource_id)}` })}
      transform={(row, values) => {
        const [resource_type, resource_id] = String(values.resource).split(':');
        return { ...row, resource_type, resource_id };
      }}
      renderRow={r => {
        const res = byValue.get(`${String(r.resource_type)}:${String(r.resource_id)}`);
        return (
          <div className="flex items-center gap-2 min-w-0">
            <Badge variant="default">{t(`is.study.kinds.${res?.kind ?? r.resource_type}`)}</Badge>
            <IsRowText primary={res?.label.replace(/^\S+\s/, '') ?? t('is.study.missing')} secondary={isText(r.note, language)} />
          </div>
        );
      }}
    />
  );
};
