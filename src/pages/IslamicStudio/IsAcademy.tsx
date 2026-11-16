import { useState } from 'react';
import { FolderTree, ListChecks, Layers, Route } from 'lucide-react';
import { IsListEditor, IsRowText } from '../../components/islamicStudio/IsListEditor';
import type { IsField, IsFormValues } from '../../components/islamicStudio/IsFieldInput';
import { LEARN_ITEM_TYPES, LearnItemView, type LearnItemData } from '../../components/islamicStudio/IsLearnItem';
import { useLanguage } from '../../lib/LanguageContext';
import { supabase } from '../../lib/supabase';
import { isText, useIsReviewer, useIsUserId, type IsI18n, type IsRow } from '../../lib/islamicStudio';
import { PfPageHeader } from '../Portfolio/PfPageHeader';

const MAX_OPTIONS = 4;
const MAX_PAIRS = 6;
const MAX_PIECES = 10;
/** Icons the app knows (islamic-studio-app/src/components/ui.tsx). */
const ICONS = ['sparkles', 'clock', 'book-open', 'hand-heart', 'moon', 'compass', 'library', 'graduation-cap', 'trophy', 'calendar', 'calculator', 'users'];

const CATEGORY_FIELDS: IsField[] = [
  { name: 'title', label: 'is.common.title', type: 'i18n', required: true },
  { name: 'description', label: 'is.common.description', type: 'i18nArea' },
  { name: 'color', label: 'is.academy.color', type: 'text', hint: 'is.academy.colorHint' },
  { name: 'icon', label: 'is.academy.icon', type: 'select', allowEmpty: true, options: ICONS.map(v => ({ value: v, label: v })) },
  { name: 'is_active', label: 'is.common.active', type: 'boolean' },
];

const SECTION_FIELDS: IsField[] = [
  { name: 'title', label: 'is.common.title', type: 'i18n', required: true },
  { name: 'description', label: 'is.common.description', type: 'i18nArea' },
  { name: 'is_active', label: 'is.common.active', type: 'boolean' },
];

const UNIT_FIELDS: IsField[] = [
  { name: 'title', label: 'is.common.title', type: 'i18n', required: true },
  { name: 'description', label: 'is.common.description', type: 'i18nArea' },
  { name: 'color', label: 'is.academy.color', type: 'text', hint: 'is.academy.colorHint' },
  { name: 'icon', label: 'is.academy.icon', type: 'select', allowEmpty: true, options: ICONS.map(v => ({ value: v, label: v })) },
  { name: 'is_active', label: 'is.common.active', type: 'boolean' },
];

const LESSON_FIELDS: IsField[] = [
  { name: 'title', label: 'is.common.title', type: 'i18n', required: true },
  { name: 'kind', label: 'is.academy.kind', type: 'select', required: true,
    options: ['lesson', 'checkpoint'].map(v => ({ value: v, label: `is.academy.kinds.${v}` })) },
];

const is = (...types: string[]) => (v: IsFormValues) => types.includes(String(v.type));
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/** Item form: the type decides which fields show; they are saved together in `data`. */
const ITEM_FIELDS: IsField[] = [
  { name: 'type', label: 'is.academy.type', type: 'select', required: true, options: LEARN_ITEM_TYPES.map(v => ({ value: v, label: `is.academy.types.${v}` })) },
  { name: 'prompt', label: 'is.academy.prompt', type: 'i18nArea', hint: 'is.academy.promptHint' },
  { name: 'before', label: 'is.academy.before', type: 'i18n', virtual: true, when: is('fill') },
  { name: 'after', label: 'is.academy.after', type: 'i18n', virtual: true, when: is('fill') },
  ...range(MAX_OPTIONS).map((i): IsField => ({ name: `option${i}`, label: `is.quiz.option${i + 1}`, type: 'i18n', virtual: true, required: i < 2, when: is('choice', 'fill') })),
  { name: 'correct', label: 'is.quiz.correct', type: 'select', required: true, virtual: true, when: is('choice', 'fill'),
    options: range(MAX_OPTIONS).map(i => ({ value: String(i), label: `is.quiz.option${i + 1}` })) },
  { name: 'answer', label: 'is.academy.answer', type: 'select', required: true, virtual: true, when: is('true_false'),
    options: [{ value: 'true', label: 'is.academy.true' }, { value: 'false', label: 'is.academy.false' }] },
  ...range(MAX_PAIRS).flatMap((i): IsField[] => [
    { name: `left${i}`, label: `is.academy.left`, type: 'i18n', virtual: true, required: i < 2, when: is('match') },
    { name: `right${i}`, label: `is.academy.right`, type: 'i18n', virtual: true, required: i < 2, when: is('match') },
  ]),
  ...range(MAX_PIECES).map((i): IsField => ({ name: `piece${i}`, label: 'is.academy.piece', type: 'i18n', virtual: true, required: i < 2, when: is('order') })),
  { name: 'rtl', label: 'is.academy.rtl', type: 'boolean', virtual: true, hint: 'is.academy.rtlHint', when: is('order', 'fill') },
  { name: 'explanation', label: 'is.quiz.explanation', type: 'i18nArea' },
  { name: 'source_ref', label: 'is.duas.source', type: 'text' },
];

