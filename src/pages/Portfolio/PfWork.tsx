import { Badge } from '../../components/ui/Button';
import { PfListEditor, PfRowText } from '../../components/portfolio/PfListEditor';
import { useLanguage } from '../../lib/LanguageContext';
import { PF_ICON_OPTIONS, type PfField } from '../../lib/portfolio';
import { PfPageHeader } from './PfPageHeader';

const PROJECT_FIELDS: PfField[] = [
  { name: 'title', label: 'pf.work.title', type: 'i18n', required: true },
  { name: 'duration', label: 'pf.work.duration', type: 'i18n' },
  { name: 'description', label: 'pf.work.description', type: 'i18n', multiline: true },
  { name: 'responsibilities', label: 'pf.work.responsibilities', type: 'i18nList' },
  { name: 'tech_stack', label: 'pf.work.techStack', type: 'tags' },
  { name: 'link', label: 'pf.work.link', type: 'text' },
  { name: 'is_featured', label: 'pf.work.featured', type: 'boolean', hint: 'pf.work.featuredHint' },
];

const EXPERIENCE_FIELDS: PfField[] = [
  { name: 'position', label: 'pf.work.position', type: 'i18n', required: true },
  { name: 'company', label: 'pf.work.company', type: 'i18n', required: true },
  { name: 'location', label: 'pf.about.location', type: 'i18n' },
  { name: 'duration', label: 'pf.work.duration', type: 'i18n' },
  { name: 'responsibilities', label: 'pf.work.responsibilities', type: 'i18nList' },
  { name: 'is_current', label: 'pf.work.current', type: 'boolean', hint: 'pf.work.currentHint' },
];

const TECH_FIELDS: PfField[] = [
  { name: 'title', label: 'pf.work.category', type: 'i18n', required: true },
  { name: 'icon', label: 'pf.common.icon', type: 'select', options: PF_ICON_OPTIONS, initial: 'code', hint: 'pf.work.iconHint' },
  { name: 'skills', label: 'pf.work.skills', type: 'tags' },
];

const Tags = ({ items }: { items: unknown }) => (
  <>{(items as string[]).map(s => <Badge key={s} variant="muted">{s}</Badge>)}</>
);

export const PfProjects = () => {
  const { t } = useLanguage();
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PfPageHeader title="pf.work.projectsTitle" subtitle="pf.common.orderHint" />
      <PfListEditor
        table="pf_projects"
        title="pf.work.projects"
        fields={PROJECT_FIELDS}
        searchable
        renderRow={r => (
          <PfRowText
            primary={String(r.title_en)}
            secondary={String(r.duration_en ?? '')}
            extra={<>{r.is_featured === true && <Badge variant="success">{t('pf.work.featured')}</Badge>}<Tags items={r.tech_stack} /></>}
          />
        )}
      />
    </div>
  );
};

export const PfExperience = () => {
  const { t } = useLanguage();
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PfPageHeader title="pf.work.experienceTitle" subtitle="pf.common.orderHint" />
      <PfListEditor
        table="pf_experiences"
        title="pf.work.experience"
        fields={EXPERIENCE_FIELDS}
        renderRow={r => (
          <PfRowText
            primary={`${r.position_en} · ${r.company_en}`}
            secondary={String(r.duration_en ?? '')}
            extra={r.is_current === true ? <Badge variant="success">{t('pf.work.current')}</Badge> : undefined}
          />
        )}
      />
    </div>
  );
};

export const PfTechStack = () => (
  <div className="max-w-5xl mx-auto space-y-6">
    <PfPageHeader title="pf.work.techTitle" subtitle="pf.common.orderHint" />
    <PfListEditor
      table="pf_tech_categories"
      title="pf.work.categories"
      fields={TECH_FIELDS}
      renderRow={r => <PfRowText primary={`${r.title_en} (${r.icon})`} extra={<Tags items={r.skills} />} />}
    />
  </div>
);

const PUB_TYPES = ['journal', 'conference', 'preprint', 'thesis', 'book_chapter', 'other']
  .map(value => ({ value, label: `pf.research.types.${value}` }));
const PUB_STATUSES = ['published', 'accepted', 'under_review']
  .map(value => ({ value, label: `pf.research.status.${value}` }));

const PUBLICATION_FIELDS: PfField[] = [
  { name: 'title', label: 'pf.work.title', type: 'i18n', required: true, hint: 'pf.research.titleHint' },
  { name: 'authors', label: 'pf.research.authors', type: 'tags', hint: 'pf.research.authorsHint' },
  { name: 'venue', label: 'pf.research.venue', type: 'text', hint: 'pf.research.venueHint' },
  { name: 'pub_type', label: 'pf.research.type', type: 'select', options: PUB_TYPES, initial: 'journal' },
  { name: 'status', label: 'pf.research.statusLabel', type: 'select', options: PUB_STATUSES, initial: 'published' },
  { name: 'year', label: 'pf.about.year', type: 'number', min: 1950, max: 2100 },
  { name: 'abstract', label: 'pf.research.abstract', type: 'i18n', multiline: true },
  { name: 'keywords', label: 'pf.research.keywords', type: 'tags' },
  { name: 'doi', label: 'DOI', type: 'text', hint: 'pf.research.doiHint' },
  { name: 'url', label: 'pf.research.url', type: 'text' },
  { name: 'pdf_url', label: 'pf.research.pdfUrl', type: 'text' },
  { name: 'code_url', label: 'pf.research.codeUrl', type: 'text' },
  { name: 'citation', label: 'pf.research.citation', type: 'textarea', hint: 'pf.research.citationHint' },
  { name: 'is_featured', label: 'pf.work.featured', type: 'boolean', hint: 'pf.research.featuredHint' },
];

export const PfResearch = () => {
  const { t } = useLanguage();
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PfPageHeader title="pf.research.pageTitle" subtitle="pf.common.orderHint" />
      <PfListEditor
        table="pf_publications"
        title="pf.research.publications"
        fields={PUBLICATION_FIELDS}
        searchable
        renderRow={r => (
          <PfRowText
            primary={String(r.title_en)}
            secondary={[r.venue, r.year, (r.authors as string[]).join(', ')].filter(Boolean).join(' · ')}
            extra={
              <>
                <Badge variant="default">{t(`pf.research.types.${r.pub_type}`)}</Badge>
                {r.status !== 'published' && <Badge variant="warning">{t(`pf.research.status.${r.status}`)}</Badge>}
                {r.is_featured === true && <Badge variant="success">{t('pf.work.featured')}</Badge>}
              </>
            }
          />
        )}
      />
    </div>
  );
};
