import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';
import { errorMessage } from './portfolio';

// Achievement Cycle (ac_) rows belong to the signed-in IAM user (`user_id`),
// like the tm_ / pf_ tables. Rules that must always hold (no loops, achieved
// never above total, cycle cascades, rollups) live in migration 032; pages
// call its functions instead of re-implementing them.

export type CycleKind = 'new' | 'revise' | 'practice';
export type CycleStatus = 'backlog' | 'todo' | 'hold' | 'in_progress' | 'complete' | 'cancel';
export type LinkRole = 'general' | 'area';

/** Board order. Backlog = not planned yet (where new cycles start). */
export const STATUSES: CycleStatus[] = ['backlog', 'todo', 'hold', 'in_progress', 'complete', 'cancel'];
export const KINDS: CycleKind[] = ['new', 'revise', 'practice'];

export type AcDomainType = { id: string; name: string; description: string | null; color: string; sort_order: number };
export type AcDomain = {
  id: string; name: string; description: string | null; color: string; sort_order: number;
  type_id: string | null; is_archived: boolean; archived_at: string | null;
};
export type AcTopic = {
  id: string; name: string; description: string | null; story_point_description: string | null;
  default_points: number; is_milestone: boolean; created_at: string; updated_at: string;
  is_archived: boolean; archived_at: string | null;
  /** Milestone schedule: weekdays (0 = Sunday … 6 = Saturday) and specific dates (yyyy-MM-dd). */
  schedule_weekdays: number[]; schedule_dates: string[];
};
export type AcTopicDomain = { id: string; topic_id: string; domain_id: string };
export type AcLink = { id: string; parent_id: string; child_id: string; role: LinkRole | null; sort_order: number };
export type AcCycle = {
  id: string; topic_id: string; kind: CycleKind; round: number; total_points: number; achieved_points: number;
  status: CycleStatus; sort_order: number; started_at: string | null; completed_at: string | null; updated_at: string;
};
export type AcRollup = {
  topic_id: string; kind: CycleKind; round: number; own_total: number; own_achieved: number; own_status: CycleStatus | null;
  total: number; achieved: number; topics: number; completed_topics: number;
};
export type AcDomainRollup = { domain_id: string; kind: CycleKind; round: number; total: number; achieved: number; topics: number; completed_topics: number };
export type AcLog = { id: string; cycle_id: string; delta: number; achieved_after: number; comment_html: string | null; created_at: string };

/** A cycle of the whole learning plan: New, Revise 2, Practice 1… */
export type CycleRef = { kind: CycleKind; round: number };

export const cycleKey = (c: CycleRef) => `${c.kind}:${c.round}`;
export const parseCycleKey = (k: string): CycleRef => {
  const [kind, round] = k.split(':');
  return { kind: kind as CycleKind, round: Number(round) };
};
export const NEW_CYCLE: CycleRef = { kind: 'new', round: 0 };

/** Translation-free label; pages prefix it with t('ac.kinds.<kind>'). */
export const cycleLabel = (c: CycleRef, t: (k: string) => string) =>
  c.kind === 'new' ? t('ac.kinds.new') : `${t(`ac.kinds.${c.kind}`)} ${c.round}`;

export const percent = (achieved: number, total: number) => (total > 0 ? Math.round((achieved / total) * 100) : 0);

export function useAcUserId(): string | null {
  return useAuth().user?.userId ?? null;
}

const ARCHIVED_KEY = 'ac-show-archived';
const ARCHIVED_EVENT = 'ac-show-archived-change';

/** The "show archived" switch, shared by every Achievement Cycle page and remembered in this browser. */
export function useShowArchived(): [boolean, (v: boolean) => void] {
  const read = () => { try { return localStorage.getItem(ARCHIVED_KEY) === 'true'; } catch { return false; } };
  const [value, setValue] = useState(read);
  useEffect(() => {
    const sync = () => setValue(read());
    window.addEventListener(ARCHIVED_EVENT, sync);
    return () => window.removeEventListener(ARCHIVED_EVENT, sync);
  }, []);
  const set = (v: boolean) => {
    try { localStorage.setItem(ARCHIVED_KEY, String(v)); } catch { /* per-browser convenience only */ }
    setValue(v);
    window.dispatchEvent(new Event(ARCHIVED_EVENT));
  };
  return [value, set];
}

