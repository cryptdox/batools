import { IsListEditor, IsRowText } from '../../components/islamicStudio/IsListEditor';
import type { IsField } from '../../components/islamicStudio/IsFieldInput';
import { pfInputClass } from '../../components/portfolio/PfFieldInput';
import { Badge } from '../../components/ui/Button';
import { useLanguage } from '../../lib/LanguageContext';
import { LpScope, lpChoices } from '../../lib/parenting';
import { PfPageHeader } from '../Portfolio/PfPageHeader';

const STATUSES = ['new', 'seen', 'done', 'spam'].map(s => ({ value: s, label: `is.feedback.statuses.${s}` }));
const KINDS = lpChoices('lp.feedback.kinds', ['general', 'bug', 'content_error', 'medical_concern', 'feature_request']);

const FIELDS: IsField[] = [
  { name: 'status', label: 'is.feedback.status', type: 'select', required: true, options: STATUSES },
];

/** What app users sent. A medical concern about content is flagged first. */
export const LpFeedback = () => {
  const { t } = useLanguage();
  return (
    <LpScope>
      <div className="max-w-5xl mx-auto space-y-6">
        <PfPageHeader title="lp.feedback.pageTitle" subtitle="lp.feedback.pageSubtitle" />
        <IsListEditor
          table="lp_feedback"
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
                primary={t(`lp.feedback.kinds.${r.kind}`)}
                secondary={[new Date(String(r.created_at)).toLocaleString(), r.contact, r.content_ref, r.platform, r.app_version_code ? `v${r.app_version_code}` : '']
                  .filter(Boolean).join(' · ')}
                extra={r.kind === 'medical_concern' ? <Badge variant="danger">{t('lp.feedback.medicalFlag')}</Badge> : undefined}
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
    </LpScope>
  );
};
