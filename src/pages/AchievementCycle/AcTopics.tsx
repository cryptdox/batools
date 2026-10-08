import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { Plus, Pencil, Trash2, Search, Star, Layers, ChevronLeft, ChevronRight, ArchiveRestore } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { errorMessage } from '../../lib/portfolio';
import { acRpc, useAcData, useSelectedCycle, type AcDomain } from '../../lib/achievementCycle';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Pagination, usePagination } from '../../components/ui/Pagination';
import { pfInputClass } from '../../components/portfolio/PfFieldInput';
import { AcArchivedBadge, AcArchiveToggle, AcCyclePicker, AcLevelBadge, AcProgress, acCard, acSelectClass } from '../../components/achievementCycle/AcUi';
import { AcRemoveModal } from '../../components/achievementCycle/AcRemoveModal';
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
  const { openTopic, newTopic, dialogs } = useAcDialogs(data, cycle);

  const [search, setSearch] = useState('');
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

  const shown = topics.filter(x => filter.matches(x.id) && (!search.trim() || x.name.toLowerCase().includes(search.trim().toLowerCase())));
  const pager = usePagination(shown, 25);
  const { setPage } = pager;
  // A new filter starts from the first page.
  useEffect(() => { setPage(1); }, [filter.key, search, setPage]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PfPageHeader
        title="ac.topics.pageTitle"
        subtitle="ac.topics.pageSubtitle"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <AcArchiveToggle value={showArchived} onChange={setShowArchived} />
            <AcCyclePicker refs={cycleRefs} value={cycleKey} onChange={select} />
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
        </div>
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
                    <tr key={x.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer ${x.is_archived ? 'opacity-70' : ''}`} onClick={() => openTopic(x.id)}>
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
