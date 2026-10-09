import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Inbox, CalendarDays, ChevronLeft, ChevronRight, Moon, Sun } from 'lucide-react';
import { format } from 'date-fns';
import { getDhakaDateString } from '../../lib/dhakaTime';
import { Minus, Plus, Star, Search, GripVertical } from 'lucide-react';
import { useLanguage } from '../../lib/LanguageContext';
import {
  cycleLabel, acRpc, STATUSES, useAcData, NEW_CYCLE, isScheduledOn, shiftDay, setHibernated, ASK_HIBERNATE, type CycleKind, type CycleStatus, type AcCycle,
} from '../../lib/achievementCycle';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { pfInputClass } from '../../components/portfolio/PfFieldInput';
import { AcProgress, AcRichEditor, AcLevelBadge, statusColor, acCard, acSelectClass, AcArchiveToggle } from '../../components/achievementCycle/AcUi';
import { AcProgressModal } from '../../components/achievementCycle/AcProgressModal';
import { useAcDialogs } from '../../components/achievementCycle/useAcDialogs';
import { AcTopicFilterSelects, useTopicFilter, ALL } from '../../components/achievementCycle/AcTopicFilters';
import { AcMilestonePicker } from '../../components/achievementCycle/AcMilestonePicker';
import { PfPageHeader, PfTabs } from '../Portfolio/PfPageHeader';

const KIND_TABS: { key: CycleKind; label: string }[] = [
  { key: 'new', label: 'ac.kinds.new' },
  { key: 'revise', label: 'ac.kinds.revise' },
  { key: 'practice', label: 'ac.kinds.practice' },
];

