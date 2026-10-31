import { useState } from 'react';
import { Lightbulb } from 'lucide-react';
import { Badge } from '../../components/ui/Button';
import { PfListEditor, PfRowText } from '../../components/portfolio/PfListEditor';
import { useLanguage } from '../../lib/LanguageContext';
import { PF_ICON_OPTIONS, usePfUserId, type PfField, type PfFormValues, type PfRow } from '../../lib/portfolio';
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
      <PfPageHeader versions title="pf.work.projectsTitle" subtitle="pf.common.orderHint" />
      <PfListEditor
        versioned
        cloneable
        table="pf_projects"
        title="pf.work.projects"
        fields={PROJECT_FIELDS}
        searchable
        pageSize={10}
        filters={[{ name: 'is_featured', label: 'pf.work.kind', options: [
          { value: 'true', label: 'pf.work.featureProject' }, { value: 'false', label: 'pf.work.enterprise' }] }]}
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
      <PfPageHeader versions title="pf.work.experienceTitle" subtitle="pf.common.orderHint" />
      <PfListEditor
        versioned
        cloneable
        table="pf_experiences"
        title="pf.work.experience"
        fields={EXPERIENCE_FIELDS}
        searchable
        pageSize={10}
        filters={[{ name: 'kind', label: 'pf.work.experienceKind', options: EXPERIENCE_KINDS }]}
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

const splitSkills = (v: unknown) => String(v ?? '').split(',').map(x => x.trim()).filter(Boolean);
const lower = (xs: string[]) => new Set(xs.map(x => x.toLowerCase()));

/**
 * Under a category's skills: the other categories' skills as chips. A click
 * moves the skill here; on Save it is also taken off the category it came from.
 * The moves ride along in the hidden form value `__moved`.
 */
