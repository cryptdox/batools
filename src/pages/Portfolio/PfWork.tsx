import { useState } from 'react';
import { Lightbulb } from 'lucide-react';
import { Badge } from '../../components/ui/Button';
import { PfListEditor, PfRowText } from '../../components/portfolio/PfListEditor';
import { useLanguage } from '../../lib/LanguageContext';
import { PF_ICON_OPTIONS, usePfUserId, type PfField, type PfRow } from '../../lib/portfolio';
import { PF_BUCKET } from '../../components/portfolio/PfFileUpload';
import { PfPageHeader } from './PfPageHeader';
import { PfCaseStudyModal } from '../../components/portfolio/PfCaseStudyModal';
import { Button } from '../../components/ui/Button';
import { supabase } from '../../lib/supabase';
import { addMissingSkills } from '../../lib/techSkills';
import { toast } from 'react-toastify';

const PROJECT_FIELDS: PfField[] = [
  { name: 'title', label: 'pf.work.title', type: 'i18n', required: true },
  { name: 'duration', label: 'pf.work.duration', type: 'i18n' },
  { name: 'description', label: 'pf.work.description', type: 'i18n', rich: true },
  { name: 'responsibilities', label: 'pf.work.responsibilities', type: 'i18nList' },
  { name: 'tech_stack', label: 'pf.work.techStack', type: 'tags', skillPicker: true, hint: 'pf.skills.hint' },
  { name: 'link', label: 'pf.work.link', type: 'text' },
  { name: 'show_on_home', label: 'pf.common.showOnHome', type: 'boolean', hint: 'pf.common.showOnHomeHint' },
  { name: 'is_featured', label: 'pf.work.featureProject', type: 'boolean', hint: 'pf.work.featureProjectHint' },
  { name: 'show_case_study', label: 'pf.work.showCaseStudy', type: 'boolean', hint: 'pf.work.showCaseStudyHint' },
  { name: 'show_challenges', label: 'pf.work.showChallenges', type: 'boolean', hint: 'pf.work.showChallengesHint' },
];


const EXPERIENCE_KINDS = ['industry', 'research', 'teaching']
  .map(value => ({ value, label: `pf.work.experienceKinds.${value}` }));

const EXPERIENCE_FIELDS: PfField[] = [
  { name: 'kind', label: 'pf.work.experienceKind', type: 'select', options: EXPERIENCE_KINDS, initial: 'industry', hint: 'pf.work.experienceKindHint' },
  { name: 'position', label: 'pf.work.position', type: 'i18n', required: true },
  { name: 'company', label: 'pf.work.company', type: 'i18n', required: true },
  { name: 'location', label: 'pf.about.location', type: 'i18n' },
  { name: 'duration', label: 'pf.work.duration', type: 'i18n' },
  { name: 'responsibilities', label: 'pf.work.responsibilities', type: 'i18nList' },
  { name: 'is_current', label: 'pf.work.current', type: 'boolean', hint: 'pf.work.currentHint' },
  { name: 'show_on_home', label: 'pf.common.showOnHome', type: 'boolean', hint: 'pf.common.showOnHomeHint' },
];

const TECH_FIELDS: PfField[] = [
  { name: 'title', label: 'pf.work.category', type: 'i18n', required: true },
  { name: 'icon', label: 'pf.common.icon', type: 'select', options: PF_ICON_OPTIONS, initial: 'code', hint: 'pf.work.iconHint' },
  { name: 'skills', label: 'pf.work.skills', type: 'tags' },
];

/** Opens a project's / publication's case study and challenges. */
const DetailsButton = ({ onClick }: { onClick: () => void }) => {
  const { t } = useLanguage();
  return (
    <button className="p-1.5 rounded-md text-primary hover:bg-primary/10" onClick={onClick} title={t('pf.work.details')}>
      <Lightbulb size={16} />
    </button>
  );
};

const Tags = ({ items }: { items: unknown }) => (
  <>{(items as string[]).map(s => <Badge key={s} variant="muted">{s}</Badge>)}</>
);

