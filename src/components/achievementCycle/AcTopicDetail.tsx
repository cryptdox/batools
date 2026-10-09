import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { Pencil, Trash2, Plus, Minus, Star, ChevronRight, Link2, Unlink, History, Play, AlertTriangle, ArchiveRestore, Moon, Sun } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { errorMessage } from '../../lib/portfolio';
import {
  cycleLabel, KINDS, STATUSES, ASK_HIBERNATE, acRpc, percent, setHibernated, type CycleKind, type CycleStatus, type CycleRef, type AcCycle, type AcLog, type LinkRole, type useAcData,
} from '../../lib/achievementCycle';
import { Badge, Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { pfInputClass } from '../portfolio/PfFieldInput';
import { AcArchivedBadge, AcLevelBadge, AcProgress, AcRichView, AcStatusDot } from './AcUi';
import { AcRemoveModal } from './AcRemoveModal';
import { AcProgressModal } from './AcProgressModal';
import { AcTopicMultiPicker } from './AcTopicMultiPicker';

type AcData = ReturnType<typeof useAcData>;

type Props = {
  data: AcData;
  topicId: string;
  cycle: CycleRef;
  onClose: () => void;
  onOpenTopic: (id: string) => void;
  onEdit: (id: string) => void;
  onAddChild: (parentId: string) => void;
};

const section = 'space-y-2';
const heading = 'text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400';

/** Everything about one topic: paths, children, domains, cycles and their log. */
export const AcTopicDetail = ({ data, topicId, cycle, onClose, onOpenTopic, onEdit, onAddChild }: Props) => {
  const { t } = useLanguage();
  const { userId, graph, topics, domains, cycles, reload, rollupOf } = data;
  const topic = graph.byId.get(topicId);
  const [linkChildren, setLinkChildren] = useState<Set<string>>(new Set());
  const [cascade, setCascade] = useState(true);
  const [busy, setBusy] = useState(false);
  const [openLog, setOpenLog] = useState<string | null>(null);
  const [logs, setLogs] = useState<AcLog[]>([]);
  const [totals, setTotals] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Deleting a revise / practice round: which one, whether beneath too, and its log count.
  const [roundToDelete, setRoundToDelete] = useState<AcCycle | null>(null);
  // Progress / status straight from the topic (parents have no board card).
  const [progressOf, setProgressOf] = useState<{ cycle: AcCycle; direction: 1 | -1 } | null>(null);
  const [roundCascade, setRoundCascade] = useState(false);
  const [roundLogs, setRoundLogs] = useState<number | null>(null);
  // A status change to Complete / Cancel / Backlog waits here to ask about hibernating.
  const [pendingStatus, setPendingStatus] = useState<{ cycle: AcCycle; status: CycleStatus } | null>(null);

  // A parent's points are always computed from its children (migrations 050 / 051):
  // no hand-made progress on any topic with children.
  const childIds = new Set((graph.childLinks.get(topicId) ?? []).map(l => l.child_id));
  const isComputed = (_c: AcCycle) => childIds.size > 0;

  const myCycles = cycles
    .filter(c => c.topic_id === topicId)
    .sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind) || a.round - b.round);

  useEffect(() => {
    if (!openLog || !userId) return;
    void supabase.from('ac_progress_logs').select('*').eq('user_id', userId).eq('cycle_id', openLog)
      .order('created_at', { ascending: false }).then(({ data: rows, error }) => {
        if (error) toast.error(error.message);
        setLogs((rows ?? []) as AcLog[]);
      });
  }, [openLog, userId]);

  // The cycles a round delete would remove: this one, plus the same round beneath when cascading.
  const roundIds = (c: AcCycle, withBeneath: boolean) => {
    if (!withBeneath) return [c.id];
    const below = graph.subtree(c.topic_id);
    return cycles.filter(x => x.kind === c.kind && x.round === c.round && below.has(x.topic_id)).map(x => x.id);
  };

  useEffect(() => {
    if (!roundToDelete || !userId) return;
    setRoundLogs(null);
    void supabase.from('ac_progress_logs').select('id', { count: 'exact', head: true }).eq('user_id', userId)
      .in('cycle_id', roundIds(roundToDelete, roundCascade)).then(({ count }) => setRoundLogs(count ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundToDelete, roundCascade, userId]);

  if (!topic || !userId) return null;

  const run = async (fn: () => Promise<boolean>) => {
    setBusy(true);
    try {
      if (await fn()) await reload();
    } finally {
      setBusy(false);
    }
  };

  const setRole = (linkId: string, role: LinkRole | null) => run(async () => {
    const { error } = await supabase.from('ac_topic_links').update({ role }).eq('id', linkId).eq('user_id', userId);
    if (error) { toast.error(errorMessage(error, t('pf.common.saveError'))); return false; }
    return true;
  });

  const unlink = (linkId: string) => run(async () => {
    const { error } = await supabase.from('ac_topic_links').delete().eq('id', linkId).eq('user_id', userId);
    if (error) { toast.error(errorMessage(error, t('pf.common.deleteError'))); return false; }
    return true;
  });

  const addExistingChildren = () => run(async () => {
    if (linkChildren.size === 0) return false;
    const base = graph.childLinks.get(topicId)?.length ?? 0;
    const { error } = await supabase.from('ac_topic_links').insert([...linkChildren].map((childId, i) => ({
      user_id: userId, parent_id: topicId, child_id: childId, sort_order: base + i + 1,
    })));
    if (error) { toast.error(errorMessage(error, t('pf.common.saveError'))); return false; }
    setLinkChildren(new Set());
    return true;
  });

  const startCycle = (kind: CycleKind) => run(async () => {
    const round = await acRpc<number>('ac_start_cycle', {
      p_user_id: userId, p_topic_id: topicId, p_kind: kind, p_round: null, p_cascade: cascade,
    }, t('pf.common.saveError'));
    if (round === null) return false;
    toast.success(t('ac.detail.cycleStarted').replace('{cycle}', cycleLabel({ kind, round }, t)));
    return true;
  });

  const saveTotal = (c: AcCycle) => run(async () => {
    const n = Number(totals[c.id]);
    if (!Number.isInteger(n) || n < c.achieved_points) {
      toast.error(t('ac.detail.totalMin').replace('{n}', String(c.achieved_points)));
      return false;
    }
    const { error } = await supabase.from('ac_cycles').update({ total_points: n, updated_at: new Date().toISOString() }).eq('id', c.id).eq('user_id', userId);
    if (error) { toast.error(errorMessage(error, t('pf.common.saveError'))); return false; }
    setTotals(s => { const next = { ...s }; delete next[c.id]; return next; });
    return true;
  });

  // Completing through the dropdown fills the remaining points (logged as "Marked complete").
  const setStatus = (c: AcCycle, status: CycleStatus, hibernate = false) => run(async () => {
    if (status === c.status) return false;
    const res = await acRpc('ac_set_status', { p_user_id: userId, p_cycle_id: c.id, p_status: status, p_sort_order: null, p_comment_html: null }, t('pf.common.saveError'));
    if (res && hibernate) await setHibernated(userId, [topicId], true, t('pf.common.saveError'));
    return !!res;
  });

  const requestStatus = (c: AcCycle, status: CycleStatus) => {
    if (status === c.status) return;
    if (ASK_HIBERNATE.includes(status) && !topic?.is_hibernated) setPendingStatus({ cycle: c, status });
    else void setStatus(c, status);
  };

  const toggleHibernate = () => run(() => setHibernated(userId, [topicId], !topic?.is_hibernated, t('pf.common.saveError')));

  const deleteRound = () => run(async () => {
    if (!roundToDelete) return false;
    const res = await acRpc<{ cycles: number; logs: number }>('ac_delete_cycle', {
      p_user_id: userId, p_cycle_id: roundToDelete.id, p_cascade: roundCascade,
    }, t('pf.common.deleteError'));
    if (!res) return false;
    toast.success(t('ac.detail.roundDeleted').replace('{cycles}', String(res.cycles)).replace('{logs}', String(res.logs)));
    if (openLog && roundIds(roundToDelete, roundCascade).includes(openLog)) setOpenLog(null);
    setRoundToDelete(null);
    return true;
  });

  // Brings back this topic and whatever was archived together with it.
  const restore = () => run(async () => {
    const res = await acRpc<{ topics: number }>('ac_restore', { p_user_id: userId, p_topic_id: topicId, p_domain_id: null }, t('ac.archive.restoreError'));
    if (!res) return false;
    toast.success(t('ac.archive.restoredToast').replace('{topics}', String(res.topics)));
    return true;
  });

  const paths = graph.pathsTo(topicId);
  const children = graph.childLinks.get(topicId) ?? [];
  const { own, inherited } = graph.domainsOf(topicId);
  const domainName = (id: string) => domains.find(d => d.id === id);
  // Existing topics that can go under this one without making a loop.
  const ancestors = graph.ancestors(topicId);
  const linkable = topics.filter(x => x.id !== topicId && !ancestors.has(x.id) && !children.some(l => l.child_id === x.id));
  const roll = rollupOf(topicId, cycle);

  return (
    <Modal isOpen onClose={() => !busy && onClose()} title={topic.name} className="max-w-4xl">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {topic.is_archived && <AcArchivedBadge />}
            <AcLevelBadge level={graph.levelOf(topicId)} />
            {topic.is_hibernated && <Badge variant="muted"><Moon size={11} className="inline mr-1" />{t('ac.hibernate.hibernated')}</Badge>}
            {topic.is_milestone && <Badge variant="warning"><Star size={11} className="inline mr-1 fill-current" />{t('ac.topic.milestone')}</Badge>}
            <Badge variant="muted">{t('ac.topic.points')}: {topic.default_points}</Badge>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void toggleHibernate()} title={t('ac.hibernate.topicHint')}>
              {topic.is_hibernated
                ? <><Sun size={14} className="mr-1" />{t('ac.hibernate.wake')}</>
                : <><Moon size={14} className="mr-1" />{t('ac.hibernate.hibernate')}</>}
            </Button>
            <Button size="sm" variant="outline" onClick={() => onEdit(topicId)}><Pencil size={14} className="mr-1" />{t('pf.common.edit')}</Button>
            {topic.is_archived && (
              <Button size="sm" onClick={() => void restore()} disabled={busy}><ArchiveRestore size={14} className="mr-1" />{t('ac.archive.restore')}</Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setConfirmDelete(true)}><Trash2 size={14} className="mr-1 text-danger" />{t('pf.common.delete')}</Button>
          </div>
        </div>

        {roll && (
          <div>
            <div className={heading}>{cycleLabel(cycle, t)} · {t('ac.detail.withChildren')}</div>
            <AcProgress achieved={roll.achieved} total={roll.total} />
          </div>
        )}

        {(topic.description || topic.story_point_description) && (
          <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            {topic.description && <p className="whitespace-pre-line">{topic.description}</p>}
            {topic.story_point_description && <p><span className="font-medium">{t('ac.topic.spMeaning')}:</span> {topic.story_point_description}</p>}
          </div>
        )}

        <div className={section}>
          <div className={heading}>{t('ac.domains')}</div>
          <div className="flex flex-wrap gap-1.5">
            {own.size + inherited.size === 0 && <span className="text-sm text-gray-500">—</span>}
            {[...own].map(id => domainName(id) && (
              <span key={id} className="px-2.5 py-0.5 rounded-full text-xs font-semibold text-white" style={{ background: domainName(id)!.color }}>{domainName(id)!.name}</span>
            ))}
            {[...inherited].map(id => domainName(id) && (
              <span key={id} className="px-2.5 py-0.5 rounded-full text-xs border border-dashed text-gray-600 dark:text-gray-300" style={{ borderColor: domainName(id)!.color }} title={t('ac.detail.inherited')}>
                {domainName(id)!.name}
              </span>
            ))}
          </div>
        </div>

        <div className={section}>
          <div className={heading}>{t('ac.detail.paths')}</div>
          {paths.length === 0 ? (
            <p className="text-sm text-gray-500">{t('ac.detail.isSubject')}</p>
          ) : (
            <ul className="space-y-2">
              {paths.map((path, i) => {
                const last = path[path.length - 1];
                const role = graph.roleOf(last);
                return (
                  <li key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 dark:border-gray-700 p-2.5">
                    <span className="flex flex-wrap items-center gap-1 text-sm">
                      {path.map((l, k) => (
                        <span key={l.id} className="inline-flex items-center gap-1">
                          {k > 0 && <ChevronRight size={13} className="text-gray-400" />}
                          <button className="text-primary hover:underline" onClick={() => onOpenTopic(l.parent_id)}>{graph.byId.get(l.parent_id)?.name}</button>
                        </span>
                      ))}
                      <ChevronRight size={13} className="text-gray-400" />
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{topic.name}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      {(['general', 'area'] as const).map(r => (
                        <button
                          key={r}
                          disabled={busy}
                          onClick={() => void setRole(last.id, last.role === r ? null : r)}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium border ${role === r
                            ? 'bg-primary text-white border-primary'
                            : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                          title={last.role === r ? t('ac.detail.roleAutoHint') : undefined}
                        >
                          {t(`ac.level.${r}`)}
                        </button>
                      ))}
                      {last.role === null && <span className="text-[11px] text-gray-400 ml-1">{t('ac.detail.auto')}</span>}
                      <button className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700" disabled={busy} onClick={() => void unlink(last.id)} title={t('ac.detail.unlink')}>
                        <Unlink size={14} />
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className={section}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className={heading}>{t('ac.detail.children')} ({children.length})</div>
            <div className="flex flex-wrap items-center gap-2">
              <AcTopicMultiPicker topics={linkable} value={linkChildren} onChange={setLinkChildren} placeholder={t('ac.detail.linkExisting')} />
              <Button size="sm" variant="outline" disabled={linkChildren.size === 0 || busy} onClick={() => void addExistingChildren()}>
                <Link2 size={14} className="mr-1" />{t('ac.detail.link')}{linkChildren.size > 1 ? ` (${linkChildren.size})` : ''}
              </Button>
              <Button size="sm" onClick={() => onAddChild(topicId)}><Plus size={14} className="mr-1" />{t('ac.detail.newChild')}</Button>
            </div>
          </div>
          {children.length === 0 ? (
            <p className="text-sm text-gray-500">{t('ac.detail.noChildren')}</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700 rounded-lg border border-gray-100 dark:border-gray-700">
              {children.map(l => {
                const child = graph.byId.get(l.child_id)!;
                const r = rollupOf(child.id, cycle);
                return (
                  <li key={l.id} className="flex items-center gap-3 p-2.5">
                    <button className="flex-1 min-w-0 text-left" onClick={() => onOpenTopic(child.id)}>
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{child.name}</span>
                        <AcLevelBadge level={graph.roleOf(l)} />
                        {child.is_milestone && <Star size={12} className="fill-warning text-warning shrink-0" />}
                      </span>
                    </button>
                    <div className="w-48"><AcProgress achieved={r?.achieved ?? 0} total={r?.total ?? 0} size="sm" /></div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className={section}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className={heading}>{t('ac.detail.cycles')}</div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                <input type="checkbox" checked={cascade} onChange={e => setCascade(e.target.checked)} className="w-3.5 h-3.5 text-primary rounded border-gray-300" />
                {t('ac.detail.cascade')}
              </label>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void startCycle('revise')}><Play size={13} className="mr-1" />{t('ac.detail.startRevise')}</Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void startCycle('practice')}><Play size={13} className="mr-1" />{t('ac.detail.startPractice')}</Button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-700">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/40 text-left text-xs text-gray-500">
                <tr>
                  <th className="px-3 py-2">{t('ac.cycle')}</th>
                  <th className="px-3 py-2">{t('ac.detail.status')}</th>
                  <th className="px-3 py-2 w-48">{t('ac.detail.own')}</th>
                  <th className="px-3 py-2">{t('ac.detail.total')}</th>
                  <th className="px-3 py-2 w-40">{t('ac.detail.withChildren')}</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {myCycles.map(c => {
                  const r = rollupOf(topicId, c);
                  const draft = totals[c.id];
                  return [
                    <tr key={c.id}>
                      <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">{cycleLabel(c, t)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          <AcStatusDot status={c.status} />
                          <select
                            value={c.status}
                            disabled={busy}
                            onChange={e => requestStatus(c, e.target.value as CycleStatus)}
                            className="text-xs rounded-md border border-gray-200 dark:border-gray-600 bg-transparent px-1.5 py-1 text-gray-700 dark:text-gray-300"
                            aria-label={t('ac.detail.status')}
                          >
                            {STATUSES.map(st => <option key={st} value={st}>{t(`ac.status.${st}`)}</option>)}
                          </select>
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-1.5">
                          {isComputed(c) && (
                            <span className="text-[11px] text-gray-500 whitespace-nowrap" title={t('ac.detail.computedHint')}>{t('ac.detail.computed')}</span>
                          )}
                          {c.status === 'in_progress' && !isComputed(c) && (
                            <>
                              <button className="p-1 rounded border border-gray-200 dark:border-gray-600 text-danger disabled:opacity-30" disabled={c.achieved_points === 0} onClick={() => setProgressOf({ cycle: c, direction: -1 })} title={t('ac.progress.remove')}><Minus size={12} /></button>
                              <button className="p-1 rounded border border-gray-200 dark:border-gray-600 text-success disabled:opacity-30" disabled={c.achieved_points >= c.total_points} onClick={() => setProgressOf({ cycle: c, direction: 1 })} title={t('ac.progress.add')}><Plus size={12} /></button>
                            </>
                          )}
                          <span className="flex-1 min-w-24"><AcProgress achieved={c.achieved_points} total={c.total_points} size="sm" /></span>
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1">
                          <input
                            type="number"
                            min={c.achieved_points}
                            step={1}
                            value={draft ?? String(c.total_points)}
                            onChange={e => setTotals(s => ({ ...s, [c.id]: e.target.value }))}
                            className={`${pfInputClass} h-8 py-0 w-20`}
                            aria-label={t('ac.detail.total')}
                          />
                          {draft !== undefined && draft !== String(c.total_points) && (
                            <Button size="sm" disabled={busy} onClick={() => void saveTotal(c)}>{t('pf.common.save')}</Button>
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-2">{r && <span className="text-xs tabular-nums text-gray-600 dark:text-gray-300">{percent(r.achieved, r.total)}% · {r.achieved}/{r.total}</span>}</td>
                      <td className="px-2 py-2">
                        <span className="inline-flex">
                          <button className={`p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 ${openLog === c.id ? 'text-primary' : 'text-gray-500'}`} onClick={() => setOpenLog(openLog === c.id ? null : c.id)} title={t('ac.detail.log')}>
                            <History size={15} />
                          </button>
                          {c.kind !== 'new' && (
                            <button
                              className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                              disabled={busy}
                              onClick={() => { setRoundCascade(false); setRoundToDelete(c); }}
                              title={t('ac.detail.deleteRound')}
                            >
                              <Trash2 size={15} className="text-danger" />
                            </button>
                          )}
                        </span>
                      </td>
                    </tr>,
                    openLog === c.id && (
                      <tr key={`${c.id}-log`}>
                        <td colSpan={6} className="px-3 py-3 bg-gray-50/60 dark:bg-gray-900/30">
                          {logs.length === 0 ? <p className="text-sm text-gray-500">{t('ac.detail.noLog')}</p> : (
                            <ul className="space-y-3">
                              {logs.map(l => (
                                <li key={l.id} className="text-sm">
                                  <div className="text-xs text-gray-500">
                                    <span className={l.delta > 0 ? 'text-success font-semibold' : 'text-danger font-semibold'}>{l.delta > 0 ? `+${l.delta}` : l.delta}</span>
                                    {' '}→ {l.achieved_after}/{c.total_points} · {format(new Date(l.created_at), 'dd MMM yyyy, h:mm a')}
                                  </div>
                                  <AcRichView html={l.comment_html} />
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    ),
                  ];
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('ac.detail.totalHint')}</p>
        </div>
      </div>

      <Modal isOpen={!!roundToDelete} onClose={() => !busy && setRoundToDelete(null)} title={roundToDelete ? `${t('ac.detail.deleteRound')} · ${cycleLabel(roundToDelete, t)}` : ''}>
        {roundToDelete && (() => {
          const beneath = roundIds(roundToDelete, true).length - 1;
          return (
            <div className="space-y-4">
              <div className="flex items-start gap-3 bg-danger/5 border border-danger/20 rounded-lg p-4 text-sm text-gray-700 dark:text-gray-300">
                <AlertTriangle size={20} className="text-danger shrink-0" />
                <div>
                  {t('ac.detail.deleteRoundHint').replace('{cycle}', cycleLabel(roundToDelete, t)).replace('{name}', topic.name)}
                  <div className="mt-1 font-medium">
                    {roundLogs === null ? '…' : t('ac.detail.deleteRoundLogs').replace('{n}', String(roundLogs))}
                  </div>
                </div>
              </div>
              {beneath > 0 && (
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                  <input type="checkbox" checked={roundCascade} onChange={e => setRoundCascade(e.target.checked)} className="w-4 h-4 text-primary rounded border-gray-300" />
                  {t('ac.detail.deleteRoundBeneath').replace('{n}', String(beneath)).replace('{cycle}', cycleLabel(roundToDelete, t))}
                </label>
              )}
              <div className="flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setRoundToDelete(null)} disabled={busy}>{t('pf.common.cancel')}</Button>
                <Button variant="danger" onClick={() => void deleteRound()} disabled={busy || roundLogs === null}>{t('pf.common.delete')}</Button>
              </div>
            </div>
          );
        })()}
      </Modal>

      <Modal
        isOpen={!!pendingStatus}
        onClose={() => !busy && setPendingStatus(null)}
        title={t('ac.board.moveTitle').replace('{status}', t(`ac.status.${pendingStatus?.status ?? 'todo'}`))}
      >
        {pendingStatus && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-primary/5 border border-primary/20 rounded-lg p-4 text-sm text-gray-700 dark:text-gray-300">
              <Moon size={18} className="text-primary shrink-0 mt-0.5" />
              {t('ac.hibernate.ask').replace('{name}', topic.name)}
            </div>
            <div className="flex flex-wrap justify-end gap-3">
              <Button variant="ghost" onClick={() => setPendingStatus(null)} disabled={busy}>{t('pf.common.cancel')}</Button>
              <Button variant="outline" disabled={busy} onClick={() => { const p = pendingStatus; setPendingStatus(null); void setStatus(p.cycle, p.status); }}>
                {t('ac.board.move')}
              </Button>
              <Button disabled={busy} onClick={() => { const p = pendingStatus; setPendingStatus(null); void setStatus(p.cycle, p.status, true); }}>
                <Moon size={14} className="mr-1" />{t('ac.hibernate.andHibernate').replace('{action}', t('ac.board.move'))}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {progressOf && (
        <AcProgressModal
          userId={userId}
          cycle={progressOf.cycle}
          topic={topic}
          direction={progressOf.direction}
          onClose={() => setProgressOf(null)}
          onDone={async () => { setProgressOf(null); await reload(); }}
        />
      )}
      {confirmDelete && (
        <AcRemoveModal
          userId={userId}
          topicId={topicId}
          name={topic.name}
          alreadyArchived={topic.is_archived}
          onClose={() => setConfirmDelete(false)}
          onDone={async () => { setConfirmDelete(false); onClose(); await reload(); }}
        />
      )}
    </Modal>
  );
};
