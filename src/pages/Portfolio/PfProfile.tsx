import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { errorMessage, formFromRow, isFormComplete, rowFromForm, usePfUserId, PF_ICON_OPTIONS, type PfField, type PfFormValues } from '../../lib/portfolio';
import { Badge, Button } from '../../components/ui/Button';
import { PfFieldInput, removeUploads, type PfUploadTarget } from '../../components/portfolio/PfFieldInput';
import { PfListEditor, PfRowText } from '../../components/portfolio/PfListEditor';
import { PfFileUpload, PF_BUCKET } from '../../components/portfolio/PfFileUpload';
import { PfPageHeader } from './PfPageHeader';
import { setPfVersionTab } from '../../lib/pfVersionTab';

// The profile page in tabs, one per kind of data:
//   Overview        where each version gets its data + add / clone / delete versions
//   Every version   identity, one value for all
//   Defaults        title, objective, photo, CV: used by a version without its own
//   <each version>  its settings, its own values and what only its layout shows
//   Links           handles, each shown in the versions ticked under it

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

// Only the Developer layout draws these (hero and footer); one set for every Developer-layout version.
const DEV_HERO: PfField[] = [
  { name: 'greeting', label: 'pf.profile.greeting', type: 'i18n' },
  { name: 'subtitle', label: 'pf.profile.subtitle', type: 'i18n', multiline: true },
  { name: 'slogan', label: 'pf.profile.slogan', type: 'i18n', multiline: true },
];

// Handles only — the site builds each platform's URL.
const SOCIAL: PfField[] = ['github', 'linkedin', 'medium', 'youtube', 'facebook', 'instagram', 'x', 'gitlab', 'kaggle']
  .map(name => ({ name, label: `pf.profile.${name}`, type: 'text' as const }));

const ACADEMIC: PfField[] = [
  { name: 'huggingface', label: 'pf.profile.huggingface', type: 'text' },
  { name: 'google_scholar', label: 'pf.profile.google_scholar', type: 'text', hint: 'pf.profile.google_scholarHint' },
  { name: 'orcid', label: 'pf.profile.orcid', type: 'text', hint: 'pf.profile.orcidHint' },
  { name: 'researchgate', label: 'pf.profile.researchgate', type: 'text', hint: 'pf.profile.researchgateHint' },
];

const ALL = [...IDENTITY, ...DEFAULTS, ...DEV_HERO, ...SOCIAL, ...ACADEMIC];

const LAYOUTS = ['developer', 'researcher'].map(value => ({ value, label: `pf.versions.layouts.${value}` }));
const isResearcher = (v: PfFormValues) => v.layout === 'researcher';

/** A version's settings (063). */
const VERSION_SETTINGS: PfField[] = [
  { name: 'name', label: 'pf.versions.name', type: 'i18n', required: true },
  { name: 'slug', label: 'pf.versions.slug', type: 'text', required: true, hint: 'pf.versions.slugHint' },
  { name: 'short_code', label: 'pf.versions.shortCode', type: 'text', hint: 'pf.versions.shortCodeHint' },
  { name: 'layout', label: 'pf.versions.layout', type: 'select', options: LAYOUTS, initial: 'developer', hint: 'pf.versions.layoutHint' },
  { name: 'is_active', label: 'pf.versions.active', type: 'boolean', initial: true, hint: 'pf.versions.activeHint' },
  { name: 'is_default', label: 'pf.versions.default', type: 'boolean', hint: 'pf.versions.defaultHint' },
];
/** Its own values; empty uses the default. */
const VERSION_OWN: PfField[] = [
  { name: 'title', label: 'pf.versions.title', type: 'i18n', hint: 'pf.versions.titleHint' },
  { name: 'statement', label: 'pf.versions.statement', type: 'i18n', rich: true, hint: 'pf.versions.statementHint' },
  { name: 'photo_url', label: 'pf.versions.photo', type: 'text', upload: 'image/*', hint: 'pf.versions.photoHint' },
  { name: 'cv_url', label: 'pf.versions.cv', type: 'text', upload: 'application/pdf', hint: 'pf.versions.cvHint' },
];
/** Only the Researcher layout shows these. */
const VERSION_RESEARCHER: PfField[] = [
  { name: 'affiliation', label: 'pf.versions.affiliation', type: 'i18n', showIf: isResearcher },
  { name: 'interests', label: 'pf.versions.interests', type: 'i18nList', showIf: isResearcher },
];
const VERSION_FIELDS = [...VERSION_SETTINGS, ...VERSION_OWN, ...VERSION_RESEARCHER];

