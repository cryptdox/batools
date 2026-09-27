export type FilterPreset = 'daily' | 'weekly' | 'monthly' | 'custom' | 'all';

interface DateRangeFilterProps {
  preset: FilterPreset;
  onPresetChange: (preset: FilterPreset) => void;
  customFrom: string;
  customTo: string;
  onCustomFromChange: (value: string) => void;
  onCustomToChange: (value: string) => void;
  exclude?: FilterPreset[];
}

const PRESETS: { value: FilterPreset; label: string }[] = [
  { value: 'all', label: 'All Time' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom', label: 'Custom Range' },
];

export const DateRangeFilter = ({
  preset,
  onPresetChange,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
  exclude = [],
}: DateRangeFilterProps) => {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        value={preset}
        onChange={(e) => onPresetChange(e.target.value as FilterPreset)}
        className="h-10 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 dark:text-gray-50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      >
        {PRESETS.filter(p => !exclude.includes(p.value)).map(p => (
          <option key={p.value} value={p.value}>{p.label}</option>
        ))}
      </select>

      {preset === 'custom' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => onCustomFromChange(e.target.value)}
            className="h-10 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 dark:text-gray-50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <span className="text-gray-400 text-sm">to</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => onCustomToChange(e.target.value)}
            className="h-10 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 dark:text-gray-50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      )}
    </div>
  );
};
