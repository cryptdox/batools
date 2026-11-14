import { useState } from 'react';
import { IsListEditor, IsRowText } from '../../components/islamicStudio/IsListEditor';
import type { IsField } from '../../components/islamicStudio/IsFieldInput';
import { useLanguage } from '../../lib/LanguageContext';
import { isText } from '../../lib/islamicStudio';
import { PfPageHeader, PfTabs } from '../Portfolio/PfPageHeader';

/** Methods adhan-js knows (the app computes the times with it). */
const METHODS = ['Karachi', 'MuslimWorldLeague', 'Egyptian', 'UmmAlQura', 'Dubai', 'MoonsightingCommittee', 'NorthAmerica', 'Kuwait', 'Qatar', 'Singapore', 'Tehran', 'Turkey'];

const REGION_FIELDS: IsField[] = [
  { name: 'code', label: 'is.prayer.code', type: 'text', required: true, hint: 'is.prayer.codeHint' },
  { name: 'name', label: 'is.common.name', type: 'i18n', required: true },
  { name: 'calc_method', label: 'is.prayer.method', type: 'select', required: true, options: METHODS.map(m => ({ value: m, label: m })) },
  { name: 'madhab', label: 'is.prayer.madhab', type: 'select', required: true,
    options: [{ value: 'hanafi', label: 'is.prayer.hanafi' }, { value: 'shafi', label: 'is.prayer.shafi' }] },
  { name: 'high_latitude_rule', label: 'is.prayer.highLatitude', type: 'select', required: true,
    options: ['middle_of_the_night', 'seventh_of_the_night', 'twilight_angle'].map(v => ({ value: v, label: `is.prayer.hl.${v}` })) },
  { name: 'adjustments', label: 'is.prayer.adjustments', type: 'json', hint: 'is.prayer.adjustmentsHint' },
  { name: 'default_city', label: 'is.prayer.defaultCity', type: 'i18n' },
  { name: 'default_lat', label: 'is.prayer.lat', type: 'number' },
  { name: 'default_lng', label: 'is.prayer.lng', type: 'number' },
  { name: 'timezone', label: 'is.prayer.timezone', type: 'text', hint: 'is.prayer.timezoneHint' },
  { name: 'is_active', label: 'is.common.active', type: 'boolean' },
];

const ADHAN_FIELDS: IsField[] = [
  { name: 'name', label: 'is.common.name', type: 'i18n', required: true },
  { name: 'muezzin', label: 'is.prayer.muezzin', type: 'text' },
  { name: 'audio_url', label: 'is.common.audio', type: 'upload', accept: 'audio/*', required: true },
  { name: 'for_fajr', label: 'is.prayer.forFajr', type: 'boolean', hint: 'is.prayer.forFajrHint' },
  { name: 'is_default', label: 'is.common.default', type: 'boolean' },
  { name: 'is_active', label: 'is.common.active', type: 'boolean' },
];

type Tab = 'regions' | 'adhan';

export const IsPrayer = () => {
  const { t, language } = useLanguage();
  const [tab, setTab] = useState<Tab>('regions');
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PfPageHeader title="is.prayer.pageTitle" subtitle="is.prayer.pageSubtitle" />
      <PfTabs<Tab> tabs={[{ key: 'regions', label: 'is.prayer.tabRegions' }, { key: 'adhan', label: 'is.prayer.tabAdhan' }]} active={tab} onChange={setTab} />
      {tab === 'regions' ? (
        <IsListEditor
          table="is_prayer_regions"
          title="is.prayer.regionsTitle"
          subtitle="is.prayer.regionsSubtitle"
          keys={['code']}
          fields={REGION_FIELDS}
          defaults={{ calc_method: 'MuslimWorldLeague', madhab: 'shafi', high_latitude_rule: 'middle_of_the_night', adjustments: '{}' }}
          renderRow={r => (
            <IsRowText
              primary={`${isText(r.name, language)} (${r.code})`}
              secondary={`${r.calc_method} · ${t(`is.prayer.${r.madhab}`)} · ${isText(r.default_city, language) || '—'}`}
            />
          )}
        />
      ) : (
        <IsListEditor
          table="is_adhan_sounds"
          title="is.prayer.adhanTitle"
          fields={ADHAN_FIELDS}
          audited="both"
          renderRow={r => (
            <div className="space-y-2">
              <IsRowText primary={isText(r.name, language)} secondary={[r.muezzin, r.for_fajr ? t('is.prayer.forFajr') : '', r.is_default ? t('is.common.default') : ''].filter(Boolean).join(' · ')} />
              {typeof r.audio_url === 'string' && r.audio_url && <audio controls preload="none" src={r.audio_url} className="h-8 max-w-full" />}
            </div>
          )}
        />
      )}
    </div>
  );
};
