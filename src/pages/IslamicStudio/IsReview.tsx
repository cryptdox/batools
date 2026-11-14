import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { Check, X, Inbox, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button, Badge } from '../../components/ui/Button';
import { useLanguage } from '../../lib/LanguageContext';
import { supabase } from '../../lib/supabase';
import { errorMessage } from '../../lib/portfolio';
import { IS_REVIEWED_TABLES, isText, useIsReviewer, useIsUserId, type IsRow } from '../../lib/islamicStudio';
import { PfPageHeader } from '../Portfolio/PfPageHeader';

type Item = { table: (typeof IS_REVIEWED_TABLES)[number]; row: IsRow };
type QuizQuestion = { id: string; question: unknown; explanation: unknown; source_ref: string | null; is_quiz_options: { id: string; text: unknown; is_correct: boolean; sort_order: number }[] };

/** A quiz's questions with every answer; the correct one is marked. */
const QuizPreview = ({ quizId }: { quizId: string }) => {
  const { t, language } = useLanguage();
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  useEffect(() => {
    void supabase.from('is_quiz_questions').select('id, question, explanation, source_ref, is_quiz_options(id, text, is_correct, sort_order)')
      .eq('quiz_id', quizId).order('sort_order').then(({ data }) => setQuestions((data ?? []) as QuizQuestion[]));
  }, [quizId]);
  if (!questions) return <p className="text-sm text-gray-500">{t('pf.common.loading')}</p>;
  return (
    <ol className="space-y-3 list-decimal pl-5 text-sm">
      {questions.map(q => (
        <li key={q.id} className="space-y-1">
          <p className="font-medium text-gray-900 dark:text-gray-100">{isText(q.question, language)}</p>
          <ul className="flex flex-wrap gap-1">
            {[...q.is_quiz_options].sort((a, b) => a.sort_order - b.sort_order).map(o => (
              <li key={o.id} className={`px-2 py-0.5 rounded-full text-xs border ${o.is_correct ? 'bg-success/10 text-success border-success/30 font-semibold' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'}`}>
                {o.is_correct ? '✓ ' : ''}{isText(o.text, language)}
              </li>
            ))}
          </ul>
          {isText(q.explanation, language) && <p className="text-xs text-gray-500">{isText(q.explanation, language)}{q.source_ref ? ` · ${q.source_ref}` : ''}</p>}
        </li>
      ))}
    </ol>
  );
};

const arabicStyle = { fontFamily: '"Amiri", "Scheherazade New", "Noto Naskh Arabic", serif' };

/**
 * Religious content waiting for a reviewer: duas, tasbih presets and
 * translation / hadith packs. The app shows a row only once it is approved.
 */
export const IsReview = () => {
  const { t, language } = useLanguage();
  const userId = useIsUserId();
  const isReviewer = useIsReviewer();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const lists = await Promise.all(IS_REVIEWED_TABLES.map(async table => {
        const { data, error } = await supabase.from(table).select('*').in('review_status', ['draft', 'in_review']).order('updated_at', { ascending: false });
        if (error) throw error;
        return (data ?? []).map(row => ({ table, row: row as IsRow }));
      }));
      setItems(lists.flat());
    } catch (e) {
      console.error(e);
      toast.error(errorMessage(e, t('pf.common.loadError')));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  const decide = async (item: Item, status: 'approved' | 'rejected') => {
    setBusy(String(item.row.id));
    try {
      const { error } = await supabase.from(item.table)
        .update({ review_status: status, reviewed_by: userId, reviewed_at: new Date().toISOString(), updated_by: userId })
        .eq('id', item.row.id);
      if (error) throw error;
      setItems(prev => prev.filter(i => i !== item));
      toast.success(t(status === 'approved' ? 'is.review.approvedToast' : 'is.review.rejectedToast'));
    } catch (e) {
      console.error(e);
      toast.error(errorMessage(e, t('pf.common.saveError')));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PfPageHeader title="is.review.pageTitle" subtitle="is.review.pageSubtitle" />
      {!isReviewer && (
        <p className="text-sm rounded-lg bg-warning/10 border border-warning/20 p-3 text-gray-700 dark:text-gray-300">{t('is.review.notReviewer')}</p>
      )}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">{t('pf.common.loading')}</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Inbox size={28} className="mx-auto mb-2 text-gray-400" />
            {t('is.review.empty')}
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {items.map(item => {
              const r = item.row;
              const noLicense = item.table === 'is_content_packs' && !String(r.license ?? '').trim();
              return (
                <li key={`${item.table}:${r.id}`} className="p-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="default">{t(`is.review.tables.${item.table}`)}</Badge>
                    <Badge variant="warning">{t(`is.review.${r.review_status}`)}</Badge>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{isText(r.title ?? r.name ?? r.transliteration, language)}</span>
                  </div>
                  {typeof r.arabic === 'string' && (
                    <p dir="rtl" lang="ar" className="text-2xl leading-loose text-gray-900 dark:text-gray-100" style={arabicStyle}>{r.arabic}</p>
                  )}
                  {Boolean(r.translation) && <p className="text-sm text-gray-700 dark:text-gray-300">{isText(r.translation, language)}</p>}
                  {item.table === 'is_zakat_settings' && <p className="text-sm whitespace-pre-line text-gray-700 dark:text-gray-300">{isText(r.guidance, language)}</p>}
                  {item.table === 'is_quizzes' && open === String(r.id) && <QuizPreview quizId={String(r.id)} />}
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {[
                      r.source_ref ? `${t('is.duas.source')}: ${r.source_ref}` : '',
                      r.grade ? `${t('is.duas.grade')}: ${t(`is.duas.grades.${r.grade}`)}` : '',
                      r.author ? `${t('is.quran.author')}: ${r.author}` : '',
                      r.api_edition ? `${t('is.quran.apiEdition')}: ${r.api_edition}` : '',
                      r.license ? `${t('is.quran.license')}: ${r.license}` : '',
                    ].filter(Boolean).join(' · ')}
                  </p>
                  {noLicense && <p className="text-xs text-danger">{t('is.review.needsLicense')}</p>}
                  <div className="flex flex-wrap gap-2">
                    {item.table === 'is_quizzes' && (
                      <Button size="sm" variant="outline" onClick={() => setOpen(open === String(r.id) ? null : String(r.id))}>
                        <BookOpen size={14} className="mr-1" /> {t('is.text.read')}
                      </Button>
                    )}
                    {item.table === 'is_content_packs' && (r.kind === 'quran_translation' && r.is_stored || r.kind === 'hadith') && (
                      <Link to={r.kind === 'hadith' ? `/is/quran?tab=hadithText&book=${r.hadith_collection_id}` : `/is/quran?tab=text&pack=${r.id}`}
                        className="inline-flex items-center rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-800">
                        <BookOpen size={14} className="mr-1" /> {t('is.text.read')}
                      </Link>
                    )}
                  {isReviewer && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => void decide(item, 'approved')} disabled={busy === String(r.id) || noLicense}>
                        <Check size={14} className="mr-1" /> {t('is.review.approve')}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void decide(item, 'rejected')} disabled={busy === String(r.id)}>
                        <X size={14} className="mr-1" /> {t('is.review.reject')}
                      </Button>
                    </div>
                  )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};
