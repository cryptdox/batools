import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { errorMessage, formFromRow, isFormComplete, loadPfVersions, rowFromForm, usePfUserId, PF_ICON_OPTIONS, type PfField, type PfFormValues } from '../../lib/portfolio';
import { Badge, Button } from '../../components/ui/Button';
import { PfFieldInput } from '../../components/portfolio/PfFieldInput';
import { PfListEditor, PfRowText } from '../../components/portfolio/PfListEditor';
import { PfFileUpload, PF_BUCKET } from '../../components/portfolio/PfFileUpload';
import { PfPageHeader } from './PfPageHeader';
import { setPfVersionTab, usePfVersionTab } from '../../lib/pfVersionTab';

const IDENTITY: PfField[] = [
  { name: 'name', label: 'pf.profile.name', type: 'i18n', required: true },
  { name: 'email', label: 'pf.profile.email', type: 'text' },
  { name: 'phone', label: 'pf.profile.phone', type: 'i18n' },
  { name: 'location', label: 'pf.profile.location', type: 'i18n', hint: 'pf.profile.locationHint' },
  { name: 'career_start_year', label: 'pf.profile.careerStartYear', type: 'number', min: 1950, max: 2100, hint: 'pf.profile.careerStartYearHint' },
];

// Used by a version only when it has no value of its own (pf_versions title / statement).
const DEFAULTS: PfField[] = [
  { name: 'title', label: 'pf.profile.title', type: 'i18n', hint: 'pf.profile.titleHint' },
  { name: 'objective', label: 'pf.profile.objective', type: 'i18n', rich: true, hint: 'pf.common.richTextHint' },
];

// Only the Developer layout draws these (hero and footer).
const DEV_HERO: PfField[] = [
  { name: 'greeting', label: 'pf.profile.greeting', type: 'i18n' },
  { name: 'subtitle', label: 'pf.profile.subtitle', type: 'i18n', multiline: true },
  { name: 'slogan', label: 'pf.profile.slogan', type: 'i18n', multiline: true },
];

// Handles only — the site builds each platform's URL.
const SOCIAL: PfField[] = ['github', 'linkedin', 'medium', 'youtube', 'facebook', 'instagram', 'x', 'gitlab', 'kaggle']
  .map(name => ({ name, label: `pf.profile.${name}`, type: 'text' as const }));

const LAYOUTS = ['developer', 'researcher'].map(value => ({ value, label: `pf.versions.layouts.${value}` }));
const isResearcher = (v: PfFormValues) => v.layout === 'researcher';

/** A version of the portfolio (063): its address, layout, switches and overrides. */
const VERSION_FIELDS: PfField[] = [
  { name: 'name', label: 'pf.versions.name', type: 'i18n', required: true },
  { name: 'slug', label: 'pf.versions.slug', type: 'text', required: true, hint: 'pf.versions.slugHint' },
  { name: 'layout', label: 'pf.versions.layout', type: 'select', options: LAYOUTS, initial: 'developer', hint: 'pf.versions.layoutHint' },
  { name: 'is_active', label: 'pf.versions.active', type: 'boolean', initial: true, hint: 'pf.versions.activeHint' },
  { name: 'is_default', label: 'pf.versions.default', type: 'boolean', hint: 'pf.versions.defaultHint' },
  { name: 'title', label: 'pf.versions.title', type: 'i18n', hint: 'pf.versions.titleHint' },
  { name: 'statement', label: 'pf.versions.statement', type: 'i18n', rich: true, hint: 'pf.versions.statementHint' },
  { name: 'affiliation', label: 'pf.versions.affiliation', type: 'i18n', showIf: isResearcher },
  { name: 'interests', label: 'pf.versions.interests', type: 'i18nList', showIf: isResearcher },
  { name: 'photo_url', label: 'pf.versions.photo', type: 'text', upload: 'image/*', hint: 'pf.versions.photoHint' },
  { name: 'cv_url', label: 'pf.versions.cv', type: 'text', upload: 'application/pdf', hint: 'pf.versions.cvHint' },
];

