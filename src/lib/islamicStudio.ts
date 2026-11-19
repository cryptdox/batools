import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';
import { useAccess } from './permissions';

// Islamic Studio (is_ tables, migrations 074–079): batools controls the
// Android app com.cryptdox.islamicstudio. The app reads with the anon key and
// sees only what is switched on and approved; batools writes with its IAM
// token (same database guard as the music tables).

export const IS_BUCKET = 'islamic-studio';

/** Text shown in the app: one value per language code, e.g. {"en": "...", "bn": "..."}. */
export type IsI18n = Record<string, string>;

export type IsLanguage = { code: string; name: string; is_rtl: boolean; is_default: boolean; is_active: boolean; sort_order: number };

export type IsRow = Record<string, unknown>;

/** Languages offered in every multilingual field; until they load, English and Bangla. */
const FALLBACK_LANGUAGES: IsLanguage[] = [
  { code: 'en', name: 'English', is_rtl: false, is_default: false, is_active: true, sort_order: 1 },
  { code: 'bn', name: 'বাংলা', is_rtl: false, is_default: true, is_active: true, sort_order: 2 },
];

let languagesPromise: Promise<IsLanguage[]> | null = null;

export function loadIsLanguages(force = false): Promise<IsLanguage[]> {
  if (!languagesPromise || force) {
    languagesPromise = Promise.resolve(
      supabase.from('is_languages').select('*').eq('is_active', true).order('sort_order'),
    ).then(({ data, error }) => {
      if (error || !data?.length) {
        languagesPromise = null;
        return FALLBACK_LANGUAGES;
      }
      return data as IsLanguage[];
    });
  }
  return languagesPromise;
}

/**
 * Another app's menu (Life-Stage Parenting) reuses these editors inside an
 * IsEditorScope: its own storage bucket, its own languages and the IAM page
 * whose UPDATE makes someone a reviewer. Outside one, Islamic Studio's.
 */
export type IsEditorScope = { bucket: string; languages: IsLanguage[]; reviewResource: string };
export const IsEditorScopeContext = createContext<IsEditorScope | null>(null);

export function useIsLanguages(): IsLanguage[] {
  const scope = useContext(IsEditorScopeContext);
  const [languages, setLanguages] = useState<IsLanguage[]>(FALLBACK_LANGUAGES);
  useEffect(() => { if (!scope) void loadIsLanguages().then(setLanguages); }, [scope]);
  return scope?.languages ?? languages;
}

/** Where uploads go. */
export function useIsBucket(): string {
  return useContext(IsEditorScopeContext)?.bucket ?? IS_BUCKET;
}

/** The value in `lang`, else English, else Bangla, else any. */
export function isText(value: unknown, lang: string): string {
  if (!value || typeof value !== 'object') return typeof value === 'string' ? value : '';
  const map = value as IsI18n;
  return map[lang] || map.en || map.bn || Object.values(map).find(Boolean) || '';
}

/** Tables whose rows need a reviewer's approval before the app shows them. */
export const IS_REVIEWED_TABLES = ['is_duas', 'is_dhikr_presets', 'is_content_packs', 'is_quizzes', 'is_zakat_settings', 'is_learn_units', 'is_media_items', 'is_books'] as const;

export type IsReviewStatus = 'draft' | 'in_review' | 'approved' | 'rejected';

/** Who may approve religious content: UPDATE on the Review page in IAM. */
export function useIsReviewer(): boolean {
  const { has } = useAccess();
  const resource = useContext(IsEditorScopeContext)?.reviewResource ?? 'ISLAMIC_STUDIO_REVIEW';
  return has(resource, 'UPDATE') || has(resource, 'UPDATE_ALL');
}

export function useIsUserId(): string | null {
  return useAuth().user?.userId ?? null;
}

export const IS_FEATURE_STATUSES = ['hidden', 'coming_soon', 'beta', 'active', 'maintenance'] as const;
export type IsFeatureStatus = (typeof IS_FEATURE_STATUSES)[number];

/** Turns database errors into the editor's words where we know them. */
export function isErrorKey(e: unknown): string | null {
  const message = e && typeof e === 'object' && 'message' in e ? String(e.message) : '';
  if (message.includes('is_features_built')) return 'is.features.notBuilt';
  if (message.includes('is_learn_items_data_ok')) return 'is.academy.badItem';
  if (message.includes('duplicate key')) return 'is.common.duplicate';
  if (message.includes('row-level security')) return 'is.common.notAllowed';
  return null;
}
