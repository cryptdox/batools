import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '../../lib/LanguageContext';

/** "‹ 1 2 3 ›" under a paged list; nothing for a single page. */
export const PfPager = ({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) => {
  const { t } = useLanguage();
  if (pages < 2) return null;
  const btn = 'min-w-8 h-8 px-2 rounded-md text-sm disabled:opacity-30 disabled:pointer-events-none';
  return (
    <div className="flex items-center justify-center gap-1 p-3 border-t border-gray-100 dark:border-gray-700">
      <button className={`${btn} hover:bg-gray-100 dark:hover:bg-gray-700`} disabled={page === 0} onClick={() => onChange(page - 1)} title={t('pf.common.prevPage')}>
        <ChevronLeft size={16} className="mx-auto" />
      </button>
      {Array.from({ length: pages }, (_, i) => (
        <button key={i} onClick={() => onChange(i)}
          className={`${btn} ${i === page ? 'bg-primary text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
          {i + 1}
        </button>
      ))}
      <button className={`${btn} hover:bg-gray-100 dark:hover:bg-gray-700`} disabled={page === pages - 1} onClick={() => onChange(page + 1)} title={t('pf.common.nextPage')}>
        <ChevronRight size={16} className="mx-auto" />
      </button>
    </div>
  );
};

/** The page of `items` to show; a page past the end (after filtering) shows the last one. */
export function pageOf<T>(items: T[], page: number, size: number) {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(page, pages - 1);
  return { pages, current, slice: items.slice(current * size, current * size + size) };
}
