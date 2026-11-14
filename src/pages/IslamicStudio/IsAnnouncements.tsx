import { useState } from 'react';
import { IsListEditor, IsRowText } from '../../components/islamicStudio/IsListEditor';
import type { IsField } from '../../components/islamicStudio/IsFieldInput';
import { useLanguage } from '../../lib/LanguageContext';
import { isText } from '../../lib/islamicStudio';
import { PfPageHeader } from '../Portfolio/PfPageHeader';

const FIELDS: IsField[] = [
  { name: 'title', label: 'is.common.title', type: 'i18n', required: true },
  { name: 'body', label: 'is.announcements.body', type: 'i18nArea' },
  { name: 'placement', label: 'is.announcements.placement', type: 'select', required: true,
    options: ['home', 'banner', 'popup'].map(v => ({ value: v, label: `is.announcements.place.${v}` })) },
  { name: 'image_url', label: 'is.common.image', type: 'upload', accept: 'image/*' },
  { name: 'link_url', label: 'is.announcements.link', type: 'text', hint: 'is.announcements.linkHint' },
  { name: 'starts_at', label: 'is.announcements.startsAt', type: 'datetime', required: true },
  { name: 'ends_at', label: 'is.announcements.endsAt', type: 'datetime', hint: 'is.announcements.endsAtHint' },
  { name: 'regions', label: 'is.announcements.regions', type: 'tags', hint: 'is.announcements.regionsHint' },
  { name: 'min_version_code', label: 'is.features.minVersion', type: 'number', hint: 'is.announcements.minVersionHint' },
  { name: 'priority', label: 'is.announcements.priority', type: 'number', hint: 'is.announcements.priorityHint' },
  { name: 'is_active', label: 'is.common.active', type: 'boolean' },
];

const when = (iso: unknown) => (iso ? new Date(String(iso)).toLocaleString() : '');

/** Now, as a datetime-local value. */
const nowLocal = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); };

export const IsAnnouncements = () => {
  const { t, language } = useLanguage();
  const [opened] = useState(nowLocal);
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PfPageHeader title="is.announcements.pageTitle" subtitle="is.announcements.pageSubtitle" />
      <IsListEditor
        table="is_announcements"
        title="is.announcements.title"
        fields={FIELDS}
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
            secondary={`${t(`is.announcements.place.${r.placement}`)} · ${when(r.starts_at)}${r.ends_at ? ` → ${when(r.ends_at)}` : ''}`}
          />
        )}
      />
    </div>
  );
};