const ROLE_FIELDS: PfField[] = [
  { name: 'text', label: 'pf.profile.roleText', type: 'i18n', required: true },
  { name: 'icon', label: 'pf.common.icon', type: 'select', options: PF_ICON_OPTIONS, initial: 'code' },
];

type PfRowData = Record<string, unknown>;

/** Who a card's data is for. */
type Scope = 'shared' | 'default' | 'version' | 'layout' | 'links';
const SCOPE_STYLE: Record<Scope, string> = {
  shared: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800',
  default: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
  version: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
  layout: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800',
  links: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800',
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

/** A version's own value for each default, or '' when it uses the default. */
const OWN: Record<string, (v: PfRowData) => unknown> = {
  title: v => v.title_en, objective: v => plain(v.statement_en), photo: v => v.photo_url, resume: v => v.cv_url,
};

export const PfProfile = () => {
  const { t } = useLanguage();
  const userId = usePfUserId();
  const [values, setValues] = useState<PfFormValues>(() => formFromRow(ALL, null));
  // Saved on its own the moment a file is uploaded, not by the Save button.
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Which versions show each link (069): a link missing here shows in all.
  const [linkVersions, setLinkVersions] = useState<Record<string, string[]>>({});
  const [versionRows, setVersionRows] = useState<PfRowData[]>([]);
  // Each version's form; `dirty` = edited since loaded, saved by the Save button.
  const [versionForms, setVersionForms] = useState<Record<string, PfFormValues>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const dirtyRef = useRef(dirty);
  useEffect(() => { dirtyRef.current = dirty; }, [dirty]);
  const [roleRows, setRoleRows] = useState<PfRowData[]>([]);
  const [versionsReload, setVersionsReload] = useState(0);
  const [chosenTab, setPageTab] = useState<string>('overview');
  // A tab of a deleted version falls back to the overview.
  const pageTab = ['overview', 'shared', 'defaults', 'links'].includes(chosenTab) || versionRows.some(v => v.id === chosenTab) ? chosenTab : 'overview';
  const activeVersion = versionRows.find(v => v.id === pageTab);
  const versionUpload: PfUploadTarget | undefined = userId ? { bucket: PF_BUCKET, folder: `${userId}/versions` } : undefined;

  /** New version rows: refresh the forms, keeping the ones being edited. */
  const applyVersionRows = useCallback((rows: PfRowData[]) => {
    const editing = dirtyRef.current;
    setVersionRows(rows);
    setVersionForms(prev => Object.fromEntries(rows.map(r => {
      const id = String(r.id);
      return [id, editing.has(id) && prev[id] ? prev[id] : formFromRow(VERSION_FIELDS, r)];
    })));
    setDirty(new Set([...editing].filter(id => rows.some(r => r.id === id))));
  }, []);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      const [profile, versions, roles] = await Promise.all([
        supabase.from('pf_profile').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('pf_versions').select('*').eq('user_id', userId).order('sort_order'),
        supabase.from('pf_hero_roles').select('*').eq('user_id', userId),
      ]);
      const error = profile.error ?? versions.error ?? roles.error;
      if (error) toast.error(error.message);
      const data = profile.data;
      setValues(formFromRow(ALL, data));
      setLinkVersions((data?.link_versions as Record<string, string[]> | null) ?? {});
      setResumeUrl(data?.resume_url ?? null);
      setPhotoUrl(data?.photo_url ?? null);
      applyVersionRows((versions.data ?? []) as PfRowData[]);
      setRoleRows((roles.data ?? []) as PfRowData[]);
      setLoading(false);
    })();
  }, [userId, applyVersionRows]);


  const openTab = (key: string) => {
    setPageTab(key);
    // A version tab also filters the versioned lists here and on the other Portfolio pages.
    if (versionRows.some(v => v.id === key)) setPfVersionTab(key);
  };

  const onChange = (key: string, value: string | boolean) => setValues(prev => ({ ...prev, [key]: value }));
  const onVersionChange = (id: string) => (key: string, value: string | boolean) => {
    setVersionForms(prev => ({ ...prev, [id]: { ...prev[id], [key]: value } }));
    setDirty(prev => new Set(prev).add(id));
  };

  const canSave = isFormComplete(ALL, values) && [...dirty].every(id => versionForms[id] && isFormComplete(VERSION_FIELDS, versionForms[id]));

  /** Saves the profile and every edited version. */
  const handleSave = async () => {
    if (!userId || !canSave) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('pf_profile').upsert({
        ...rowFromForm(ALL, values),
        link_versions: linkVersions,
        user_id: userId,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      for (const id of dirty) {
        const before = versionRows.find(v => v.id === id);
        const row = rowFromForm(VERSION_FIELDS, versionForms[id]);
        row.slug = String(row.slug ?? '').trim().toLowerCase();
        row.short_code = String(row.short_code ?? '').trim().toLowerCase() || null;
        const { error: vError } = await supabase.from('pf_versions')
          .update({ ...row, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId);
        if (vError) throw vError;
        if (row.is_default === true) await keepOneDefault(row);
        await removeReplaced(id, [before?.photo_url, before?.cv_url].filter(u => u && u !== row.photo_url && u !== row.cv_url) as string[]);
      }
      dirtyRef.current = new Set();
      setDirty(new Set());
      if (dirty.size) await reloadVersions();
      toast.success(t('pf.common.updated'));
    } catch (e) {
      console.error(e);
      toast.error(errorMessage(e, t('pf.common.saveError')));
    } finally {
      setSaving(false);
    }
  };

  const reloadVersions = async () => {
    if (!userId) return;
    const { data } = await supabase.from('pf_versions').select('*').eq('user_id', userId).order('sort_order');
    applyVersionRows((data ?? []) as PfRowData[]);
    setVersionsReload(n => n + 1);
  };

  /** Deletes a version's replaced photo / CV unless another version or the profile still uses it. */
  const removeReplaced = async (id: string, urls: string[]) => {
    if (!userId || !versionUpload || !urls.length) return;
    const unused: string[] = [];
    for (const url of urls) {
      const [a, b] = await Promise.all([
        supabase.from('pf_versions').select('id', { head: true, count: 'exact' }).eq('user_id', userId).neq('id', id).or(`photo_url.eq."${url}",cv_url.eq."${url}"`),
        supabase.from('pf_profile').select('user_id', { head: true, count: 'exact' }).eq('user_id', userId).or(`photo_url.eq."${url}",resume_url.eq."${url}"`),
      ]);
      if (!a.count && !b.count) unused.push(url);
    }
    await removeUploads(versionUpload, unused);
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
  };

  /** Ticks or unticks a version for a link; all ticked is stored as "every version". */
  const toggleLinkVersion = (link: string, version: string) => setLinkVersions(prev => {
    const all = versionRows.map(v => String(v.id));
    const shown = prev[link] ?? all;
    const next = shown.includes(version) ? shown.filter(v => v !== version) : [...shown, version];
    const rest = { ...prev };
    delete rest[link];
    return all.every(v => next.includes(v)) ? rest : { ...rest, [link]: next };
  });

  /** A link field with "Show in: ☑ Developer ☑ Researcher" under it. */
  const linkSection = (fields: PfField[]) => fields.map(f => (
    <div key={f.name}>
      <PfFieldInput field={f} values={values} onChange={onChange} />
      {versionRows.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
          <span>{t('pf.profile.showIn')}:</span>
          {versionRows.map(v => (
            <label key={String(v.id)} className="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                className="w-3.5 h-3.5 accent-primary"
                checked={(linkVersions[f.name] ?? [String(v.id)]).includes(String(v.id))}
                onChange={() => toggleLinkVersion(f.name, String(v.id))}
              />
              {String(v.name_en)}
            </label>
          ))}
        </div>
      )}
    </div>
  ));

  const section = (fields: PfField[]) => fields.map(f => <PfFieldInput key={f.name} field={f} values={values} onChange={onChange} />);

  /** "Developer uses this · Researcher has its own", under a default field. */
  const perVersion = (key: string) => versionRows.length > 0 && (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <span className="text-gray-500 dark:text-gray-400">{t('pf.profile.perVersion')}:</span>
      {versionRows.map(v => {
        const has = !!OWN[key](v);
        return (
          <button
            key={String(v.id)}
            onClick={() => openTab(String(v.id))}
            className={`hover:underline ${has ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'}`}
          >
            <strong className="font-medium">{String(v.name_en)}</strong> {t(has ? 'pf.profile.ownValue' : 'pf.profile.usesThis')}
          </button>
        );
      })}
    </div>
  );

  /** Under a version's own field: what shows when it is left empty. */
  const fallback = (form: PfFormValues, own: string, def: unknown, show: (x: unknown) => string) => (
    <p className="text-xs">
      {String(form[own] ?? '').trim()
        ? <span className="text-emerald-700 dark:text-emerald-400">{t('pf.profile.usingOwn')}</span>
        : def
          ? <span className="text-amber-700 dark:text-amber-400">{t('pf.profile.usingDefault')}: <span className="text-gray-600 dark:text-gray-400">{show(def)}</span></span>
          : <span className="text-red-600 dark:text-red-400">{t('pf.profile.noDefault')}</span>}
      {' · '}
      <button onClick={() => openTab('defaults')} className="text-primary hover:underline">{t('pf.profile.editDefault')}</button>
    </p>
  );

  /** One overview cell: where this version gets the value from. */
  type Cell = { kind: 'own' | 'default' | 'shared' | 'empty' | 'na'; text?: string };
  const CELL_STYLE: Record<Cell['kind'], string> = {
    own: 'text-emerald-700 dark:text-emerald-400',
    default: 'text-amber-700 dark:text-amber-400',
    shared: 'text-sky-700 dark:text-sky-400',
    empty: 'text-red-600 dark:text-red-400',
    na: 'text-gray-400 dark:text-gray-500',
  };
  const CELL_LABEL: Record<Cell['kind'], string> = {
    own: 'pf.profile.cellOwn', default: 'pf.profile.cellDefault', shared: 'pf.profile.cellShared', empty: 'pf.profile.cellEmpty', na: 'pf.profile.cellNA',
  };
  const fromDefault = (ownVal: unknown, defVal: unknown, show: (x: unknown) => string): Cell =>
    ownVal ? { kind: 'own', text: show(ownVal) } : defVal ? { kind: 'default', text: show(defVal) } : { kind: 'empty' };
  const count = (n: number): Cell => n ? { kind: 'own', text: t('pf.profile.countItems').replace('{n}', String(n)) } : { kind: 'empty' };
  const linkFields = [...SOCIAL, ...ACADEMIC];
  const MATRIX: { label: string; cell: (v: PfRowData, dev: boolean) => Cell }[] = [
    { label: 'pf.profile.title', cell: v => fromDefault(v.title_en, values.title_en, x => short(x)) },
    { label: 'pf.versions.statement', cell: v => fromDefault(plain(v.statement_en), plain(values.objective_en), x => short(x)) },
    { label: 'pf.versions.photo', cell: v => fromDefault(v.photo_url, photoUrl, fileName) },
    { label: 'pf.versions.cv', cell: v => fromDefault(v.cv_url, resumeUrl, fileName) },
    { label: 'pf.versions.affiliation', cell: (v, dev) => dev ? { kind: 'na' } : v.affiliation_en ? { kind: 'own', text: short(v.affiliation_en) } : { kind: 'empty' } },
    { label: 'pf.versions.interests', cell: (v, dev) => dev ? { kind: 'na' }
      : count(Array.isArray(v.interests_en) ? (v.interests_en as string[]).filter(Boolean).length : 0) },
    { label: 'pf.profile.devHeroFields', cell: (_v, dev) => !dev ? { kind: 'na' }
      : values.subtitle_en || values.greeting_en ? { kind: 'shared', text: short(values.greeting_en || values.subtitle_en, 40) } : { kind: 'empty' } },
    { label: 'pf.profile.roles', cell: (v, dev) => !dev ? { kind: 'na' }
      : count(roleRows.filter(r => r.is_visible !== false && inVersion(r, String(v.id))).length) },
    { label: 'pf.profile.linksShown', cell: v => {
      const shown = linkFields.filter(f => String(values[f.name] ?? '').trim() && (linkVersions[f.name] ?? [String(v.id)]).includes(String(v.id)));
      return shown.length ? { kind: 'shared', text: shown.map(f => t(f.label)).join(', ') } : { kind: 'empty' };
    } },
  ];

  const overview = (
    <>
      {versionRows.length > 0 && (
        <Card title={t('pf.profile.matrixTitle')} note={t('pf.profile.matrixHint')}>
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="w-40" />
                  {versionRows.map(v => (
                    <th key={String(v.id)} className="px-2 pb-2 text-left align-bottom">
                      <button
                        onClick={() => openTab(String(v.id))}
                        className="w-full text-left px-3 py-2 rounded-lg border bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <div className="font-semibold">{String(v.name_en)}{v.is_active === true ? '' : ` (${t('pf.versions.inactive')})`}</div>
                        <div className="text-xs font-normal text-gray-500 dark:text-gray-400">
                          {t(`pf.versions.layouts.${v.layout}`)} {t('pf.profile.layoutWord')} · ?v={String(v.short_code || v.slug)}
                        </div>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MATRIX.map(row => (
                  <tr key={row.label} className="align-top">
                    <td className="px-2 py-2 border-t border-gray-100 dark:border-gray-700 font-medium text-gray-700 dark:text-gray-300">{t(row.label)}</td>
                    {versionRows.map(v => {
                      const c = row.cell(v, v.layout !== 'researcher');
                      return (
                        <td key={String(v.id)} className="px-3 py-2 border-t border-gray-100 dark:border-gray-700">
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

      <PfListEditor
        cloneable
        table="pf_versions"
        title="pf.versions.listTitle"
        subtitle="pf.versions.manageHint"
        fields={VERSION_FIELDS}
        hideable={false}
        upload={versionUpload}
        transform={row => ({
          ...row,
          slug: String(row.slug ?? '').trim().toLowerCase(),
          short_code: String(row.short_code ?? '').trim().toLowerCase() || null,
        })}
        afterSave={keepOneDefault}
        reloadSignal={versionsReload}
        onRowsChange={applyVersionRows}
        renderRow={r => (
          <PfRowText
            primary={`${r.name_en} · ?v=${r.short_code || r.slug}`}
            secondary={String(r.title_en ?? '')}
            extra={<>
              <Badge variant="default">{t(`pf.versions.layouts.${r.layout}`)}</Badge>
              <Badge variant={r.is_active === true ? 'success' : 'muted'}>{t(r.is_active === true ? 'pf.versions.active' : 'pf.versions.inactive')}</Badge>
              {r.is_default === true && <Badge variant="warning">{t('pf.versions.default')}</Badge>}
            </>}
          />
        )}
      />
    </>
  );

  const versionPanel = (v: PfRowData) => {
    const id = String(v.id);
    const form = versionForms[id];
    if (!form) return null;
    const change = onVersionChange(id);
    const field = (f: PfField) => <PfFieldInput key={f.name} field={f} values={form} onChange={change} upload={versionUpload} />;
    const dev = form.layout !== 'researcher';
    const devNames = versionRows.filter(r => r.layout !== 'researcher').map(r => String(r.name_en));
    const name = String(form.name_en || v.name_en);
    return (
      <>
        <Card title={t('pf.profile.versionSettings')} scope="version" scopeLabel={`${t('pf.profile.scopeVersion')}: ${name}`}>
          <div className="grid sm:grid-cols-2 gap-4">{VERSION_SETTINGS.map(field)}</div>
        </Card>

        <Card title={t('pf.profile.versionOwn')} scope="version" scopeLabel={`${t('pf.profile.scopeVersion')}: ${name}`} note={t('pf.profile.versionOwnNote')}>
          <div className="space-y-2">{field(VERSION_OWN[0])}{fallback(form, 'title_en', values.title_en, x => short(x, 80))}</div>
          <div className="space-y-2">{field(VERSION_OWN[1])}{fallback({ s: plain(form.statement_en) }, 's', plain(values.objective_en), x => short(x, 80))}</div>
          <div className="space-y-2">{field(VERSION_OWN[2])}{fallback(form, 'photo_url', photoUrl, fileName)}</div>
          <div className="space-y-2">{field(VERSION_OWN[3])}{fallback(form, 'cv_url', resumeUrl, fileName)}</div>
        </Card>

        {dev ? (
          <>
            <Card
              title={t('pf.profile.devHero')}
              scope="layout"
              scopeLabel={t('pf.profile.scopeLayout')}
              note={`${t('pf.profile.scopeLayoutNote')}${devNames.length > 1 ? ` ${t('pf.profile.usedByNow')}: ${devNames.join(', ')}.` : ''}`}
            >
              {section(DEV_HERO)}
            </Card>
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
          </>
        ) : (
          <Card title={t('pf.profile.researcherOnly')} scope="layout" scopeLabel={t('pf.profile.scopeResearcherLayout')} note={t('pf.profile.researcherOnlyNote')}>
            {VERSION_RESEARCHER.map(field)}
          </Card>
        )}
      </>
    );
  };

  const TABS: { key: string; label: string; scope?: Scope }[] = [
    { key: 'overview', label: t('pf.profile.tabOverview') },
    { key: 'shared', label: t('pf.profile.scopeShared'), scope: 'shared' },
    { key: 'defaults', label: t('pf.profile.tabDefaults'), scope: 'default' },
    ...versionRows.map(v => ({
      key: String(v.id),
      label: `${String(v.name_en)}${dirty.has(String(v.id)) ? ' •' : ''}`,
      scope: 'version' as Scope,
    })),
    { key: 'links', label: t('pf.profile.tabLinks'), scope: 'links' },
  ];
  const DOT: Record<Scope, string> = {
    shared: 'bg-sky-500', default: 'bg-amber-500', version: 'bg-emerald-500', layout: 'bg-violet-500', links: 'bg-teal-500',
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PfPageHeader
        title="pf.profile.pageTitle"
        subtitle="pf.profile.pageSubtitle"
        action={
          <Button onClick={handleSave} disabled={loading || saving || !canSave}>
            {saving ? t('pf.common.saving') : t('pf.common.save')}
          </Button>
        }
      />

      {loading ? (
        <div className="p-12 text-center text-gray-500">{t('pf.common.loading')}</div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-gray-800 px-4 py-3 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            {TABS.map(tb => (
              <button
                key={tb.key}
                onClick={() => openTab(tb.key)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  pageTab === tb.key
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {tb.scope && <span className={`w-2 h-2 rounded-full ${DOT[tb.scope]}`} />}
                {tb.label}
              </button>
            ))}
            <span className="basis-full text-xs text-gray-400">
              {t(activeVersion ? 'pf.profile.tabHintVersion' : `pf.profile.tabHint_${pageTab}`)}
            </span>
          </div>

          {pageTab === 'overview' && overview}

          {pageTab === 'shared' && (
            <Card title={t('pf.profile.identity')} scope="shared" scopeLabel={t('pf.profile.scopeShared')} note={t('pf.profile.scopeSharedNote')}>
              {section(IDENTITY)}
            </Card>
          )}

          {pageTab === 'defaults' && (
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
          )}

          {activeVersion && versionPanel(activeVersion)}

          {pageTab === 'links' && (
            <>
              <Card title={t('pf.profile.social')} scope="links" scopeLabel={t('pf.profile.scopeLinks')} note={t('pf.profile.scopeLinksNote')}>
                <div className="grid sm:grid-cols-2 gap-4">{linkSection(SOCIAL)}</div>
              </Card>
              <Card title={t('pf.profile.academicLinks')} scope="links" scopeLabel={t('pf.profile.scopeLinks')} note={t('pf.profile.scopeLinksNote')}>
                <div className="grid sm:grid-cols-2 gap-4">{linkSection(ACADEMIC)}</div>
              </Card>
            </>
          )}

          {pageTab !== 'overview' && (
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving || !canSave}>
                {saving ? t('pf.common.saving') : t('pf.common.save')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
