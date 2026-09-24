export type SummaryItem = {
  label: string;
  value: string | number;
  /** Tailwind text colour class for the label, e.g. 'text-success'. */
  tone?: string;
  /** Makes the card a button, e.g. to open a detail list. */
  onClick?: () => void;
};

// A strip of stat cards showing the column totals of the table below it.
export const SummaryBar = ({ items }: { items: SummaryItem[] }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-[repeat(auto-fit,minmax(8.5rem,1fr))] gap-3">
    {items.map(item => {
      const content = (
        <>
          <div className={`text-xs font-medium truncate ${item.tone ?? 'text-gray-500 dark:text-gray-400'}`}>{item.label}</div>
          <div className="text-2xl font-bold mt-1 text-gray-900 dark:text-white truncate">{item.value}</div>
        </>
      );
      const cardClass = 'bg-white dark:bg-gray-800 px-4 py-3 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 min-w-0 text-left';
      return item.onClick ? (
        <button
          key={item.label}
          type="button"
          onClick={item.onClick}
          title={`View ${item.label.toLowerCase()} details`}
          className={`${cardClass} cursor-pointer transition-colors hover:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary`}
        >
          {content}
        </button>
      ) : (
        <div key={item.label} className={cardClass}>{content}</div>
      );
    })}
  </div>
);

export const formatTaka = (n: number) => `৳${n.toFixed(2)}`;
