import { useMemo, useState } from 'react';
import { IsListEditor, IsRowText } from '../../components/islamicStudio/IsListEditor';
import type { IsField } from '../../components/islamicStudio/IsFieldInput';
import { Badge } from '../../components/ui/Button';
import { useLanguage } from '../../lib/LanguageContext';
import { isText } from '../../lib/islamicStudio';
import { LpScope, lpChoices, lpDayLabel, useLpOptions } from '../../lib/parenting';
import { PfPageHeader, PfTabs } from '../Portfolio/PfPageHeader';

type Tab = 'schedules' | 'doses' | 'vaccines';

const SCHEDULE_KINDS = lpChoices('lp.vaccines.scheduleKinds', ['national', 'private', 'who']);
const SUBJECTS = lpChoices('lp.vaccines.doseSubjects', ['child', 'mother']);
const SEXES = lpChoices('lp.common.sexes', ['any', 'female', 'male']);

/**
 * Vaccine schedules per country, kept apart (national programme, private
 * paediatric, WHO), their doses, and the vaccines themselves. A schedule is
 * shown in the app only after review.
 */
export const LpVaccines = () => {
  const { t, language } = useLanguage();
  const [tab, setTab] = useState<Tab>('schedules');
  const [reload, setReload] = useState(0);
  const options = useLpOptions(language, reload);
  const changed = async () => { setReload(n => n + 1); };
  const vaccineName = useMemo(() => new Map(options.vaccines.map(v => [v.value, v.label])), [options.vaccines]);

  const scheduleFields: IsField[] = [
    { name: 'key', label: 'lp.common.key', type: 'text', required: true, hint: 'lp.common.keyHint' },
    { name: 'country', label: 'lp.library.country', type: 'text', required: true, hint: 'lp.library.countryHint' },
    { name: 'kind', label: 'lp.vaccines.scheduleKind', type: 'select', required: true, options: SCHEDULE_KINDS },
    { name: 'name', label: 'is.common.name', type: 'i18n', required: true },
    { name: 'notes', label: 'is.common.note', type: 'i18nArea' },
    { name: 'effective_from', label: 'lp.vaccines.effectiveFrom', type: 'date' },
    { name: 'version', label: 'lp.vaccines.version', type: 'number', required: true },
    { name: 'source_key', label: 'lp.common.source', type: 'select', allowEmpty: true, options: options.sources },
    { name: 'is_default', label: 'lp.vaccines.isDefault', type: 'boolean', hint: 'lp.vaccines.isDefaultHint' },
    { name: 'is_active', label: 'is.common.active', type: 'boolean' },
  ];

  const doseFields: IsField[] = [
    { name: 'schedule_key', label: 'lp.vaccines.schedule', type: 'select', required: true, options: options.schedules },
    { name: 'vaccine_key', label: 'lp.vaccines.vaccine', type: 'select', required: true, options: options.vaccines },
    { name: 'dose_number', label: 'lp.vaccines.doseNumber', type: 'number', required: true },
    { name: 'label', label: 'lp.vaccines.label', type: 'i18n', required: true },
    { name: 'subject', label: 'lp.vaccines.doseSubject', type: 'select', required: true, options: SUBJECTS },
    { name: 'due_day', label: 'lp.vaccines.dueDay', type: 'number', hint: 'lp.vaccines.dueDayHint' },
    { name: 'latest_day', label: 'lp.vaccines.latestDay', type: 'number' },
    { name: 'min_interval_days', label: 'lp.vaccines.minInterval', type: 'number' },
    { name: 'due_note', label: 'lp.vaccines.dueNote', type: 'i18nArea' },
    { name: 'sex', label: 'lp.common.sex', type: 'select', required: true, options: SEXES },
  ];

  const vaccineFields: IsField[] = [
    { name: 'key', label: 'lp.common.key', type: 'text', required: true, hint: 'lp.common.keyHint' },
    { name: 'short_name', label: 'lp.vaccines.shortName', type: 'text', required: true },
    { name: 'name', label: 'is.common.name', type: 'i18n', required: true },
    { name: 'protects_against', label: 'lp.vaccines.protects', type: 'i18nArea', required: true },
    { name: 'common_reactions', label: 'lp.vaccines.reactions', type: 'i18nArea' },
    { name: 'notes', label: 'is.common.note', type: 'i18nArea' },
    { name: 'is_active', label: 'is.common.active', type: 'boolean' },
  ];

  return (
    <LpScope>
      <div className="max-w-5xl mx-auto space-y-6">
        <PfPageHeader title="lp.vaccines.pageTitle" subtitle="lp.vaccines.pageSubtitle" />
        <PfTabs<Tab> tabs={(['schedules', 'doses', 'vaccines'] as Tab[]).map(k => ({ key: k, label: `lp.vaccines.tabs.${k}` }))} active={tab} onChange={setTab} />
        {tab === 'schedules' && (
          <IsListEditor
            table="lp_vaccine_schedules"
            title="lp.vaccines.tabs.schedules"
            keys={['key']}
            fields={scheduleFields}
            reviewed
            ordered={false}
            activeToggle
            orderBy={['country', 'key']}
            defaults={{ kind: 'national', version: '1', country: 'BD' }}
            afterSave={changed}
            renderRow={r => (
              <IsRowText
                primary={isText(r.name, language)}
                secondary={[r.country, t(`lp.vaccines.scheduleKinds.${r.kind}`), `v${r.version}`, r.effective_from].filter(Boolean).join(' · ')}
                extra={r.is_default ? <Badge variant="success">{t('lp.vaccines.isDefault')}</Badge> : undefined}
              />
            )}
          />
        )}
        {tab === 'doses' && (
          <IsListEditor
            table="lp_vaccine_doses"
            title="lp.vaccines.tabs.doses"
            subtitle="lp.vaccines.dosesSubtitle"
            fields={doseFields}
            activeToggle={false}
            audited="none"
            defaults={{ subject: 'child', sex: 'any', dose_number: '1' }}
            filters={[
              { name: 'schedule_key', label: 'lp.vaccines.schedule', options: options.schedules },
              { name: 'vaccine_key', label: 'lp.vaccines.vaccine', options: options.vaccines },
            ]}
            renderRow={r => (
              <IsRowText
                primary={isText(r.label, language)}
                secondary={[vaccineName.get(String(r.vaccine_key)) ?? r.vaccine_key, r.subject === 'mother' ? t('lp.vaccines.doseSubjects.mother') : lpDayLabel(r.due_day, t),
                  isText(r.due_note, language)].filter(Boolean).join(' · ')}
                extra={r.sex !== 'any' ? <Badge variant="muted">{t(`lp.common.sexes.${r.sex}`)}</Badge> : undefined}
              />
            )}
          />
        )}
        {tab === 'vaccines' && (
          <IsListEditor
            table="lp_vaccines"
            title="lp.vaccines.tabs.vaccines"
            keys={['key']}
            fields={vaccineFields}
            afterSave={changed}
            renderRow={r => <IsRowText primary={`${r.short_name} — ${isText(r.name, language)}`} secondary={isText(r.protects_against, language)} />}
          />
        )}
      </div>
    </LpScope>
  );
};
