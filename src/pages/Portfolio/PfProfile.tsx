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

const IDENTITY: PfField[] = [
  { name: 'name', label: 'pf.profile.name', type: 'i18n', required: true },
  { name: 'email', label: 'pf.profile.email', type: 'text' },
  { name: 'phone', label: 'pf.profile.phone', type: 'i18n' },
  { name: 'location', label: 'pf.profile.location', type: 'i18n', hint: 'pf.profile.locationHint' },
  { name: 'career_start_year', label: 'pf.profile.careerStartYear', type: 'number', min: 1950, max: 2100, hint: 'pf.profile.careerStartYearHint' },
];

const HERO: PfField[] = [
  { name: 'greeting', label: 'pf.profile.greeting', type: 'i18n' },
  { name: 'title', label: 'pf.profile.title', type: 'i18n', hint: 'pf.profile.titleHint' },
  { name: 'subtitle', label: 'pf.profile.subtitle', type: 'i18n', multiline: true },
  { name: 'slogan', label: 'pf.profile.slogan', type: 'i18n', multiline: true },
  { name: 'objective', label: 'pf.profile.objective', type: 'i18n', rich: true, hint: 'pf.common.richTextHint' },
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

const ALL = [...IDENTITY, ...HERO, ...SOCIAL, ...ACADEMIC];

const ROLE_FIELDS: PfField[] = [
  { name: 'text', label: 'pf.profile.roleText', type: 'i18n', required: true },
  { name: 'icon', label: 'pf.common.icon', type: 'select', options: PF_ICON_OPTIONS, initial: 'code' },
];

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 space-y-4">
    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
    {children}
  </div>
);

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
          <Card title={t('pf.profile.identity')}>
            {section(IDENTITY)}
            {userId && (
              <PfFileUpload
                userId={userId}
                label="pf.profile.photo"
                name="photo"
                accept="image/*"
                url={photoUrl}
                onChange={savePhotoUrl}
              />
            )}
            {userId && (
              <PfFileUpload
                userId={userId}
                label="pf.profile.resume"
                name="resume"
                accept="application/pdf"
                url={resumeUrl}
                onChange={saveResumeUrl}
              />
            )}
          </Card>
          <Card title={t('pf.profile.hero')}>{section(HERO)}</Card>
          <Card title={t('pf.profile.social')}>
            <div className="grid sm:grid-cols-2 gap-4">{linkSection(SOCIAL)}</div>
          </Card>
          <Card title={t('pf.profile.academicLinks')}>
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
        renderRow={r => (
          <PfRowText
            primary={`${r.name_en} · ?version=${r.slug}`}
            secondary={String(r.title_en ?? '')}
            extra={<>
              <Badge variant="default">{t(`pf.versions.layouts.${r.layout}`)}</Badge>
              <Badge variant={r.is_active === true ? 'success' : 'muted'}>{t(r.is_active === true ? 'pf.versions.active' : 'pf.versions.inactive')}</Badge>
              {r.is_default === true && <Badge variant="warning">{t('pf.versions.default')}</Badge>}
            </>}
          />
        )}
      />

      <PfListEditor
        versioned
        cloneable
        table="pf_hero_roles"
        title="pf.profile.roles"
        subtitle="pf.profile.rolesHint"
        fields={ROLE_FIELDS}
        renderRow={r => <PfRowText primary={String(r.text_en)} secondary={`${r.text_bn ?? ''} · ${r.icon}`} />}
      />
    </div>
  );
};
