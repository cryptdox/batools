import { useMemo, useState } from 'react';
import { IsListEditor, IsRowText } from '../../components/islamicStudio/IsListEditor';
import type { IsField } from '../../components/islamicStudio/IsFieldInput';
import { Badge } from '../../components/ui/Button';
import { useLanguage } from '../../lib/LanguageContext';
import { isText } from '../../lib/islamicStudio';
import { LpScope, lpChoices, lpRangeLabel, useLpOptions } from '../../lib/parenting';
import { PfPageHeader, PfTabs } from '../Portfolio/PfPageHeader';

const TYPES = lpChoices('lp.tasks.taskTypes', ['must_do', 'recommended', 'learn', 'observe', 'family']);
const FREQUENCIES = lpChoices('lp.tasks.frequencies', ['once', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly']);
const ASSIGNEES = lpChoices('lp.tasks.assignees', ['shared', 'mother', 'father', 'any']);
const SUBJECTS = lpChoices('lp.tasks.subjects', ['child', 'pregnancy', 'planning', 'family']);
const SEXES = lpChoices('lp.common.sexes', ['any', 'female', 'male']);
const REVIEW = ['draft', 'in_review', 'approved', 'rejected'].map(s => ({ value: s, label: `is.review.${s}` }));
const UNITS = lpChoices('lp.counters.units', ['times', 'minutes', 'hours', 'glasses', 'ml', 'pages', 'tablets']);
const INPUTS = lpChoices('lp.counters.inputs', ['tap', 'timer', 'amount']);
const KINDS = lpChoices('lp.counters.kinds', ['at_least', 'at_most']);
const PERIODS = lpChoices('lp.counters.periods', ['day', 'week', 'month']);

/** The tasks the app schedules by age: what to do, why it matters and what the family gains. */
export const LpTasks = () => {
  const { t, language } = useLanguage();
  const options = useLpOptions(language);
  const categoryByKey = useMemo(() => options.categories.map(c => ({ value: c.key, label: c.label })), [options.categories]);
  const categoryName = useMemo(() => new Map(categoryByKey.map(c => [c.value, c.label])), [categoryByKey]);

  const fields: IsField[] = [
    { name: 'key', label: 'lp.common.key', type: 'text', required: true, hint: 'lp.common.keyHint' },
    { name: 'emoji', label: 'lp.common.emoji', type: 'text' },
    { name: 'title', label: 'is.common.title', type: 'i18n', required: true },
    { name: 'description', label: 'is.common.description', type: 'i18nArea' },
    { name: 'why', label: 'lp.tasks.why', type: 'i18nArea', required: true, hint: 'lp.tasks.whyHint' },
    { name: 'benefit', label: 'lp.tasks.benefit', type: 'i18nArea', required: true, hint: 'lp.tasks.benefitHint' },
    { name: 'steps', label: 'lp.tasks.steps', type: 'json', hint: 'lp.tasks.stepsHint' },
    { name: 'safety_note', label: 'lp.tasks.safetyNote', type: 'i18nArea' },
    { name: 'task_type', label: 'lp.tasks.taskType', type: 'select', required: true, options: TYPES },
    { name: 'frequency', label: 'lp.tasks.frequency', type: 'select', required: true, options: FREQUENCIES },
    { name: 'assignee', label: 'lp.tasks.assignee', type: 'select', required: true, options: ASSIGNEES },
    { name: 'subject', label: 'lp.tasks.subject', type: 'select', required: true, options: SUBJECTS, hint: 'lp.tasks.subjectHint' },
    { name: 'min_day', label: 'lp.common.minDay', type: 'number', hint: 'lp.common.dayHint' },
    { name: 'max_day', label: 'lp.common.maxDay', type: 'number', hint: 'lp.common.maxDayHint' },
    { name: 'estimated_minutes', label: 'lp.tasks.minutes', type: 'number' },
    { name: 'xp', label: 'lp.common.xp', type: 'number', required: true, hint: 'lp.tasks.xpHint' },
    { name: 'category_key', label: 'lp.common.category', type: 'select', allowEmpty: true, options: categoryByKey },
    { name: 'resource_slug', label: 'lp.tasks.resource', type: 'select', allowEmpty: true, options: options.resources, hint: 'lp.tasks.resourceHint' },
    { name: 'source_key', label: 'lp.common.source', type: 'select', allowEmpty: true, options: options.sources },
    { name: 'sex', label: 'lp.common.sex', type: 'select', required: true, options: SEXES },
    { name: 'countries', label: 'lp.common.countries', type: 'tags', hint: 'lp.common.countriesHint' },
    { name: 'is_active', label: 'is.common.active', type: 'boolean' },
  ];

  const [tab, setTab] = useState<'tasks' | 'counters'>('tasks');
  const counterFields: IsField[] = [
    { name: 'key', label: 'lp.common.key', type: 'text', required: true, hint: 'lp.common.keyHint' },
    { name: 'emoji', label: 'lp.common.emoji', type: 'text' },
    { name: 'title', label: 'is.common.title', type: 'i18n', required: true },
    { name: 'description', label: 'is.common.description', type: 'i18nArea' },
    { name: 'why', label: 'lp.tasks.why', type: 'i18nArea', required: true, hint: 'lp.tasks.whyHint' },
    { name: 'safety_note', label: 'lp.tasks.safetyNote', type: 'i18nArea' },
    { name: 'unit', label: 'lp.counters.unit', type: 'select', required: true, options: UNITS },
    { name: 'input', label: 'lp.counters.input', type: 'select', required: true, options: INPUTS, hint: 'lp.counters.inputHint' },
    { name: 'step', label: 'lp.counters.step', type: 'number', required: true, hint: 'lp.counters.stepHint' },
    { name: 'target', label: 'lp.counters.target', type: 'number', hint: 'lp.counters.targetHint' },
    { name: 'target_kind', label: 'lp.counters.kind', type: 'select', required: true, options: KINDS },
    { name: 'period', label: 'lp.counters.period', type: 'select', required: true, options: PERIODS },
    { name: 'subject', label: 'lp.tasks.subject', type: 'select', required: true, options: SUBJECTS, hint: 'lp.tasks.subjectHint' },
    { name: 'min_day', label: 'lp.common.minDay', type: 'number', hint: 'lp.common.dayHint' },
    { name: 'max_day', label: 'lp.common.maxDay', type: 'number', hint: 'lp.common.maxDayHint' },
    { name: 'xp', label: 'lp.common.xp', type: 'number', required: true, hint: 'lp.counters.xpHint' },
    { name: 'category_key', label: 'lp.common.category', type: 'select', allowEmpty: true, options: categoryByKey },
    { name: 'source_key', label: 'lp.common.source', type: 'select', allowEmpty: true, options: options.sources },
    { name: 'sex', label: 'lp.common.sex', type: 'select', required: true, options: SEXES },
    { name: 'is_active', label: 'is.common.active', type: 'boolean' },
  ];

  return (
    <LpScope>
      <div className="max-w-5xl mx-auto space-y-6">
        <PfPageHeader title="lp.tasks.pageTitle" subtitle="lp.tasks.pageSubtitle" />
        <PfTabs<'tasks' | 'counters'> tabs={[{ key: 'tasks', label: 'lp.tasks.title' }, { key: 'counters', label: 'lp.counters.title' }]} active={tab} onChange={setTab} />
        {tab === 'counters' && (
          <IsListEditor
            table="lp_counter_templates"
            title="lp.counters.title"
            subtitle="lp.counters.subtitle"
            keys={['key']}
            fields={counterFields}
            reviewed
            searchable
            pageSize={25}
            defaults={{ unit: 'times', input: 'tap', step: '1', target_kind: 'at_least', period: 'day', subject: 'child', sex: 'any', xp: '5' }}
            filters={[
              { name: 'subject', label: 'lp.tasks.subject', options: SUBJECTS },
              { name: 'review_status', label: 'is.review.status', options: REVIEW },
            ]}
            renderRow={r => (
              <IsRowText
                primary={`${r.emoji ?? ''} ${isText(r.title, language)}`}
                secondary={[t(`lp.tasks.subjects.${r.subject}`), lpRangeLabel(r, t),
                  `${t(`lp.counters.kinds.${r.target_kind}`)} ${r.target ?? '—'} ${t(`lp.counters.units.${r.unit}`)} / ${t(`lp.counters.periods.${r.period}`)}`].join(' · ')}
                extra={<Badge variant="muted">{t(`lp.counters.inputs.${r.input}`)}</Badge>}
              />
            )}
          />
        )}
        {tab === 'tasks' && (
        <IsListEditor
          table="lp_task_templates"
          title="lp.tasks.title"
          keys={['key']}
          fields={fields}
          reviewed
          searchable
          pageSize={25}
          defaults={{ task_type: 'recommended', frequency: 'daily', assignee: 'shared', subject: 'child', sex: 'any', xp: '10', steps: '[]' }}
          // An empty steps box means no steps (a list, not an object).
          transform={row => ({ ...row, steps: Array.isArray(row.steps) ? row.steps : [] })}
          filters={[
            { name: 'subject', label: 'lp.tasks.subject', options: SUBJECTS },
            { name: 'task_type', label: 'lp.tasks.taskType', options: TYPES },
            { name: 'frequency', label: 'lp.tasks.frequency', options: FREQUENCIES },
            { name: 'review_status', label: 'is.review.status', options: REVIEW },
          ]}
          renderRow={r => (
            <IsRowText
              primary={`${r.emoji ?? ''} ${isText(r.title, language)}`}
              secondary={[t(`lp.tasks.subjects.${r.subject}`), t(`lp.tasks.frequencies.${r.frequency}`), t(`lp.tasks.assignees.${r.assignee}`), lpRangeLabel(r, t),
                r.category_key ? categoryName.get(String(r.category_key)) ?? r.category_key : ''].filter(Boolean).join(' · ')}
              extra={
                <>
                  <Badge variant={r.task_type === 'must_do' ? 'danger' : 'default'}>{t(`lp.tasks.taskTypes.${r.task_type}`)}</Badge>
                  <Badge variant="muted">{String(r.xp)} XP</Badge>
                </>
              }
            />
          )}
        />
        )}
      </div>
    </LpScope>
  );
};
