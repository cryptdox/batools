import { useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { errorMessage, uploadFileName } from '../../lib/portfolio';
import { useIsBucket, useIsLanguages, type IsI18n, type IsRow } from '../../lib/islamicStudio';
import { Button } from '../ui/Button';
import { pfInputClass } from '../portfolio/PfFieldInput';

/**
 * One editable thing on an is_ row. `name` is the column, except `virtual`
 * fields, which only reach the editor's afterSave (e.g. a dua's categories).
 */
export type IsField = {
  name: string;
  /** Translation key. */
  label: string;
  type: 'text' | 'textarea' | 'i18n' | 'i18nArea' | 'arabic' | 'number' | 'boolean' | 'select' | 'multi' | 'date' | 'datetime' | 'tags' | 'json' | 'upload';
  required?: boolean;
  /** Translation key. */
  hint?: string;
  options?: { value: string; label: string }[];
  /** select: offer an empty choice (saved as NULL). */
  allowEmpty?: boolean;
  /** upload: accepted file types, e.g. 'image/*' or 'audio/*'. */
  accept?: string;
  virtual?: boolean;
  /** Shown only when this returns true for the form's values. */
  when?: (values: IsFormValues) => boolean;
};

/** Form state: i18n fields are kept per language as `<name>.<code>`. */
export type IsFormValues = Record<string, string | boolean>;

const asText = (v: unknown) => (v === null || v === undefined ? '' : String(v));

/** Two-way between a row and the form. */
export function isFormFromRow(fields: IsField[], row: IsRow | null, languages: string[]): IsFormValues {
  const values: IsFormValues = {};
  for (const f of fields) {
    const v = row?.[f.name];
    if (f.type === 'i18n' || f.type === 'i18nArea') {
      const map = (v && typeof v === 'object' ? v : {}) as IsI18n;
      for (const lang of new Set([...languages, ...Object.keys(map)])) values[`${f.name}.${lang}`] = map[lang] ?? '';
    } else if (f.type === 'boolean') {
      values[f.name] = row ? v === true : f.name === 'is_active';
    } else if (f.type === 'tags' || f.type === 'multi') {
      values[f.name] = Array.isArray(v) ? v.join(',') : asText(v);
    } else if (f.type === 'json') {
      values[f.name] = v === null || v === undefined ? '' : JSON.stringify(v, null, 2);
    } else if (f.type === 'datetime') {
      // datetime-local wants local time without a zone.
      const d = v ? new Date(String(v)) : null;
      values[f.name] = d && !Number.isNaN(d.getTime())
        ? new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
        : '';
    } else {
      values[f.name] = asText(v);
    }
  }
  return values;
}

/** The row columns from the form (virtual fields left out); throws on invalid JSON. */
export function isRowFromForm(fields: IsField[], values: IsFormValues): IsRow {
  const row: IsRow = {};
  for (const f of fields) {
    if (f.virtual || (f.when && !f.when(values))) continue;
    const raw = values[f.name];
    const text = typeof raw === 'string' ? raw.trim() : '';
    if (f.type === 'i18n' || f.type === 'i18nArea') {
      const map: IsI18n = {};
      for (const [key, v] of Object.entries(values)) {
        if (key.startsWith(`${f.name}.`) && typeof v === 'string' && v.trim()) map[key.slice(f.name.length + 1)] = v.trim();
      }
      row[f.name] = map;
    } else if (f.type === 'boolean') {
      row[f.name] = raw === true;
    } else if (f.type === 'number') {
      row[f.name] = text === '' ? null : Number(text);
    } else if (f.type === 'tags' || f.type === 'multi') {
      row[f.name] = text ? text.split(',').map(s => s.trim()).filter(Boolean) : [];
    } else if (f.type === 'json') {
      row[f.name] = text ? JSON.parse(text) : {};
    } else if (f.type === 'datetime') {
      row[f.name] = text ? new Date(text).toISOString() : null;
    } else {
      row[f.name] = text === '' ? null : text;
    }
  }
  return row;
}

export function isFormComplete(fields: IsField[], values: IsFormValues): boolean {
  return fields.every(f => {
    if (!f.required || (f.when && !f.when(values))) return true;
    if (f.type === 'i18n' || f.type === 'i18nArea') {
      return Object.entries(values).some(([k, v]) => k.startsWith(`${f.name}.`) && typeof v === 'string' && v.trim());
    }
    if (f.type === 'boolean') return true;
    return String(values[f.name] ?? '').trim() !== '';
  });
}

const LangTag = ({ code }: { code: string }) => (
  <span className="inline-block mr-1.5 px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-[10px] font-bold uppercase text-gray-500 dark:text-gray-300 align-middle">
    {code}
  </span>
);

/** Uploads into the editor's bucket (islamic-studio unless scoped) under `folder` and hands back the public URL. */
const UploadButton = ({ accept, folder, onUploaded }: { accept: string; folder: string; onUploaded: (url: string) => void }) => {
  const { t } = useLanguage();
  const input = useRef<HTMLInputElement>(null);
  const bucket = useIsBucket();
  const [busy, setBusy] = useState(false);
  const upload = async (file: File) => {
    setBusy(true);
    try {
      const path = `${folder}/${uploadFileName(file)}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      onUploaded(supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl);
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

type Props = {
  field: IsField;
  values: IsFormValues;
  onChange: (key: string, value: string | boolean) => void;
  /** Storage folder for uploads (the table name). */
  folder: string;
};

export const IsFieldInput = ({ field: f, values, onChange, folder }: Props) => {
  const { t } = useLanguage();
  const languages = useIsLanguages();
  const label = (
    <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
      {t(f.label)}{f.required && <span className="text-danger"> *</span>}
    </span>
  );
  const hint = f.hint && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t(f.hint)}</p>;
  const text = (key: string) => String(values[key] ?? '');

  if (f.type === 'boolean') {
    return (
      <label className="flex items-start gap-2 cursor-pointer">
        <input type="checkbox" checked={!!values[f.name]} onChange={e => onChange(f.name, e.target.checked)} className="w-4 h-4 mt-0.5 accent-primary" />
        <span className="text-sm">
          <span className="font-medium text-gray-700 dark:text-gray-300">{t(f.label)}</span>
          {f.hint && <span className="block text-xs text-gray-500 dark:text-gray-400">{t(f.hint)}</span>}
        </span>
      </label>
    );
  }

  if (f.type === 'i18n' || f.type === 'i18nArea') {
    return (
      <div>
        {label}
        <div className="grid sm:grid-cols-2 gap-3">
          {languages.map(lang => {
            const key = `${f.name}.${lang.code}`;
            const dir = lang.is_rtl ? 'rtl' : 'ltr';
            return (
              <div key={lang.code}>
                <span className="block mb-1"><LangTag code={lang.code} /></span>
                {f.type === 'i18nArea' ? (
                  <textarea dir={dir} value={text(key)} onChange={e => onChange(key, e.target.value)} rows={3} className={pfInputClass} />
                ) : (
                  <input dir={dir} value={text(key)} onChange={e => onChange(key, e.target.value)} className={`${pfInputClass} h-10`} />
                )}
              </div>
            );
          })}
        </div>
        {hint}
      </div>
    );
  }

  return (
    <div>
      {label}
      {f.type === 'textarea' || f.type === 'json' ? (
        <textarea
          value={text(f.name)}
          onChange={e => onChange(f.name, e.target.value)}
          rows={f.type === 'json' ? 6 : 4}
          className={`${pfInputClass} ${f.type === 'json' ? 'font-mono text-xs' : ''}`}
        />
      ) : f.type === 'arabic' ? (
        <textarea
          dir="rtl"
          lang="ar"
          value={text(f.name)}
          onChange={e => onChange(f.name, e.target.value)}
          rows={3}
          className={`${pfInputClass} text-2xl leading-loose`}
          style={{ fontFamily: '"Amiri", "Scheherazade New", "Noto Naskh Arabic", serif' }}
        />
      ) : f.type === 'select' ? (
        <select value={text(f.name)} onChange={e => onChange(f.name, e.target.value)} className={`${pfInputClass} h-10`}>
          {f.allowEmpty && <option value="">—</option>}
          {f.options?.map(o => <option key={o.value} value={o.value}>{t(o.label)}</option>)}
        </select>
      ) : f.type === 'multi' ? (
        <div className="flex flex-wrap gap-x-5 gap-y-2 py-1">
          {f.options?.map(o => {
            const picked = text(f.name).split(',').filter(Boolean);
            const on = picked.includes(o.value);
            return (
              <label key={o.value} className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => onChange(f.name, (on ? picked.filter(v => v !== o.value) : [...picked, o.value]).join(','))}
                  className="w-4 h-4 accent-primary"
                />
                {t(o.label)}
              </label>
            );
          })}
        </div>
      ) : f.type === 'upload' ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {f.accept?.startsWith('image') && text(f.name) && (
              <img src={text(f.name)} alt="" className="h-10 w-10 rounded object-cover border border-gray-200 dark:border-gray-700 shrink-0" />
            )}
            <input value={text(f.name)} onChange={e => onChange(f.name, e.target.value)} placeholder="https://" className={`${pfInputClass} h-10`} />
            <UploadButton accept={f.accept ?? '*/*'} folder={folder} onUploaded={url => onChange(f.name, url)} />
          </div>
          {/* Audio: listen before saving (an uploaded file or a pasted link). */}
          {f.accept?.startsWith('audio') && /^https:\/\//.test(text(f.name)) && (
            <audio key={text(f.name)} controls preload="none" src={text(f.name)} className="h-10 w-full" />
          )}
        </div>
      ) : (
        <input
          type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : f.type === 'datetime' ? 'datetime-local' : 'text'}
          step={f.type === 'number' ? 'any' : undefined}
          value={text(f.name)}
          onChange={e => onChange(f.name, e.target.value)}
          className={`${pfInputClass} h-10`}
        />
      )}
      {f.type === 'tags' && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('pf.common.commaSeparated')}</p>}
      {hint}
    </div>
  );
};