/**
 * Everything of the signed-in user's achievement plan, plus every cycle's
 * rollup. Archived domains / topics (and what hangs off them) are left out
 * unless "show archived" is on; rollups follow the same switch.
 */
export function useAcData() {
  const userId = useAcUserId();
  const [showArchived, setShowArchived] = useShowArchived();
  const [allDomains, setDomains] = useState<AcDomain[]>([]);
  const [allTopics, setTopics] = useState<AcTopic[]>([]);
  const [allTopicDomains, setTopicDomains] = useState<AcTopicDomain[]>([]);
  const [allLinks, setLinks] = useState<AcLink[]>([]);
  const [allCycles, setCycles] = useState<AcCycle[]>([]);
  const [domainTypes, setDomainTypes] = useState<AcDomainType[]>([]);
  const [rollups, setRollups] = useState<AcRollup[]>([]);
  const [domainRollups, setDomainRollups] = useState<AcDomainRollup[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!userId) return;
    const [d, t, td, l, c, ty, r, dr] = await Promise.all([
      supabase.from('ac_domains').select('*').eq('user_id', userId).order('sort_order').order('name'),
      supabase.from('ac_topics').select('*').eq('user_id', userId).order('name'),
      supabase.from('ac_topic_domains').select('id, topic_id, domain_id').eq('user_id', userId),
      supabase.from('ac_topic_links').select('id, parent_id, child_id, role, sort_order').eq('user_id', userId),
      supabase.from('ac_cycles').select('*').eq('user_id', userId).order('sort_order').order('updated_at', { ascending: false }),
      supabase.from('ac_domain_types').select('*').eq('user_id', userId).order('sort_order').order('name'),
      supabase.rpc('ac_rollup', { p_user_id: userId, p_include_archived: showArchived }),
      supabase.rpc('ac_domain_rollup', { p_user_id: userId, p_include_archived: showArchived }),
    ]);
    const failed = d.error ?? t.error ?? td.error ?? l.error ?? c.error ?? ty.error ?? r.error ?? dr.error;
    if (failed) toast.error(errorMessage(failed, 'Could not load achievement data'));
    setDomains((d.data ?? []) as AcDomain[]);
    setTopics((t.data ?? []) as AcTopic[]);
    setTopicDomains((td.data ?? []) as AcTopicDomain[]);
    setLinks((l.data ?? []) as AcLink[]);
    setCycles((c.data ?? []) as AcCycle[]);
    setDomainTypes((ty.data ?? []) as AcDomainType[]);
    // bigint columns arrive as numbers or strings depending on size; normalise.
    setRollups(((r.data ?? []) as AcRollup[]).map(x => ({
      ...x, own_total: +x.own_total, own_achieved: +x.own_achieved, total: +x.total, achieved: +x.achieved,
      topics: +x.topics, completed_topics: +x.completed_topics,
    })));
    setDomainRollups(((dr.data ?? []) as AcDomainRollup[]).map(x => ({
      ...x, total: +x.total, achieved: +x.achieved, topics: +x.topics, completed_topics: +x.completed_topics,
    })));
    setLoading(false);
  }, [userId, showArchived]);

  useEffect(() => { void reload(); }, [reload]);

  // What the pages see: archived things only when the switch is on.
  const domains = useMemo(() => allDomains.filter(x => showArchived || !x.is_archived), [allDomains, showArchived]);
  const topics = useMemo(() => allTopics.filter(x => showArchived || !x.is_archived), [allTopics, showArchived]);
  const { links, topicDomains, cycles } = useMemo(() => {
    const t = new Set(topics.map(x => x.id));
    const d = new Set(domains.map(x => x.id));
    return {
      links: allLinks.filter(l => t.has(l.parent_id) && t.has(l.child_id)),
      topicDomains: allTopicDomains.filter(x => t.has(x.topic_id) && d.has(x.domain_id)),
      cycles: allCycles.filter(c => t.has(c.topic_id)),
    };
  }, [topics, domains, allLinks, allTopicDomains, allCycles]);

  const graph = useMemo(() => buildGraph(topics, links, topicDomains), [topics, links, topicDomains]);

  /** Every cycle that exists anywhere, New first then by kind and round. */
  const cycleRefs = useMemo(() => {
    const seen = new Map<string, CycleRef>([[cycleKey(NEW_CYCLE), NEW_CYCLE]]);
    for (const c of cycles) seen.set(cycleKey(c), { kind: c.kind, round: c.round });
    return [...seen.values()].sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind) || a.round - b.round);
  }, [cycles]);

  const rollupOf = useCallback((topicId: string, c: CycleRef) =>
    rollups.find(r => r.topic_id === topicId && r.kind === c.kind && r.round === c.round) ?? null, [rollups]);

  const domainRollupOf = useCallback((domainId: string, c: CycleRef) =>
    domainRollups.find(r => r.domain_id === domainId && r.kind === c.kind && r.round === c.round) ?? null, [domainRollups]);

  return {
    userId, loading, reload, domains, topics, topicDomains, links, cycles, rollups, graph, cycleRefs, rollupOf, domainRollupOf,
    domainTypes, showArchived, setShowArchived,
  };
}

