import { useMemo, useState } from 'react';
import { IsListEditor, IsRowText } from '../../components/islamicStudio/IsListEditor';
import type { IsField, IsFormValues } from '../../components/islamicStudio/IsFieldInput';
import { Badge } from '../../components/ui/Button';
import { useLanguage } from '../../lib/LanguageContext';
import { supabase } from '../../lib/supabase';
import { isText, type IsRow } from '../../lib/islamicStudio';
import { LpScope, lpChoices, lpRangeLabel, useLpOptions } from '../../lib/parenting';
import { PfPageHeader, PfTabs } from '../Portfolio/PfPageHeader';

type Tab = 'resources' | 'sources';

const KINDS = lpChoices('lp.library.kinds', ['article', 'video', 'animation', 'audio', 'infographic', 'checklist', 'quiz', 'scenario', 'emergency', 'story', 'activity']);
const PERSPECTIVES = lpChoices('lp.common.perspectives', ['scientific', 'islamic', 'cultural', 'general']);
const AUDIENCES = lpChoices('lp.common.audiences', ['shared', 'mother', 'father', 'child', 'family']);
const URGENCIES = lpChoices('lp.library.urgencies', ['educational', 'routine', 'important', 'emergency']);
const EVIDENCE = lpChoices('lp.library.evidences', ['guideline', 'consensus', 'research', 'limited', 'religious', 'tradition']);
const SEXES = lpChoices('lp.common.sexes', ['any', 'female', 'male']);
const SOURCE_KINDS = lpChoices('lp.library.sourceKinds', ['guideline', 'systematic_review', 'research', 'national_policy', 'quran', 'hadith', 'fiqh', 'scholar', 'cultural', 'other']);
const REVIEW = ['draft', 'in_review', 'approved', 'rejected'].map(s => ({ value: s, label: `is.review.${s}` }));

const list = (v: string | boolean | undefined) => String(v ?? '').split(',').map(s => s.trim()).filter(Boolean);

/** Replaces a resource's links (categories or sources) with the picked ones. */
async function relink(table: string, resourceId: unknown, column: string, ids: string[]) {
  const { error } = await supabase.from(table).delete().eq('resource_id', resourceId);
  if (error) throw error;
  if (!ids.length) return;
  const { error: insertError } = await supabase.from(table).insert(ids.map((id, i) => ({ resource_id: resourceId, [column]: id, sort_order: i })));
  if (insertError) throw insertError;
}

/**
 * Every guide, video, checklist, "What should I do?" scenario and emergency
 * page, each with its age range, audience, perspective and evidence; and the
 * evidence sources they cite.
 */
