import { useState } from 'react';
import { IsListEditor, IsRowText } from '../../components/islamicStudio/IsListEditor';
import type { IsField, IsFormValues } from '../../components/islamicStudio/IsFieldInput';
import type { IsRow } from '../../lib/islamicStudio';
import { useLanguage } from '../../lib/LanguageContext';
import { isText, loadIsLanguages } from '../../lib/islamicStudio';
import { PfPageHeader, PfTabs } from '../Portfolio/PfPageHeader';

const APP_FIELDS: IsField[] = [
  { name: 'latest_version_code', label: 'is.settings.latestVersion', type: 'number', required: true, hint: 'is.settings.latestVersionHint' },
  { name: 'min_supported_version_code', label: 'is.settings.minSupported', type: 'number', required: true, hint: 'is.settings.minSupportedHint' },
  { name: 'update_message', label: 'is.settings.updateMessage', type: 'i18nArea' },
  { name: 'maintenance_mode', label: 'is.settings.maintenanceMode', type: 'boolean', hint: 'is.settings.maintenanceModeHint' },
  { name: 'maintenance_message', label: 'is.settings.maintenanceMessage', type: 'i18nArea', when: v => v.maintenance_mode === true },
  { name: 'default_language', label: 'is.settings.defaultLanguage', type: 'text', required: true, hint: 'is.settings.defaultLanguageHint' },
  { name: 'default_region', label: 'is.settings.defaultRegion', type: 'text', required: true, hint: 'is.settings.defaultRegionHint' },
  { name: 'play_store_url', label: 'is.settings.playStoreUrl', type: 'text' },
  { name: 'support_email', label: 'is.settings.supportEmail', type: 'text' },
  { name: 'privacy_url', label: 'is.settings.privacyUrl', type: 'text' },
  { name: 'share_text', label: 'is.settings.shareText', type: 'i18nArea' },
  { name: 'azan_url', label: 'is.settings.azanUrl', type: 'upload', accept: 'audio/mpeg,audio/ogg,audio/mp4,audio/aac,.mp3,.ogg,.m4a,.aac', hint: 'is.settings.azanUrlHint' },
  { name: 'azan_credit', label: 'is.settings.azanCredit', type: 'text', hint: 'is.settings.azanCreditHint' },
];

const LANGUAGE_FIELDS: IsField[] = [
  { name: 'code', label: 'is.settings.languageCode', type: 'text', required: true, hint: 'is.settings.languageCodeHint' },
  { name: 'name', label: 'is.common.name', type: 'text', required: true, hint: 'is.settings.languageNameHint' },
  { name: 'is_rtl', label: 'is.settings.rtl', type: 'boolean' },
  { name: 'is_default', label: 'is.common.default', type: 'boolean' },
  { name: 'is_active', label: 'is.common.active', type: 'boolean' },
];

const SECTION_KINDS = ['greeting', 'hijri_date', 'next_prayer', 'quick_actions', 'announcements', 'daily_ayah', 'daily_hadith', 'daily_dua',
  'ramadan', 'continue_reading', 'continue_course'];

const SECTION_FIELDS: IsField[] = [
  { name: 'kind', label: 'is.settings.sectionKind', type: 'select', required: true, options: SECTION_KINDS.map(k => ({ value: k, label: `is.settings.section.${k}` })) },
  { name: 'feature_key', label: 'is.settings.sectionFeature', type: 'text', hint: 'is.settings.sectionFeatureHint' },
  { name: 'title', label: 'is.common.title', type: 'i18n', hint: 'is.settings.sectionTitleHint' },
  { name: 'config', label: 'is.settings.sectionConfig', type: 'json', hint: 'is.settings.sectionConfigHint' },
  { name: 'is_active', label: 'is.common.active', type: 'boolean' },
];

/** Moments a sound style can replace with an uploaded file (088). */
const SOUND_MOMENTS = ['correct', 'wrong', 'combo', 'm50', 'm75', 'm100', 'star', 'complete', 'tap', 'laugh'] as const;
const AUDIO = 'audio/mpeg,audio/ogg,audio/mp4,audio/aac,.mp3,.ogg,.m4a,.aac';