const ACADEMIC: PfField[] = [
  { name: 'huggingface', label: 'pf.profile.huggingface', type: 'text' },
  { name: 'google_scholar', label: 'pf.profile.google_scholar', type: 'text', hint: 'pf.profile.google_scholarHint' },
  { name: 'orcid', label: 'pf.profile.orcid', type: 'text', hint: 'pf.profile.orcidHint' },
  { name: 'researchgate', label: 'pf.profile.researchgate', type: 'text', hint: 'pf.profile.researchgateHint' },
];

const ALL = [...IDENTITY, ...DEFAULTS, ...DEV_HERO, ...SOCIAL, ...ACADEMIC];

const ROLE_FIELDS: PfField[] = [
  { name: 'text', label: 'pf.profile.roleText', type: 'i18n', required: true },
  { name: 'icon', label: 'pf.common.icon', type: 'select', options: PF_ICON_OPTIONS, initial: 'code' },
];

type PfRowData = Record<string, unknown>;

/** Who a card's data is for: one value for all, a default versions can replace, one layout only, or per link. */
type Scope = 'shared' | 'default' | 'layout' | 'links';
const SCOPE_STYLE: Record<Scope, string> = {
  shared: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800',
  default: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
  layout: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800',
  links: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
};

const ScopePill = ({ scope, label }: { scope: Scope; label: string }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold ${SCOPE_STYLE[scope]}`}>{label}</span>
);

const Card = ({ title, scope, scopeLabel, note, children }: { title: string; scope?: Scope; scopeLabel?: string; note?: string; children: React.ReactNode }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 space-y-4">
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
        {scope && scopeLabel && <ScopePill scope={scope} label={scopeLabel} />}
      </div>
      {note && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{note}</p>}
    </div>
    {children}
  </div>
);

const plain = (v: unknown) => String(v ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const short = (v: unknown, n = 60) => { const s = plain(v); return s.length > n ? `${s.slice(0, n)}…` : s; };
const fileName = (v: unknown) => decodeURIComponent(String(v ?? '').split('/').pop() ?? '');
const inVersion = (row: PfRowData, id: string) => {
  const tags = Array.isArray(row.versions) ? row.versions as string[] : [];
  return !tags.length || tags.includes(id);
};

export const PfProfile = () => {
  const { t } = useLanguage();
  const userId = usePfUserId();
  const [values, setValues] = useState<PfFormValues>(() => formFromRow(ALL, null));
  // Saved on its own the moment a file is uploaded, not by the Save button.
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [versionsReload, setVersionsReload] = useState(0);
  // Which versions show each link (069): a link missing here shows in all.
  const [linkVersions, setLinkVersions] = useState<Record<string, string[]>>({});
  const [versions, setVersions] = useState<{ value: string; label: string }[]>([]);
  useEffect(() => {
    if (userId) void loadPfVersions(userId).then(setVersions);
  }, [userId, versionsReload]);
  const [saving, setSaving] = useState(false);
  // Full rows of the two lists below, for the overview and the "per version" notes.
  const [versionRows, setVersionRows] = useState<PfRowData[]>([]);
  const [roleRows, setRoleRows] = useState<PfRowData[]>([]);
  const tab = usePfVersionTab();

  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.from('pf_profile').select('*').eq('user_id', userId).maybeSingle();
      if (error) toast.error(error.message);
      setValues(formFromRow(ALL, data));
      setLinkVersions((data?.link_versions as Record<string, string[]> | null) ?? {});
      setResumeUrl(data?.resume_url ?? null);
      setPhotoUrl(data?.photo_url ?? null);
      setLoading(false);
    })();
  }, [userId]);

  const onChange = (key: string, value: string | boolean) => setValues(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!userId || !isFormComplete(ALL, values)) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('pf_profile').upsert({
        ...rowFromForm(ALL, values),
        link_versions: linkVersions,
        user_id: userId,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      toast.success(t('pf.common.updated'));
    } catch (e) {
      console.error(e);
      toast.error(errorMessage(e, t('pf.common.saveError')));
    } finally {
      setSaving(false);
    }
  };

  const saveResumeUrl = async (url: string | null) => {
    if (!userId) return;
    const { error } = await supabase.from('pf_profile').upsert({ user_id: userId, resume_url: url, updated_at: new Date().toISOString() });
    if (error) throw error;
    setResumeUrl(url);
  };

  const savePhotoUrl = async (url: string | null) => {
    if (!userId) return;
    const { error } = await supabase.from('pf_profile').upsert({ user_id: userId, photo_url: url, updated_at: new Date().toISOString() });
    if (error) throw error;
    setPhotoUrl(url);
  };

  /** One default version: saving a default turns the others off. */
  const keepOneDefault = async (row: Record<string, unknown>) => {
    if (!userId || row.is_default !== true) return;
    const { error } = await supabase.from('pf_versions').update({ is_default: false })
      .eq('user_id', userId).eq('is_default', true).neq('slug', String(row.slug));
    if (error) throw error;
    setVersionsReload(n => n + 1);
  };

  /** Ticks or unticks a version for a link; all ticked is stored as "every version". */
  const toggleLinkVersion = (link: string, version: string) => setLinkVersions(prev => {
    const shown = prev[link] ?? versions.map(v => v.value);
    const next = shown.includes(version) ? shown.filter(v => v !== version) : [...shown, version];
    const rest = { ...prev };
    delete rest[link];
    return versions.every(v => next.includes(v.value)) ? rest : { ...rest, [link]: next };
  });

  /** A link field with "Show in: ☑ Developer ☑ Researcher" under it. */
  const linkSection = (fields: PfField[]) => fields.map(f => (
    <div key={f.name}>
      <PfFieldInput field={f} values={values} onChange={onChange} />
      {versions.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
          <span>{t('pf.profile.showIn')}:</span>
          {versions.map(v => (
            <label key={v.value} className="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                className="w-3.5 h-3.5 accent-primary"
                checked={(linkVersions[f.name] ?? versions.map(x => x.value)).includes(v.value)}
                onChange={() => toggleLinkVersion(f.name, v.value)}
              />
              {v.label}
            </label>
          ))}
        </div>
      )}
    </div>
  ));

  const section = (fields: PfField[]) => fields.map(f => <PfFieldInput key={f.name} field={f} values={values} onChange={onChange} />);

  /** The version's own value for a default, or '' when it uses the default. */
  const own: Record<string, (v: PfRowData) => unknown> = {
    title: v => v.title_en, objective: v => plain(v.statement_en), photo: v => v.photo_url, resume: v => v.cv_url,
  };

  /** "Developer: uses this · Researcher: own value", under a default field. */
  const perVersion = (key: string) => versionRows.length > 0 && (
    <div className="-mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <span className="text-gray-500 dark:text-gray-400">{t('pf.profile.perVersion')}:</span>
      {versionRows.map(v => {
        const has = !!own[key](v);
        return (
          <span key={String(v.id)} className={has ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'}>
            <strong className="font-medium">{String(v.name_en)}</strong> {t(has ? 'pf.profile.ownValue' : 'pf.profile.usesThis')}
          </span>
        );
      })}
    </div>
  );

  const devVersions = versionRows.filter(v => v.layout !== 'researcher').map(v => String(v.name_en));
  const linkFields = [...SOCIAL, ...ACADEMIC];

  /** One overview cell: where this version gets the value from. */
  type Cell = { kind: 'own' | 'default' | 'shared' | 'empty' | 'na'; text?: string };
  const CELL_STYLE: Record<Cell['kind'], string> = {
    own: 'text-emerald-700 dark:text-emerald-400',
    default: 'text-amber-700 dark:text-amber-400',
    shared: 'text-sky-700 dark:text-sky-400',
    empty: 'text-red-600 dark:text-red-400',
    na: 'text-gray-400 dark:text-gray-500',
  };
  const fromDefault = (ownVal: unknown, defVal: unknown, show: (x: unknown) => string): Cell =>
    ownVal ? { kind: 'own', text: show(ownVal) } : defVal ? { kind: 'default', text: show(defVal) } : { kind: 'empty' };
  const MATRIX: { label: string; cell: (v: PfRowData, dev: boolean) => Cell }[] = [
    { label: 'pf.profile.title', cell: v => fromDefault(v.title_en, values.title_en, x => short(x)) },
    { label: 'pf.versions.statement', cell: v => fromDefault(plain(v.statement_en), plain(values.objective_en), x => short(x)) },
    { label: 'pf.versions.photo', cell: v => fromDefault(v.photo_url, photoUrl, fileName) },
    { label: 'pf.versions.cv', cell: v => fromDefault(v.cv_url, resumeUrl, fileName) },
    { label: 'pf.versions.affiliation', cell: (v, dev) => dev ? { kind: 'na' } : v.affiliation_en ? { kind: 'own', text: short(v.affiliation_en) } : { kind: 'empty' } },
    { label: 'pf.versions.interests', cell: (v, dev) => {
      const n = Array.isArray(v.interests_en) ? (v.interests_en as string[]).filter(Boolean).length : 0;
      return dev ? { kind: 'na' } : n ? { kind: 'own', text: t('pf.profile.countItems').replace('{n}', String(n)) } : { kind: 'empty' };
    } },
    { label: 'pf.profile.devHeroFields', cell: (_v, dev) => !dev ? { kind: 'na' }
      : values.subtitle_en || values.greeting_en ? { kind: 'shared', text: short(values.greeting_en || values.subtitle_en, 40) } : { kind: 'empty' } },
    { label: 'pf.profile.roles', cell: (v, dev) => {
      const n = roleRows.filter(r => r.is_visible !== false && inVersion(r, String(v.id))).length;
      return !dev ? { kind: 'na' } : n ? { kind: 'own', text: t('pf.profile.countItems').replace('{n}', String(n)) } : { kind: 'empty' };
    } },
    { label: 'pf.profile.linksShown', cell: v => {
      const shown = linkFields.filter(f => String(values[f.name] ?? '').trim() && (linkVersions[f.name] ?? [String(v.id)]).includes(String(v.id)));
      return shown.length ? { kind: 'shared', text: shown.map(f => t(f.label)).join(', ') } : { kind: 'empty' };
    } },
  ];
  const CELL_LABEL: Record<Cell['kind'], string> = {
    own: 'pf.profile.cellOwn', default: 'pf.profile.cellDefault', shared: 'pf.profile.cellShared', empty: 'pf.profile.cellEmpty', na: 'pf.profile.cellNA',
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PfPageHeader versions
        title="pf.profile.pageTitle"
        subtitle="pf.profile.pageSubtitle"
        action={
          <Button onClick={handleSave} disabled={loading || saving || !isFormComplete(ALL, values)}>
            {saving ? t('pf.common.saving') : t('pf.common.save')}
          </Button>
        }
      />

      {loading ? (
        <div className="p-12 text-center text-gray-500">{t('pf.common.loading')}</div>
      ) : (
        <>
          {versionRows.length > 0 && (
            <Card title={t('pf.profile.matrixTitle')} note={t('pf.profile.matrixHint')}>
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm border-separate border-spacing-0">
                  <thead>
                    <tr>
                      <th className="w-40" />
                      {versionRows.map(v => {
                        const active = tab === v.id;
                        return (
                          <th key={String(v.id)} className="px-2 pb-2 text-left align-bottom">
                            <button
                              onClick={() => setPfVersionTab(active ? 'all' : String(v.id))}
                              className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${active
                                ? 'bg-primary text-white border-primary'
                                : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                            >
                              <div className="font-semibold">{String(v.name_en)}{v.is_active === true ? '' : ` (${t('pf.versions.inactive')})`}</div>
                              <div className={`text-xs font-normal ${active ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>
                                {t(`pf.versions.layouts.${v.layout}`)} {t('pf.profile.layoutWord')} · ?version={String(v.slug)}
                              </div>
                            </button>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {MATRIX.map(row => (
                      <tr key={row.label} className="align-top">
                        <td className="px-2 py-2 border-t border-gray-100 dark:border-gray-700 font-medium text-gray-700 dark:text-gray-300">{t(row.label)}</td>
                        {versionRows.map(v => {
                          const c = row.cell(v, v.layout !== 'researcher');
                          return (
                            <td key={String(v.id)} className={`px-3 py-2 border-t border-gray-100 dark:border-gray-700 ${tab === v.id ? 'bg-primary/5' : ''}`}>
                              <span className={`text-xs font-semibold ${CELL_STYLE[c.kind]}`}>{t(CELL_LABEL[c.kind])}</span>
                              {c.text && <div className="text-xs text-gray-600 dark:text-gray-400 break-words">{c.text}</div>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                {(['own', 'default', 'shared', 'empty', 'na'] as const).map(k => (
                  <span key={k}><strong className={CELL_STYLE[k]}>{t(CELL_LABEL[k])}</strong> = {t(`${CELL_LABEL[k]}Hint`)}</span>
                ))}
              </div>
            </Card>
          )}

          <Card title={t('pf.profile.identity')} scope="shared" scopeLabel={t('pf.profile.scopeShared')} note={t('pf.profile.scopeSharedNote')}>
            {section(IDENTITY)}
          </Card>

          <Card title={t('pf.profile.defaults')} scope="default" scopeLabel={t('pf.profile.scopeDefault')} note={t('pf.profile.scopeDefaultNote')}>
            {DEFAULTS.map(f => (
              <div key={f.name} className="space-y-2">
                <PfFieldInput field={f} values={values} onChange={onChange} />
                {perVersion(f.name)}
              </div>
            ))}
            {userId && (
              <div className="space-y-2">
                <PfFileUpload userId={userId} label="pf.profile.photo" name="photo" accept="image/*" url={photoUrl} onChange={savePhotoUrl} />
                {perVersion('photo')}
              </div>
            )}
            {userId && (
              <div className="space-y-2">
                <PfFileUpload userId={userId} label="pf.profile.resume" name="resume" accept="application/pdf" url={resumeUrl} onChange={saveResumeUrl} />
                {perVersion('resume')}
              </div>
            )}
          </Card>

          <Card
            title={t('pf.profile.devHero')}
            scope="layout"
            scopeLabel={t('pf.profile.scopeLayout')}
            note={`${t('pf.profile.scopeLayoutNote')}${devVersions.length ? ` ${t('pf.profile.usedByNow')}: ${devVersions.join(', ')}.` : ''}`}
          >
            {section(DEV_HERO)}
          </Card>
          <Card title={t('pf.profile.social')} scope="links" scopeLabel={t('pf.profile.scopeLinks')} note={t('pf.profile.scopeLinksNote')}>
            <div className="grid sm:grid-cols-2 gap-4">{linkSection(SOCIAL)}</div>
          </Card>
          <Card title={t('pf.profile.academicLinks')} scope="links" scopeLabel={t('pf.profile.scopeLinks')} note={t('pf.profile.scopeLinksNote')}>
            <div className="grid sm:grid-cols-2 gap-4">{linkSection(ACADEMIC)}</div>
          </Card>
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving || !isFormComplete(ALL, values)}>
              {saving ? t('pf.common.saving') : t('pf.common.save')}
            </Button>
          </div>
        </>
      )}

      <PfListEditor
        cloneable
        table="pf_versions"
        title="pf.versions.listTitle"
        subtitle="pf.versions.hint"
        fields={VERSION_FIELDS}
        hideable={false}
        upload={userId ? { bucket: PF_BUCKET, folder: `${userId}/versions` } : undefined}
        transform={row => ({ ...row, slug: String(row.slug ?? '').trim().toLowerCase() })}
        afterSave={keepOneDefault}
        reloadSignal={versionsReload}
        onRowsChange={setVersionRows}
        renderRow={r => (
          <PfRowText
            primary={`${r.name_en} · ?version=${r.slug}`}
            secondary={String(r.title_en ?? '')}
            extra={<>
              <Badge variant="default">{t(`pf.versions.layouts.${r.layout}`)}</Badge>
              <Badge variant={r.is_active === true ? 'success' : 'muted'}>{t(r.is_active === true ? 'pf.versions.active' : 'pf.versions.inactive')}</Badge>
              {r.is_default === true && <Badge variant="warning">{t('pf.versions.default')}</Badge>}
              {Object.keys(own).filter(k => own[k](r)).length > 0 && (
                <span className="text-xs text-emerald-700 dark:text-emerald-400">
                  {t('pf.profile.replaces')}: {Object.keys(own).filter(k => own[k](r)).map(k => t(`pf.profile.${k}`)).join(', ')}
                </span>
              )}
            </>}
          />
        )}
      />

      <PfListEditor
        versioned
        cloneable
        table="pf_hero_roles"
        onRowsChange={setRoleRows}
        title="pf.profile.roles"
        subtitle="pf.profile.rolesHint"
        fields={ROLE_FIELDS}
        renderRow={r => <PfRowText primary={String(r.text_en)} secondary={`${r.text_bn ?? ''} · ${r.icon}`} />}
      />
    </div>
  );
};
