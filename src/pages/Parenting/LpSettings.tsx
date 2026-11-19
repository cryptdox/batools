import { IsListEditor, IsRowText } from '../../components/islamicStudio/IsListEditor';
import type { IsField } from '../../components/islamicStudio/IsFieldInput';
import { useLanguage } from '../../lib/LanguageContext';
import { LpScope } from '../../lib/parenting';
import { PfPageHeader } from '../Portfolio/PfPageHeader';

const FIELDS: IsField[] = [
  { name: 'latest_version_code', label: 'is.settings.latestVersion', type: 'number', required: true, hint: 'is.settings.latestVersionHint' },
  { name: 'min_supported_version_code', label: 'is.settings.minSupported', type: 'number', required: true, hint: 'is.settings.minSupportedHint' },
  { name: 'update_message', label: 'is.settings.updateMessage', type: 'i18nArea' },
  { name: 'maintenance_mode', label: 'is.settings.maintenanceMode', type: 'boolean', hint: 'is.settings.maintenanceModeHint' },
  { name: 'maintenance_message', label: 'is.settings.maintenanceMessage', type: 'i18nArea', when: v => v.maintenance_mode === true },
  { name: 'default_language', label: 'is.settings.defaultLanguage', type: 'select', required: true,
    options: [{ value: 'bn', label: 'বাংলা' }, { value: 'en', label: 'English' }] },
  { name: 'default_country', label: 'lp.settings.defaultCountry', type: 'text', required: true, hint: 'lp.settings.defaultCountryHint' },
  { name: 'medical_disclaimer', label: 'lp.settings.medicalDisclaimer', type: 'i18nArea', required: true, hint: 'lp.settings.medicalDisclaimerHint' },
  { name: 'emergency_numbers', label: 'lp.settings.emergencyNumbers', type: 'json', hint: 'lp.settings.emergencyNumbersHint' },
  { name: 'play_store_url', label: 'is.settings.playStoreUrl', type: 'text' },
  { name: 'web_url', label: 'lp.settings.webUrl', type: 'text' },
  { name: 'support_email', label: 'is.settings.supportEmail', type: 'text' },
  { name: 'privacy_url', label: 'is.settings.privacyUrl', type: 'text' },
  { name: 'terms_url', label: 'lp.settings.termsUrl', type: 'text' },
  { name: 'share_text', label: 'is.settings.shareText', type: 'i18nArea' },
];

/** The single settings row: versions, maintenance, defaults, disclaimer and emergency numbers. */
export const LpSettings = () => {
  const { t } = useLanguage();
  return (
    <LpScope>
      <div className="max-w-5xl mx-auto space-y-6">
        <PfPageHeader title="lp.settings.pageTitle" subtitle="lp.settings.pageSubtitle" />
        <IsListEditor
          table="lp_app_settings"
          title="lp.settings.title"
          keys={['id']}
          fields={FIELDS}
          ordered={false}
          canAdd={false}
          canDelete={false}
          renderRow={r => {
            const numbers = (r.emergency_numbers ?? {}) as Record<string, { number: string }[]>;
            return (
              <IsRowText
                primary={`${t('is.settings.latestVersion')}: ${r.latest_version_code} · ${t('is.settings.minSupported')}: ${r.min_supported_version_code}`}
                secondary={[
                  r.maintenance_mode ? t('is.settings.maintenanceOn') : t('is.settings.maintenanceOff'),
                  `${t('is.settings.defaultLanguage')}: ${r.default_language}`,
                  `${t('lp.settings.defaultCountry')}: ${r.default_country}`,
                  `${t('lp.settings.emergencyNumbers')}: ${Object.entries(numbers).map(([c, list]) => `${c} ${list.map(n => n.number).join('/')}`).join(', ') || '—'}`,
                ].join(' · ')}
              />
            );
          }}
        />
      </div>
    </LpScope>
  );
};
