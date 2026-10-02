import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { errorMessage, formFromRow, isFormComplete, rowFromForm, usePfUserId, PF_ICON_OPTIONS, type PfField, type PfFormValues } from '../../lib/portfolio';
import { Button } from '../../components/ui/Button';
import { PfFieldInput } from '../../components/portfolio/PfFieldInput';
import { PfListEditor, PfRowText } from '../../components/portfolio/PfListEditor';
import { PfFileUpload } from '../../components/portfolio/PfFileUpload';
import { PfPageHeader } from './PfPageHeader';

const IDENTITY: PfField[] = [
  { name: 'name', label: 'pf.profile.name', type: 'i18n', required: true },
  { name: 'email', label: 'pf.profile.email', type: 'text' },
  { name: 'phone', label: 'pf.profile.phone', type: 'i18n' },
  { name: 'career_start_year', label: 'pf.profile.careerStartYear', type: 'number', min: 1950, max: 2100, hint: 'pf.profile.careerStartYearHint' },
];

const HERO: PfField[] = [
  { name: 'greeting', label: 'pf.profile.greeting', type: 'i18n' },
  { name: 'title', label: 'pf.profile.title', type: 'i18n', hint: 'pf.profile.titleHint' },
  { name: 'subtitle', label: 'pf.profile.subtitle', type: 'i18n', multiline: true },
  { name: 'slogan', label: 'pf.profile.slogan', type: 'i18n', multiline: true },
  { name: 'objective', label: 'pf.profile.objective', type: 'i18n', multiline: true, hint: 'pf.common.richTextHint' },
];

// Handles only — the site builds each platform's URL.
const SOCIAL: PfField[] = ['github', 'linkedin', 'medium', 'youtube', 'facebook', 'x', 'gitlab', 'kaggle']
  .map(name => ({ name, label: `pf.profile.${name}`, type: 'text' as const }));

const ALL = [...IDENTITY, ...HERO, ...SOCIAL];

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.from('pf_profile').select('*').eq('user_id', userId).maybeSingle();
      if (error) toast.error(error.message);
      setValues(formFromRow(ALL, data));
      setResumeUrl(data?.resume_url ?? null);
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

  const section = (fields: PfField[]) => fields.map(f => <PfFieldInput key={f.name} field={f} values={values} onChange={onChange} />);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PfPageHeader
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
            <div className="grid sm:grid-cols-2 gap-4">{section(SOCIAL)}</div>
          </Card>
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving || !isFormComplete(ALL, values)}>
              {saving ? t('pf.common.saving') : t('pf.common.save')}
            </Button>
          </div>
        </>
      )}

      <PfListEditor
        table="pf_hero_roles"
        title="pf.profile.roles"
        subtitle="pf.profile.rolesHint"
        fields={ROLE_FIELDS}
        renderRow={r => <PfRowText primary={String(r.text_en)} secondary={`${r.text_bn ?? ''} · ${r.icon}`} />}
      />
    </div>
  );
};
