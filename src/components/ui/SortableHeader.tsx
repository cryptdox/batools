import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useState } from 'react';

export type SortDirection = 'asc' | 'desc';
export type SortState<K extends string> = { key: K; direction: SortDirection };

export function useSort<K extends string>(initialKey: K) {
  const [sort, setSort] = useState<SortState<K>>({ key: initialKey, direction: 'asc' });

  const toggleSort = (key: K) => {
    setSort(prev =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    );
  };

  // Empty values always sort last, so untyped members don't crowd the top.
  const compare = (a: string, b: string) => {
    if (!a && !b) return 0;
    if (!a) return 1;
    if (!b) return -1;
    const result = a.localeCompare(b, undefined, { sensitivity: 'base' });
    return sort.direction === 'asc' ? result : -result;
  };

  return { sort, toggleSort, compare };
}

interface SortableHeaderProps<K extends string> {
  label: string;
  sortKey: K;
  sort: SortState<K>;
  onSort: (key: K) => void;
  className?: string;
}

export function SortableHeader<K extends string>({ label, sortKey, sort, onSort, className }: SortableHeaderProps<K>) {
  const isActive = sort.key === sortKey;
  return (
    <th className={`p-4 font-medium text-gray-500 dark:text-gray-400 text-sm ${className ?? ''}`}>
      <button
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1.5 transition-colors hover:text-primary ${isActive ? 'text-primary' : ''}`}
      >
        {label}
        {isActive ? (
          sort.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
        ) : (
          <ArrowUpDown size={14} className="opacity-40" />
        )}
      </button>
    </th>
  );
}
