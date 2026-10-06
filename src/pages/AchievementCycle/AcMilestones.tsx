import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Star, CheckCircle2, Circle, CalendarPlus, Ban, RotateCcw, AlertTriangle, Inbox, KanbanSquare } from 'lucide-react';
import { useLanguage } from '../../lib/LanguageContext';
import { acRpc, cycleLabel, percent, useAcData, useSelectedCycle, type AcTopic, type CycleStatus } from '../../lib/achievementCycle';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { acSelectClass, AcCyclePicker, AcLevelBadge, AcProgress, AcStat, acCard, AcArchiveToggle } from '../../components/achievementCycle/AcUi';
import { useAcDialogs } from '../../components/achievementCycle/useAcDialogs';
import { AcTopicFilterSelects, useTopicFilter } from '../../components/achievementCycle/AcTopicFilters';
import { AcScheduleSummary } from '../../components/achievementCycle/AcSchedule';
import { Pagination, usePagination } from '../../components/ui/Pagination';
import { PfPageHeader } from '../Portfolio/PfPageHeader';

/** Milestone topics of a domain (optionally one subject / level), and how many are reached in a cycle. */
export const AcMilestones = () => {
  const { t } = useLanguage();
  const data = useAcData();
  const { userId, loading, graph, domains, topics, cycles, cycleRefs, rollupOf, reload } = data;
  const { cycle, cycleKey, select } = useSelectedCycle(cycleRefs);
  const { openTopic, dialogs } = useAcDialogs(data, cycle);
  // Same filter as the Topics page: one domain, then subject / level (all by default).
  const filter = useTopicFilter(graph, domains);
  // Open (not yet reached) milestones first: what is left to do.
  const [show, setShow] = useState<'all' | 'open' | 'done'>('open');
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState<AcTopic | null>(null);

  const OPEN: CycleStatus[] = ['backlog', 'todo', 'hold', 'in_progress'];

  /** Statuses of the selected cycle across a milestone and everything beneath it. */
  const statusCounts = (m: AcTopic) => {
    const sub = graph.subtree(m.id);
    const counts: Partial<Record<CycleStatus, number>> = {};
    for (const c of cycles) {
      if (c.kind === cycle.kind && c.round === cycle.round && sub.has(c.topic_id)) counts[c.status] = (counts[c.status] ?? 0) + 1;
    }
    return counts;
  };

  // Plan (backlog → to do), cancel (anything open → cancel) or reopen (cancel → backlog),
  // for the milestone and everything beneath it, in the selected cycle.
  const bulk = async (m: AcTopic, from: CycleStatus[], to: CycleStatus, done: string) => {
    if (!userId) return;
    setBusy(true);
    const n = await acRpc<number>('ac_bulk_status', {
      p_user_id: userId, p_topic_id: m.id, p_kind: cycle.kind, p_round: cycle.round, p_from: from, p_to: to,
    }, t('pf.common.saveError'));
    setBusy(false);
    if (n === null) return;
    toast.success(t(done).replace('{n}', String(n)));
    await reload();
  };

  const isDone = (id: string) => {
    const r = rollupOf(id, cycle);
    return !!r && r.total > 0 && r.achieved === r.total;
  };

  const all = topics.filter(x => x.is_milestone && filter.matches(x.id));
  const done = all.filter(m => isDone(m.id));
  const listed = all
    .filter(m => show === 'all' || (show === 'done') === isDone(m.id))
    .sort((a, b) => percent(rollupOf(b.id, cycle)?.achieved ?? 0, rollupOf(b.id, cycle)?.total ?? 0) - percent(rollupOf(a.id, cycle)?.achieved ?? 0, rollupOf(a.id, cycle)?.total ?? 0));
  const pager = usePagination(listed, 10);
  const { setPage } = pager;
  // A new filter starts from the first page.
  useEffect(() => { setPage(1); }, [filter.key, show, cycleKey, setPage]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PfPageHeader title="ac.milestones.pageTitle" subtitle="ac.milestones.pageSubtitle" action={<AcArchiveToggle value={data.showArchived} onChange={data.setShowArchived} />} />

      <div className={`${acCard} p-4 flex flex-wrap items-center gap-3`}>
        <AcCyclePicker refs={cycleRefs} value={cycleKey} onChange={select} />
        <AcTopicFilterSelects filter={filter} domains={domains} />
        <select value={show} onChange={e => setShow(e.target.value as typeof show)} className={`${acSelectClass} h-9`}>
          <option value="all">{t('ac.milestones.all')}</option>
          <option value="open">{t('ac.milestones.open')}</option>
          <option value="done">{t('ac.milestones.done')}</option>
        </select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <AcStat label={t('ac.milestones.done')} value={`${done.length}/${all.length}`} hint={cycleLabel(cycle, t)} />
        <AcStat label={t('ac.dashboard.complete')} value={`${percent(done.length, all.length)}%`} />
        <AcStat label={t('ac.milestones.open')} value={all.length - done.length} />
      </div>

      <div className={`${acCard} overflow-hidden`}>
        {loading ? (
          <div className="p-12 text-center text-gray-500">{t('pf.common.loading')}</div>
        ) : listed.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Star size={28} className="mx-auto mb-2 text-gray-400" />
            {all.length === 0 ? t('ac.milestones.empty') : t('pf.common.empty')}
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {pager.pageItems.map(m => {
              const r = rollupOf(m.id, cycle);
              const complete = isDone(m.id);
              const nested = [...graph.subtree(m.id)].filter(id => id !== m.id && graph.byId.get(id)?.is_milestone);
              const nestedDone = nested.filter(isDone).length;
              const path = graph.pathsTo(m.id, 1)[0];
              return (
                <li key={m.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer" onClick={() => openTopic(m.id)}>
                  <div className="flex flex-wrap items-center gap-2">
                    {complete ? <CheckCircle2 size={18} className="text-success shrink-0" /> : <Circle size={18} className="text-gray-300 shrink-0" />}
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{m.name}</span>
                    <AcLevelBadge level={graph.levelOf(m.id)} />
                    <span className={`text-xs font-medium ${complete ? 'text-success' : 'text-gray-500'}`}>{complete ? t('ac.milestones.reached') : t('ac.milestones.inProgress')}</span>
                    {nested.length > 0 && (
                      <span className="text-xs text-gray-500 ml-auto">{t('ac.milestones.nested').replace('{done}', String(nestedDone)).replace('{n}', String(nested.length))}</span>
                    )}
                  </div>
                  {(() => {
                    const counts = statusCounts(m);
                    const open = OPEN.reduce((a, st) => a + (counts[st] ?? 0), 0);
                    // Planned but not started: can go back to Backlog.
                    const planned = (counts.todo ?? 0) + (counts.hold ?? 0);
                    const btn = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border disabled:opacity-40';
                    return (
                      <div className="mt-2 ml-7 flex flex-wrap items-center gap-2" onClick={e => e.stopPropagation()}>
                        {(counts.backlog ?? 0) > 0 && (
                          <button className={`${btn} border-primary/30 text-primary hover:bg-primary/10`} disabled={busy}
                            onClick={() => void bulk(m, ['backlog'], 'todo', 'ac.milestones.planned')}>
                            <CalendarPlus size={13} />{t('ac.milestones.plan')} ({counts.backlog})
                          </button>
                        )}
                        {planned > 0 && (
                          <button className={`${btn} border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700`} disabled={busy}
                            onClick={() => void bulk(m, ['todo', 'hold'], 'backlog', 'ac.milestones.unplanned')}>
                            <Inbox size={13} />{t('ac.milestones.toBacklog')} ({planned})
                          </button>
                        )}
                        {open > 0 && (
                          <button className={`${btn} border-danger/30 text-danger hover:bg-danger/10`} disabled={busy} onClick={() => setCancelling(m)}>
                            <Ban size={13} />{t('ac.milestones.cancel')} ({open})
                          </button>
                        )}
                        {(counts.cancel ?? 0) > 0 && (
                          <button className={`${btn} border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700`} disabled={busy}
                            onClick={() => void bulk(m, ['cancel'], 'backlog', 'ac.milestones.reopened')}>
                            <RotateCcw size={13} />{t('ac.milestones.reopen')} ({counts.cancel})
                          </button>
                        )}
                        <Link to={`/ac/board?milestone=${m.id}`} className={`${btn} border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700`}>
                          <KanbanSquare size={13} />{t('ac.milestones.openBoard')}
                        </Link>
                        <span className="text-[11px] text-gray-400">{cycleLabel(cycle, t)}</span>
                      </div>
                    );
                  })()}
                  {path && <div className="text-xs text-gray-500 mt-0.5 ml-7">{path.map(l => graph.byId.get(l.parent_id)?.name).join(' › ')}</div>}
                  <div className="ml-7 mt-0.5"><AcScheduleSummary weekdays={m.schedule_weekdays ?? []} dates={m.schedule_dates ?? []} /></div>
                  <div className="mt-2 ml-7"><AcProgress achieved={r?.achieved ?? 0} total={r?.total ?? 0} /></div>
                </li>
              );
            })}
          </ul>
        )}
        <Pagination
          page={pager.page}
          pageCount={pager.pageCount}
          total={pager.total}
          pageSize={pager.pageSize}
          onPageChange={pager.setPage}
          onPageSizeChange={pager.setPageSize}
        />
      </div>
      <Modal isOpen={!!cancelling} onClose={() => !busy && setCancelling(null)} title={t('ac.milestones.cancelTitle')}>
        {cancelling && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-danger/5 border border-danger/20 rounded-lg p-4 text-sm text-gray-700 dark:text-gray-300">
              <AlertTriangle size={20} className="text-danger shrink-0" />
              {t('ac.milestones.cancelHint')
                .replace('{name}', cancelling.name)
                .replace('{cycle}', cycleLabel(cycle, t))
                .replace('{n}', String(OPEN.reduce((a, st) => a + (statusCounts(cancelling)[st] ?? 0), 0)))}
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setCancelling(null)} disabled={busy}>{t('pf.common.cancel')}</Button>
              <Button variant="danger" disabled={busy} onClick={async () => { const m = cancelling; setCancelling(null); await bulk(m, OPEN, 'cancel', 'ac.milestones.cancelled'); }}>
                {t('ac.milestones.cancel')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
      {dialogs}
    </div>
  );
};
