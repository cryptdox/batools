import { useAuth } from './AuthContext';
import { supabase } from './supabase';

// Portfolio (pf_) rows belong to the signed-in IAM user, like the tm_ tables.
// The public site reads the rows of one fixed user id (its own .env).
export function usePfUserId(): string | null {
  return useAuth().user?.userId ?? null;
}

/**
 * A storage name for an uploaded file: its own name made URL-safe (accents
 * dropped, other symbols as `-`) plus a short unique tail, so links stay
 * readable and a replaced file is never served from a cache.
 */
export function uploadFileName(file: File, fallback = 'file'): string {
  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : 'bin';
  const base = file.name.replace(/\.[^.]*$/, '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || fallback;
  return `${base}-${Date.now().toString(36)}.${ext}`;
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
 *   multi            — one array column, picked from `options` (checkboxes)
 *   number / boolean / select / date — as named
 */
export type PfField = {
  name: string;
  /** Translation key. */
  label: string;
  type: 'text' | 'textarea' | 'i18n' | 'i18nList' | 'tags' | 'multi' | 'number' | 'boolean' | 'select' | 'date';
  /** i18n only: render as a textarea instead of an input. */
  multiline?: boolean;
  /** i18n only: a rich text editor per language; the value is stored as HTML. */
  rich?: boolean;
  required?: boolean;
  /** Translation key shown under the field. */
  hint?: string;
  options?: { value: string; label: string }[];
  /** select only: offers a blank choice, stored as NULL. */
  allowEmpty?: boolean;
  /** textarea only: visible rows (default 4). */
  rows?: number;
  /** text only: adds an upload button that fills in the file's public URL.
   *  The value is the input's `accept`; the editor supplies the bucket. */
  upload?: string;
  min?: number;
  max?: number;
  /** Value a new row starts with (in form shape). */
  initial?: string | boolean;
  /** tags only: pick from the Tech Stack skills (new names allowed). */
  skillPicker?: boolean;
  /** Shown (and saved) only while this holds; a hidden field is stored as NULL. */
  showIf?: (values: PfFormValues) => boolean;
  /** text only: a "Fetch details" button that reads the link's preview and fills
   *  these (form keys) when they are still empty. */
  fetchPreview?: { title?: string; description?: string; image?: string; date?: string };
};

/** The fields of a form that apply to its current values. */
export const shownFields = (fields: PfField[], values: PfFormValues) => fields.filter(f => !f.showIf || f.showIf(values));

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
      case 'multi':
        values[f.name] = row && Array.isArray(row[f.name]) ? (row[f.name] as string[]).join(',') : '';
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
      case 'multi':
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

/** Form → columns, with fields hidden by `showIf` cleared (NULL, [] or false). */
export function rowFromShownForm(fields: PfField[], values: PfFormValues): Record<string, unknown> {
  const row = rowFromForm(fields, values);
  for (const f of fields) {
    if (!f.showIf || f.showIf(values)) continue;
    const cols = f.type === 'i18n' || f.type === 'i18nList' ? [`${f.name}_en`, `${f.name}_bn`] : [f.name];
    for (const c of cols) row[c] = f.type === 'tags' || f.type === 'multi' || f.type === 'i18nList' ? [] : f.type === 'boolean' ? false : null;
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

/** The owner's portfolio versions (063), for tagging rows. Empty before 063 or before any version exists. */
export async function loadPfVersions(userId: string): Promise<{ value: string; label: string }[]> {
  const { data, error } = await supabase.from('pf_versions').select('id, name_en, is_active').eq('user_id', userId).order('sort_order');
  if (error) return [];
  return (data ?? []).map(v => ({ value: v.id as string, label: `${v.name_en}${v.is_active ? '' : ' (inactive)'}` }));
}

/** Icon keys the portfolio site knows how to draw. */
export const PF_ICON_OPTIONS = ['cpu', 'code', 'sparkles', 'globe', 'database', 'cloud', 'wrench']
  .map(value => ({ value, label: value }));
