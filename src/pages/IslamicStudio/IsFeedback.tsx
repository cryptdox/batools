import { IsListEditor, IsRowText } from '../../components/islamicStudio/IsListEditor';
import type { IsField } from '../../components/islamicStudio/IsFieldInput';
import { pfInputClass } from '../../components/portfolio/PfFieldInput';
import { useLanguage } from '../../lib/LanguageContext';
import { PfPageHeader } from '../Portfolio/PfPageHeader';

const STATUSES = ['new', 'seen', 'done', 'spam'].map(s => ({ value: s, label: `is.feedback.statuses.${s}` }));
const KINDS = ['general', 'bug', 'content_error', 'feature_request'].map(k => ({ value: k, label: `is.feedback.kinds.${k}` }));

const FIELDS: IsField[] = [
  { name: 'status', label: 'is.feedback.status', type: 'select', required: true, options: STATUSES },
];

/** What app users sent (Settings → Send feedback in the app). */
export const IsFeedback = () => {
  const { t } = useLanguage();
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PfPageHeader title="is.feedback.pageTitle" subtitle="is.feedback.pageSubtitle" />
      <IsListEditor
        table="is_feedback"
        title="is.feedback.title"
        fields={FIELDS}
        ordered={false}
        canAdd={false}
        audited="none"
        orderBy={['-created_at']}
        pageSize={20}
        searchable
        filters={[{ name: 'status', label: 'is.feedback.status', options: STATUSES }, { name: 'kind', label: 'is.feedback.kind', options: KINDS }]}
        renderRow={r => (
          <div className="min-w-0 space-y-1">
            <IsRowText
              primary={t(`is.feedback.kinds.${r.kind}`)}
              secondary={[new Date(String(r.created_at)).toLocaleString(), r.contact, r.content_ref, r.app_version_code ? `v${r.app_version_code}` : '', r.device].filter(Boolean).join(' · ')}
            />
            <p className="text-sm whitespace-pre-wrap text-gray-800 dark:text-gray-200">{String(r.message ?? '')}</p>
          </div>
        )}
        rowActions={(r, patch) => (
          <select value={String(r.status)} onChange={e => patch({ status: e.target.value })} className={`${pfInputClass} h-8 w-auto text-xs mr-1`}>
            {STATUSES.map(s => <option key={s.value} value={s.value}>{t(s.label)}</option>)}
          </select>
        )}
      />
    </div>
  );
};