export type AcGraph = ReturnType<typeof buildGraph>;

export function buildGraph(topics: AcTopic[], links: AcLink[], topicDomains: AcTopicDomain[]) {
  const byId = new Map(topics.map(t => [t.id, t]));
  const childLinks = new Map<string, AcLink[]>();
  const parentLinks = new Map<string, AcLink[]>();
  for (const l of links) {
    if (!byId.has(l.parent_id) || !byId.has(l.child_id)) continue;
    (childLinks.get(l.parent_id) ?? childLinks.set(l.parent_id, []).get(l.parent_id)!).push(l);
    (parentLinks.get(l.child_id) ?? parentLinks.set(l.child_id, []).get(l.child_id)!).push(l);
  }
  const name = (id: string) => byId.get(id)?.name ?? '';
  for (const list of childLinks.values()) list.sort((a, b) => a.sort_order - b.sort_order || name(a.child_id).localeCompare(name(b.child_id)));

  const isSubject = (id: string) => !(parentLinks.get(id)?.length);
  const roots = topics.filter(t => isSubject(t.id));
  const children = (id: string) => (childLinks.get(id) ?? []).map(l => byId.get(l.child_id)!);
  const parents = (id: string) => (parentLinks.get(id) ?? []).map(l => byId.get(l.parent_id)!);

  /** The role a link gives its child: its own override, else by depth. */
  const roleOf = (l: AcLink): LinkRole => l.role ?? (isSubject(l.parent_id) ? 'general' : 'area');

  /** All subject → … → topic paths, as links (capped to stay cheap on wide graphs). */
  const pathsTo = (id: string, limit = 50): AcLink[][] => {
    const out: AcLink[][] = [];
    const walk = (cur: string, acc: AcLink[]) => {
      if (out.length >= limit) return;
      const ups = parentLinks.get(cur) ?? [];
      if (ups.length === 0) { out.push([...acc].reverse()); return; }
      for (const l of ups) walk(l.parent_id, [...acc, l]);
    };
    walk(id, []);
    return out.filter(p => p.length > 0);
  };

  /** A topic and everything beneath it (each once). */
  const subtree = (id: string): Set<string> => {
    const seen = new Set<string>([id]);
    const stack = [id];
    while (stack.length) for (const c of childLinks.get(stack.pop()!) ?? []) if (!seen.has(c.child_id)) { seen.add(c.child_id); stack.push(c.child_id); }
    return seen;
  };

  /** Ancestors, nearest first, each once. */
  const ancestors = (id: string): Set<string> => {
    const seen = new Set<string>();
    const stack = [id];
    while (stack.length) for (const l of parentLinks.get(stack.pop()!) ?? []) if (!seen.has(l.parent_id)) { seen.add(l.parent_id); stack.push(l.parent_id); }
    return seen;
  };

  const explicitDomains = new Map<string, Set<string>>();
  for (const td of topicDomains) (explicitDomains.get(td.topic_id) ?? explicitDomains.set(td.topic_id, new Set()).get(td.topic_id)!).add(td.domain_id);

  /** Domains of a topic: its own plus those of every ancestor. */
  const domainsOf = (id: string): { own: Set<string>; inherited: Set<string> } => {
    const own = new Set(explicitDomains.get(id) ?? []);
    const inherited = new Set<string>();
    for (const a of ancestors(id)) for (const d of explicitDomains.get(a) ?? []) if (!own.has(d)) inherited.add(d);
    return { own, inherited };
  };

  /** Topics in a domain: tagged ones and everything beneath them. */
  const domainTopics = (domainId: string): Set<string> => {
    const out = new Set<string>();
    for (const [topicId, ds] of explicitDomains) if (ds.has(domainId)) for (const x of subtree(topicId)) out.add(x);
    return out;
  };

  /** Topics in no domain at all (neither their own nor through an ancestor). */
  const unassignedTopics = (): Set<string> => {
    const assigned = new Set<string>();
    for (const [topicId] of explicitDomains) for (const x of subtree(topicId)) assigned.add(x);
    return new Set(topics.filter(t => !assigned.has(t.id)).map(t => t.id));
  };

  /** How a topic is named: subject if it has no parent, else by its links' roles. */
  const levelOf = (id: string): 'subject' | LinkRole | 'mixed' => {
    const ups = parentLinks.get(id) ?? [];
    if (ups.length === 0) return 'subject';
    const roles = new Set(ups.map(roleOf));
    return roles.size === 1 ? [...roles][0] : 'mixed';
  };

  return { byId, roots, children, parents, childLinks, parentLinks, isSubject, roleOf, pathsTo, subtree, ancestors, domainsOf, domainTopics, unassignedTopics, levelOf };
}

