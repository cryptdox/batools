import { useCallback, useMemo, useState } from 'react';
import { useLanguage } from '../../lib/LanguageContext';
import type { AcDomain, AcGraph } from '../../lib/achievementCycle';
import { acSelectClass } from './AcUi';

/** Level filter choices, in this order. */
export const LEVELS = ['subject', 'general', 'mixed', 'area'] as const;
export type Level = (typeof LEVELS)[number];
/** Select value meaning "all subjects" / "all levels". */
export const ALL = '__all';
/** Domain select value for topics in no domain at all. */
export const UNASSIGNED = '__unassigned';

/**
 * Domain → subject → level filter over topics, shared by the Topics page and
 * the topic form's parent picker. Domain has no "all" (one is always chosen,
 * else the first); subject and level have "all" and default to it.
 */
export function useTopicFilter(graph: AcGraph, domains: AcDomain[], init: { domainId?: string | null; subjectId?: string | null; exclude?: Set<string> } = {}) {
  const [domainFilter, setDomain] = useState(init.domainId ?? '');
  const [subjectFilter, setSubject] = useState(init.subjectId ?? ALL);
  const [level, setLevel] = useState<Level | typeof ALL>(ALL);
  const exclude = init.exclude;

  // Topics in no domain (e.g. restored after their parent was deleted) can be picked as "Unassigned".
  const unassigned = useMemo(() => graph.unassignedTopics(), [graph]);
  const activeDomain = domainFilter === UNASSIGNED
    ? UNASSIGNED
    : domains.find(d => d.id === domainFilter)?.id ?? domains[0]?.id ?? (unassigned.size ? UNASSIGNED : '');
  const domainSet = useMemo(() => {
    if (activeDomain === UNASSIGNED) return unassigned;
    return activeDomain ? graph.domainTopics(activeDomain) : null;
  }, [graph, activeDomain, unassigned]);
  const subjects = graph.roots.filter(r => (!domainSet || domainSet.has(r.id)) && !exclude?.has(r.id));
  // A chosen subject that is not in the current domain falls back to all.
  const activeSubject = subjects.find(s => s.id === subjectFilter)?.id ?? '';
  const subjectSet = useMemo(() => (activeSubject ? graph.subtree(activeSubject) : null), [graph, activeSubject]);

  const matches = useCallback((id: string) =>
    (subjectSet ? subjectSet.has(id) : !domainSet || domainSet.has(id)) &&
    (level === ALL || graph.levelOf(id) === level), [graph, subjectSet, domainSet, level]);

  return {
    activeDomain, activeSubject, level, subjects, matches, unassignedCount: unassigned.size,
    subjectValue: activeSubject || ALL,
    setDomain, setSubject, setLevel,
    /** Changes whenever the filter does (for resetting pages). */
    key: `${activeDomain}|${activeSubject}|${level}`,
  };
}

export type TopicFilter = ReturnType<typeof useTopicFilter>;

/** The three filter selects. */
export const AcTopicFilterSelects = ({ filter: f, domains, className = '' }: { filter: TopicFilter; domains: AcDomain[]; className?: string }) => {
  const { t } = useLanguage();
  const cls = `${acSelectClass} h-9 ${className}`;
  return (
    <>
      <select value={f.activeDomain} onChange={e => f.setDomain(e.target.value)} disabled={domains.length === 0 && f.unassignedCount === 0} className={cls} aria-label={t('ac.domains')}>
        {domains.length === 0 && f.unassignedCount === 0 && <option value="">{t('ac.domain.none')}</option>}
        {domains.map(d => <option key={d.id} value={d.id}>{d.name}{d.is_archived ? ` (${t('ac.archive.archived')})` : ''}</option>)}
        {(f.unassignedCount > 0 || f.activeDomain === UNASSIGNED) && (
          <option value={UNASSIGNED}>{t('ac.domain.unassigned')} ({f.unassignedCount})</option>
        )}
      </select>
      <select value={f.subjectValue} onChange={e => f.setSubject(e.target.value)} className={cls} aria-label={t('ac.level.subject')}>
        <option value={ALL}>{t('ac.allSubjects')}</option>
        {f.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <select value={f.level} onChange={e => f.setLevel(e.target.value as Level | typeof ALL)} className={cls} aria-label={t('ac.topics.level')}>
        <option value={ALL}>{t('ac.allLevels')}</option>
        {LEVELS.map(l => <option key={l} value={l}>{t(`ac.level.${l}`)}</option>)}
      </select>
    </>
  );
};
