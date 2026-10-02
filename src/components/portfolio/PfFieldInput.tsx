import { useLanguage } from '../../lib/LanguageContext';
import type { PfField, PfFormValues } from '../../lib/portfolio';

export const pfInputClass =
  'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:border-gray-700 dark:bg-gray-900 dark:text-gray-50';

const LangTag = ({ lang }: { lang: 'EN' | 'BN' }) => (
  <span className="inline-block mr-1.5 px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-[10px] font-bold text-gray-500 dark:text-gray-300 align-middle">
    {lang}
  </span>
);

type Props = {
  field: PfField;
  values: PfFormValues;
  onChange: (key: string, value: string | boolean) => void;
};

/** Renders one PfField; bilingual kinds render as an EN | BN pair. */
export const PfFieldInput = ({ field: f, values, onChange }: Props) => {
  const { t } = useLanguage();
  const label = (
    <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
      {t(f.label)}{f.required && <span className="text-danger"> *</span>}
    </span>
  );
  const hint = f.hint && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t(f.hint)}</p>;
  const textValue = (key: string) => String(values[key] ?? '');

  if (f.type === 'boolean') {
    return (
      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={!!values[f.name]}
          onChange={e => onChange(f.name, e.target.checked)}
          className="w-4 h-4 mt-0.5 text-primary rounded border-gray-300 focus:ring-primary"
        />
        <span className="text-sm">
          <span className="font-medium text-gray-700 dark:text-gray-300">{t(f.label)}</span>
          {f.hint && <span className="block text-xs text-gray-500 dark:text-gray-400">{t(f.hint)}</span>}
        </span>
      </label>
    );
  }

  if (f.type === 'i18n' || f.type === 'i18nList') {
    const isArea = f.type === 'i18nList' || f.multiline;
    const rows = f.type === 'i18nList' ? 5 : 4;
    return (
      <div>
        {label}
        <div className="grid sm:grid-cols-2 gap-3">
          {(['en', 'bn'] as const).map(lang => {
            const key = `${f.name}_${lang}`;
            return (
              <div key={lang}>
                <span className="block mb-1"><LangTag lang={lang === 'en' ? 'EN' : 'BN'} /></span>
                {isArea ? (
                  <textarea
                    value={textValue(key)}
                    onChange={e => onChange(key, e.target.value)}
                    rows={rows}
                    className={pfInputClass}
                  />
                ) : (
                  <input value={textValue(key)} onChange={e => onChange(key, e.target.value)} className={`${pfInputClass} h-10`} />
                )}
              </div>
            );
          })}
        </div>
        {f.type === 'i18nList' && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('pf.common.onePerLine')}</p>}
        {hint}
      </div>
    );
  }

  return (
    <div>
      {label}
      {f.type === 'textarea' ? (
        <textarea value={textValue(f.name)} onChange={e => onChange(f.name, e.target.value)} rows={4} className={pfInputClass} />
      ) : f.type === 'select' ? (
        <select value={textValue(f.name)} onChange={e => onChange(f.name, e.target.value)} className={`${pfInputClass} h-10`}>
          {f.options?.map(o => <option key={o.value} value={o.value}>{t(o.label)}</option>)}
        </select>
      ) : (
        <input
          type={f.type === 'number' ? 'number' : 'text'}
          min={f.min}
          max={f.max}
          value={textValue(f.name)}
          onChange={e => onChange(f.name, e.target.value)}
          className={`${pfInputClass} h-10`}
        />
      )}
      {f.type === 'tags' && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('pf.common.commaSeparated')}</p>}
      {hint}
    </div>
  );
};