/** The form's `<name>.<lang>` values as {lang: text}, empty languages left out. */
function i18nOf(values: IsFormValues, name: string): IsI18n {
  const map: IsI18n = {};
  for (const [k, v] of Object.entries(values)) if (k.startsWith(`${name}.`) && typeof v === 'string' && v.trim()) map[k.slice(name.length + 1)] = v.trim();
  return map;
}
const filled = (m: IsI18n) => Object.keys(m).length > 0;

/** Builds `data` from the form. An incomplete item is refused by the database (is_learn_items_data_ok). */
function itemData(values: IsFormValues): LearnItemData {
  const type = String(values.type);
  const rtl = values.rtl === true;
  if (type === 'true_false') return { answer: values.answer === 'true' };
  if (type === 'match') {
    return { pairs: range(MAX_PAIRS).map(i => ({ left: i18nOf(values, `left${i}`), right: i18nOf(values, `right${i}`) })).filter(p => filled(p.left) && filled(p.right)) };
  }
  if (type === 'order') return { pieces: range(MAX_PIECES).map(i => i18nOf(values, `piece${i}`)).filter(filled), rtl };
  // choice / fill: empty answers are dropped, `correct` follows its answer.
  const options = range(MAX_OPTIONS).map(i => ({ i, text: i18nOf(values, `option${i}`) })).filter(o => filled(o.text));
  const data: LearnItemData = { options: options.map(o => o.text), correct: options.findIndex(o => String(o.i) === String(values.correct)) };
  if (type === 'fill') {
    const before = i18nOf(values, 'before');
    const after = i18nOf(values, 'after');
    if (filled(before)) data.before = before;
    if (filled(after)) data.after = after;
    data.rtl = rtl;
  }
  return data;
}

/** The form values for a saved item's `data`. */
function formFromData(row: IsRow): IsFormValues {
  const data = (row.data ?? {}) as LearnItemData;
  const values: IsFormValues = { rtl: data.rtl === true, answer: String(data.answer ?? true), correct: String(Math.max(0, data.correct ?? 0)) };
  const put = (name: string, map: IsI18n | undefined) => { for (const [lang, text] of Object.entries(map ?? {})) values[`${name}.${lang}`] = text; };
  (data.options ?? []).forEach((o, i) => put(`option${i}`, o));
  (data.pairs ?? []).forEach((p, i) => { put(`left${i}`, p.left); put(`right${i}`, p.right); });
  (data.pieces ?? []).forEach((p, i) => put(`piece${i}`, p));
  put('before', data.before);
  put('after', data.after);
  return values;
}

/**
 * Islamic Academy: the learning path. Units (reviewed, like quizzes) hold
 * lessons, lessons hold items. A non-reviewer's change to a lesson or item
 * sends its unit back to review, so approved content can't change unseen.
 */
