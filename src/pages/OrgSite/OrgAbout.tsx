import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { errorMessage, formFromRow, isFormComplete, rowFromForm, type PfField, type PfFormValues } from '../../lib/portfolio';
import { useOrgEditor } from '../../lib/orgSite';
import { Button } from '../../components/ui/Button';
import { PfFieldInput } from '../../components/portfolio/PfFieldInput';
import { PfPageHeader } from '../Portfolio/PfPageHeader';
import { OrgMissing } from './OrgMissing';

const FIELDS: PfField[] = [
  { name: 'title', label: 'org.about.title', type: 'text', required: true },
  { name: 'founder_name', label: 'org.about.founderName', type: 'text' },
  { name: 'founder_image_url', label: 'org.about.founderImage', type: 'text', upload: 'image/*' },
  { name: 'mission', label: 'org.about.mission', type: 'textarea', rows: 3 },
  { name: 'description', label: 'org.common.description', type: 'textarea' },
  { name: 'story', label: 'org.about.story', type: 'textarea', rows: 6 },
  { name: 'core_values', label: 'org.about.coreValues', type: 'tags' },
];

/** The organization's About page: one row per org. */
export const OrgAbout = () => {
  const { t } = useLanguage();
  const { orgId, userId, upload } = useOrgEditor();
  const [rowId, setRowId] = useState<string | null>(null);
  const [values, setValues] = useState<PfFormValues>(() => formFromRow(FIELDS, null));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.from('org_about').select('*').eq('org_id', orgId).maybeSingle();
      if (error) toast.error(error.message);
      setRowId(data?.id ?? null);
      setValues(formFromRow(FIELDS, data));
      setLoading(false);
    })();
  }, [orgId]);

  const handleSave = async () => {
    if (!orgId || !isFormComplete(FIELDS, values)) return;
    setSaving(true);
    try {
      const payload = { ...rowFromForm(FIELDS, values), updated_by: userId, updated_at: new Date().toISOString() };
      if (rowId) {
        const { error } = await supabase.from('org_about').update(payload).eq('id', rowId).eq('org_id', orgId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('org_about')
          .insert([{ ...payload, org_id: orgId, created_by: userId }]).select('id').single();
        if (error) throw error;
        setRowId(data.id);
      }
      toast.success(t('pf.common.updated'));
    } catch (e) {
      console.error(e);
      toast.error(errorMessage(e, t('pf.common.saveError')));
    } finally {
      setSaving(false);
    }
  };

  if (!orgId) return <OrgMissing />;

  const saveButton = (
    <Button onClick={handleSave} disabled={loading || saving || !isFormComplete(FIELDS, values)}>
      {saving ? t('pf.common.saving') : t('pf.common.save')}
    </Button>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PfPageHeader title="org.about.pageTitle" subtitle="org.about.pageSubtitle" action={saveButton} />
      {loading ? (
        <div className="p-12 text-center text-gray-500">{t('pf.common.loading')}</div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 space-y-4">
          {FIELDS.map(f => (
            <PfFieldInput key={f.name} field={f} values={values} upload={upload} onChange={(key, value) => setValues(prev => ({ ...prev, [key]: value }))} />
          ))}
          <div className="flex justify-end pt-2">{saveButton}</div>
        </div>
      )}
    </div>
  );
};