export const PfProjects = () => {
  const { t } = useLanguage();
  // The project whose details (case study, challenges) are open in the modal.
  const [project, setProject] = useState<PfRow | null>(null);
  const [reload, setReload] = useState(0);
  const userId = usePfUserId();
  const [syncing, setSyncing] = useState(false);

  /** A saved project's new skills join Tech Stack → Others. */
  const afterSave = async (row: Record<string, unknown>) => {
    if (!userId) return;
    const added = await addMissingSkills(userId, (row.tech_stack as string[] | undefined) ?? []);
    return added.length ? t('pf.skills.added').replace('{list}', added.join(', ')) : undefined;
  };

  /** Every project's skills that the Tech Stack does not list yet, added to Others. */
  const syncSkills = async () => {
    if (!userId) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.from('pf_projects').select('tech_stack').eq('user_id', userId);
      if (error) throw error;
      const added = await addMissingSkills(userId, (data ?? []).flatMap(p => (p.tech_stack as string[]) ?? []));
      toast.success(added.length ? t('pf.skills.added').replace('{list}', added.join(', ')) : t('pf.skills.inSync'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PfPageHeader title="pf.work.projectsTitle" subtitle="pf.common.orderHint" />
      <PfListEditor
        versioned
        cloneable
        table="pf_projects"
        title="pf.work.projects"
        fields={PROJECT_FIELDS}
        searchable
        reloadSignal={reload}
        afterSave={afterSave}
        headerActions={
          <Button size="sm" variant="outline" onClick={() => void syncSkills()} disabled={syncing} title={t('pf.skills.syncHint')}>
            {syncing ? t('pf.skills.syncing') : t('pf.skills.sync')}
          </Button>
        }
        renderRow={r => (
          <PfRowText
            primary={String(r.title_en)}
            secondary={String(r.duration_en ?? '')}
            extra={<>
              {r.show_on_home === true && <Badge variant="default">{t('pf.common.onHome')}</Badge>}
              <Badge variant={r.is_featured === true ? 'success' : 'muted'}>{t(r.is_featured === true ? 'pf.work.featureProject' : 'pf.work.enterprise')}</Badge>
              {r.show_case_study === true && <Badge variant="warning">{t('pf.work.caseStudyShown')}</Badge>}
              {r.show_challenges === true && <Badge variant="warning">{t('pf.work.challengesShown')}</Badge>}
              <Tags items={r.tech_stack} />
            </>}
          />
        )}
        rowActions={r => <DetailsButton onClick={() => setProject(r)} />}
      />
      <PfCaseStudyModal
        row={project}
        table="pf_projects"
        parentColumn="project_id"
        onClose={() => setProject(null)}
        onSwitchChange={() => setReload(n => n + 1)}
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
        versioned
        cloneable
        table="pf_experiences"
        title="pf.work.experience"
        fields={EXPERIENCE_FIELDS}
        renderRow={r => (
          <PfRowText
            primary={`${r.position_en} · ${r.company_en}`}
            secondary={String(r.duration_en ?? '')}
            extra={<>
              {r.kind && r.kind !== 'industry' && <Badge variant="warning">{t(`pf.work.experienceKinds.${r.kind}`)}</Badge>}
              {r.is_current === true && <Badge variant="success">{t('pf.work.current')}</Badge>}
              {r.show_on_home === true && <Badge variant="default">{t('pf.common.onHome')}</Badge>}
            </>}
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
      versioned
      cloneable
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
  { name: 'abstract', label: 'pf.research.abstract', type: 'i18n', rich: true },
  { name: 'keywords', label: 'pf.research.keywords', type: 'tags' },
  { name: 'doi', label: 'DOI', type: 'text', hint: 'pf.research.doiHint' },
  { name: 'url', label: 'pf.research.url', type: 'text' },
  { name: 'pdf_url', label: 'pf.research.pdfUrl', type: 'text', upload: 'application/pdf', hint: 'pf.research.pdfHint' },
  { name: 'pdf_public', label: 'pf.research.pdfPublic', type: 'boolean', initial: true, hint: 'pf.research.pdfPublicHint' },
  { name: 'code_url', label: 'pf.research.codeUrl', type: 'text' },
  { name: 'citation', label: 'pf.research.citation', type: 'textarea', hint: 'pf.research.citationHint' },
  { name: 'show_on_home', label: 'pf.common.showOnHome', type: 'boolean', hint: 'pf.common.showOnHomeHint' },
  { name: 'is_featured', label: 'pf.work.featured', type: 'boolean', hint: 'pf.research.featuredHint' },
  { name: 'show_case_study', label: 'pf.work.showCaseStudy', type: 'boolean', hint: 'pf.work.showCaseStudyHint' },
  { name: 'show_challenges', label: 'pf.work.showChallenges', type: 'boolean', hint: 'pf.work.showChallengesHint' },
];

const ARTIFACT_KINDS = ['model', 'dataset', 'demo', 'code']
  .map(value => ({ value, label: `pf.research.kinds.${value}` }));
const ARTIFACT_PLATFORMS = ['huggingface', 'kaggle', 'github', 'zenodo', 'website', 'other']
  .map(value => ({ value, label: `pf.research.platforms.${value}` }));

/** A released model / dataset / demo / code (063); `papers` are the publications to link it to. */
const artifactFields = (papers: { value: string; label: string }[]): PfField[] => [
  { name: 'kind', label: 'pf.research.artifactKind', type: 'select', options: ARTIFACT_KINDS, initial: 'model' },
  { name: 'platform', label: 'pf.research.platform', type: 'select', options: ARTIFACT_PLATFORMS, initial: 'huggingface' },
  { name: 'title', label: 'pf.work.title', type: 'i18n', required: true },
  { name: 'description', label: 'pf.work.description', type: 'i18n', multiline: true },
  { name: 'url', label: 'pf.research.artifactUrl', type: 'text', required: true },
  { name: 'demo_url', label: 'pf.research.demoUrl', type: 'text', hint: 'pf.research.demoUrlHint' },
  { name: 'publication_id', label: 'pf.research.paper', type: 'select', options: papers, allowEmpty: true, hint: 'pf.research.paperHint' },
  { name: 'metrics', label: 'pf.research.metrics', type: 'tags', hint: 'pf.research.metricsHint' },
  { name: 'tags', label: 'pf.research.tags', type: 'tags' },
  { name: 'released_on', label: 'pf.research.releasedOn', type: 'date' },
  { name: 'is_private', label: 'pf.research.private', type: 'boolean', hint: 'pf.research.privateHint' },
  { name: 'is_featured', label: 'pf.work.featured', type: 'boolean', hint: 'pf.research.featuredHint' },
];

export const PfResearch = () => {
  const { t } = useLanguage();
  const userId = usePfUserId();
  // The publication whose details (case study, challenges) are open in the modal.
  const [publication, setPublication] = useState<PfRow | null>(null);
  const [reload, setReload] = useState(0);
  // Publications, for linking an artifact to its paper.
  const [papers, setPapers] = useState<{ value: string; label: string }[]>([]);
  const paperTitle = (id: unknown) => papers.find(p => p.value === id)?.label;
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PfPageHeader title="pf.research.pageTitle" subtitle="pf.common.orderHint" />
      <PfListEditor
        versioned
        cloneable
        table="pf_publications"
        title="pf.research.publications"
        fields={PUBLICATION_FIELDS}
        upload={userId ? { bucket: PF_BUCKET, folder: `${userId}/research` } : undefined}
        searchable
        reloadSignal={reload}
        onRowsChange={rows => setPapers(rows.map(r => ({ value: r.id, label: String(r.title_en) })))}
        rowActions={r => <DetailsButton onClick={() => setPublication(r)} />}
        renderRow={r => (
          <PfRowText
            primary={String(r.title_en)}
            secondary={[r.venue, r.year, (r.authors as string[]).join(', ')].filter(Boolean).join(' · ')}
            extra={
              <>
                <Badge variant="default">{t(`pf.research.types.${r.pub_type}`)}</Badge>
                {r.status !== 'published' && <Badge variant="warning">{t(`pf.research.status.${r.status}`)}</Badge>}
                {r.show_on_home === true && <Badge variant="default">{t('pf.common.onHome')}</Badge>}
                {r.is_featured === true && <Badge variant="success">{t('pf.work.featured')}</Badge>}
                {!!r.pdf_url && r.pdf_public === false && <Badge variant="muted">{t('pf.research.pdfPrivate')}</Badge>}
                {r.show_case_study === true && <Badge variant="warning">{t('pf.work.caseStudyShown')}</Badge>}
                {r.show_challenges === true && <Badge variant="warning">{t('pf.work.challengesShown')}</Badge>}
              </>
            }
          />
        )}
      />
      <PfListEditor
        versioned
        cloneable
        table="pf_research_artifacts"
        title="pf.research.artifacts"
        subtitle="pf.research.artifactsHint"
        fields={artifactFields(papers)}
        searchable
        renderRow={r => (
          <PfRowText
            primary={String(r.title_en)}
            secondary={[paperTitle(r.publication_id), String(r.url)].filter(Boolean).join(' · ')}
            extra={<>
              <Badge variant="default">{t(`pf.research.kinds.${r.kind}`)}</Badge>
              <Badge variant="muted">{t(`pf.research.platforms.${r.platform}`)}</Badge>
              {r.is_private === true && <Badge variant="warning">{t('pf.research.private')}</Badge>}
              {r.is_featured === true && <Badge variant="success">{t('pf.work.featured')}</Badge>}
              <Tags items={r.metrics} />
            </>}
          />
        )}
      />
      <PfCaseStudyModal
        row={publication}
        table="pf_publications"
        parentColumn="publication_id"
        onClose={() => setPublication(null)}
        onSwitchChange={() => setReload(n => n + 1)}
      />
    </div>
  );
};
