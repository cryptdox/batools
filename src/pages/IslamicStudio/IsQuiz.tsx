import { useEffect, useState } from 'react';
import { ListChecks } from 'lucide-react';
import { IsListEditor, IsRowText } from '../../components/islamicStudio/IsListEditor';
import type { IsField } from '../../components/islamicStudio/IsFieldInput';
import { Badge, Button } from '../../components/ui/Button';
import { useLanguage } from '../../lib/LanguageContext';
import { supabase } from '../../lib/supabase';
import { isText, type IsRow } from '../../lib/islamicStudio';
import { PfPageHeader, PfTabs } from '../Portfolio/PfPageHeader';
import { IsStudyLinks } from '../../components/islamicStudio/IsStudyLinks';

const TOPICS = ['quran', 'prophets', 'pillars', 'seerah', 'history', 'fiqh', 'ramadan', 'general'];
const OPTION_COUNT = 4;

const QUIZ_FIELDS: IsField[] = [
  { name: 'title', label: 'is.common.title', type: 'i18n', required: true },
  { name: 'description', label: 'is.common.description', type: 'i18nArea' },
  { name: 'topic', label: 'is.quiz.topic', type: 'select', required: true, options: TOPICS.map(v => ({ value: v, label: `is.quiz.topics.${v}` })) },
  { name: 'difficulty', label: 'is.quiz.difficulty', type: 'select', required: true,
    options: ['easy', 'medium', 'hard'].map(v => ({ value: v, label: `is.quiz.levels.${v}` })) },
  { name: 'time_limit_seconds', label: 'is.quiz.timeLimit', type: 'number', hint: 'is.quiz.timeLimitHint' },
  { name: 'points_per_question', label: 'is.quiz.points', type: 'number', required: true },
  { name: 'is_active', label: 'is.common.active', type: 'boolean' },
];

/** Question form: the question plus four answers (virtual fields saved to is_quiz_options). */
const QUESTION_FIELDS: IsField[] = [
  { name: 'question', label: 'is.quiz.question', type: 'i18nArea', required: true },
  ...Array.from({ length: OPTION_COUNT }, (_, i): IsField => ({ name: `option${i}`, label: `is.quiz.option${i + 1}`, type: 'i18n', virtual: true, required: i < 2 })),
  { name: 'correct', label: 'is.quiz.correct', type: 'select', required: true, virtual: true,
    options: Array.from({ length: OPTION_COUNT }, (_, i) => ({ value: String(i), label: `is.quiz.option${i + 1}` })) },
  { name: 'explanation', label: 'is.quiz.explanation', type: 'i18nArea' },
  { name: 'source_ref', label: 'is.duas.source', type: 'text' },
];

type OptionRow = { id: string; text: Record<string, string>; is_correct: boolean; sort_order: number };

/** Replaces a question's answers with the form's (empty answers are dropped). */
async function saveOptions(questionId: string, values: Record<string, string | boolean>) {
  const options = Array.from({ length: OPTION_COUNT }, (_, i) => {
    const text: Record<string, string> = {};
    for (const [k, v] of Object.entries(values)) if (k.startsWith(`option${i}.`) && typeof v === 'string' && v.trim()) text[k.slice(`option${i}.`.length)] = v.trim();
    return { text, is_correct: String(values.correct) === String(i), sort_order: i + 1 };
  }).filter(o => Object.keys(o.text).length);
  const { error: delError } = await supabase.from('is_quiz_options').delete().eq('question_id', questionId);
  if (delError) throw delError;
  if (options.length) {
    const { error } = await supabase.from('is_quiz_options').insert(options.map(o => ({ ...o, question_id: questionId })));
    if (error) throw error;
  }
}

type Tab = 'quizzes' | 'challenges';

