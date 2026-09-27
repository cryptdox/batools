import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

export function usePagination<T>(items: T[], pageSize: number) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  // Filtering can shrink the list under the current page; clamp to the last page.
  const current = Math.min(page, pageCount);
  const pageItems = items.slice((current - 1) * pageSize, current * pageSize);
  return { page: current, pageCount, pageItems, setPage, total: items.length, pageSize };
}

interface PaginationProps {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export const Pagination = ({ page, pageCount, total, pageSize, onPageChange }: PaginationProps) => {
  if (total === 0) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-gray-200 dark:border-gray-700 text-sm">
      <span className="text-gray-500 dark:text-gray-400">
        {first}&ndash;{last} of {total}
      </span>
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
  );
};
