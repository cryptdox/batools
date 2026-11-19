import { IsListEditor, IsRowText } from '../../components/islamicStudio/IsListEditor';
import type { IsField } from '../../components/islamicStudio/IsFieldInput';
import { useLanguage } from '../../lib/LanguageContext';
import { isText } from '../../lib/islamicStudio';
import { LpScope, lpChoices, lpDayLabel, useLpOptions } from '../../lib/parenting';
import { PfPageHeader } from '../Portfolio/PfPageHeader';

const KINDS = lpChoices('lp.milestones.kinds', ['development', 'health', 'family']);
const AREAS = lpChoices('lp.milestones.areas', ['social_emotional', 'language', 'cognitive', 'movement', 'self_care', 'pregnancy', 'health', 'learning', 'islamic']);
const REVIEW = ['draft', 'in_review', 'approved', 'rejected'].map(s => ({ value: s, label: `is.review.${s}` }));

/** Development, health and family milestones. Families record them as observed / not yet / unsure — never pass or fail. */
export const LpMilestones = () => {
  const { t, language } = useLanguage();
  const { sources } = useLpOptions(language);
  const fields: IsField[] = [
    { name: 'key', label: 'lp.common.key', type: 'text', required: true, hint: 'lp.common.keyHint' },
    { name: 'kind', label: 'lp.milestones.kind', type: 'select', required: true, options: KINDS },
    { name: 'area', label: 'lp.milestones.area', type: 'select', required: true, options: AREAS },
    { name: 'emoji', label: 'lp.common.emoji', type: 'text' },
    { name: 'title', label: 'is.common.title', type: 'i18n', required: true },
    { name: 'description', label: 'is.common.description', type: 'i18nArea' },
    { name: 'how_to_support', label: 'lp.milestones.howToSupport', type: 'i18nArea' },
    { name: 'typical_day', label: 'lp.milestones.typicalDay', type: 'number', hint: 'lp.milestones.typicalDayHint' },
    { name: 'source_key', label: 'lp.common.source', type: 'select', allowEmpty: true, options: sources },
    { name: 'is_active', label: 'is.common.active', type: 'boolean' },
  ];
  return (
    <LpScope>
      <div className="max-w-5xl mx-auto space-y-6">
        <PfPageHeader title="lp.milestones.pageTitle" subtitle="lp.milestones.pageSubtitle" />
        <IsListEditor
          table="lp_milestones"
          title="lp.milestones.title"
          keys={['key']}
          fields={fields}
          reviewed
          searchable
          pageSize={30}
          defaults={{ kind: 'development', area: 'social_emotional' }}
          filters={[
            { name: 'kind', label: 'lp.milestones.kind', options: KINDS },
            { name: 'area', label: 'lp.milestones.area', options: AREAS },
            { name: 'review_status', label: 'is.review.status', options: REVIEW },
          ]}
          renderRow={r => (
            <IsRowText
              primary={`${r.emoji ?? ''} ${isText(r.title, language)}`}
              secondary={[lpDayLabel(r.typical_day, t), t(`lp.milestones.areas.${r.area}`), t(`lp.milestones.kinds.${r.kind}`)].filter(Boolean).join(' · ')}
            />
          )}
        />
      </div>
    </LpScope>
  );
};