export const IsQuiz = () => {
  const { t, language } = useLanguage();
  const [tab, setTab] = useState<Tab>('quizzes');
  const [quiz, setQuiz] = useState<IsRow | null>(null);
  const [quizOptions, setQuizOptions] = useState<{ value: string; label: string }[]>([]);
  useEffect(() => {
    void supabase.from('is_quizzes').select('id, title').order('sort_order').then(({ data }) =>
      setQuizOptions((data ?? []).map(q => ({ value: String(q.id), label: isText(q.title, language) }))));
  }, [language, tab]);

  const challengeFields: IsField[] = [
    { name: 'title', label: 'is.common.title', type: 'i18n', required: true },
    { name: 'description', label: 'is.common.description', type: 'i18nArea' },
    { name: 'quiz_ids', label: 'is.quiz.quizzes', type: 'multi', options: quizOptions, required: true },
    { name: 'starts_at', label: 'is.announcements.startsAt', type: 'datetime', required: true },
    { name: 'ends_at', label: 'is.announcements.endsAt', type: 'datetime', required: true },
    { name: 'is_active', label: 'is.common.active', type: 'boolean' },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PfPageHeader title="is.quiz.pageTitle" subtitle="is.quiz.pageSubtitle" />
      <PfTabs<Tab> tabs={[{ key: 'quizzes', label: 'is.quiz.tabQuizzes' }, { key: 'challenges', label: 'is.quiz.tabChallenges' }]} active={tab} onChange={k => { setTab(k); setQuiz(null); }} />
      {tab === 'quizzes' && (
        <>
          <IsListEditor
            table="is_quizzes"
            title="is.quiz.quizzesTitle"
            subtitle="is.quiz.quizzesSubtitle"
            fields={QUIZ_FIELDS}
            reviewed
            audited="both"
            searchable
            pageSize={25}
            filters={[
              { name: 'topic', label: 'is.quiz.topic', options: TOPICS.map(v => ({ value: v, label: `is.quiz.topics.${v}` })) },
              { name: 'difficulty', label: 'is.quiz.difficulty', options: ['easy', 'medium', 'hard'].map(v => ({ value: v, label: `is.quiz.levels.${v}` })) },
              { name: 'review_status', label: 'is.review.status', options: ['draft', 'in_review', 'approved', 'rejected'].map(v => ({ value: v, label: `is.review.${v}` })) },
            ]}
            defaults={{ topic: 'general', difficulty: 'easy', points_per_question: '10' }}
            renderRow={r => (
              <IsRowText
                primary={isText(r.title, language)}
                secondary={`${t(`is.quiz.topics.${r.topic}`)} · ${t(`is.quiz.levels.${r.difficulty}`)}${r.time_limit_seconds ? ` · ${r.time_limit_seconds}s` : ''}`}
              />
            )}
            rowActions={r => (
              <button onClick={() => setQuiz(quiz?.id === r.id ? null : r)} title={t('is.quiz.questions')}
                className={`p-1.5 rounded-md ${quiz?.id === r.id ? 'text-primary bg-primary/10' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                <ListChecks size={16} />
              </button>
            )}
          />
          {quiz && <IsStudyLinks targetType="quiz" targetId={String(quiz.id)} />}
          {quiz && (
            <IsListEditor
              key={String(quiz.id)}
              table="is_quiz_questions"
              title="is.quiz.questions"
              subtitle="is.quiz.questionsSubtitle"
              select="*, is_quiz_options(id, text, is_correct, sort_order)"
              scope={{ quiz_id: String(quiz.id) }}
              fields={QUESTION_FIELDS}
              activeToggle={false}
              defaults={{ correct: '0' }}
              formFromRow={r => {
                const options = [...((r.is_quiz_options as OptionRow[] | undefined) ?? [])].sort((a, b) => a.sort_order - b.sort_order);
                const values: Record<string, string> = { correct: String(Math.max(0, options.findIndex(o => o.is_correct))) };
                options.forEach((o, i) => { for (const [lang, text] of Object.entries(o.text)) values[`option${i}.${lang}`] = text; });
                return values;
              }}
              afterSave={async (row, values) => saveOptions(String(row.id), values)}
              renderRow={r => {
                const options = [...((r.is_quiz_options as OptionRow[] | undefined) ?? [])].sort((a, b) => a.sort_order - b.sort_order);
                return (
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium text-gray-900 dark:text-gray-100">{isText(r.question, language)}</p>
                    <div className="flex flex-wrap gap-1">
                      {options.map(o => <Badge key={o.id} variant={o.is_correct ? 'success' : 'muted'}>{isText(o.text, language)}</Badge>)}
                    </div>
                  </div>
                );
              }}
            />
          )}
        </>
      )}
      {tab === 'challenges' && (
        <IsListEditor
          table="is_challenges"
          title="is.quiz.challengesTitle"
          searchable
          subtitle="is.quiz.challengesSubtitle"
          fields={challengeFields}
          renderRow={r => {
            // Live / upcoming / ended by its dates; "off" hides it whatever the dates.
            const now = Date.now();
            const phase = r.is_active === false ? 'off' : now < Date.parse(String(r.starts_at)) ? 'upcoming' : now > Date.parse(String(r.ends_at)) ? 'ended' : 'live';
            return (
              <IsRowText
                primary={isText(r.title, language)}
                secondary={`${new Date(String(r.starts_at)).toLocaleDateString()} → ${new Date(String(r.ends_at)).toLocaleDateString()} · ${(r.quiz_ids as string[]).length} ${t('is.quiz.quizzes')}`}
                extra={<Badge variant={phase === 'live' ? 'success' : phase === 'upcoming' ? 'warning' : 'muted'}>{t(`is.quiz.phase.${phase}`)}</Badge>}
              />
            );
          }}
          rowActions={(r, patch) => (
            <Button size="sm" variant={r.is_active === false ? 'primary' : 'outline'} className="h-7 px-2 text-xs mr-1" onClick={() => patch({ is_active: r.is_active === false })}>
              {t(r.is_active === false ? 'is.quiz.turnOn' : 'is.quiz.turnOff')}
            </Button>
          )}
        />
      )}
    </div>
  );
};
