import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

export const PAGE_SIZES = [10, 25, 50, 100];

/**
 * Slices a list for display.
 *
 * `pageSize` may be a fixed number (the original Spend usage) or omitted, in
 * which case the size becomes selectable via `setPageSize`. `pageItems` and
 * `pageRows` are the same array under two names — the first predates the
 * second and is still used by the Spend table.
 */
export function usePagination<T>(items: T[], pageSize = 25) {
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(pageSize);

  const pageCount = Math.max(1, Math.ceil(items.length / size));
  // Filtering can shrink the list under the current page; clamp to the last page.
  const current = Math.min(page, pageCount);
  const pageItems = items.slice((current - 1) * size, current * size);

  return {
    page: current,
    pageCount,
    pageItems,
    pageRows: pageItems,
    setPage,
    total: items.length,
    pageSize: size,
    setPageSize: (n: number) => { setSize(n); setPage(1); },
  };
}

interface PaginationProps {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  /** Supply to offer a rows-per-page picker; omit for a fixed page size. */
  onPageSizeChange?: (n: number) => void;
}

export const Pagination = ({ page, pageCount, total, pageSize, onPageChange, onPageSizeChange }: PaginationProps) => {
  if (total === 0) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-gray-200 dark:border-gray-700 text-sm">
      <span className="text-gray-500 dark:text-gray-400">
        {first}&ndash;{last} of {total}
      </span>

      <div className="flex items-center gap-3">
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={e => onPageSizeChange(Number(e.target.value))}
            aria-label="Rows per page"
            className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary dark:border-gray-700 dark:bg-gray-900 dark:text-gray-50"
          >
            {PAGE_SIZES.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        )}

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="rounded-full w-8 h-8 p-0" onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
            <ChevronLeft size={16} />
          </Button>
          <span className="text-gray-700 dark:text-gray-300 font-medium min-w-[4.5rem] text-center">
            Page {page} / {pageCount}
          </span>
          <Button variant="ghost" size="sm" className="rounded-full w-8 h-8 p-0" onClick={() => onPageChange(page + 1)} disabled={page >= pageCount} aria-label="Next page">
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
};
