import { useEffect, useState } from 'react';
import { Layers } from 'lucide-react';
import { useLanguage } from '../../lib/LanguageContext';
import { loadPfVersions, usePfUserId } from '../../lib/portfolio';
import { setPfVersionTab, usePfVersionTab } from '../../lib/pfVersionTab';

/** "All versions | Developer | Researcher …": filters the versioned lists below. Nothing before any version exists. */
export const PfVersionTabs = () => {
  const { t } = useLanguage();
  const userId = usePfUserId();
  const tab = usePfVersionTab();
  const [versions, setVersions] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    if (userId) void loadPfVersions(userId).then(setVersions);
  }, [userId]);

  // A tab of a deleted version falls back to All.
  useEffect(() => {
    if (versions.length && tab !== 'all' && !versions.some(v => v.value === tab)) setPfVersionTab('all');
  }, [versions, tab]);

  if (!versions.length) return null;
  const tabs = [{ value: 'all', label: t('pf.versions.allTab') }, ...versions];
  return (
    <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-gray-800 px-4 py-3 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
      <Layers size={16} className="text-gray-400" />
      <span className="text-sm text-gray-500 dark:text-gray-400 mr-1">{t('pf.versions.field')}:</span>
      {tabs.map(v => (
        <button
          key={v.value}
          onClick={() => setPfVersionTab(v.value)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            tab === v.value
              ? 'bg-primary text-white shadow-sm'
              : 'bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          {v.label}
        </button>
      ))}
      <span className="basis-full text-xs text-gray-400">{t('pf.versions.tabHint')}</span>
    </div>
  );
};
