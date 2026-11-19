import { useState } from 'react';
import { IsListEditor, IsRowText } from '../../components/islamicStudio/IsListEditor';
import type { IsField } from '../../components/islamicStudio/IsFieldInput';
import { useLanguage } from '../../lib/LanguageContext';
import { isText } from '../../lib/islamicStudio';
import { LpScope, useLpOptions } from '../../lib/parenting';
import { PfPageHeader } from '../Portfolio/PfPageHeader';

const when = (iso: unknown) => (iso ? new Date(String(iso)).toLocaleString() : '');

/** Now, as a datetime-local value. */
const nowLocal = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); };

export const LpAnnouncements = () => {
  const { t, language } = useLanguage();
  const [opened] = useState(nowLocal);
  const { stages } = useLpOptions(language);
  const fields: IsField[] = [
    { name: 'title', label: 'is.common.title', type: 'i18n', required: true },
    { name: 'body', label: 'is.announcements.body', type: 'i18nArea' },
    { name: 'placement', label: 'is.announcements.placement', type: 'select', required: true,
      options: ['home', 'banner', 'popup'].map(v => ({ value: v, label: `is.announcements.place.${v}` })) },
    { name: 'image_url', label: 'is.common.image', type: 'upload', accept: 'image/*' },
    { name: 'link_url', label: 'is.announcements.link', type: 'text', hint: 'lp.announcements.linkHint' },
    { name: 'stage_keys', label: 'lp.announcements.stages', type: 'multi', options: stages, hint: 'lp.announcements.stagesHint' },
    { name: 'countries', label: 'lp.common.countries', type: 'tags', hint: 'lp.common.countriesHint' },
    { name: 'starts_at', label: 'is.announcements.startsAt', type: 'datetime', required: true },
    { name: 'ends_at', label: 'is.announcements.endsAt', type: 'datetime', hint: 'is.announcements.endsAtHint' },
    { name: 'min_version_code', label: 'is.features.minVersion', type: 'number', hint: 'is.announcements.minVersionHint' },
    { name: 'priority', label: 'is.announcements.priority', type: 'number', hint: 'is.announcements.priorityHint' },
    { name: 'is_active', label: 'is.common.active', type: 'boolean' },
  ];
  return (
    <LpScope>
      <div className="max-w-5xl mx-auto space-y-6">
        <PfPageHeader title="lp.announcements.pageTitle" subtitle="lp.announcements.pageSubtitle" />
        <IsListEditor
          table="lp_announcements"
          title="is.announcements.title"
          fields={fields}
          ordered={false}
          activeToggle
          audited="both"
          orderBy={['-priority', '-starts_at']}
          defaults={{ placement: 'home', starts_at: opened, priority: '0' }}
          pageSize={20}
          searchable
          renderRow={r => (
            <IsRowText
              primary={isText(r.title, language)}
              secondary={[
                t(`is.announcements.place.${r.placement}`),
                `${when(r.starts_at)}${r.ends_at ? ` → ${when(r.ends_at)}` : ''}`,
                (r.stage_keys as string[] | undefined)?.length ? (r.stage_keys as string[]).join(', ') : t('lp.announcements.allStages'),
              ].join(' · ')}
            />
          )}
        />
      </div>
    </LpScope>
  );
};
