import { useMemo, useState } from 'react';
import { IsListEditor, IsRowText } from '../../components/islamicStudio/IsListEditor';
import type { IsField } from '../../components/islamicStudio/IsFieldInput';
import { Badge } from '../../components/ui/Button';
import { useLanguage } from '../../lib/LanguageContext';
import { isText } from '../../lib/islamicStudio';
import { LpScope, lpRangeLabel, useLpOptions } from '../../lib/parenting';
import { PfPageHeader, PfTabs } from '../Portfolio/PfPageHeader';

type Tab = 'stages' | 'ageGroups' | 'domains' | 'categories' | 'placement';

const DAYS: IsField[] = [
  { name: 'min_day', label: 'lp.common.minDay', type: 'number', hint: 'lp.common.dayHint' },
  { name: 'max_day', label: 'lp.common.maxDay', type: 'number', hint: 'lp.common.maxDayHint' },
];

/**
 * The app's structure: the 7 life stages and their age groups on the
 * life-day axis, the 20 knowledge domains, categories (with subcategories)
 * and which categories each stage shows.
 */
export const LpJourney = () => {
  const { t, language } = useLanguage();
  const [tab, setTab] = useState<Tab>('stages');
  const [reload, setReload] = useState(0);
  const options = useLpOptions(language, reload);
  const changed = async () => { setReload(n => n + 1); };

  const stageName = useMemo(() => new Map(options.stages.map(s => [s.value, s.label])), [options.stages]);
  const groupName = useMemo(() => new Map(options.ageGroups.map(a => [a.value, a.label])), [options.ageGroups]);
  const categoryName = useMemo(() => new Map(options.categories.map(c => [c.id, c.label])), [options.categories]);
  const domainName = useMemo(() => new Map(options.domains.map(d => [d.value, d.label])), [options.domains]);

  const keyField = (hint: string): IsField => ({ name: 'key', label: 'lp.common.key', type: 'text', required: true, hint });

  const stageFields: IsField[] = [
    keyField('lp.common.keyHint'),
    { name: 'number', label: 'lp.journey.number', type: 'number', required: true },
    { name: 'name', label: 'is.common.name', type: 'i18n', required: true },
    { name: 'age_label', label: 'lp.journey.ageLabel', type: 'i18n', hint: 'lp.journey.ageLabelHint' },
    { name: 'objective', label: 'lp.journey.objective', type: 'i18nArea' },
    { name: 'description', label: 'is.common.description', type: 'i18nArea' },
    { name: 'emoji', label: 'lp.common.emoji', type: 'text' },
    { name: 'color', label: 'lp.common.color', type: 'text', hint: 'lp.common.colorHint' },
    { name: 'image_url', label: 'is.common.image', type: 'upload', accept: 'image/*' },
    ...DAYS,
    { name: 'is_active', label: 'is.common.active', type: 'boolean' },
  ];

  const groupFields: IsField[] = [
    keyField('lp.common.keyHint'),
    { name: 'stage_key', label: 'lp.common.stage', type: 'select', required: true, options: options.stages },
    { name: 'name', label: 'is.common.name', type: 'i18n', required: true },
    { name: 'focus', label: 'lp.journey.focus', type: 'i18n' },
    ...DAYS,
    { name: 'is_active', label: 'is.common.active', type: 'boolean' },
  ];

  const domainFields: IsField[] = [
    keyField('lp.common.keyHint'),
    { name: 'name', label: 'is.common.name', type: 'i18n', required: true },
    { name: 'description', label: 'is.common.description', type: 'i18nArea' },
    { name: 'emoji', label: 'lp.common.emoji', type: 'text' },
    { name: 'color', label: 'lp.common.color', type: 'text', hint: 'lp.common.colorHint' },
    { name: 'is_active', label: 'is.common.active', type: 'boolean' },
  ];

  const topCategories = options.categories.filter(c => !c.parent);
  const categoryFields: IsField[] = [
    keyField('lp.common.keyHint'),
    { name: 'domain_key', label: 'lp.common.domain', type: 'select', required: true, options: options.domains },
    { name: 'parent_id', label: 'lp.journey.parentCategory', type: 'select', allowEmpty: true, options: topCategories, hint: 'lp.journey.parentHint' },
    { name: 'name', label: 'is.common.name', type: 'i18n', required: true },
    { name: 'description', label: 'is.common.description', type: 'i18nArea' },
    { name: 'emoji', label: 'lp.common.emoji', type: 'text' },
    { name: 'color', label: 'lp.common.color', type: 'text', hint: 'lp.common.colorHint' },
    { name: 'is_active', label: 'is.common.active', type: 'boolean' },
  ];

  const placementFields: IsField[] = [
    { name: 'stage_key', label: 'lp.common.stage', type: 'select', required: true, options: options.stages },
    { name: 'age_group_key', label: 'lp.common.ageGroup', type: 'select', allowEmpty: true, hint: 'lp.journey.wholeStageHint',
      options: options.ageGroups.map(a => ({ value: a.value, label: `${stageName.get(a.stage) ?? a.stage} · ${a.label}` })) },
    { name: 'category_id', label: 'lp.common.category', type: 'select', required: true, options: options.categories },
    { name: 'focus', label: 'lp.journey.focus', type: 'i18n', hint: 'lp.journey.placementFocusHint' },
  ];

  return (
    <LpScope>
      <div className="max-w-5xl mx-auto space-y-6">
        <PfPageHeader title="lp.journey.pageTitle" subtitle="lp.journey.pageSubtitle" />
        <PfTabs<Tab>
          tabs={(['stages', 'ageGroups', 'domains', 'categories', 'placement'] as Tab[]).map(k => ({ key: k, label: `lp.journey.tabs.${k}` }))}
          active={tab}
          onChange={setTab}
        />
        {tab === 'stages' && (
          <IsListEditor
            table="lp_stages"
            title="lp.journey.tabs.stages"
            subtitle="lp.journey.stagesSubtitle"
            keys={['key']}
            fields={stageFields}
            afterSave={changed}
            renderRow={r => (
              <IsRowText primary={`${r.emoji ?? ''} ${r.number}. ${isText(r.name, language)}`} secondary={`${isText(r.age_label, language)} · ${lpRangeLabel(r, t)}`} />
            )}
          />
        )}
        {tab === 'ageGroups' && (
          <IsListEditor
            table="lp_age_groups"
            title="lp.journey.tabs.ageGroups"
            keys={['key']}
            fields={groupFields}
            afterSave={changed}
            filters={[{ name: 'stage_key', label: 'lp.common.stage', options: options.stages }]}
            renderRow={r => (
              <IsRowText primary={isText(r.name, language)} secondary={`${stageName.get(String(r.stage_key)) ?? r.stage_key} · ${lpRangeLabel(r, t)}`} />
            )}
          />
        )}
        {tab === 'domains' && (
          <IsListEditor
            table="lp_domains"
            title="lp.journey.tabs.domains"
            subtitle="lp.journey.domainsSubtitle"
            keys={['key']}
            fields={domainFields}
            afterSave={changed}
            renderRow={r => <IsRowText primary={`${r.emoji ?? ''} ${isText(r.name, language)}`} secondary={String(r.key)} />}
          />
        )}
        {tab === 'categories' && (
          <IsListEditor
            table="lp_categories"
            title="lp.journey.tabs.categories"
            subtitle="lp.journey.categoriesSubtitle"
            fields={categoryFields}
            afterSave={changed}
            searchable
            filters={[{ name: 'domain_key', label: 'lp.common.domain', options: options.domains }]}
            renderRow={r => (
              <IsRowText
                primary={`${r.parent_id ? '↳ ' : ''}${r.emoji ?? ''} ${isText(r.name, language)}`}
                secondary={[domainName.get(String(r.domain_key)) ?? r.domain_key, r.parent_id ? categoryName.get(String(r.parent_id)) : '', r.key].filter(Boolean).join(' · ')}
              />
            )}
          />
        )}
        {tab === 'placement' && (
          <IsListEditor
            table="lp_stage_categories"
            title="lp.journey.tabs.placement"
            subtitle="lp.journey.placementSubtitle"
            fields={placementFields}
            activeToggle={false}
            audited="none"
            searchable
            filters={[{ name: 'stage_key', label: 'lp.common.stage', options: options.stages }]}
            renderRow={r => (
              <IsRowText
                primary={categoryName.get(String(r.category_id)) ?? String(r.category_id)}
                secondary={`${stageName.get(String(r.stage_key)) ?? r.stage_key}${r.age_group_key ? ` · ${groupName.get(String(r.age_group_key)) ?? r.age_group_key}` : ''}`}
                extra={!r.age_group_key ? <Badge variant="muted">{t('lp.journey.wholeStage')}</Badge> : undefined}
              />
            )}
          />
        )}
      </div>
    </LpScope>
  );
};
