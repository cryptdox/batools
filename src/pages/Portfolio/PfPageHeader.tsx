import type { ReactNode } from 'react';
import { useLanguage } from '../../lib/LanguageContext';

export const PfPageHeader = ({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) => {
  const { t } = useLanguage();
  return (
    <div className="flex flex-wrap justify-between items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
      <div>
        <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">{t(title)}</h2>
        {subtitle && <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{t(subtitle)}</p>}
      </div>
      {action}
    </div>
  );
};

/** Tab strip for pages that hold several pf_ lists. */
export const PfTabs = <K extends string>({ tabs, active, onChange }: { tabs: { key: K; label: string }[]; active: K; onChange: (k: K) => void }) => {
  const { t } = useLanguage();
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map(tab => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            active === tab.key
              ? 'bg-primary text-white shadow-sm'
              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          {t(tab.label)}
        </button>
      ))}
    </div>
  );
};