export const IsAcademy = () => {
  const { t, language } = useLanguage();
  const isReviewer = useIsReviewer();
  const userId = useIsUserId();
  const [category, setCategory] = useState<IsRow | null>(null);
  const [section, setSection] = useState<IsRow | null>(null);
  const [unit, setUnit] = useState<IsRow | null>(null);
  const [lesson, setLesson] = useState<IsRow | null>(null);
  const [unitsReload, setUnitsReload] = useState(0);

  const backToReview = async () => {
    if (isReviewer || !unit || unit.review_status === 'in_review') return;
    const { error } = await supabase.from('is_learn_units').update({ review_status: 'in_review', updated_by: userId }).eq('id', unit.id);
    if (error) throw error;
    setUnit({ ...unit, review_status: 'in_review' });
    setUnitsReload(n => n + 1);
  };

  const toggle = (active: boolean, onClick: () => void, title: string, Icon: typeof Layers) => (
    <button onClick={onClick} title={title}
      className={`p-1.5 rounded-md ${active ? 'text-primary bg-primary/10' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
      <Icon size={16} />
    </button>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PfPageHeader title="is.academy.pageTitle" subtitle="is.academy.pageSubtitle" />
      <IsListEditor
        table="is_learn_categories"
        title="is.academy.categories"
        subtitle="is.academy.categoriesSubtitle"
        fields={CATEGORY_FIELDS}
        audited="both"
        renderRow={r => (
          <div className="flex items-center gap-3 min-w-0">
            <span className="h-8 w-8 shrink-0 rounded-xl" style={{ background: String(r.color ?? '#44bd32') }} />
            <IsRowText primary={isText(r.title, language)} secondary={isText(r.description, language)} />
          </div>
        )}
        rowActions={r => toggle(category?.id === r.id, () => { setCategory(category?.id === r.id ? null : r); setSection(null); setUnit(null); setLesson(null); }, t('is.academy.sections'), FolderTree)}
      />
      {category && (
        <IsListEditor
          key={`sections-${String(category.id)}`}
          table="is_learn_sections"
          title="is.academy.sections"
          subtitle="is.academy.sectionsSubtitle"
          scope={{ category_id: String(category.id) }}
          fields={SECTION_FIELDS}
          renderRow={r => <IsRowText primary={isText(r.title, language)} secondary={isText(r.description, language)} />}
          rowActions={r => toggle(section?.id === r.id, () => { setSection(section?.id === r.id ? null : r); setUnit(null); setLesson(null); }, t('is.academy.units'), Route)}
        />
      )}
      {category && section && <IsListEditor
        key={`units-${String(section.id)}`}
        table="is_learn_units"
        title="is.academy.units"
        subtitle="is.academy.unitsSubtitle"
        scope={{ section_id: String(section.id) }}
        fields={UNIT_FIELDS}
        reviewed
        audited="both"
        reloadSignal={unitsReload}
        renderRow={r => (
          <div className="flex items-center gap-3 min-w-0">
            <span className="h-8 w-8 shrink-0 rounded-full" style={{ background: String(r.color ?? '#44bd32') }} />
            <IsRowText primary={isText(r.title, language)} secondary={isText(r.description, language)} />
          </div>
        )}
        rowActions={r => toggle(unit?.id === r.id, () => { setUnit(unit?.id === r.id ? null : r); setLesson(null); }, t('is.academy.lessons'), Layers)}
      />}
      {section && unit && (
        <IsListEditor
          key={`lessons-${String(unit.id)}`}
          table="is_learn_lessons"
          title="is.academy.lessons"
          subtitle="is.academy.lessonsSubtitle"
          scope={{ unit_id: String(unit.id) }}
          fields={LESSON_FIELDS}
          defaults={{ kind: 'lesson' }}
          afterSave={backToReview}
          renderRow={r => (
            <IsRowText primary={isText(r.title, language)} secondary={t(`is.academy.kinds.${r.kind}`)} />
          )}
          rowActions={r => toggle(lesson?.id === r.id, () => setLesson(lesson?.id === r.id ? null : r), t('is.academy.items'), ListChecks)}
        />
      )}
      {section && unit && lesson && (
        <IsListEditor
          key={`items-${String(lesson.id)}`}
          table="is_learn_items"
          title="is.academy.items"
          subtitle="is.academy.itemsSubtitle"
          scope={{ lesson_id: String(lesson.id) }}
          fields={ITEM_FIELDS}
          activeToggle={false}
          defaults={{ type: 'choice', correct: '0', answer: 'true' }}
          formFromRow={formFromData}
          transform={(row, values) => {
            // Match and order items have a default instruction in the app; the others need their question.
            if (!['match', 'order'].includes(String(values.type)) && !Object.keys((row.prompt ?? {}) as IsI18n).length) throw new Error(t('is.academy.needPrompt'));
            return { ...row, data: itemData(values) };
          }}
          afterSave={backToReview}
          renderRow={r => <LearnItemView item={r} />}
        />
      )}
    </div>
  );
};
