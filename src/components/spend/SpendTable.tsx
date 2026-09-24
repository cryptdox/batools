import { format, parse } from 'date-fns';
import { Pencil, Trash2 } from 'lucide-react';
import type { Spend } from '../../lib/supabase';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Pagination, usePagination } from '../ui/Pagination';
import { formatTaka } from '../ui/SummaryBar';

export const SPEND_PAGE_SIZE = 10;

export type SpendRow = Pick<Spend, 'id' | 'spend_date' | 'amount' | 'description' | 'created_at'>;

// Newest day first; same-day entries by when they were added.
export const sortSpendsDesc = <T extends SpendRow>(spends: T[]) =>
  [...spends].sort((a, b) =>
    b.spend_date.localeCompare(a.spend_date) || b.created_at.localeCompare(a.created_at)
  );

export const sumSpends = (spends: SpendRow[]) => spends.reduce((sum, s) => sum + Number(s.amount), 0);

interface SpendTableProps<T extends SpendRow> {
  spends: T[];
  onEdit?: (spend: T) => void;
  onDelete?: (spend: T) => void;
  emptyText?: string;
}

// Paginated spend list, newest first. Edit/delete columns show only when handlers are given.
export function SpendTable<T extends SpendRow>({ spends, onEdit, onDelete, emptyText = 'No spending recorded for this period.' }: SpendTableProps<T>) {
  const sorted = sortSpendsDesc(spends);
  const { page, pageCount, pageItems, setPage, total, pageSize } = usePagination(sorted, SPEND_PAGE_SIZE);
  const hasActions = !!(onEdit || onDelete);

  if (total === 0) {
    return <div className="p-12 text-center text-gray-500 font-medium">{emptyText}</div>;
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
              <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm whitespace-nowrap">Date</th>
              <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm">Description</th>
              <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm text-right">Amount</th>
              {hasActions && <th className="p-4 font-medium text-gray-500 dark:text-gray-400 text-sm text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {pageItems.map(s => (
              <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <td className="p-4 text-gray-900 dark:text-gray-100 font-medium whitespace-nowrap">
                  {format(parse(s.spend_date, 'yyyy-MM-dd', new Date()), 'MMM d, yyyy')}
                </td>
                <td className="p-4 text-gray-700 dark:text-gray-300 break-words">{s.description}</td>
                <td className="p-4 text-right font-medium text-danger whitespace-nowrap">{formatTaka(Number(s.amount))}</td>
                {hasActions && (
                  <td className="p-4 text-right whitespace-nowrap">
                    {onEdit && (
                      <Button variant="ghost" size="sm" onClick={() => onEdit(s)} title="Edit">
                        <Pencil size={16} />
                      </Button>
                    )}
                    {onDelete && (
                      <Button variant="ghost" size="sm" onClick={() => onDelete(s)} title="Delete">
                        <Trash2 size={16} className="text-danger" />
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageCount={pageCount} total={total} pageSize={pageSize} onPageChange={setPage} />
    </>
  );
}

interface SpendListModalProps {
  isOpen: boolean;
  onClose: () => void;
  spends: SpendRow[];
  periodLabel?: string | null;
}

// Read-only drill-down opened from a "Total Spend" summary card.
export const SpendListModal = ({ isOpen, onClose, spends, periodLabel }: SpendListModalProps) => (
  <Modal isOpen={isOpen} onClose={onClose} title="Spending" className="max-w-2xl">
    <div className="flex items-center justify-between gap-3 mb-3 text-sm">
      <span className="text-gray-500 dark:text-gray-400">{periodLabel ?? 'All time'}</span>
      <span className="font-semibold text-gray-900 dark:text-white">Total {formatTaka(sumSpends(spends))}</span>
    </div>
    <div className="border border-gray-100 dark:border-gray-700 rounded-lg overflow-hidden max-h-[65vh] overflow-y-auto">
      <SpendTable spends={spends} />
    </div>
  </Modal>
);
