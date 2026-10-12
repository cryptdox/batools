import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { Plus, Pencil, Trash2, Search, Star, Layers, ListPlus, FolderTree, Unlink, ChevronLeft, ChevronRight, ArchiveRestore, Hash } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { errorMessage } from '../../lib/portfolio';
import { acRpc, rankByName, useAcData, useSelectedCycle, type AcDomain } from '../../lib/achievementCycle';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Pagination, usePagination } from '../../components/ui/Pagination';
import { pfInputClass } from '../../components/portfolio/PfFieldInput';
import { AcArchivedBadge, AcArchiveToggle, AcCyclePicker, AcLevelBadge, AcProgress, acCard, acSelectClass } from '../../components/achievementCycle/AcUi';
import { AcRemoveModal } from '../../components/achievementCycle/AcRemoveModal';
import { AcAssignParentModal } from '../../components/achievementCycle/AcAssignParentModal';
import { AcScheduleEditor } from '../../components/achievementCycle/AcSchedule';
import { AcDomainTypes, AcTypeBadge } from '../../components/achievementCycle/AcDomainTypes';
import { useAcDialogs } from '../../components/achievementCycle/useAcDialogs';
import { AcTopicFilterSelects, UNASSIGNED, useTopicFilter } from '../../components/achievementCycle/AcTopicFilters';
import { SECTION_RESOURCES, useAccess } from '../../lib/permissions';
import { PfPageHeader } from '../Portfolio/PfPageHeader';

/** Domain cards are fetched this many at a time. */
const DOMAIN_PAGE = 4;

const DOMAIN_COLORS = ['#6c5ce7', '#2a78d6', '#1baf7a', '#eb6834', '#e87ba4', '#eda100', '#008300', '#e34948'];