/** Kanban of topic cycles for one state (New / Revise n / Practice n). */
export const AcBoard = () => {
  const { t } = useLanguage();
  const data = useAcData();
  const { userId, loading, cycles, graph, domains, topics, reload } = data;
  const [kind, setKind] = useState<CycleKind>('new');
  const [round, setRound] = useState<number | 'all'>('all');
  // "Show by day": only the work of milestones scheduled on `day` (remembered per browser).
  const [byDay, setByDayState] = useState(() => { try { return localStorage.getItem('ac-board-by-day') === 'true'; } catch { return false; } });
  // Same Domain → Subject → Level filter as Topics, plus an optional milestone.
  // Starts on "All domains"; By day switches to it too, and turning By day off
  // goes back to the domain chosen before.
  const filter = useTopicFilter(graph, domains, { domainId: ALL, allowAllDomains: true });
  const prevDomain = useRef<string | null>(null);
  // Backlog (not planned yet) is hidden unless asked for; By day shows it by default.
  const [showBacklog, setShowBacklog] = useState(byDay);
  const setByDay = (v: boolean) => {
    setByDayState(v);
    try { localStorage.setItem('ac-board-by-day', String(v)); } catch { /* convenience only */ }
    if (v) { prevDomain.current = filter.activeDomain; filter.setDomain(ALL); }
    else filter.setDomain(prevDomain.current ?? ALL);
    setShowBacklog(v);
  };
  // ?milestone=<id> (from the Milestones page) opens the board on that milestone.
  const [params] = useSearchParams();
  const [milestoneId, setMilestoneId] = useState(params.get('milestone') ?? '');
  const linkedMilestone = params.get('milestone');
  const { setDomain } = filter;
  useEffect(() => {
    // Show the domain the linked milestone is in, once the topics have loaded.
    if (!linkedMilestone || !graph.byId.has(linkedMilestone)) return;
    const { own, inherited } = graph.domainsOf(linkedMilestone);
    const domain = [...own, ...inherited][0];
    if (domain) setDomain(domain);
  }, [linkedMilestone, graph, setDomain]);
  // Hibernated topics are hidden too; shown (dimmed, with Wake) only when asked for.
  const [showHibernated, setShowHibernated] = useState(false);
  const [search, setSearch] = useState('');
  const today = getDhakaDateString();
  const [day, setDay] = useState(today);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<CycleStatus | null>(null);
  const [progress, setProgress] = useState<{ cycle: AcCycle; direction: 1 | -1 } | null>(null);
  // A move to Complete / Cancel / Backlog waits here to ask about hibernating.
  const [pending, setPending] = useState<{ cycle: AcCycle; status: CycleStatus } | null>(null);
  const [completeNote, setCompleteNote] = useState('');
  const [busy, setBusy] = useState(false);

  const rounds = useMemo(() => [...new Set(cycles.filter(c => c.kind === kind).map(c => c.round))].sort((a, b) => a - b), [cycles, kind]);
  const activeRound = kind === 'new' ? 0 : round;
  const dialogCycle = kind === 'new' || round === 'all' ? NEW_CYCLE : { kind, round };
  const { openTopic, dialogs } = useAcDialogs(data, dialogCycle);

  // Milestones the picker offers: those inside the current domain / subject / level.
  const milestones = topics.filter(x => x.is_milestone && filter.matches(x.id));
  const activeMilestone = milestones.some(m => m.id === milestoneId) ? milestoneId : '';
  const milestoneSet = useMemo(() => (activeMilestone ? graph.subtree(activeMilestone) : null), [graph, activeMilestone]);

  // Milestones scheduled on the chosen day, and everything beneath them.
  const dayMilestones = milestones.filter(m => isScheduledOn(m, day));
  const daySet = useMemo(() => {
    if (!byDay) return null;
    const set = new Set<string>();
    for (const m of dayMilestones) for (const id of graph.subtree(m.id)) set.add(id);
    return set;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byDay, graph, day, dayMilestones.map(m => m.id).join()]);

  // Cards are work items: topics with nothing beneath them. A parent's own
  // cycle is moved / progressed from the topic itself.
  const isParent = (topicId: string) => (graph.childLinks.get(topicId)?.length ?? 0) > 0;

  const isHibernated = (topicId: string) => !!graph.byId.get(topicId)?.is_hibernated;

  const matching = cycles.filter(c =>
    c.kind === kind &&
    (activeRound === 'all' || c.round === activeRound) &&
    !isParent(c.topic_id) &&
    filter.matches(c.topic_id) &&
    (!milestoneSet || milestoneSet.has(c.topic_id)) &&
    (!daySet || daySet.has(c.topic_id)) &&
    (!search.trim() || (graph.byId.get(c.topic_id)?.name ?? '').toLowerCase().includes(search.trim().toLowerCase())));
  const hibernatedCount = matching.filter(c => isHibernated(c.topic_id)).length;
  const visible = showHibernated ? matching : matching.filter(c => !isHibernated(c.topic_id));

  const backlogCount = visible.filter(c => c.status === 'backlog').length;
  const columns = STATUSES.filter(s => s !== 'backlog' || showBacklog).map(s => ({
    status: s,
    cards: visible.filter(c => c.status === s).sort((a, b) => a.sort_order - b.sort_order || b.updated_at.localeCompare(a.updated_at)),
  }));

  const move = async (c: AcCycle, status: CycleStatus, note?: string, hibernate = false) => {
    if (!userId) return;
    setBusy(true);
    const lastOrder = Math.max(0, ...cycles.filter(x => x.status === status).map(x => x.sort_order)) + 1;
    const ok = await acRpc('ac_set_status', {
      p_user_id: userId, p_cycle_id: c.id, p_status: status, p_sort_order: lastOrder, p_comment_html: note || null,
    }, t('pf.common.saveError'));
    if (ok && hibernate) await setHibernated(userId, [c.topic_id], true, t('pf.common.saveError'));
    setBusy(false);
    if (ok) await reload();
  };

  const wake = async (topicId: string) => {
    if (!userId) return;
    setBusy(true);
    const ok = await setHibernated(userId, [topicId], false, t('pf.common.saveError'));
    setBusy(false);
    if (ok) await reload();
  };

  // Complete / Cancel / Backlog ask whether to hibernate the topic too
  // (completing with points left also takes a note, since it fills them).
  const requestMove = (c: AcCycle, status: CycleStatus) => {
    if (status === c.status) return;
    const fillsPoints = status === 'complete' && c.achieved_points < c.total_points;
    if (fillsPoints || (ASK_HIBERNATE.includes(status) && !isHibernated(c.topic_id))) {
      setCompleteNote('');
      setPending({ cycle: c, status });
      return;
    }
    void move(c, status);
  };

  const onDrop = (status: CycleStatus) => {
    const c = cycles.find(x => x.id === dragId);
    setDragId(null);
    setOverCol(null);
    if (c) requestMove(c, status);
  };


  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      <PfPageHeader title="ac.board.pageTitle" subtitle="ac.board.pageSubtitle" action={<AcArchiveToggle value={data.showArchived} onChange={data.setShowArchived} />} />

      <div className={`${acCard} p-4 flex flex-wrap items-center gap-3`}>
        <PfTabs tabs={KIND_TABS} active={kind} onChange={k => { setKind(k); setRound('all'); }} />
        {kind !== 'new' && (
          <select value={String(round)} onChange={e => setRound(e.target.value === 'all' ? 'all' : Number(e.target.value))} className={`${acSelectClass} h-9`}>
            <option value="all">{t('ac.board.allRounds')}</option>
            {rounds.map(r => <option key={r} value={r}>{cycleLabel({ kind, round: r }, t)}</option>)}
          </select>
        )}
        <AcTopicFilterSelects filter={filter} domains={domains} />
        <AcMilestonePicker milestones={milestones} value={activeMilestone} onChange={setMilestoneId} />
        <button
          type="button"
          onClick={() => setShowBacklog(v => !v)}
          className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium border transition-colors ${showBacklog
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
          aria-pressed={showBacklog}
        >
          <Inbox size={15} />{showBacklog ? t('ac.board.hideBacklog') : t('ac.board.showBacklog')}
          <span className="tabular-nums text-xs opacity-75">({backlogCount})</span>
        </button>
        <button
          type="button"
          onClick={() => setShowHibernated(v => !v)}
          className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium border transition-colors ${showHibernated
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
          aria-pressed={showHibernated}
        >
          <Moon size={15} />{showHibernated ? t('ac.board.hideHibernated') : t('ac.board.showHibernated')}
          <span className="tabular-nums text-xs opacity-75">({hibernatedCount})</span>
        </button>
        <button
          type="button"
          onClick={() => setByDay(!byDay)}
          className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium border transition-colors ${byDay
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
          aria-pressed={byDay}
        >
          <CalendarDays size={15} />{t('ac.board.byDay')}
        </button>
        <div className="relative ml-auto">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('pf.common.search')} className={`${pfInputClass} h-9 pl-8 w-52`} />
        </div>
      </div>

      {byDay && (
        <div className={`${acCard} p-3 flex flex-wrap items-center gap-3`}>
          <div className="flex items-center gap-1">
            <button className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700" onClick={() => setDay(d => shiftDay(d, -1))} aria-label={t('ac.prev')}><ChevronLeft size={16} /></button>
            <input type="date" value={day} onChange={e => e.target.value && setDay(e.target.value)} className={`${acSelectClass} h-9`} aria-label={t('ac.board.day')} />
            <button className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700" onClick={() => setDay(d => shiftDay(d, 1))} aria-label={t('ac.next')}><ChevronRight size={16} /></button>
          </div>
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {format(new Date(`${day}T00:00:00`), 'EEEE')}{day === today && <span className="ml-1.5 text-xs font-medium text-primary">{t('ac.board.today')}</span>}
          </span>
          {day !== today && <button className="text-sm text-primary hover:underline" onClick={() => setDay(today)}>{t('ac.board.goToday')}</button>}
          <div className="flex flex-wrap items-center gap-1.5 ml-auto">
            {dayMilestones.length === 0
              ? <span className="text-sm text-gray-500">{t('ac.board.nothingScheduled')}</span>
              : dayMilestones.map(m => (
                <button key={m.id} onClick={() => openTopic(m.id)} className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-warning/15 text-gray-800 dark:text-gray-100 border border-warning/30 hover:bg-warning/25">
                  ★ {m.name}
                </button>
              ))}
          </div>
        </div>
      )}

      {kind !== 'new' && rounds.length === 0 && !loading && (
        <div className={`${acCard} p-6 text-sm text-gray-500 text-center`}>{t('ac.board.noRounds').replace('{kind}', t(`ac.kinds.${kind}`))}</div>
      )}

      {loading ? (
        <div className="p-12 text-center text-gray-500">{t('pf.common.loading')}</div>
      ) : (
        <div className={`grid gap-4 grid-cols-1 md:grid-cols-3 items-start ${showBacklog ? 'xl:grid-cols-6' : 'xl:grid-cols-5'}`}>
          {columns.map(col => (
            <div
              key={col.status}
              onDragOver={e => { e.preventDefault(); setOverCol(col.status); }}
              onDragLeave={() => setOverCol(o => (o === col.status ? null : o))}
              onDrop={() => onDrop(col.status)}
              className={`rounded-xl border-2 transition-colors min-h-40 ${overCol === col.status ? 'border-primary bg-primary/5' : 'border-transparent bg-gray-100/70 dark:bg-gray-900/40'}`}
            >
              <div className="flex items-center justify-between px-3 pt-3 pb-2">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: statusColor(col.status) }} />
                  {t(`ac.status.${col.status}`)}
                </span>
                <span className="text-xs tabular-nums text-gray-500">{col.cards.length}</span>
              </div>
              <div className="space-y-2 px-2 pb-3">
                {col.cards.map(c => {
                  const topic = graph.byId.get(c.topic_id);
                  if (!topic) return null;
                  const parentNames = graph.parents(topic.id).map(p => p.name);
                  const asleep = topic.is_hibernated;
                  return (
                    <div
                      key={c.id}
                      draggable={!busy}
                      onDragStart={() => setDragId(c.id)}
                      onDragEnd={() => { setDragId(null); setOverCol(null); }}
                      className={`${acCard} p-3 space-y-2 cursor-grab active:cursor-grabbing ${dragId === c.id || asleep ? 'opacity-50' : ''}`}
                      style={{ borderLeft: `3px solid ${statusColor(c.status)}` }}
                    >
                      <div className="flex items-start gap-1.5">
                        <GripVertical size={14} className="text-gray-300 mt-0.5 shrink-0" />
                        <button className="flex-1 min-w-0 text-left" onClick={() => openTopic(topic.id)}>
                          <div className="flex items-center gap-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {topic.is_milestone && <Star size={12} className="fill-warning text-warning shrink-0" />}
                            <span className="truncate">{topic.name}</span>
                          </div>
                          {parentNames.length > 0 && <div className="text-[11px] text-gray-500 truncate">{parentNames.join(' · ')}</div>}
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <AcLevelBadge level={graph.levelOf(topic.id)} />
                        {asleep && (
                          <button
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline disabled:opacity-40"
                            disabled={busy}
                            onClick={() => void wake(topic.id)}
                            title={t('ac.hibernate.wake')}
                          ><Sun size={11} />{t('ac.hibernate.wake')}</button>
                        )}
                        {(kind !== 'new' && activeRound === 'all') && <span className="text-[11px] font-medium text-gray-500">{cycleLabel(c, t)}</span>}
                      </div>
                      <AcProgress achieved={c.achieved_points} total={c.total_points} size="sm" />
                      <div className="flex items-center gap-1.5">
                        {c.status === 'in_progress' && (
                          <>
                            <button
                              className="p-1.5 rounded-md border border-gray-200 dark:border-gray-600 text-danger hover:bg-danger/10 disabled:opacity-30"
                              disabled={c.achieved_points === 0}
                              onClick={() => setProgress({ cycle: c, direction: -1 })}
                              title={t('ac.progress.remove')}
                            ><Minus size={14} /></button>
                            <button
                              className="p-1.5 rounded-md border border-gray-200 dark:border-gray-600 text-success hover:bg-success/10 disabled:opacity-30"
                              disabled={c.achieved_points >= c.total_points}
                              onClick={() => setProgress({ cycle: c, direction: 1 })}
                              title={t('ac.progress.add')}
                            ><Plus size={14} /></button>
                          </>
                        )}
                        <select
                          value={c.status}
                          disabled={busy}
                          onChange={e => requestMove(c, e.target.value as CycleStatus)}
                          className="ml-auto text-xs rounded-md border border-gray-200 dark:border-gray-600 bg-transparent px-1.5 py-1 text-gray-600 dark:text-gray-300"
                          aria-label={t('ac.detail.status')}
                        >
                          {STATUSES.map(s => <option key={s} value={s}>{t(`ac.status.${s}`)}</option>)}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {progress && userId && graph.byId.get(progress.cycle.topic_id) && (
        <AcProgressModal
          userId={userId}
          cycle={progress.cycle}
          topic={graph.byId.get(progress.cycle.topic_id)!}
          direction={progress.direction}
          onClose={() => setProgress(null)}
          onDone={async () => { setProgress(null); await reload(); }}
        />
      )}

      <Modal
        isOpen={!!pending}
        onClose={() => !busy && setPending(null)}
        title={pending?.status === 'complete' ? t('ac.board.completeTitle') : t('ac.board.moveTitle').replace('{status}', t(`ac.status.${pending?.status ?? 'todo'}`))}
        className="max-w-2xl"
      >
        {pending && (() => {
          const { cycle: c, status } = pending;
          const topic = graph.byId.get(c.topic_id);
          const fillsPoints = status === 'complete' && c.achieved_points < c.total_points;
          const ask = ASK_HIBERNATE.includes(status) && !topic?.is_hibernated;
          const go = (hibernate: boolean) => { setPending(null); void move(c, status, fillsPoints ? completeNote : undefined, hibernate); };
          const label = status === 'complete' ? t('ac.board.markComplete') : t('ac.board.move');
          return (
            <div className="space-y-4">
              {fillsPoints && (
                <>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {t('ac.board.completeHint').replace('{n}', String(c.total_points - c.achieved_points))}
                  </p>
                  <AcRichEditor value={completeNote} onChange={setCompleteNote} placeholder={t('ac.progress.whyPlaceholder')} />
                </>
              )}
              {ask && (
                <div className="flex items-start gap-3 bg-primary/5 border border-primary/20 rounded-lg p-4 text-sm text-gray-700 dark:text-gray-300">
                  <Moon size={18} className="text-primary shrink-0 mt-0.5" />
                  {t('ac.hibernate.ask').replace('{name}', topic?.name ?? '')}
                </div>
              )}
              <div className="flex flex-wrap justify-end gap-3 pt-2">
                <Button variant="ghost" onClick={() => setPending(null)} disabled={busy}>{t('pf.common.cancel')}</Button>
                <Button variant={ask ? 'outline' : 'primary'} disabled={busy} onClick={() => go(false)}>{label}</Button>
                {ask && (
                  <Button disabled={busy} onClick={() => go(true)}>
                    <Moon size={14} className="mr-1" />{t('ac.hibernate.andHibernate').replace('{action}', label)}
                  </Button>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>

      {dialogs}
    </div>
  );
};
