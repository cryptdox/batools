import { useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { errorMessage, type PfField, type PfFormValues } from '../../lib/portfolio';
import { Button } from '../ui/Button';

export const pfInputClass =
  'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:border-gray-700 dark:bg-gray-900 dark:text-gray-50';

const LangTag = ({ lang }: { lang: 'EN' | 'BN' }) => (
  <span className="inline-block mr-1.5 px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-[10px] font-bold text-gray-500 dark:text-gray-300 align-middle">
    {lang}
  </span>
);

/** Where fields with `upload` put their files: `<bucket>/<folder>/…` (public). */
export type PfUploadTarget = { bucket: string; folder: string };

type Props = {
  field: PfField;
  values: PfFormValues;
  onChange: (key: string, value: string | boolean) => void;
  upload?: PfUploadTarget;
};

/** Uploads one file and hands back its public URL. Replaced files are left in
 * the bucket: the old URL may still be in use until the form is saved. */
const UploadButton = ({ accept, target, onUploaded }: { accept: string; target: PfUploadTarget; onUploaded: (url: string) => void }) => {
  const { t } = useLanguage();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : 'bin';
      // A fresh name per upload, so browsers and CDNs never serve an old file.
      const path = `${target.folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from(target.bucket).upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      onUploaded(supabase.storage.from(target.bucket).getPublicUrl(path).data.publicUrl);
      toast.success(t('pf.upload.uploaded'));
    } catch (e) {
      console.error(e);
      toast.error(errorMessage(e, t('pf.upload.error')));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <>
      <input ref={input} type="file" accept={accept} className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
      <Button type="button" size="sm" variant="outline" className="h-10 shrink-0" onClick={() => input.current?.click()} disabled={busy}>
        <Upload size={14} className="mr-1.5" />
        {busy ? t('pf.upload.uploading') : t('pf.upload.upload')}
      </Button>
    </>
  );
};

/** Renders one PfField; bilingual kinds render as an EN | BN pair. */
export const PfFieldInput = ({ field: f, values, onChange, upload }: Props) => {
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
        <textarea value={textValue(f.name)} onChange={e => onChange(f.name, e.target.value)} rows={f.rows ?? 4} className={pfInputClass} />
      ) : f.type === 'select' ? (
        <select value={textValue(f.name)} onChange={e => onChange(f.name, e.target.value)} className={`${pfInputClass} h-10`}>
          {f.allowEmpty && <option value="">—</option>}
          {f.options?.map(o => <option key={o.value} value={o.value}>{t(o.label)}</option>)}
        </select>
      ) : f.upload && upload ? (
        <div className="flex items-center gap-2">
          {f.upload.startsWith('image') && textValue(f.name) && (
            <img src={textValue(f.name)} alt="" className="h-10 w-10 rounded object-cover border border-gray-200 dark:border-gray-700 shrink-0" />
          )}
          <input value={textValue(f.name)} onChange={e => onChange(f.name, e.target.value)} className={`${pfInputClass} h-10`} />
          <UploadButton accept={f.upload} target={upload} onUploaded={url => onChange(f.name, url)} />
        </div>
      ) : (
        <input
          type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
          step={f.type === 'number' ? 'any' : undefined}
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