export const LpLibrary = () => {
  const { t, language } = useLanguage();
  const [tab, setTab] = useState<Tab>('resources');
  const [reload, setReload] = useState(0);
  const options = useLpOptions(language, reload);
  const sourceName = useMemo(() => new Map(options.sources.map(s => [s.value, s.label])), [options.sources]);

  const resourceFields: IsField[] = [
    { name: 'slug', label: 'is.common.slug', type: 'text', required: true, hint: 'lp.library.slugHint' },
    { name: 'kind', label: 'lp.library.kind', type: 'select', required: true, options: KINDS },
    { name: 'perspective', label: 'lp.common.perspective', type: 'select', required: true, options: PERSPECTIVES, hint: 'lp.common.perspectiveHint' },
    { name: 'audience', label: 'lp.common.audience', type: 'select', required: true, options: AUDIENCES },
    { name: 'urgency', label: 'lp.library.urgency', type: 'select', required: true, options: URGENCIES },
    { name: 'evidence_level', label: 'lp.library.evidence', type: 'select', allowEmpty: true, options: EVIDENCE },
    { name: 'emoji', label: 'lp.common.emoji', type: 'text' },
    { name: 'title', label: 'is.common.title', type: 'i18n', required: true },
    { name: 'summary', label: 'lp.library.summary', type: 'i18nArea' },
    { name: 'body', label: 'lp.library.body', type: 'i18nArea', hint: 'lp.library.bodyHint' },
    { name: 'sections', label: 'lp.library.sections', type: 'json', hint: 'lp.library.sectionsHint' },
    { name: 'categories', label: 'lp.common.categories', type: 'multi', virtual: true, options: options.categories },
    { name: 'sources', label: 'lp.common.sources', type: 'multi', virtual: true, options: options.sources },
    { name: 'min_day', label: 'lp.common.minDay', type: 'number', hint: 'lp.common.dayHint' },
    { name: 'max_day', label: 'lp.common.maxDay', type: 'number', hint: 'lp.common.maxDayHint' },
    { name: 'sex', label: 'lp.common.sex', type: 'select', required: true, options: SEXES },
    { name: 'countries', label: 'lp.common.countries', type: 'tags', hint: 'lp.common.countriesHint' },
    { name: 'tags', label: 'lp.library.tags', type: 'tags' },
    { name: 'media_url', label: 'lp.library.media', type: 'upload', accept: 'image/*,video/*,audio/*,application/json', hint: 'lp.library.mediaHint' },
    { name: 'thumbnail_url', label: 'lp.library.thumbnail', type: 'upload', accept: 'image/*' },
    { name: 'duration_seconds', label: 'lp.library.duration', type: 'number', when: v => ['video', 'animation', 'audio'].includes(String(v.kind)) },
    { name: 'reading_minutes', label: 'lp.library.readingMinutes', type: 'number' },
    { name: 'reviewer_names', label: 'lp.library.reviewerNames', type: 'text', hint: 'lp.library.reviewerNamesHint' },
    { name: 'next_review_at', label: 'lp.library.nextReview', type: 'date' },
    { name: 'is_featured', label: 'lp.library.featured', type: 'boolean' },
    { name: 'is_active', label: 'is.common.active', type: 'boolean' },
  ];

  const sourceFields: IsField[] = [
    { name: 'key', label: 'lp.common.key', type: 'text', required: true, hint: 'lp.common.keyHint' },
    { name: 'name', label: 'is.common.name', type: 'text', required: true },
    { name: 'organization', label: 'lp.library.organization', type: 'text' },
    { name: 'kind', label: 'lp.library.sourceKind', type: 'select', required: true, options: SOURCE_KINDS },
    { name: 'perspective', label: 'lp.common.perspective', type: 'select', required: true, options: PERSPECTIVES.filter(p => p.value !== 'general') },
    { name: 'url', label: 'lp.library.url', type: 'text', hint: 'lp.library.urlHint' },
    { name: 'country', label: 'lp.library.country', type: 'text', hint: 'lp.library.countryHint' },
    { name: 'published_on', label: 'lp.library.publishedOn', type: 'date' },
    { name: 'checked_on', label: 'lp.library.checkedOn', type: 'date', hint: 'lp.library.checkedOnHint' },
    { name: 'notes', label: 'is.common.note', type: 'textarea' },
  ];

  return (
    <LpScope>
      <div className="max-w-5xl mx-auto space-y-6">
        <PfPageHeader title="lp.library.pageTitle" subtitle="lp.library.pageSubtitle" />
        <PfTabs<Tab> tabs={[{ key: 'resources', label: 'lp.library.tabs.resources' }, { key: 'sources', label: 'lp.library.tabs.sources' }]} active={tab} onChange={setTab} />
        {tab === 'resources' && (
          <IsListEditor
            table="lp_resources"
            title="lp.library.tabs.resources"
            subtitle="lp.library.resourcesSubtitle"
            select="*, lp_resource_categories(category_id), lp_resource_sources(lp_sources(key))"
            fields={resourceFields}
            reviewed
            audited="both"
            searchable
            pageSize={25}
            defaults={{ kind: 'article', perspective: 'scientific', audience: 'shared', urgency: 'educational', sex: 'any' }}
            filters={[
              { name: 'kind', label: 'lp.library.kind', options: KINDS },
              { name: 'perspective', label: 'lp.common.perspective', options: PERSPECTIVES },
              { name: 'review_status', label: 'is.review.status', options: REVIEW },
            ]}
            formFromRow={(row: IsRow): IsFormValues => ({
              categories: ((row.lp_resource_categories ?? []) as { category_id: string }[]).map(c => c.category_id).join(','),
              sources: ((row.lp_resource_sources ?? []) as { lp_sources: { key: string } | null }[]).map(s => s.lp_sources?.key).filter(Boolean).join(','),
            })}
            afterSave={async (row, values) => {
              await relink('lp_resource_categories', row.id, 'category_id', list(values.categories));
              const keys = list(values.sources);
              let ids: string[] = [];
              if (keys.length) {
                const { data, error } = await supabase.from('lp_sources').select('id, key').in('key', keys);
                if (error) throw error;
                ids = keys.map(k => (data ?? []).find(s => s.key === k)?.id).filter(Boolean) as string[];
              }
              await relink('lp_resource_sources', row.id, 'source_id', ids);
              setReload(n => n + 1);
            }}
            renderRow={r => (
              <IsRowText
                primary={`${r.emoji ?? ''} ${isText(r.title, language)}`}
                secondary={[t(`lp.library.kinds.${r.kind}`), t(`lp.common.perspectives.${r.perspective}`), t(`lp.common.audiences.${r.audience}`), lpRangeLabel(r, t)].join(' · ')}
                extra={
                  <>
                    {r.urgency === 'emergency' && <Badge variant="danger">{t('lp.library.urgencies.emergency')}</Badge>}
                    {((r.lp_resource_sources ?? []) as { lp_sources: { key: string } | null }[]).map(s => s.lp_sources?.key).filter(Boolean)
                      .map(k => <Badge key={k} variant="muted">{sourceName.get(String(k)) ?? k}</Badge>)}
                  </>
                }
              />
            )}
          />
        )}
        {tab === 'sources' && (
          <IsListEditor
            table="lp_sources"
            title="lp.library.tabs.sources"
            subtitle="lp.library.sourcesSubtitle"
            fields={sourceFields}
            ordered={false}
            activeToggle={false}
            orderBy={['name']}
            searchable
            afterSave={async () => { setReload(n => n + 1); }}
            renderRow={r => (
              <IsRowText
                primary={String(r.name)}
                secondary={[r.organization, t(`lp.library.sourceKinds.${r.kind}`), t(`lp.common.perspectives.${r.perspective}`), r.country].filter(Boolean).join(' · ')}
                extra={r.url
                  ? <a href={String(r.url)} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline truncate">{String(r.url)}</a>
                  : <Badge variant="warning">{t('lp.library.noUrl')}</Badge>}
              />
            )}
          />
        )}
      </div>
    </LpScope>
  );
};
