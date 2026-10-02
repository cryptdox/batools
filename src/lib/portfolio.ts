import { useAuth } from './AuthContext';

// Portfolio (pf_) rows belong to the signed-in IAM user, like the tm_ tables.
// The public site reads the rows of one fixed user id (its own .env).
export function usePfUserId(): string | null {
  return useAuth().user?.userId ?? null;
}

/** Supabase errors are plain objects, not Error instances; keep their message. */
export const errorMessage = (e: unknown, fallback: string): string => {
  const message = e && typeof e === 'object' && 'message' in e ? e.message : null;
  return typeof message === 'string' && message ? message : fallback;
};

export type PfRow = Record<string, unknown> & { id: string };

/**
 * One editable thing on a pf_ row. `name` is the column, except for the
 * bilingual kinds, where it is the base of a `<name>_en` / `<name>_bn` pair.
 *
 *   text / textarea  — one column, one string
 *   i18n             — `_en`/`_bn` strings, shown side by side
 *   i18nList         — `_en`/`_bn` TEXT[], edited one item per line
 *   tags             — one TEXT[], edited comma separated (tech names)
 *   number / boolean / select — as named
 */
export type PfField = {
  name: string;
  /** Translation key. */
  label: string;
  type: 'text' | 'textarea' | 'i18n' | 'i18nList' | 'tags' | 'number' | 'boolean' | 'select';
  /** i18n only: render as a textarea instead of an input. */
  multiline?: boolean;
  required?: boolean;
  /** Translation key shown under the field. */
  hint?: string;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  /** Value a new row starts with (in form shape). */
  initial?: string | boolean;
};

/** The form keeps everything as strings/booleans; this is the column → form map. */
export type PfFormValues = Record<string, string | boolean>;

const linesOf = (v: unknown) => (Array.isArray(v) ? v.join('\n') : '');
const fromLines = (s: string) => s.split('\n').map(x => x.trim()).filter(Boolean);
const fromCommas = (s: string) => s.split(',').map(x => x.trim()).filter(Boolean);
const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));

export function formFromRow(fields: PfField[], row: Record<string, unknown> | null): PfFormValues {
  const values: PfFormValues = {};
  for (const f of fields) {
    switch (f.type) {
      case 'i18n':
        values[`${f.name}_en`] = row ? str(row[`${f.name}_en`]) : str(f.initial);
        values[`${f.name}_bn`] = row ? str(row[`${f.name}_bn`]) : str(f.initial);
        break;
      case 'i18nList':
        values[`${f.name}_en`] = row ? linesOf(row[`${f.name}_en`]) : '';
        values[`${f.name}_bn`] = row ? linesOf(row[`${f.name}_bn`]) : '';
        break;
      case 'tags':
        values[f.name] = row && Array.isArray(row[f.name]) ? (row[f.name] as string[]).join(', ') : '';
        break;
      case 'boolean':
        values[f.name] = row ? !!row[f.name] : f.initial === true;
        break;
      default:
        values[f.name] = row ? str(row[f.name]) : str(f.initial);
    }
  }
  return values;
}

/** Form → columns. Empty optional strings are stored as NULL, not ''. */
export function rowFromForm(fields: PfField[], values: PfFormValues): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const text = (v: string | boolean, required?: boolean) => {
    const s = String(v).trim();
    return s || required ? s : null;
  };
  for (const f of fields) {
    switch (f.type) {
      case 'i18n':
        // The _bn half is NOT NULL wherever _en is required, so it falls back to ''.
        row[`${f.name}_en`] = text(values[`${f.name}_en`], f.required);
        row[`${f.name}_bn`] = text(values[`${f.name}_bn`], f.required);
        break;
      case 'i18nList':
        row[`${f.name}_en`] = fromLines(String(values[`${f.name}_en`]));
        row[`${f.name}_bn`] = fromLines(String(values[`${f.name}_bn`]));
        break;
      case 'tags':
        row[f.name] = fromCommas(String(values[f.name]));
        break;
      case 'boolean':
        row[f.name] = !!values[f.name];
        break;
      case 'number': {
        const s = String(values[f.name]).trim();
        row[f.name] = s === '' ? null : Number(s);
        break;
      }
      default:
        row[f.name] = text(values[f.name], f.required);
    }
  }
  return row;
}

/** Required fields filled in (for i18n kinds, the English half). */
export function isFormComplete(fields: PfField[], values: PfFormValues): boolean {
  return fields.every(f => {
    if (!f.required) return true;
    const key = f.type === 'i18n' || f.type === 'i18nList' ? `${f.name}_en` : f.name;
    return String(values[key] ?? '').trim() !== '';
  });
}

/** Icon keys the portfolio site knows how to draw. */
export const PF_ICON_OPTIONS = ['cpu', 'code', 'sparkles', 'globe', 'database', 'cloud', 'wrench']
  .map(value => ({ value, label: value }));