const OtherSkills = ({ values, setValue, rows, editing }: {
  values: PfFormValues; setValue: (key: string, value: string | boolean) => void; rows: PfRow[]; editing: PfRow | null;
}) => {
  const { t } = useLanguage();
  const here = splitSkills(values.skills);
  const taken = lower(here);
  const others = rows
    .filter(r => r.id !== editing?.id)
    .map(r => ({ id: r.id, title: String(r.title_en), skills: ((r.skills as string[]) ?? []).filter(s => !taken.has(s.toLowerCase())) }))
    .filter(c => c.skills.length);
  if (!others.length) return null;
  const take = (skill: string) => {
    setValue('skills', [...here, skill].join(', '));
    setValue('__moved', [...splitSkills(values.__moved), skill].join(', '));
  };
  return (
    <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-3 space-y-3">
      <p className="text-xs text-gray-500 dark:text-gray-400">{t('pf.work.otherSkillsHint')}</p>
      {others.map(c => (
        <div key={c.id}>
          <div className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">{c.title}</div>
          <div className="flex flex-wrap gap-1.5">
            {c.skills.map(skill => (
              <button key={skill} type="button" onClick={() => take(skill)}
                className="px-2 py-0.5 rounded-md text-xs border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-primary hover:text-primary hover:bg-primary/5">
                + {skill}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export const PfTechStack = () => {
  const userId = usePfUserId();
  const [rows, setRows] = useState<PfRow[]>([]);

  /** Skills moved into the saved category leave the categories they came from. */
  const afterSave = async (row: Record<string, unknown>, values: PfFormValues) => {
    const moved = lower(splitSkills(values.__moved));
    if (!userId || !moved.size) return;
    const kept = lower((row.skills as string[]) ?? []);
    for (const r of rows) {
      const skills = (r.skills as string[]) ?? [];
      const left = skills.filter(s => !(moved.has(s.toLowerCase()) && kept.has(s.toLowerCase())));
      // Untouched categories (the saved one included: moved skills were never in it) stay as they are.
      if (left.length === skills.length) continue;
      const { error } = await supabase.from('pf_tech_categories').update({ skills: left, updated_at: new Date().toISOString() })
        .eq('id', r.id).eq('user_id', userId);
      if (error) throw error;
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PfPageHeader versions title="pf.work.techTitle" subtitle="pf.common.orderHint" />
      <PfListEditor
        versioned
        cloneable
        table="pf_tech_categories"
        title="pf.work.categories"
        fields={TECH_FIELDS}
        onRowsChange={setRows}
        afterSave={afterSave}
        formExtra={ctx => <OtherSkills {...ctx} />}
        renderRow={r => <PfRowText primary={`${r.title_en} (${r.icon})`} extra={<Tags items={r.skills} />} />}
      />
    </div>
  );
};

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
  { name: 'highlights', label: 'pf.research.highlights', type: 'i18nList', hint: 'pf.research.highlightsHint' },
  { name: 'show_highlights', label: 'pf.research.showHighlights', type: 'boolean', initial: true },
  { name: 'contributions', label: 'pf.research.contributions', type: 'i18nList', hint: 'pf.research.contributionsHint' },
  { name: 'show_contributions', label: 'pf.research.showContributions', type: 'boolean', initial: true },
  { name: 'methods', label: 'pf.research.methods', type: 'tags', hint: 'pf.research.methodsHint' },
  { name: 'show_methods', label: 'pf.research.showMethods', type: 'boolean', initial: true },
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

const KIND_ORDER = ['model', 'dataset', 'code', 'demo'];
const ARTIFACT_KINDS = KIND_ORDER.map(value => ({ value, label: `pf.research.kinds.${value}` }));
/** The link column of each kind (073). */
const KIND_LINK: Record<string, string> = { model: 'model_url', dataset: 'dataset_url', code: 'code_url', demo: 'demo_url' };

const pickedKinds = (v: PfFormValues) => String(v.kinds ?? '').split(',').filter(Boolean);
const has = (kind: string) => (v: PfFormValues) => pickedKinds(v).includes(kind);

/** A released item (063, 073): one or more kinds, each with its own link; `papers` are the publications to link it to. */
const artifactFields = (papers: { value: string; label: string }[]): PfField[] => [
  { name: 'kinds', label: 'pf.research.artifactKinds', type: 'multi', options: ARTIFACT_KINDS, initial: 'model', hint: 'pf.research.artifactKindsHint' },
  { name: 'title', label: 'pf.work.title', type: 'i18n', required: true },
  { name: 'description', label: 'pf.work.description', type: 'i18n', multiline: true },
  { name: 'model_url', label: 'pf.research.modelUrl', type: 'text', showIf: has('model'), hint: 'pf.research.modelUrlHint' },
  { name: 'demo_url', label: 'pf.research.demoUrl', type: 'text', showIf: v => has('model')(v) || has('demo')(v), hint: 'pf.research.demoUrlHint' },
  { name: 'dataset_url', label: 'pf.research.datasetUrl', type: 'text', showIf: has('dataset'), hint: 'pf.research.datasetUrlHint' },
  { name: 'code_url', label: 'pf.research.codeLink', type: 'text', showIf: has('code'), hint: 'pf.research.codeLinkHint' },
  { name: 'private_kinds', label: 'pf.research.privateKinds', type: 'multi', options: ARTIFACT_KINDS, hint: 'pf.research.privateKindsHint' },
  { name: 'publication_id', label: 'pf.research.paper', type: 'select', options: papers, allowEmpty: true, hint: 'pf.research.paperHint' },
  { name: 'metrics', label: 'pf.research.metrics', type: 'tags', hint: 'pf.research.metricsHint' },
  { name: 'tags', label: 'pf.research.tags', type: 'tags' },
  { name: 'released_on', label: 'pf.research.releasedOn', type: 'date' },
  { name: 'show_case_study', label: 'pf.work.showCaseStudy', type: 'boolean', hint: 'pf.work.showCaseStudyHint' },
  { name: 'show_challenges', label: 'pf.work.showChallenges', type: 'boolean', hint: 'pf.work.showChallengesHint' },
  { name: 'is_featured', label: 'pf.work.featured', type: 'boolean', hint: 'pf.research.featuredHint' },
];

/** The platform a link is on, from its address. */
const platformOf = (url: unknown) => {
  const host = (() => { try { return new URL(String(url)).hostname; } catch { return ''; } })();
  return host.includes('huggingface') ? 'huggingface' : host.includes('kaggle') ? 'kaggle' : host.includes('github') ? 'github'
    : host.includes('zenodo') ? 'zenodo' : host ? 'website' : 'other';
};

/**
 * Keeps the older columns in step: kind and url are the first kind and its
 * link, platform comes from that link, is_private is "any link private", and
 * private kinds the item does not have are dropped.
 */
const shapeArtifact = (row: Record<string, unknown>) => {
  const kinds = KIND_ORDER.filter(k => ((row.kinds as string[]) ?? []).includes(k));
  const first = kinds.find(k => row[KIND_LINK[k]]) ?? kinds[0] ?? 'model';
  const url = row[KIND_LINK[first]] ?? null;
  const privateKinds = ((row.private_kinds as string[]) ?? []).filter(k => kinds.includes(k));
  return { ...row, kinds, kind: first, url, platform: platformOf(url), private_kinds: privateKinds, is_private: privateKinds.length > 0 };
};

export const PfResearch = () => {
  const { t } = useLanguage();
  const userId = usePfUserId();
  // The publication whose details (case study, challenges) are open in the modal.
  const [publication, setPublication] = useState<PfRow | null>(null);
  const [reload, setReload] = useState(0);
  // The model / dataset whose details (case study, challenges) are open.
  const [artifact, setArtifact] = useState<PfRow | null>(null);
  const [artifactReload, setArtifactReload] = useState(0);
  // Publications, for linking an artifact to its paper.
  const [papers, setPapers] = useState<{ value: string; label: string }[]>([]);
  const paperTitle = (id: unknown) => papers.find(p => p.value === id)?.label;
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PfPageHeader versions title="pf.research.pageTitle" subtitle="pf.common.orderHint" />
      <PfListEditor
        versioned
        cloneable
        table="pf_publications"
        title="pf.research.publications"
        fields={PUBLICATION_FIELDS}
        pageSize={10}
        filters={[
          { name: 'status', label: 'pf.research.statusLabel', options: PUB_STATUSES },
          { name: 'pub_type', label: 'pf.research.type', options: PUB_TYPES },
        ]}
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
                {r.show_highlights === false && <Badge variant="muted">{t('pf.research.highlightsHidden')}</Badge>}
                {r.show_contributions === false && <Badge variant="muted">{t('pf.research.contributionsHidden')}</Badge>}
                {r.show_methods === false && <Badge variant="muted">{t('pf.research.methodsHidden')}</Badge>}
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
        reloadSignal={artifactReload}
        rowActions={r => <DetailsButton onClick={() => setArtifact(r)} />}
        pageSize={10}
        transform={shapeArtifact}
        filters={[{ name: 'kinds', label: 'pf.research.artifactKind', options: ARTIFACT_KINDS }]}
        searchable
        renderRow={r => (
          <PfRowText
            primary={String(r.title_en)}
            secondary={[paperTitle(r.publication_id), r.url ? String(r.url) : ''].filter(Boolean).join(' · ')}
            extra={<>
              {(((r.kinds as string[]) ?? []).length ? (r.kinds as string[]) : [String(r.kind)]).map(k => (
                <Badge key={k} variant={((r.private_kinds as string[]) ?? []).includes(k) ? 'warning' : 'default'}>
                  {t(`pf.research.kinds.${k}`)}{((r.private_kinds as string[]) ?? []).includes(k) ? ` · ${t('pf.research.private')}` : ''}
                </Badge>
              ))}
              {r.show_case_study === true && <Badge variant="warning">{t('pf.work.caseStudyShown')}</Badge>}
              {r.show_challenges === true && <Badge variant="warning">{t('pf.work.challengesShown')}</Badge>}
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
      <PfCaseStudyModal
        row={artifact}
        table="pf_research_artifacts"
        parentColumn="artifact_id"
        onClose={() => setArtifact(null)}
        onSwitchChange={() => setArtifactReload(n => n + 1)}
      />
    </div>
  );
};
