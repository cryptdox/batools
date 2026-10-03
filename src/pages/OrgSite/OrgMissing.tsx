import { Building2 } from 'lucide-react';
import { useLanguage } from '../../lib/LanguageContext';

/** Shown when the session's token carries no realm, so there is no org to edit. */
export const OrgMissing = () => {
  const { t } = useLanguage();
  return (
    <div className="max-w-xl mx-auto mt-12 p-8 text-center bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
      <Building2 size={32} className="mx-auto mb-3 text-gray-400" />
      <p className="font-semibold text-gray-900 dark:text-gray-100">{t('org.common.noOrg')}</p>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('org.common.noOrgHint')}</p>
    </div>
  );
};