const CYCLE_KEY = 'ac-selected-cycle';

/** The cycle every page rolls up by; remembered in this browser. */
export function useSelectedCycle(refs: CycleRef[]) {
  const [key, setKey] = useState<string>(() => {
    try { return localStorage.getItem(CYCLE_KEY) ?? cycleKey(NEW_CYCLE); } catch { return cycleKey(NEW_CYCLE); }
  });
  const selected = refs.find(r => cycleKey(r) === key) ?? NEW_CYCLE;
  const select = (k: string) => {
    setKey(k);
    try { localStorage.setItem(CYCLE_KEY, k); } catch { /* per-browser convenience only */ }
  };
  return { cycle: selected, cycleKey: cycleKey(selected), select };
}

/** Calls a database function, toasting its error message; null on failure. */
export async function acRpc<T>(fn: string, args: Record<string, unknown>, fallback: string): Promise<T | null> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    toast.error(errorMessage(error, fallback));
    return null;
  }
  return data as T;
}

/** Day of the week (0 = Sunday … 6 = Saturday) of a 'yyyy-MM-dd' calendar date. */
export const weekdayOf = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay();

/** 'yyyy-MM-dd' moved by n days (calendar arithmetic, no timezone involved). */
export const shiftDay = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Whether a milestone is scheduled on a day: its weekday, or one of its dates. */
export const isScheduledOn = (topic: AcTopic, day: string) =>
  (topic.schedule_dates ?? []).includes(day) || (topic.schedule_weekdays ?? []).includes(weekdayOf(day));

export const hasSchedule = (topic: AcTopic) =>
  (topic.schedule_weekdays?.length ?? 0) > 0 || (topic.schedule_dates?.length ?? 0) > 0;
