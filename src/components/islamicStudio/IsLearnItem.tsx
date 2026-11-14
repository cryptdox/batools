import { useEffect, useState } from 'react';
import { Badge } from '../ui/Button';
import { useLanguage } from '../../lib/LanguageContext';
import { supabase } from '../../lib/supabase';
import { isText, type IsI18n, type IsRow } from '../../lib/islamicStudio';

// Islamic Academy items (is_learn_items, migration 079): how each type's
// `data` looks, and a read-only view of an item with its answer shown.

export const LEARN_ITEM_TYPES = ['choice', 'true_false', 'match', 'order', 'fill'] as const;
export type LearnItemType = (typeof LEARN_ITEM_TYPES)[number];

export type LearnItemData = {
  options?: IsI18n[];
  correct?: number;
  answer?: boolean;
  pairs?: { left: IsI18n; right: IsI18n }[];
  pieces?: IsI18n[];
  before?: IsI18n;
  after?: IsI18n;
  rtl?: boolean;
};

const arabicStyle = { fontFamily: '"Amiri", "Scheherazade New", "Noto Naskh Arabic", serif' };

/** A multilingual value; Arabic-only text ({"ar": …}) in an Arabic font, right to left. */
export const LearnText = ({ value, className }: { value: unknown; className?: string }) => {
  const { language } = useLanguage();
  const map = (value && typeof value === 'object' ? value : {}) as IsI18n;
  const arabicOnly = !!map.ar && !map[language] && !map.en && !map.bn;
  return (
    <span dir={arabicOnly ? 'rtl' : undefined} lang={arabicOnly ? 'ar' : undefined}
      className={`${arabicOnly ? 'text-lg' : ''} ${className ?? ''}`} style={arabicOnly ? arabicStyle : undefined}>
      {isText(value, language)}
    </span>
  );
};

const chip = (ok: boolean) =>
  `px-2 py-0.5 rounded-full text-xs border ${ok ? 'bg-success/10 text-success border-success/30 font-semibold' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'}`;

/** One item: its prompt and the right answer (the correct choice, the pairs, the order…). */
export const LearnItemView = ({ item, showExplanation }: { item: IsRow; showExplanation?: boolean }) => {
  const { t, language } = useLanguage();
  const type = String(item.type) as LearnItemType;
  const data = (item.data ?? {}) as LearnItemData;
  return (
    <div className="min-w-0 space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="default">{t(`is.academy.types.${type}`)}</Badge>
        <span className="font-medium text-gray-900 dark:text-gray-100">{isText(item.prompt, language) || t(`is.academy.defaultPrompt.${type}`)}</span>
      </div>
      {(type === 'choice' || type === 'fill') && (
        <div className="space-y-1">
          {type === 'fill' && (
            <p dir={data.rtl ? 'rtl' : undefined} className="text-gray-800 dark:text-gray-200">
              <LearnText value={data.before} /> <span className="px-2 border-b-2 border-dashed border-primary">&nbsp;?&nbsp;</span> <LearnText value={data.after} />
            </p>
          )}
          <div className="flex flex-wrap gap-1">
            {(data.options ?? []).map((o, i) => (
              <span key={i} className={chip(i === data.correct)}>{i === data.correct ? '✓ ' : ''}<LearnText value={o} /></span>
            ))}
          </div>
        </div>
      )}
      {type === 'true_false' && <span className={chip(true)}>✓ {t(data.answer ? 'is.academy.true' : 'is.academy.false')}</span>}
      {type === 'match' && (
        <div className="flex flex-wrap gap-1">
          {(data.pairs ?? []).map((p, i) => (
            <span key={i} className={chip(false)}><LearnText value={p.left} /> ↔ <LearnText value={p.right} /></span>
          ))}
        </div>
      )}
      {type === 'order' && (
        <ol dir={data.rtl ? 'rtl' : undefined} className="flex flex-wrap gap-1">
          {(data.pieces ?? []).map((p, i) => (
            <li key={i} className={chip(false)}>{i + 1}. <LearnText value={p} /></li>
          ))}
        </ol>
      )}
      {showExplanation && isText(item.explanation, language) && (
        <p className="text-xs text-gray-500">{isText(item.explanation, language)}{item.source_ref ? ` · ${String(item.source_ref)}` : ''}</p>
      )}
    </div>
  );
};

/** A unit's lessons and every item, for Content Review. */
export const LearnUnitPreview = ({ unitId }: { unitId: string }) => {
  const { t, language } = useLanguage();
  const [lessons, setLessons] = useState<(IsRow & { is_learn_items: IsRow[] })[] | null>(null);
  useEffect(() => {
    void supabase.from('is_learn_lessons').select('id, title, kind, sort_order, is_active, is_learn_items(*)')
      .eq('unit_id', unitId).order('sort_order')
      .then(({ data }) => setLessons((data ?? []) as unknown as (IsRow & { is_learn_items: IsRow[] })[]));
  }, [unitId]);
  if (!lessons) return <p className="text-sm text-gray-500">{t('pf.common.loading')}</p>;
  return (
    <div className="space-y-4">
      {lessons.map(l => (
        <div key={String(l.id)} className="space-y-2">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {isText(l.title, language)}{l.kind === 'checkpoint' ? ` · ${t('is.academy.kinds.checkpoint')}` : ''}{l.is_active ? '' : ` · ${t('is.academy.off')}`}
          </p>
          <ol className="space-y-3 list-decimal pl-5 text-sm">
            {[...l.is_learn_items].sort((a, b) => Number(a.sort_order) - Number(b.sort_order)).map(item => (
              <li key={String(item.id)}><LearnItemView item={item} showExplanation /></li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
};