/** Domains, and every topic with its level, parents and progress. */
export const AcTopics = () => {
  const { t } = useLanguage();
  const data = useAcData();
  const { userId, loading, domains, topics, graph, cycleRefs, rollupOf, domainRollupOf, reload, domainTypes, showArchived, setShowArchived } = data;
  const { cycle, cycleKey, select } = useSelectedCycle(cycleRefs);
  const { openTopic, newTopic, bulkTopics, dialogs } = useAcDialogs(data, cycle);

  const [search, setSearch] = useState('');
  // Milestones only / no milestones / everything.
  const [msFilter, setMsFilter] = useState<'' | 'yes' | 'no'>('');
  // Domain (always one) → subject → level (both "all" by default).
  const filter = useTopicFilter(graph, domains);
  const { activeDomain, activeSubject, setDomain: setDomainFilter } = filter;
  const topicList = useRef<HTMLDivElement>(null);
  // Domains and domain types are their own IAM resources (read / create / update / delete).
  const { canRead, has } = useAccess();
  const D = SECTION_RESOURCES.acDomains;
  const T = SECTION_RESOURCES.acDomainTypes;
  const domainCan = { create: has(D, 'CREATE'), update: has(D, 'UPDATE') || has(D, 'UPDATE_ALL'), remove: has(D, 'DELETE') || has(D, 'DELETE_ALL') };
  const typeCan = { create: has(T, 'CREATE'), update: has(T, 'UPDATE') || has(T, 'UPDATE_ALL'), remove: has(T, 'DELETE') || has(T, 'DELETE_ALL') };
  // Clicking a domain card shows that domain's topics in the list below.
  const showDomainTopics = (id: string) => {
    setDomainFilter(id);
    topicList.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const [domainPage, setDomainPage] = useState(0);
  const [pageDomains, setPageDomains] = useState<AcDomain[]>([]);
  const [domainTotal, setDomainTotal] = useState(0);

  const [domainForm, setDomainForm] = useState<AcDomain | 'new' | null>(null);
  const [dName, setDName] = useState('');
  const [dDescription, setDDescription] = useState('');
  const [dColor, setDColor] = useState(DOMAIN_COLORS[0]);
  const [dType, setDType] = useState('');
  const [dSaving, setDSaving] = useState(false);
  const [deleteDomain, setDeleteDomain] = useState<AcDomain | null>(null);
  // Ticked topics in the list, for removing several at once.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [removeSelected, setRemoveSelected] = useState(false);
  // Bulk: story points for every ticked topic (null = closed), and a running bulk action.
  const [bulkPoints, setBulkPoints] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  // "Make milestones" form: a schedule for all of them, and whether they (and their direct children) wake up.
  const [msForm, setMsForm] = useState<{ weekdays: number[]; dates: string[]; awake: 'keep' | 'awake' | 'asleep' } | null>(null);
  const [assignParent, setAssignParent] = useState(false);
  // Unlinking the ticked topics from all their parents, or all their children from them.
  const [clearLinks, setClearLinks] = useState<'parents' | 'children' | null>(null);
  const [clearing, setClearing] = useState(false);

  const openDomain = (d: AcDomain | 'new') => {
    setDomainForm(d);
    setDName(d === 'new' ? '' : d.name);
    setDDescription(d === 'new' ? '' : d.description ?? '');
    setDColor(d === 'new' ? DOMAIN_COLORS[domains.length % DOMAIN_COLORS.length] : d.color);
    setDType(d === 'new' ? '' : d.type_id ?? '');
  };

  const saveDomain = async () => {
    if (!userId || !domainForm || !dName.trim()) return;
    setDSaving(true);
    const row = { name: dName.trim(), description: dDescription.trim() || null, color: dColor, type_id: dType || null, updated_at: new Date().toISOString() };
    const { error } = domainForm === 'new'
      ? await supabase.from('ac_domains').insert([{ ...row, user_id: userId, sort_order: domains.length + 1 }])
      : await supabase.from('ac_domains').update(row).eq('id', domainForm.id).eq('user_id', userId);
    setDSaving(false);
    if (error) return toast.error(errorMessage(error, t('pf.common.saveError')));
    setDomainForm(null);
    toast.success(t('pf.common.updated'));
    await reload();
  };

  // Brings back an archived domain and whatever was archived together with it.
  const restoreDomain = async (d: AcDomain) => {
    if (!userId) return;
    const res = await acRpc<{ topics: number }>('ac_restore', { p_user_id: userId, p_topic_id: null, p_domain_id: d.id }, t('ac.archive.restoreError'));
    if (!res) return;
    toast.success(t('ac.archive.restoredToast').replace('{topics}', String(res.topics)));
    await reload();
  };

  // Domain cards: one page of DOMAIN_PAGE from the server. Re-runs after any
  // reload (domains changes identity), so add / edit / delete show up.
  const fetchDomainPage = useCallback(async () => {
    if (!userId) return;
    const from = domainPage * DOMAIN_PAGE;
    let query = supabase.from('ac_domains').select('*', { count: 'exact' }).eq('user_id', userId);
    if (!showArchived) query = query.eq('is_archived', false);
    const { data: rows, count, error } = await query.order('sort_order').order('name').range(from, from + DOMAIN_PAGE - 1);
    if (error) return toast.error(errorMessage(error, t('pf.common.loadError')));
    // Deleting the last card of a page steps back a page.
    if ((rows ?? []).length === 0 && domainPage > 0) return setDomainPage(p => p - 1);
    setPageDomains((rows ?? []) as AcDomain[]);
    setDomainTotal(count ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, domainPage, domains, showArchived]);

  useEffect(() => { void fetchDomainPage(); }, [fetchDomainPage]);

  const shown = rankByName(topics.filter(x => filter.matches(x.id) && (!msFilter || x.is_milestone === (msFilter === 'yes'))), search);
  const pager = usePagination(shown, 25);
  const { setPage } = pager;
  // A new filter starts from the first page.
  useEffect(() => { setPage(1); }, [filter.key, search, msFilter, setPage]);

  // Only topics still listed stay ticked (after a reload or archive toggle).
  const picked = topics.filter(x => selected.has(x.id));
  const pageIds = pager.pageItems.map(x => x.id);
  const pageAllPicked = pageIds.length > 0 && pageIds.every(id => selected.has(id));
  const toggleOne = (id: string) => setSelected(s => {
    const next = new Set(s);
    if (!next.delete(id)) next.add(id);
    return next;
  });
  const togglePage = () => setSelected(s => {
    const next = new Set(s);
    for (const id of pageIds) if (pageAllPicked) next.delete(id); else next.add(id);
    return next;
  });
  const linkCount = (side: 'parents' | 'children') =>
    picked.reduce((n, x) => n + ((side === 'parents' ? graph.parentLinks : graph.childLinks).get(x.id)?.length ?? 0), 0);
  const doClearLinks = async () => {
    if (!userId || !clearLinks) return;
    setClearing(true);
    const { error } = await supabase.from('ac_topic_links').delete().eq('user_id', userId)
      .in(clearLinks === 'parents' ? 'child_id' : 'parent_id', picked.map(x => x.id));
    setClearing(false);
    if (error) return toast.error(errorMessage(error, t('pf.common.deleteError')));
    toast.success(t('ac.clearLinks.done').replace('{n}', String(linkCount(clearLinks))));
    setClearLinks(null);
    setSelected(new Set());
    await reload();
  };
  // Every ticked topic becomes a milestone of its own (or, when all already are, stops being one).
  const allMilestones = picked.length > 0 && picked.every(x => x.is_milestone);
  const doMilestones = async () => {
    if (!userId) return;
    const make = !allMilestones;
    const form = msForm;
    // Making: every ticked topic (also ones that already were, to take the schedule); unmaking: the milestones.
    const ids = make ? picked.map(x => x.id) : picked.filter(x => x.is_milestone).map(x => x.id);
    setBulkBusy(true);
    try {
      // Like the topic form: a topic that stops being a milestone drops its schedule.
      // An empty schedule in the form leaves each topic's own schedule as it is.
      const scheduled = !!form && (form.weekdays.length > 0 || form.dates.length > 0);
      const patch = make
        ? { is_milestone: true, ...(scheduled ? { schedule_weekdays: form!.weekdays, schedule_dates: form!.dates } : {}) }
        : { is_milestone: false, schedule_weekdays: [], schedule_dates: [] };
      const { error } = await supabase.from('ac_topics').update({ ...patch, updated_at: new Date().toISOString() }).eq('user_id', userId).in('id', ids);
      if (error) throw error;
      // Awake / hibernated like the Milestones page switch: the milestone and its direct children.
      if (make && form && form.awake !== 'keep') {
        const all = [...new Set(ids.flatMap(id => [id, ...graph.children(id).map(c => c.id)]))];
        const { error: e2 } = await supabase.from('ac_topics').update({ is_hibernated: form.awake === 'asleep', updated_at: new Date().toISOString() }).eq('user_id', userId).in('id', all);
        if (e2) throw e2;
      }
      toast.success(t(make ? 'ac.topics.madeMilestones' : 'ac.topics.unmadeMilestones').replace('{n}', String(ids.length)));
      setMsForm(null);
      setSelected(new Set());
      await reload();
    } catch (e) {
      toast.error(errorMessage(e, t('pf.common.saveError')));
    } finally {
      setBulkBusy(false);
    }
  };
  // Story points go through the database per topic, so each topic's open cycles follow.
  const bulkPointsNum = bulkPoints === null ? NaN : Number(bulkPoints);
  const doPoints = async () => {
    if (!userId || !Number.isInteger(bulkPointsNum) || bulkPointsNum < 0) return;
    setBulkBusy(true);
    let failed = 0;
    for (const x of picked) {
      if (x.default_points === bulkPointsNum) continue;
      const res = await acRpc('ac_set_topic_points', { p_user_id: userId, p_topic_id: x.id, p_points: bulkPointsNum }, t('pf.common.saveError'));
      if (res === null) failed++;
    }
    setBulkBusy(false);
    if (failed < picked.length) toast.success(t('ac.topics.pointsSet').replace('{n}', String(picked.length - failed)).replace('{p}', String(bulkPointsNum)));
    setBulkPoints(null);
    setSelected(new Set());
    await reload();
  };

  // A ticked topic beneath another ticked one goes with it, so only the top ones are removed.
  const removeIds = picked.map(x => x.id).filter(id => !picked.some(o => o.id !== id && graph.subtree(o.id).has(id)));

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PfPageHeader
        title="ac.topics.pageTitle"
        subtitle="ac.topics.pageSubtitle"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <AcArchiveToggle value={showArchived} onChange={setShowArchived} />
            <AcCyclePicker refs={cycleRefs} value={cycleKey} onChange={select} />
            <Button variant="outline" onClick={() => bulkTopics(activeSubject || null, activeDomain && activeDomain !== UNASSIGNED ? activeDomain : null)}><ListPlus size={16} className="mr-1" />{t('ac.bulk.button')}</Button>
            <Button onClick={() => newTopic(activeSubject || null, activeDomain && activeDomain !== UNASSIGNED ? activeDomain : null)}><Plus size={16} className="mr-1" />{t('ac.topic.create')}</Button>
          </div>
        }
      />

      {canRead(D) && (
      <div className={`${acCard} p-5 space-y-3`}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('ac.domains')}</h3>
          {domainCan.create && <Button size="sm" variant="outline" onClick={() => openDomain('new')}><Plus size={14} className="mr-1" />{t('ac.domain.create')}</Button>}
        </div>
        {userId && canRead(T) && <AcDomainTypes userId={userId} types={domainTypes} domains={domains} onChanged={reload} can={typeCan} />}
        {domainTotal === 0 ? (
          <p className="text-sm text-gray-500">{t('ac.domain.none')}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {pageDomains.map(d => {
              const r = domainRollupOf(d.id, cycle);
              return (
                <div
                  key={d.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => showDomainTopics(d.id)}
                  onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); showDomainTopics(d.id); } }}
                  title={t('ac.domain.showTopics')}
                  aria-pressed={d.id === activeDomain}
                  className={`rounded-lg border p-3 space-y-2 cursor-pointer transition-colors hover:border-primary/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${d.id === activeDomain ? 'border-primary bg-primary/5' : 'border-gray-100 dark:border-gray-700'} ${d.is_archived ? 'opacity-70' : ''}`}
                  style={{ borderLeft: `4px solid ${d.color}` }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 dark:text-gray-100 truncate">{d.name}</div>
                      <div className="text-xs text-gray-500">{graph.domainTopics(d.id).size} {t('ac.topicsCount')}</div>
                    </div>
                    {/* Own actions: don't also select the domain. */}
                    <div className="flex shrink-0" onClick={e => e.stopPropagation()}>
                      {domainCan.update && <button className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700" onClick={() => openDomain(d)} title={t('pf.common.edit')}><Pencil size={14} /></button>}
                      {domainCan.remove && <button className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700" onClick={() => setDeleteDomain(d)} title={t('pf.common.delete')}><Trash2 size={14} className="text-danger" /></button>}
                    </div>
                  </div>
                  {(d.type_id || d.is_archived) && (
                    <div className="flex flex-wrap gap-1">
                      {d.is_archived && <AcArchivedBadge />}
                      {domainTypes.find(x => x.id === d.type_id) && <AcTypeBadge type={domainTypes.find(x => x.id === d.type_id)!} />}
                    </div>
                  )}
                  <AcProgress achieved={r?.achieved ?? 0} total={r?.total ?? 0} size="sm" />
                  {d.is_archived && domainCan.update && (
                    <Button size="sm" variant="outline" className="w-full" onClick={e => { e.stopPropagation(); void restoreDomain(d); }}>
                      <ArchiveRestore size={14} className="mr-1" />{t('ac.archive.restore')}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {domainTotal > DOMAIN_PAGE && (
          <div className="flex items-center justify-between pt-1 text-sm text-gray-500 dark:text-gray-400">
            <span className="tabular-nums">
              {domainPage * DOMAIN_PAGE + 1}–{Math.min((domainPage + 1) * DOMAIN_PAGE, domainTotal)} / {domainTotal}
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={domainPage === 0} onClick={() => setDomainPage(p => p - 1)}>
                <ChevronLeft size={14} className="mr-1" />{t('ac.prev')}
              </Button>
              <Button size="sm" variant="outline" disabled={(domainPage + 1) * DOMAIN_PAGE >= domainTotal} onClick={() => setDomainPage(p => p + 1)}>
                {t('ac.next')}<ChevronRight size={14} className="ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      )}

      <div ref={topicList} className={`${acCard} overflow-hidden scroll-mt-20`}>
        <div className="flex flex-wrap items-center gap-2 p-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mr-auto">{t('ac.topics.title')} ({shown.length})</h3>
          <div className="relative">
            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('pf.common.search')} className={`${pfInputClass} h-9 pl-8 w-48`} />
          </div>
          <AcTopicFilterSelects filter={filter} domains={domains} />
          <select value={msFilter} onChange={e => setMsFilter(e.target.value as typeof msFilter)} className={`${acSelectClass} h-9`} aria-label={t('ac.topic.milestone')}>
            <option value="">{t('ac.topics.msAll')}</option>
            <option value="yes">{t('ac.topics.msYes')}</option>
            <option value="no">{t('ac.topics.msNo')}</option>
          </select>
        </div>
        {picked.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 px-4 py-2 bg-primary/5 border-b border-gray-100 dark:border-gray-700 text-sm">
            <span className="font-medium text-gray-800 dark:text-gray-200">{t('ac.detail.nSelected').replace('{n}', String(picked.length))}</span>
            {picked.length < shown.length && (
              <button className="text-primary hover:underline" onClick={() => setSelected(new Set(shown.map(x => x.id)))}>
                {t('ac.topics.selectAllShown').replace('{n}', String(shown.length))}
              </button>
            )}
            <button className="text-gray-500 hover:underline" onClick={() => setSelected(new Set())}>{t('ac.detail.clearSelection')}</button>
            <Button size="sm" variant="outline" className="ml-auto" disabled={bulkBusy}
              onClick={() => (allMilestones ? void doMilestones() : setMsForm({ weekdays: [], dates: [], awake: 'keep' }))}>
              <Star size={14} className={`mr-1 ${allMilestones ? '' : 'text-warning'}`} />{allMilestones ? t('ac.topics.unmakeMilestones') : t('ac.topics.makeMilestones')}
            </Button>
            <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => setBulkPoints(String(picked[0]?.default_points ?? 1))}>
              <Hash size={14} className="mr-1" />{t('ac.topics.setPoints')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAssignParent(true)}>
              <FolderTree size={14} className="mr-1" />{t('ac.assignParent.button')}
            </Button>
            <Button size="sm" variant="outline" disabled={linkCount('parents') === 0} onClick={() => setClearLinks('parents')}>
              <Unlink size={14} className="mr-1" />{t('ac.clearLinks.parentsBtn')}
            </Button>
            <Button size="sm" variant="outline" disabled={linkCount('children') === 0} onClick={() => setClearLinks('children')}>
              <Unlink size={14} className="mr-1" />{t('ac.clearLinks.childrenBtn')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setRemoveSelected(true)}>
              <Trash2 size={14} className="mr-1 text-danger" />{t('ac.topics.removeSelected')}
            </Button>
          </div>
        )}
        {loading ? (
          <div className="p-12 text-center text-gray-500">{t('pf.common.loading')}</div>
        ) : shown.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Layers size={30} className="mx-auto mb-2 text-gray-400" />
            {topics.length === 0 ? t('ac.topics.empty') : t('ac.topics.emptyDomain')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/40 text-left text-xs text-gray-500">
                <tr>
                  <th className="pl-4 pr-1 py-2 w-8">
                    <input type="checkbox" checked={pageAllPicked} onChange={togglePage} className="w-4 h-4 text-primary rounded border-gray-300" aria-label={t('ac.detail.selectShown')} />
                  </th>
                  <th className="px-4 py-2">{t('pf.common.name')}</th>
                  <th className="px-4 py-2">{t('ac.topics.level')}</th>
                  <th className="px-4 py-2">{t('ac.topic.parents')}</th>
                  <th className="px-4 py-2 text-right">{t('ac.topic.points')}</th>
                  <th className="px-4 py-2 w-56">{t('ac.detail.withChildren')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {pager.pageItems.map(x => {
                  const r = rollupOf(x.id, cycle);
                  return (
                    <tr key={x.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer ${selected.has(x.id) ? 'bg-primary/5' : ''} ${x.is_archived ? 'opacity-70' : ''}`} onClick={() => openTopic(x.id)}>
                      <td className="pl-4 pr-1 py-2.5" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={selected.has(x.id)} onChange={() => toggleOne(x.id)} className="w-4 h-4 text-primary rounded border-gray-300" aria-label={x.name} />
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1.5 font-medium text-gray-900 dark:text-gray-100">
                          {x.is_milestone && <Star size={13} className="fill-warning text-warning" />}{x.name}
                          {x.is_archived && <AcArchivedBadge />}
                        </span>
                      </td>
                      <td className="px-4 py-2.5"><AcLevelBadge level={graph.levelOf(x.id)} /></td>
                      <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300 max-w-xs truncate">{graph.parents(x.id).map(p => p.name).join(', ') || '—'}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{x.default_points}</td>
                      <td className="px-4 py-2.5"><AcProgress achieved={r?.achieved ?? 0} total={r?.total ?? 0} size="sm" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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

      {dialogs}

      <Modal isOpen={!!domainForm} onClose={() => !dSaving && setDomainForm(null)} title={domainForm === 'new' ? t('ac.domain.create') : t('ac.domain.edit')}>
        <div className="space-y-4">
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('pf.common.name')} <span className="text-danger">*</span></span>
            <input value={dName} onChange={e => setDName(e.target.value)} className={`${pfInputClass} h-10`} autoFocus />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('org.common.description')}</span>
            <textarea value={dDescription} onChange={e => setDDescription(e.target.value)} rows={3} className={pfInputClass} />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('ac.types.type')}</span>
            <select value={dType} onChange={e => setDType(e.target.value)} className={`${acSelectClass} h-10 w-full`}>
              <option value="">{t('ac.types.noType')}</option>
              {domainTypes.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
            {domainTypes.length === 0 && <span className="mt-1 block text-xs text-gray-500">{t('ac.types.noneHint')}</span>}
          </label>
          <div>
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('ac.domain.color')}</span>
            <div className="flex flex-wrap gap-2">
              {DOMAIN_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setDColor(c)} className={`w-8 h-8 rounded-full ${dColor === c ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-offset-gray-800' : ''}`} style={{ background: c }} aria-label={c} />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
            <Button variant="ghost" onClick={() => setDomainForm(null)} disabled={dSaving}>{t('pf.common.cancel')}</Button>
            <Button onClick={saveDomain} disabled={dSaving || !dName.trim()}>{dSaving ? t('pf.common.saving') : t('pf.common.save')}</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!msForm} onClose={() => !bulkBusy && setMsForm(null)} title={t('ac.topics.makeMilestonesTitle').replace('{n}', String(picked.length))} className="max-w-xl">
        {msForm && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">{t('ac.topics.makeMilestonesHint')}</p>
            <div>
              <AcScheduleEditor weekdays={msForm.weekdays} dates={msForm.dates} onChange={(weekdays, dates) => setMsForm(f => f && { ...f, weekdays, dates })} />
              <p className="mt-1 text-xs text-gray-500">{t('ac.topics.scheduleKeepHint')}</p>
            </div>
            <div>
              <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('ac.hibernate.awake')}</span>
              <div className="flex flex-wrap gap-2">
                {(['keep', 'awake', 'asleep'] as const).map(v => (
                  <label key={v} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm cursor-pointer ${msForm.awake === v ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300'}`}>
                    <input type="radio" name="ms-awake" className="sr-only" checked={msForm.awake === v} onChange={() => setMsForm(f => f && { ...f, awake: v })} />
                    {t(`ac.topics.awake_${v}`)}
                  </label>
                ))}
              </div>
              <p className="mt-1 text-xs text-gray-500">{t('ac.topics.awakeHint')}</p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={() => setMsForm(null)} disabled={bulkBusy}>{t('pf.common.cancel')}</Button>
              <Button onClick={() => void doMilestones()} disabled={bulkBusy}>
                <Star size={14} className="mr-1" />{bulkBusy ? t('pf.common.saving') : t('ac.topics.makeMilestones')}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={bulkPoints !== null} onClose={() => !bulkBusy && setBulkPoints(null)} title={t('ac.topics.setPoints')}>
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">{t('ac.topics.setPointsHint').replace('{n}', String(picked.length))}</p>
          <input type="number" min={0} step={1} autoFocus value={bulkPoints ?? ''} onChange={e => setBulkPoints(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void doPoints(); }} className={`${pfInputClass} h-10 w-32`} aria-label={t('ac.topic.points')} />
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setBulkPoints(null)} disabled={bulkBusy}>{t('pf.common.cancel')}</Button>
            <Button onClick={() => void doPoints()} disabled={bulkBusy || !Number.isInteger(bulkPointsNum) || bulkPointsNum < 0}>
              {bulkBusy ? t('pf.common.saving') : t('ac.topics.applyPoints').replace('{n}', String(picked.length))}
            </Button>
          </div>
        </div>
      </Modal>

      {assignParent && userId && picked.length > 0 && (
        <AcAssignParentModal
          userId={userId}
          graph={graph}
          topics={topics}
          childIds={picked.map(x => x.id)}
          onClose={() => setAssignParent(false)}
          onDone={async () => { setAssignParent(false); setSelected(new Set()); await reload(); }}
        />
      )}

      <Modal isOpen={!!clearLinks} onClose={() => !clearing && setClearLinks(null)} title={clearLinks === 'children' ? t('ac.clearLinks.childrenTitle') : t('ac.clearLinks.parentsTitle')}>
        <div className="space-y-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {(clearLinks === 'children' ? t('ac.clearLinks.childrenHint') : t('ac.clearLinks.parentsHint'))
              .replace('{links}', String(clearLinks ? linkCount(clearLinks) : 0))
              .replace('{n}', String(picked.length))}
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setClearLinks(null)} disabled={clearing}>{t('pf.common.cancel')}</Button>
            <Button variant="danger" onClick={() => void doClearLinks()} disabled={clearing}>{clearing ? t('pf.common.saving') : t('ac.clearLinks.confirm')}</Button>
          </div>
        </div>
      </Modal>

      {removeSelected && userId && removeIds.length > 0 && (
        <AcRemoveModal
          userId={userId}
          topicIds={removeIds}
          name={picked.length <= 3 ? picked.map(x => x.name).join(', ') : t('ac.topics.nTopics').replace('{n}', String(picked.length))}
          alreadyArchived={picked.every(x => x.is_archived)}
          onClose={() => setRemoveSelected(false)}
          onDone={async () => { setRemoveSelected(false); setSelected(new Set()); await reload(); }}
        />
      )}

      {deleteDomain && userId && (
        <AcRemoveModal
          userId={userId}
          domainId={deleteDomain.id}
          name={deleteDomain.name}
          alreadyArchived={deleteDomain.is_archived}
          onClose={() => setDeleteDomain(null)}
          onDone={async () => { setDeleteDomain(null); await reload(); }}
        />
      )}
    </div>
  );
};
