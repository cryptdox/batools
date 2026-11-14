import { useEffect, useState } from 'react';
import { IsListEditor, IsRowText } from '../../components/islamicStudio/IsListEditor';
import type { IsField } from '../../components/islamicStudio/IsFieldInput';
import { useLanguage } from '../../lib/LanguageContext';
import { supabase } from '../../lib/supabase';
import { isText } from '../../lib/islamicStudio';
import { PfPageHeader, PfTabs } from '../Portfolio/PfPageHeader';

const ZAKAT_FIELDS: IsField[] = [
  { name: 'rate_percent', label: 'is.zakat.rate', type: 'number', required: true },
  { name: 'gold_nisab_grams', label: 'is.zakat.goldNisab', type: 'number', required: true },
  { name: 'silver_nisab_grams', label: 'is.zakat.silverNisab', type: 'number', required: true },
  { name: 'default_nisab_basis', label: 'is.zakat.basis', type: 'select', required: true,
    options: [{ value: 'silver', label: 'is.zakat.silver' }, { value: 'gold', label: 'is.zakat.gold' }] },
  { name: 'guidance', label: 'is.zakat.guidance', type: 'i18nArea', hint: 'is.zakat.guidanceHint' },
];

type ZakatTab = 'settings' | 'prices';

/** Zakat: nisab, rate and guidance (reviewed), and daily gold / silver prices per region. */
export const IsZakat = () => {
  const { t, language } = useLanguage();
  const [tab, setTab] = useState<ZakatTab>('prices');
  const [regions, setRegions] = useState<{ value: string; label: string }[]>([]);
  useEffect(() => {
    void supabase.from('is_prayer_regions').select('code, name').order('sort_order').then(({ data }) =>
      setRegions((data ?? []).map(r => ({ value: String(r.code), label: `${isText(r.name, language)} (${r.code})` }))));
  }, [language]);
  const priceFields: IsField[] = [
    { name: 'region_code', label: 'is.calendar.region', type: 'select', required: true, options: regions },
    { name: 'price_date', label: 'is.zakat.date', type: 'date', required: true },
    { name: 'currency', label: 'is.zakat.currency', type: 'text', required: true },
    { name: 'gold_24k_per_gram', label: 'is.zakat.gold24', type: 'number' },
    { name: 'gold_22k_per_gram', label: 'is.zakat.gold22', type: 'number' },
    { name: 'gold_21k_per_gram', label: 'is.zakat.gold21', type: 'number' },
    { name: 'gold_18k_per_gram', label: 'is.zakat.gold18', type: 'number' },
    { name: 'silver_per_gram', label: 'is.zakat.silverPrice', type: 'number' },
    { name: 'source', label: 'is.quran.sourceUrl', type: 'text', hint: 'is.zakat.sourceHint' },
  ];
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PfPageHeader title="is.zakat.pageTitle" subtitle="is.zakat.pageSubtitle" />
      <PfTabs<ZakatTab> tabs={[{ key: 'prices', label: 'is.zakat.tabPrices' }, { key: 'settings', label: 'is.zakat.tabSettings' }]} active={tab} onChange={setTab} />
      {tab === 'settings' ? (
        <IsListEditor
          table="is_zakat_settings"
          title="is.zakat.settingsTitle"
          keys={['id']}
          fields={ZAKAT_FIELDS}
          ordered={false}
          reviewed
          canAdd={false}
          canDelete={false}
          renderRow={r => (
            <IsRowText
              primary={`${r.rate_percent}% · ${t('is.zakat.gold')} ${r.gold_nisab_grams} g · ${t('is.zakat.silver')} ${r.silver_nisab_grams} g`}
              secondary={`${t('is.zakat.basis')}: ${t(`is.zakat.${r.default_nisab_basis}`)}`}
            />
          )}
        />
      ) : (
        <IsListEditor
          table="is_metal_prices"
          title="is.zakat.pricesTitle"
          subtitle="is.zakat.pricesSubtitle"
          fields={priceFields}
          ordered={false}
          audited="both"
          orderBy={['-price_date']}
          pageSize={20}
          defaults={{ region_code: 'BD', currency: 'BDT', price_date: new Date().toISOString().slice(0, 10) }}
          renderRow={r => (
            <IsRowText
              primary={`${r.price_date} · ${r.region_code}`}
              secondary={`${t('is.zakat.gold22')}: ${r.gold_22k_per_gram ?? '—'} · ${t('is.zakat.gold24')}: ${r.gold_24k_per_gram ?? '—'} · ${t('is.zakat.silverPrice')}: ${r.silver_per_gram ?? '—'} ${r.currency}`}
            />
          )}
        />
      )}
    </div>
  );
};

const HABIT_FIELDS: IsField[] = [
  { name: 'key', label: 'is.tracker.key', type: 'text', required: true, hint: 'is.tracker.keyHint' },
  { name: 'name', label: 'is.common.name', type: 'i18n', required: true },
  { name: 'description', label: 'is.common.description', type: 'i18n' },
  { name: 'kind', label: 'is.calendar.kind', type: 'select', required: true,
    options: ['salah', 'quran', 'fasting', 'dhikr', 'charity', 'learning', 'other'].map(v => ({ value: v, label: `is.tracker.kinds.${v}` })) },
  { name: 'default_target', label: 'is.tracker.target', type: 'number', required: true },
  { name: 'unit', label: 'is.tracker.unit', type: 'i18n', hint: 'is.tracker.unitHint' },
  { name: 'frequency', label: 'is.tracker.frequency', type: 'select', required: true,
    options: [{ value: 'daily', label: 'is.tracker.daily' }, { value: 'weekly', label: 'is.tracker.weekly' }] },
  { name: 'is_default', label: 'is.tracker.isDefault', type: 'boolean', hint: 'is.tracker.isDefaultHint' },
  { name: 'icon', label: 'is.common.icon', type: 'text', hint: 'is.common.iconHint' },
  { name: 'is_active', label: 'is.common.active', type: 'boolean' },
];

/** What the app's Worship Tracker offers. */
export const IsTracker = () => {
  const { t, language } = useLanguage();
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PfPageHeader title="is.tracker.pageTitle" subtitle="is.tracker.pageSubtitle" />
      <IsListEditor
        table="is_habit_templates"
        title="is.tracker.title"
        keys={['key']}
        fields={HABIT_FIELDS}
        defaults={{ kind: 'other', default_target: '1', frequency: 'daily' }}
        renderRow={r => (
          <IsRowText
            primary={isText(r.name, language)}
            secondary={`${t(`is.tracker.kinds.${r.kind}`)} · ${r.default_target} ${isText(r.unit, language)} · ${t(`is.tracker.${r.frequency}`)}${r.is_default ? ` · ${t('is.tracker.isDefault')}` : ''}`}
          />
        )}
      />
    </div>
  );
};
