import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ChevronRight, Home, Star, Activity, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import {
  cycleKey, cycleLabel, percent, STATUSES, useAcData, useSelectedCycle, type CycleRef, type CycleStatus, type AcLog,
} from '../../lib/achievementCycle';
import { Button } from '../../components/ui/Button';
import { acSelectClass, AcCyclePicker, AcLevelBadge, AcProgress, AcRichView, AcStat, AcStatusBreakdown, acCard, AcArchiveToggle } from '../../components/achievementCycle/AcUi';
import { useAcDialogs } from '../../components/achievementCycle/useAcDialogs';
import { PfPageHeader } from '../Portfolio/PfPageHeader';

/** Completion, counts and activity for any slice of the learning plan. */
export const AcDashboard = () => {
  const { t } = useLanguage();
  const data = useAcData();
  const { userId, loading, graph, domains, cycles, topics, cycleRefs, rollupOf } = data;
  const { cycle, cycleKey: ck, select } = useSelectedCycle(cycleRefs);
  const { openTopic, newTopic, dialogs } = useAcDialogs(data, cycle);
  const [domainId, setDomainId] = useState('');
  // Drill path: subject → general topic → area …
  const [focus, setFocus] = useState<string[]>([]);
  const [logs, setLogs] = useState<AcLog[]>([]);

  const focusId = focus[focus.length - 1] ?? null;

  const scope = useMemo(() => {
    let set: Set<string> = new Set(topics.map(x => x.id));
    if (domainId) set = graph.domainTopics(domainId);
    if (focusId) {
      const sub = graph.subtree(focusId);
      set = domainId ? new Set([...sub].filter(x => set.has(x) || x === focusId)) : sub;
    }
    return set;
  }, [topics, graph, domainId, focusId]);

  const same = (a: CycleRef, b: CycleRef) => a.kind === b.kind && a.round === b.round;
  const scopeCycles = cycles.filter(c => scope.has(c.topic_id));
  const current = scopeCycles.filter(c => same(c, cycle));
  const live = current.filter(c => c.status !== 'cancel');
  const total = live.reduce((s, c) => s + c.total_points, 0);
  const achieved = live.reduce((s, c) => s + c.achieved_points, 0);
  const counts = Object.fromEntries(STATUSES.map(s => [s, current.filter(c => c.status === s).length])) as Record<CycleStatus, number>;

  const milestones = [...scope].map(id => graph.byId.get(id)!).filter(x => x?.is_milestone);
  const milestoneDone = milestones.filter(m => {
    const r = rollupOf(m.id, cycle);
    return r && r.total > 0 && r.achieved === r.total;
  }).length;

  // What to drill into next: the focus's children, else the scope's top level.
  const nextLevel = focusId
    ? (graph.childLinks.get(focusId) ?? []).map(l => ({ id: l.child_id, level: graph.roleOf(l) }))
    : [...scope].filter(id => graph.parents(id).every(p => !scope.has(p.id)))
      .map(id => ({ id, level: graph.levelOf(id) }))
      .sort((a, b) => graph.byId.get(a.id)!.name.localeCompare(graph.byId.get(b.id)!.name));

  const perCycle = cycleRefs.map(r => {
    const cs = scopeCycles.filter(c => same(c, r) && c.status !== 'cancel');
    return { ref: r, total: cs.reduce((s, c) => s + c.total_points, 0), achieved: cs.reduce((s, c) => s + c.achieved_points, 0), n: cs.length };
  }).filter(x => x.n > 0);

  useEffect(() => {
    if (!userId) return;
    void supabase.from('ac_progress_logs').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(60)
      .then(({ data: rows }) => setLogs((rows ?? []) as AcLog[]));
  }, [userId, cycles]);

  const cycleById = new Map(cycles.map(c => [c.id, c]));
  const recent = logs.filter(l => { const c = cycleById.get(l.cycle_id); return c && scope.has(c.topic_id); }).slice(0, 8);
  const inProgress = current.filter(c => c.status === 'in_progress').slice(0, 8);

  if (!loading && topics.length === 0) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <PfPageHeader title="ac.dashboard.pageTitle" subtitle="ac.dashboard.pageSubtitle" action={<AcArchiveToggle value={data.showArchived} onChange={data.setShowArchived} />} />
        <div className={`${acCard} p-12 text-center space-y-3`}>
          <p className="text-gray-600 dark:text-gray-300">{t('ac.dashboard.empty')}</p>
          <Button onClick={() => newTopic()}><Plus size={16} className="mr-1" />{t('ac.topic.create')}</Button>
        </div>
        {dialogs}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PfPageHeader title="ac.dashboard.pageTitle" subtitle="ac.dashboard.pageSubtitle" action={<AcArchiveToggle value={data.showArchived} onChange={data.setShowArchived} />} />

      <div className={`${acCard} p-4 flex flex-wrap items-center gap-3`}>
        <AcCyclePicker refs={cycleRefs} value={ck} onChange={select} />
        <select value={domainId} onChange={e => { setDomainId(e.target.value); setFocus([]); }} className={`${acSelectClass} h-9`}>
          <option value="">{t('ac.allDomains')}</option>
          {domains.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <nav className="flex flex-wrap items-center gap-1 text-sm">
          <button className={`inline-flex items-center gap-1 ${focus.length ? 'text-primary hover:underline' : 'font-semibold text-gray-900 dark:text-gray-100'}`} onClick={() => setFocus([])}>
            <Home size={14} />{domainId ? domains.find(d => d.id === domainId)?.name : t('ac.dashboard.everything')}
          </button>
          {focus.map((id, i) => (
            <span key={id} className="inline-flex items-center gap-1">
              <ChevronRight size={13} className="text-gray-400" />
              <button className={i === focus.length - 1 ? 'font-semibold text-gray-900 dark:text-gray-100' : 'text-primary hover:underline'} onClick={() => setFocus(focus.slice(0, i + 1))}>
                {graph.byId.get(id)?.name}
              </button>
            </span>
          ))}
        </nav>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-500">{t('pf.common.loading')}</div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)]">
            <div className={`${acCard} p-6 flex flex-col justify-center`}>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{cycleLabel(cycle, t)} · {t('ac.dashboard.complete')}</div>
              <div className="text-5xl font-bold text-gray-900 dark:text-gray-100 tabular-nums my-2">{percent(achieved, total)}%</div>
              <AcProgress achieved={achieved} total={total} />
              {focusId && <button className="mt-3 self-start text-xs text-primary hover:underline" onClick={() => openTopic(focusId)}>{t('ac.dashboard.openTopic')}</button>}
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <AcStat label={t('ac.dashboard.points')} value={`${achieved}/${total}`} />
              <AcStat label={t('ac.topicsCount')} value={scope.size} />
              <AcStat label={t('ac.dashboard.cyclesDone')} value={`${counts.complete}/${current.length - counts.cancel}`} />
              <AcStat label={t('ac.status.in_progress')} value={counts.in_progress} />
              <AcStat label={t('ac.nav.milestones')} value={`${milestoneDone}/${milestones.length}`} />
              <AcStat label={t('ac.dashboard.cycles')} value={perCycle.length} />
            </div>
          </div>

          <div className={`${acCard} p-5 space-y-3`}>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('ac.dashboard.statuses')} · {cycleLabel(cycle, t)}</h3>
            <AcStatusBreakdown counts={counts} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className={`${acCard} p-5 space-y-3`}>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{focusId ? t('ac.dashboard.inside') : t('ac.dashboard.topLevel')}</h3>
              {nextLevel.length === 0 ? <p className="text-sm text-gray-500">{t('ac.detail.noChildren')}</p> : (
                <ul className="space-y-2.5">
                  {nextLevel.map(({ id, level }) => {
                    const r = rollupOf(id, cycle);
                    const hasKids = (graph.childLinks.get(id)?.length ?? 0) > 0;
                    const topic = graph.byId.get(id)!;
                    return (
                      <li key={id} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <button
                            className="text-sm font-medium text-left text-gray-900 dark:text-gray-100 hover:text-primary truncate"
                            onClick={() => (hasKids ? setFocus([...focus, id]) : openTopic(id))}
                            title={hasKids ? t('ac.dashboard.drill') : t('ac.dashboard.openTopic')}
                          >
                            {topic.is_milestone && <Star size={12} className="inline mr-1 fill-warning text-warning" />}{topic.name}
                          </button>
                          <AcLevelBadge level={level} />
                          {hasKids && <ChevronRight size={14} className="text-gray-400" />}
                        </div>
                        <AcProgress achieved={r?.achieved ?? 0} total={r?.total ?? 0} size="sm" />
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className={`${acCard} p-5 space-y-3`}>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('ac.dashboard.byCycle')}</h3>
              <ul className="space-y-2.5">
                {perCycle.map(x => (
                  <li key={cycleKey(x.ref)} className="grid grid-cols-[6.5rem_1fr] items-center gap-3">
                    <button className={`text-sm text-left ${cycleKey(x.ref) === ck ? 'font-semibold text-primary' : 'text-gray-700 dark:text-gray-300 hover:text-primary'}`} onClick={() => select(cycleKey(x.ref))}>
                      {cycleLabel(x.ref, t)}
                    </button>
                    <AcProgress achieved={x.achieved} total={x.total} size="sm" />
                  </li>
                ))}
              </ul>
              {domainId === '' && focus.length === 0 && domains.length > 0 && (
                <>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 pt-3">{t('ac.domains')}</h3>
                  <ul className="space-y-2.5">
                    {domains.map(d => {
                      const r = data.domainRollupOf(d.id, cycle);
                      return (
                        <li key={d.id} className="grid grid-cols-[6.5rem_1fr] items-center gap-3">
                          <button className="text-sm text-left truncate text-gray-700 dark:text-gray-300 hover:text-primary" onClick={() => setDomainId(d.id)}>
                            <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: d.color }} />{d.name}
                          </button>
                          <AcProgress achieved={r?.achieved ?? 0} total={r?.total ?? 0} size="sm" />
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className={`${acCard} p-5 space-y-3`}>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('ac.status.in_progress')}</h3>
              {inProgress.length === 0 ? <p className="text-sm text-gray-500">{t('ac.dashboard.nothingInProgress')}</p> : (
                <ul className="space-y-2.5">
                  {inProgress.map(c => (
                    <li key={c.id} className="space-y-1">
                      <button className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-primary" onClick={() => openTopic(c.topic_id)}>{graph.byId.get(c.topic_id)?.name}</button>
                      <AcProgress achieved={c.achieved_points} total={c.total_points} size="sm" />
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className={`${acCard} p-5 space-y-3`}>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 inline-flex items-center gap-2"><Activity size={16} />{t('ac.dashboard.activity')}</h3>
              {recent.length === 0 ? <p className="text-sm text-gray-500">{t('ac.detail.noLog')}</p> : (
                <ul className="space-y-3">
                  {recent.map(l => {
                    const c = cycleById.get(l.cycle_id)!;
                    return (
                      <li key={l.id}>
                        <div className="text-xs text-gray-500">
                          <button className="font-medium text-gray-800 dark:text-gray-200 hover:text-primary" onClick={() => openTopic(c.topic_id)}>{graph.byId.get(c.topic_id)?.name}</button>
                          {' · '}{cycleLabel(c, t)}{' · '}
                          <span className={l.delta > 0 ? 'text-success font-semibold' : 'text-danger font-semibold'}>{l.delta > 0 ? `+${l.delta}` : l.delta}</span>
                          {' · '}{format(new Date(l.created_at), 'dd MMM, h:mm a')}
                        </div>
                        <AcRichView html={l.comment_html} className="line-clamp-3" />
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
      {dialogs}
    </div>
  );
};
