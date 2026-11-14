import { useEffect, useState } from 'react';
import { IsListEditor, IsRowText } from '../../components/islamicStudio/IsListEditor';
import type { IsField } from '../../components/islamicStudio/IsFieldInput';
import { useLanguage } from '../../lib/LanguageContext';
import { supabase } from '../../lib/supabase';
import { isText } from '../../lib/islamicStudio';
import { PfPageHeader, PfTabs } from '../Portfolio/PfPageHeader';

const MONTHS = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `is.calendar.month${i + 1}` }));

const EVENT_FIELDS: IsField[] = [
  { name: 'name', label: 'is.common.name', type: 'i18n', required: true },
  { name: 'description', label: 'is.common.description', type: 'i18nArea' },
  { name: 'kind', label: 'is.calendar.kind', type: 'select', required: true,
    options: ['eid', 'ramadan', 'hajj', 'fasting', 'night', 'other'].map(v => ({ value: v, label: `is.calendar.kinds.${v}` })) },
  { name: 'hijri_month', label: 'is.calendar.hijriMonth', type: 'select', required: true, options: MONTHS },
  { name: 'hijri_day', label: 'is.calendar.hijriDay', type: 'number', required: true },
  { name: 'duration_days', label: 'is.calendar.durationDays', type: 'number', required: true },
  { name: 'remind_days_before', label: 'is.calendar.remindBefore', type: 'number', hint: 'is.calendar.remindBeforeHint' },
  { name: 'is_active', label: 'is.common.active', type: 'boolean' },
];

const CHECKLIST_FIELDS: IsField[] = [
  { name: 'context', label: 'is.calendar.checklistContext', type: 'select', required: true,
    options: [{ value: 'daily', label: 'is.calendar.daily' }, { value: 'ramadan', label: 'is.calendar.ramadan' }] },
  { name: 'text', label: 'is.common.text', type: 'i18n', required: true },
  { name: 'is_active', label: 'is.common.active', type: 'boolean' },
];

type Tab = 'events' | 'months' | 'ramadan' | 'checklist';

export const IsCalendar = () => {
  const { t, language } = useLanguage();
  const [tab, setTab] = useState<Tab>('events');
  const [regions, setRegions] = useState<{ value: string; label: string }[]>([]);
  useEffect(() => {
    void supabase.from('is_prayer_regions').select('code, name').order('sort_order').then(({ data }) =>
      setRegions((data ?? []).map(r => ({ value: String(r.code), label: `${isText(r.name, language)} (${r.code})` }))));
  }, [language]);

  const monthStartFields: IsField[] = [
    { name: 'region_code', label: 'is.calendar.region', type: 'select', required: true, options: regions },
    { name: 'hijri_year', label: 'is.calendar.hijriYear', type: 'number', required: true },
    { name: 'hijri_month', label: 'is.calendar.hijriMonth', type: 'select', required: true, options: MONTHS },
    { name: 'starts_on', label: 'is.calendar.startsOn', type: 'date', required: true, hint: 'is.calendar.startsOnHint' },
    { name: 'note', label: 'is.common.note', type: 'text' },
  ];
  const ramadanFields: IsField[] = [
    { name: 'region_code', label: 'is.calendar.region', type: 'select', required: true, options: regions },
    { name: 'hijri_year', label: 'is.calendar.hijriYear', type: 'number', required: true },
    { name: 'starts_on', label: 'is.calendar.firstFast', type: 'date', required: true },
    { name: 'ends_on', label: 'is.calendar.lastFast', type: 'date', required: true },
    { name: 'sehri_caution_minutes', label: 'is.calendar.sehriCaution', type: 'number', hint: 'is.calendar.sehriCautionHint' },
    { name: 'iftar_caution_minutes', label: 'is.calendar.iftarCaution', type: 'number', hint: 'is.calendar.iftarCautionHint' },
    { name: 'is_active', label: 'is.common.active', type: 'boolean' },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PfPageHeader title="is.calendar.pageTitle" subtitle="is.calendar.pageSubtitle" />
      <PfTabs<Tab>
        tabs={[
          { key: 'events', label: 'is.calendar.tabEvents' },
          { key: 'months', label: 'is.calendar.tabMonths' },
          { key: 'ramadan', label: 'is.calendar.tabRamadan' },
          { key: 'checklist', label: 'is.calendar.tabChecklist' },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'events' && (
        <IsListEditor
          table="is_islamic_events"
          title="is.calendar.eventsTitle"
          fields={EVENT_FIELDS}
          defaults={{ kind: 'other', hijri_month: '1', hijri_day: '1', duration_days: '1' }}
          renderRow={r => (
            <IsRowText
              primary={isText(r.name, language)}
              secondary={`${r.hijri_day} ${t(`is.calendar.month${r.hijri_month}`)} · ${t(`is.calendar.kinds.${r.kind}`)}`}
            />
          )}
        />
      )}
      {tab === 'months' && (
        <IsListEditor
          table="is_hijri_month_starts"
          title="is.calendar.monthsTitle"
          subtitle="is.calendar.monthsSubtitle"
          keys={['region_code', 'hijri_year', 'hijri_month']}
          fields={monthStartFields}
          ordered={false}
          orderBy={['-hijri_year', '-hijri_month']}
          defaults={{ region_code: 'BD' }}
          pageSize={24}
          renderRow={r => (
            <IsRowText
              primary={`${t(`is.calendar.month${r.hijri_month}`)} ${r.hijri_year} · ${r.region_code}`}
              secondary={`${t('is.calendar.startsOn')}: ${r.starts_on}${r.note ? ` · ${r.note}` : ''}`}
            />
          )}
        />
      )}
      {tab === 'ramadan' && (
        <IsListEditor
          table="is_ramadan_seasons"
          title="is.calendar.ramadanTitle"
          fields={ramadanFields}
          ordered={false}
          activeToggle
          orderBy={['-hijri_year']}
          defaults={{ region_code: 'BD', sehri_caution_minutes: '0', iftar_caution_minutes: '0' }}
          renderRow={r => (
            <IsRowText
              primary={`${t('is.calendar.ramadan')} ${r.hijri_year} · ${r.region_code}`}
              secondary={`${r.starts_on} → ${r.ends_on} · ${t('is.calendar.sehriCaution')}: ${r.sehri_caution_minutes} · ${t('is.calendar.iftarCaution')}: ${r.iftar_caution_minutes}`}
            />
          )}
        />
      )}
      {tab === 'checklist' && (
        <IsListEditor
          table="is_checklist_items"
          title="is.calendar.checklistTitle"
          fields={CHECKLIST_FIELDS}
          defaults={{ context: 'daily' }}
          filters={[{ name: 'context', label: 'is.calendar.checklistContext', options: [{ value: 'daily', label: 'is.calendar.daily' }, { value: 'ramadan', label: 'is.calendar.ramadan' }] }]}
          renderRow={r => <IsRowText primary={isText(r.text, language)} secondary={t(`is.calendar.${r.context}`)} />}
        />
      )}
    </div>
  );
};
