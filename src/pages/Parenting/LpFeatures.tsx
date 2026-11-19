import { IsListEditor, IsRowText } from '../../components/islamicStudio/IsListEditor';
import type { IsField } from '../../components/islamicStudio/IsFieldInput';
import { pfInputClass } from '../../components/portfolio/PfFieldInput';
import { Badge } from '../../components/ui/Button';
import { useLanguage } from '../../lib/LanguageContext';
import { IS_FEATURE_STATUSES, isText, type IsRow } from '../../lib/islamicStudio';
import { LP_FEATURE_TABS, LpScope, lpChoices } from '../../lib/parenting';
import { PfPageHeader } from '../Portfolio/PfPageHeader';

const STATUS_OPTIONS = IS_FEATURE_STATUSES.map(s => ({ value: s, label: `is.features.status.${s}` }));
const TAB_OPTIONS = lpChoices('lp.features.tab', LP_FEATURE_TABS);

const FIELDS: IsField[] = [
  { name: 'status', label: 'is.features.statusLabel', type: 'select', options: STATUS_OPTIONS, required: true, hint: 'is.features.statusHint' },
  { name: 'min_version_code', label: 'is.features.minVersion', type: 'number', hint: 'is.features.minVersionHint' },
  { name: 'name', label: 'is.common.name', type: 'i18n', required: true },
  { name: 'description', label: 'is.common.description', type: 'i18nArea' },
  { name: 'status_message', label: 'is.features.statusMessage', type: 'i18nArea', hint: 'is.features.statusMessageHint',
    when: v => v.status === 'coming_soon' || v.status === 'maintenance' },
  { name: 'beta_testers', label: 'is.features.betaTesters', type: 'tags', hint: 'lp.features.betaTestersHint', when: v => v.status === 'beta' },
  { name: 'tab', label: 'is.features.tabLabel', type: 'select', options: TAB_OPTIONS, required: true },
  { name: 'icon', label: 'is.common.icon', type: 'text', hint: 'is.common.iconHint' },
];

const statusVariant = (s: string) => (s === 'active' ? 'success' : s === 'hidden' ? 'muted' : s === 'maintenance' ? 'danger' : 'warning');

/** The parenting app's features. A feature without code in the installed build can only be hidden or "coming soon". */
export const LpFeatures = () => {
  const { t, language } = useLanguage();
  return (
    <LpScope>
      <div className="max-w-5xl mx-auto space-y-6">
        <PfPageHeader title="lp.features.pageTitle" subtitle="lp.features.pageSubtitle" />
        <IsListEditor
          table="lp_features"
          title="lp.features.title"
          keys={['key']}
          fields={FIELDS}
          activeToggle={false}
          canAdd={false}
          canDelete={false}
          filters={[
            { name: 'status', label: 'is.features.statusLabel', options: STATUS_OPTIONS },
            { name: 'tab', label: 'is.features.tabLabel', options: TAB_OPTIONS },
          ]}
          renderRow={(r: IsRow) => (
            <IsRowText
              primary={isText(r.name, language)}
              secondary={`${t('is.features.phase')} ${r.phase} · ${t(`lp.features.tab.${r.tab}`)} · ${r.min_version_code ? `${t('is.features.builtIn')} ${r.min_version_code}` : t('is.features.notBuiltYet')}`}
              extra={<Badge variant={statusVariant(String(r.status))}>{t(`is.features.status.${r.status}`)}</Badge>}
            />
          )}
          rowActions={(r, patch) => (
            <select
              value={String(r.status)}
              onChange={e => patch({ status: e.target.value })}
              className={`${pfInputClass} h-8 w-auto text-xs mr-1`}
              title={t('is.features.statusLabel')}
            >
              {STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value} disabled={!r.min_version_code && !['hidden', 'coming_soon'].includes(o.value)}>
                  {t(o.label)}
                </option>
              ))}
            </select>
          )}
        />
      </div>
    </LpScope>
  );
};
