import { useState } from 'react';
import { ListTree } from 'lucide-react';
import { useLanguage } from '../../lib/LanguageContext';
import type { PfField, PfRow } from '../../lib/portfolio';
import { Badge } from '../../components/ui/Button';
import { PfListEditor, PfRowText } from '../../components/portfolio/PfListEditor';
import { PfPageHeader, PfTabs } from './PfPageHeader';

const AUDIENCES = [
  { value: 'general', label: 'pf.about.general' },
  { value: 'client', label: 'pf.about.client' },
];

const SECTION_FIELDS: PfField[] = [
  { name: 'audience', label: 'pf.about.audience', type: 'select', options: AUDIENCES, initial: 'general' },
  { name: 'heading', label: 'pf.about.heading', type: 'i18n', required: true },
];

const BLOCK_FIELDS: PfField[] = [
  { name: 'kind', label: 'pf.about.kind', type: 'select', initial: 'paragraph', options: [
    { value: 'paragraph', label: 'pf.about.paragraph' },
    { value: 'list', label: 'pf.about.list' },
  ] },
  { name: 'text', label: 'pf.about.paragraphText', type: 'i18n', multiline: true, hint: 'pf.about.paragraphHint' },
  { name: 'items', label: 'pf.about.listItems', type: 'i18nList', hint: 'pf.about.listHint' },
];

const EDUCATION_FIELDS: PfField[] = [
  { name: 'degree', label: 'pf.about.degree', type: 'i18n', required: true },
  { name: 'institution', label: 'pf.about.institution', type: 'i18n', required: true },
  { name: 'year', label: 'pf.about.year', type: 'i18n' },
  { name: 'location', label: 'pf.about.location', type: 'i18n' },
];

const TEXT_FIELDS: PfField[] = [{ name: 'text', label: 'pf.common.text', type: 'i18n', required: true }];

const CORE_FIELDS: PfField[] = [
  { name: 'label', label: 'pf.common.name', type: 'i18n', required: true },
  { name: 'percent', label: 'pf.about.percent', type: 'number', min: 0, max: 100, initial: '100', required: true },
];

const CHECKLIST_FIELDS: PfField[] = [
  { name: 'text', label: 'pf.common.text', type: 'i18n', required: true },
  { name: 'rating', label: 'pf.about.rating', type: 'number', min: 0, max: 5, initial: '5', required: true },
];

type Tab = 'about' | 'education' | 'interests' | 'core' | 'checklist';
const TABS: { key: Tab; label: string }[] = [
  { key: 'about', label: 'pf.about.aboutMe' },
  { key: 'education', label: 'pf.about.education' },
  { key: 'interests', label: 'pf.about.interests' },
  { key: 'core', label: 'pf.about.core' },
  { key: 'checklist', label: 'pf.about.checklist' },
];

const blockPreview = (r: PfRow) =>
  r.kind === 'list' ? (r.items_en as string[]).map(i => `• ${i}`).join('  ') : String(r.text_en ?? '');

export const PfAbout = () => {
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>('about');
  const [section, setSection] = useState<PfRow | null>(null);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PfPageHeader title="pf.about.pageTitle" subtitle="pf.about.pageSubtitle" />
      <PfTabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'about' && (
        <>
          <PfListEditor
            table="pf_about_sections"
            title="pf.about.sections"
            subtitle="pf.about.sectionsHint"
            fields={SECTION_FIELDS}
            orderBy={['audience', 'sort_order']}
            renderRow={r => (
              <PfRowText
                primary={String(r.heading_en)}
                secondary={String(r.heading_bn ?? '')}
                extra={<Badge variant={r.audience === 'client' ? 'warning' : 'default'}>{t(`pf.about.${r.audience}`)}</Badge>}
              />
            )}
            isRowSelected={r => r.id === section?.id}
            rowActions={r => (
              <button
                className="p-1.5 rounded-md text-primary hover:bg-primary/10"
                onClick={() => setSection(r)}
                title={t('pf.about.editBlocks')}
              >
                <ListTree size={16} />
              </button>
            )}
          />
          {section ? (
            <PfListEditor
              key={section.id}
              table="pf_about_blocks"
              title="pf.about.blocks"
              subtitle={`${section.heading_en}`}
              fields={BLOCK_FIELDS}
              scope={{ section_id: section.id }}
              renderRow={r => (
                <PfRowText
                  primary={blockPreview(r)}
                  extra={<Badge variant="muted">{t(r.kind === 'list' ? 'pf.about.list' : 'pf.about.paragraph')}</Badge>}
                />
              )}
            />
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">{t('pf.about.pickSection')}</p>
          )}
        </>
      )}

      {tab === 'education' && (
        <PfListEditor
          table="pf_education"
          title="pf.about.education"
          fields={EDUCATION_FIELDS}
          renderRow={r => <PfRowText primary={String(r.degree_en)} secondary={`${r.institution_en} · ${r.year_en ?? ''}`} />}
        />
      )}

      {tab === 'interests' && (
        <PfListEditor
          table="pf_interests"
          title="pf.about.interests"
          fields={TEXT_FIELDS}
          renderRow={r => <PfRowText primary={String(r.text_en)} secondary={String(r.text_bn ?? '')} />}
        />
      )}

      {tab === 'core' && (
        <PfListEditor
          table="pf_core_skills"
          title="pf.about.core"
          fields={CORE_FIELDS}
          renderRow={r => <PfRowText primary={`${r.label_en} — ${r.percent}%`} secondary={String(r.label_bn ?? '')} />}
        />
      )}

      {tab === 'checklist' && (
        <PfListEditor
          table="pf_checklist"
          title="pf.about.checklist"
          subtitle="pf.about.checklistHint"
          fields={CHECKLIST_FIELDS}
          renderRow={r => <PfRowText primary={String(r.text_en)} secondary={'★'.repeat(Number(r.rating))} />}
        />
      )}
    </div>
  );
};