const SOUND_FIELDS: IsField[] = [
  { name: 'key', label: 'is.sounds.key', type: 'text', required: true, hint: 'is.sounds.keyHint' },
  { name: 'name', label: 'is.common.name', type: 'i18n', required: true },
  { name: 'description', label: 'is.common.description', type: 'i18nArea' },
  { name: 'icon', label: 'is.sounds.icon', type: 'text', hint: 'is.sounds.iconHint' },
  { name: 'builtin', label: 'is.sounds.builtin', type: 'select', required: true, hint: 'is.sounds.builtinHint',
    options: ['spark', 'ertugrul', 'sufi'].map(v => ({ value: v, label: `is.sounds.builtins.${v}` })) },
  { name: 'is_default', label: 'is.sounds.isDefault', type: 'boolean', hint: 'is.sounds.isDefaultHint' },
  { name: 'is_active', label: 'is.sounds.shown', type: 'boolean', hint: 'is.sounds.shownHint' },
  ...SOUND_MOMENTS.map((m): IsField => ({ name: `sound_${m}`, label: `is.sounds.moments.${m}`, type: 'upload', accept: AUDIO, virtual: true, hint: m === 'correct' ? 'is.sounds.uploadHint' : undefined })),
];

/** The uploads as {moment: link}; empty ones play the built-in sound. */
function soundsFrom(values: IsFormValues): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of SOUND_MOMENTS) {
    const url = String(values[`sound_${m}`] ?? '').trim();
    if (url) out[m] = url;
  }
  return out;
}

type Tab = 'app' | 'home' | 'languages' | 'sounds';

export const IsSettings = () => {
  const { t, language } = useLanguage();
  const [tab, setTab] = useState<Tab>('app');
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PfPageHeader title="is.settings.pageTitle" subtitle="is.settings.pageSubtitle" />
      <PfTabs<Tab>
        tabs={[{ key: 'app', label: 'is.settings.tabApp' }, { key: 'home', label: 'is.settings.tabHome' }, { key: 'languages', label: 'is.settings.tabLanguages' }, { key: 'sounds', label: 'is.settings.tabSounds' }]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'app' && (
        <IsListEditor
          table="is_app_settings"
          title="is.settings.appTitle"
          keys={['id']}
          fields={APP_FIELDS}
          ordered={false}
          canAdd={false}
          canDelete={false}
          renderRow={r => (
            <IsRowText
              primary={`${t('is.settings.latestVersion')}: ${r.latest_version_code} · ${t('is.settings.minSupported')}: ${r.min_supported_version_code}`}
              secondary={`${r.maintenance_mode ? t('is.settings.maintenanceOn') : t('is.settings.maintenanceOff')} · ${t('is.settings.defaultLanguage')}: ${r.default_language} · ${t('is.settings.defaultRegion')}: ${r.default_region}`}
            />
          )}
        />
      )}
      {tab === 'home' && (
        <IsListEditor
          table="is_home_sections"
          title="is.settings.homeTitle"
          subtitle="is.settings.homeSubtitle"
          fields={SECTION_FIELDS}
          defaults={{ config: '{}' }}
          renderRow={r => (
            <IsRowText
              primary={t(`is.settings.section.${r.kind}`)}
              secondary={[isText(r.title, language), r.feature_key ? `${t('is.settings.sectionFeature')}: ${r.feature_key}` : ''].filter(Boolean).join(' · ')}
            />
          )}
        />
      )}
      {tab === 'languages' && (
        <IsListEditor
          table="is_languages"
          title="is.settings.languagesTitle"
          subtitle="is.settings.languagesSubtitle"
          keys={['code']}
          fields={LANGUAGE_FIELDS}
          audited="none"
          afterSave={async () => { await loadIsLanguages(true); }}
          renderRow={r => (
            <IsRowText primary={`${r.name} (${r.code})`} secondary={[r.is_default ? t('is.common.default') : '', r.is_rtl ? t('is.settings.rtl') : ''].filter(Boolean).join(' · ')} />
          )}
        />
      )}
      {tab === 'sounds' && (
        <IsListEditor
          table="is_sound_styles"
          title="is.sounds.title"
          subtitle="is.sounds.subtitle"
          fields={SOUND_FIELDS}
          defaults={{ builtin: 'spark' }}
          formFromRow={(r: IsRow) => Object.fromEntries(SOUND_MOMENTS.map(m => [`sound_${m}`, String((r.sounds as Record<string, string> | null)?.[m] ?? '')]))}
          transform={(row, values) => ({ ...row, key: String(row.key ?? '').trim().toLowerCase(), sounds: soundsFrom(values) })}
          renderRow={r => {
            const uploaded = Object.keys((r.sounds as Record<string, string> | null) ?? {}).length;
            return (
              <IsRowText
                primary={`${String(r.icon ?? '🔊')} ${isText(r.name, language)}${r.is_default ? ` · ${t('is.common.default')}` : ''}`}
                secondary={t('is.sounds.summary').replace('{n}', String(uploaded)).replace('{total}', String(SOUND_MOMENTS.length)).replace('{builtin}', t(`is.sounds.builtins.${r.builtin}`))}
              />
            );
          }}
        />
      )}
    </div>
  );
};
