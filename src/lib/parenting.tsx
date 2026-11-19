import { useEffect, useState, type ReactNode } from 'react';
import { supabase } from './supabase';
import { IsEditorScopeContext, isText, type IsEditorScope, type IsRow } from './islamicStudio';

// Life-Stage Parenting (lp_ tables, migrations 090–092): batools edits the
// app's content with the Islamic Studio editors, scoped to this app's bucket,
// its two languages and its own reviewer page. Family data never reaches
// batools; lp_admin_stats() gives counts only.

export const LP_BUCKET = 'life-stage-parenting';

const SCOPE: IsEditorScope = {
  bucket: LP_BUCKET,
  reviewResource: 'PARENTING_REVIEW',
  languages: [
    { code: 'bn', name: 'বাংলা', is_rtl: false, is_default: true, is_active: true, sort_order: 1 },
    { code: 'en', name: 'English', is_rtl: false, is_default: false, is_active: true, sort_order: 2 },
  ],
};

export const LpScope = ({ children }: { children: ReactNode }) => (
  <IsEditorScopeContext.Provider value={SCOPE}>{children}</IsEditorScopeContext.Provider>
);

/** Content that a medical / Islamic reviewer approves before the app shows it, and each table's key column. */
export const LP_REVIEWED_TABLES = [
  { table: 'lp_resources', key: 'id' },
  { table: 'lp_task_templates', key: 'key' },
  { table: 'lp_milestones', key: 'key' },
  { table: 'lp_vaccine_schedules', key: 'key' },
  { table: 'lp_counter_templates', key: 'key' },
] as const;

export const LP_FEATURE_TABS = ['home', 'journey', 'learn', 'health', 'tasks', 'family'] as const;

/**
 * A point on the life-day axis in words: day 0 = birth, a pregnancy is
 * negative (gestation day − 280), planning is before −280.
 */
export function lpDayLabel(day: unknown, t: (key: string) => string): string {
  if (day === null || day === undefined || day === '') return '';
  const d = Number(day);
  if (Number.isNaN(d)) return '';
  if (d < -280) return t('lp.age.planning');
  if (d < 0) return t('lp.age.pregnancyWeek').replace('{n}', String(Math.floor((d + 280) / 7) + 1));
  if (d === 0) return t('lp.age.birth');
  if (d < 14) return t('lp.age.days').replace('{n}', String(d));
  if (d < 91) return t('lp.age.weeks').replace('{n}', String(Math.round(d / 7)));
  if (d < 730) return t('lp.age.months').replace('{n}', String(Math.round(d / 30.4375)));
  return t('lp.age.years').replace('{n}', String(Math.round((d / 365.25) * 10) / 10));
}

/** [min_day, max_day) in words. */
export function lpRangeLabel(row: IsRow, t: (key: string) => string): string {
  const from = lpDayLabel(row.min_day, t);
  const to = lpDayLabel(row.max_day, t);
  if (!from && !to) return t('lp.age.any');
  return `${from || '…'} → ${to || '…'}`;
}

export type LpOption = { value: string; label: string };

type Options = {
  stages: LpOption[];
  ageGroups: (LpOption & { stage: string })[];
  domains: LpOption[];
  categories: (LpOption & { id: string; key: string; parent: string | null })[];
  sources: LpOption[];
  resources: LpOption[];
  vaccines: LpOption[];
  schedules: LpOption[];
};

const EMPTY: Options = { stages: [], ageGroups: [], domains: [], categories: [], sources: [], resources: [], vaccines: [], schedules: [] };

/** Choices for the editors' dropdowns (labels in the batools language). `reload` after a change elsewhere. */
export function useLpOptions(language: string, reload = 0): Options {
  const [options, setOptions] = useState<Options>(EMPTY);
  useEffect(() => {
    let live = true;
    void (async () => {
      const get = async (table: string, columns: string, order = 'sort_order') => {
        const { data } = await supabase.from(table).select(columns).order(order);
        return (data ?? []) as unknown as IsRow[];
      };
      const [stages, ageGroups, domains, categories, sources, resources, vaccines, schedules] = await Promise.all([
        get('lp_stages', 'key, name, number'),
        get('lp_age_groups', 'key, name, stage_key, min_day', 'min_day'),
        get('lp_domains', 'key, name'),
        get('lp_categories', 'id, key, name, parent_id'),
        get('lp_sources', 'key, name', 'name'),
        get('lp_resources', 'slug, title, kind'),
        get('lp_vaccines', 'key, name, short_name'),
        get('lp_vaccine_schedules', 'key, name, country', 'key'),
      ]);
      if (!live) return;
      const name = (r: IsRow, col = 'name') => isText(r[col], language);
      const keyOfId = new Map(categories.map(c => [String(c.id), String(c.key)]));
      setOptions({
        stages: stages.map(s => ({ value: String(s.key), label: `${s.number}. ${name(s)}` })),
        ageGroups: ageGroups.map(a => ({ value: String(a.key), label: name(a), stage: String(a.stage_key) })),
        domains: domains.map(d => ({ value: String(d.key), label: name(d) })),
        categories: categories.map(c => ({
          value: String(c.id), id: String(c.id), key: String(c.key),
          parent: c.parent_id ? keyOfId.get(String(c.parent_id)) ?? null : null,
          label: c.parent_id ? `↳ ${name(c)}` : name(c),
        })),
        sources: sources.map(s => ({ value: String(s.key), label: String(s.name) })),
        resources: resources.map(r => ({ value: String(r.slug), label: `${isText(r.title, language)} (${r.kind})` })),
        vaccines: vaccines.map(v => ({ value: String(v.key), label: `${v.short_name} — ${name(v)}` })),
        schedules: schedules.map(s => ({ value: String(s.key), label: `${name(s)} · ${s.country}` })),
      });
    })();
    return () => { live = false; };
  }, [language, reload]);
  return options;
}

/** Options from fixed values with labels under a translation prefix, e.g. lp.tasks.taskTypes.must_do. */
export const lpChoices = (prefix: string, values: readonly string[]): LpOption[] => values.map(v => ({ value: v, label: `${prefix}.${v}` }));
