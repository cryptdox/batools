import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { Search, Star, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { errorMessage } from '../../lib/portfolio';
import type { AcDomain, AcGraph, AcTopic } from '../../lib/achievementCycle';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { pfInputClass } from '../portfolio/PfFieldInput';
import { ALL, AcTopicFilterSelects, useTopicFilter } from './AcTopicFilters';
import { AcScheduleEditor } from './AcSchedule';

type Props = {
  userId: string;
  graph: AcGraph;
  topics: AcTopic[];
  domains: AcDomain[];
  /** Editing this topic, or creating a new one when null. */
  topic: AcTopic | null;
  /** Pre-selected parent for a new topic (e.g. "add a child here"). */
  parentId?: string | null;
  /** Pre-selected domain for a new topic (the one being filtered by). */
  domainId?: string | null;
  onClose: () => void;
  onSaved: (topicId: string) => void;
};

const PARENTS_PER_PAGE = 5;
const DOMAINS_PER_PAGE = 4;

/** "1–5 / 12" with previous / next, for the short pickers in this form. */
const MiniPager = ({ page, size, total, onChange }: { page: number; size: number; total: number; onChange: (p: number) => void }) => {
  if (total <= size) return null;
  const btn = 'p-1 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:pointer-events-none';
  return (
    <div className="flex items-center justify-end gap-2 pt-1.5 text-xs text-gray-500 dark:text-gray-400">
      <span className="tabular-nums">{page * size + 1}–{Math.min((page + 1) * size, total)} / {total}</span>
      <button type="button" className={btn} disabled={page === 0} onClick={() => onChange(page - 1)} aria-label="Previous"><ChevronLeft size={15} /></button>
      <button type="button" className={btn} disabled={(page + 1) * size >= total} onClick={() => onChange(page + 1)} aria-label="Next"><ChevronRight size={15} /></button>
    </div>
  );
};

/** A picked item, removable, shown above its paged picker. */
const Chip = ({ label: text, color, onRemove }: { label: string; color?: string; onRemove: () => void }) => (
  <span
    className={`inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full text-xs font-medium ${color ? 'text-white' : 'bg-primary/10 text-primary'}`}
    style={color ? { background: color } : undefined}
  >
    {text}
    <button type="button" onClick={onRemove} className="p-0.5 rounded-full hover:bg-black/10" aria-label={`Remove ${text}`}><X size={12} /></button>
  </span>
);

const label = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5';
const hint = 'mt-1 text-xs text-gray-500 dark:text-gray-400';

/** Create / edit a topic: what it is, its story points, domains and parents. */
export const AcTopicForm = ({ userId, graph, topics, domains, topic, parentId, domainId, onClose, onSaved }: Props) => {
  const { t } = useLanguage();
  const [name, setName] = useState(topic?.name ?? '');
  const [description, setDescription] = useState(topic?.description ?? '');
  const [spDescription, setSpDescription] = useState(topic?.story_point_description ?? '');
  const [points, setPoints] = useState(String(topic?.default_points ?? 1));
  const [milestone, setMilestone] = useState(topic?.is_milestone ?? false);
  const [schedWeekdays, setSchedWeekdays] = useState<number[]>(topic?.schedule_weekdays ?? []);
  const [schedDates, setSchedDates] = useState<string[]>(topic?.schedule_dates ?? []);
  // Every domain a topic belongs to: its own tags plus those it inherits.
  const domainsOfTopic = (id: string) => {
    const { own, inherited } = graph.domainsOf(id);
    return [...own, ...inherited];
  };
  // A new topic starts in the filtered domain and in its parent's domains.
  const [domainIds, setDomainIds] = useState<Set<string>>(() => (topic
    ? graph.domainsOf(topic.id).own
    : new Set([...(domainId ? [domainId] : []), ...(parentId ? domainsOfTopic(parentId) : [])])));
  const [parentIds, setParentIds] = useState<Set<string>>(() =>
    topic ? new Set(graph.parents(topic.id).map(p => p.id)) : new Set(parentId ? [parentId] : []));
  const [search, setSearch] = useState('');
  // Parent picker filter: a domain id, '' for all, or 'subjects' for subjects only.
  const [parentPage, setParentPage] = useState(0);
  const [domainSearch, setDomainSearch] = useState('');
  const [domainPage, setDomainPage] = useState(0);
  const [saving, setSaving] = useState(false);

  // A topic can't go under itself or anything beneath it.
  const blocked = useMemo(() => (topic ? graph.subtree(topic.id) : new Set<string>()), [graph, topic]);
  // Same domain → subject → level filter as the Topics page. It opens on all
  // subjects, or on the subject a new topic is being added under.
  const from = topic?.id ?? parentId ?? null;
  const fromRoot = from ? (graph.isSubject(from) ? from : graph.pathsTo(from, 1)[0]?.[0]?.parent_id) : null;
  const fromDomain = domainId ?? (from ? [...graph.domainsOf(from).own, ...graph.domainsOf(from).inherited][0] : null);
  const filter = useTopicFilter(graph, domains, {
    domainId: fromDomain,
    subjectId: !topic && fromRoot && !blocked.has(fromRoot) ? fromRoot : ALL,
    exclude: blocked,
  });
  const needle = search.trim().toLowerCase();
  const candidates = topics
    .filter(x => !blocked.has(x.id))
    .filter(x => filter.matches(x.id))
    .filter(x => !needle || x.name.toLowerCase().includes(needle));
  // A new filter starts from the first page.
  useEffect(() => { setParentPage(0); }, [filter.key]);
  const parentPageCount = Math.max(1, Math.ceil(candidates.length / PARENTS_PER_PAGE));
  const parentPageSafe = Math.min(parentPage, parentPageCount - 1);
  const pagedCandidates = candidates.slice(parentPageSafe * PARENTS_PER_PAGE, (parentPageSafe + 1) * PARENTS_PER_PAGE);

  const domainNeedle = domainSearch.trim().toLowerCase();
  const domainMatches = domains.filter(d => !domainNeedle || d.name.toLowerCase().includes(domainNeedle));
  const domainPageCount = Math.max(1, Math.ceil(domainMatches.length / DOMAINS_PER_PAGE));
  const domainPageSafe = Math.min(domainPage, domainPageCount - 1);
  const pagedDomains = domainMatches.slice(domainPageSafe * DOMAINS_PER_PAGE, (domainPageSafe + 1) * DOMAINS_PER_PAGE);

  const pointsNum = Number(points);
  const valid = name.trim() !== '' && Number.isInteger(pointsNum) && pointsNum >= 0;

  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  };

  // Picking a parent also selects its domains (unpicking leaves them).
  const toggleParent = (id: string) => {
    if (!parentIds.has(id)) setDomainIds(s => new Set([...s, ...domainsOfTopic(id)]));
    setParentIds(s => toggle(s, id));
  };

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      const row = {
        name: name.trim(),
        description: description.trim() || null,
        story_point_description: spDescription.trim() || null,
        default_points: pointsNum,
        is_milestone: milestone,
        // Only milestones are scheduled; un-marking clears the schedule.
        schedule_weekdays: milestone ? schedWeekdays : [],
        schedule_dates: milestone ? schedDates : [],
        updated_at: new Date().toISOString(),
      };
      let id = topic?.id;
      if (topic) {
        const { default_points: _points, ...rest } = row;
        const { error } = await supabase.from('ac_topics').update(rest).eq('id', topic.id).eq('user_id', userId);
        if (error) throw error;
        // Story points go through the database so the topic's cycles follow (and rollups update).
        if (pointsNum !== topic.default_points) {
          const { error: pointsError } = await supabase.rpc('ac_set_topic_points', { p_user_id: userId, p_topic_id: topic.id, p_points: pointsNum });
          if (pointsError) throw pointsError;
        }
      } else {
        const { data, error } = await supabase.from('ac_topics').insert([{ ...row, user_id: userId }]).select('id').single();
        if (error) throw error;
        id = data.id as string;
      }
      if (!id) return;

      const oldParents = new Set(topic ? graph.parents(topic.id).map(p => p.id) : []);
      const dropParents = [...oldParents].filter(p => !parentIds.has(p));
      const addParents = [...parentIds].filter(p => !oldParents.has(p));
      if (dropParents.length) {
        const { error } = await supabase.from('ac_topic_links').delete().eq('user_id', userId).eq('child_id', id).in('parent_id', dropParents);
        if (error) throw error;
      }
      if (addParents.length) {
        const { error } = await supabase.from('ac_topic_links').insert(addParents.map(p => ({
          user_id: userId, parent_id: p, child_id: id,
          sort_order: (graph.childLinks.get(p)?.length ?? 0) + 1,
        })));
        if (error) throw error;
      }

      const oldDomains = topic ? graph.domainsOf(topic.id).own : new Set<string>();
      const dropDomains = [...oldDomains].filter(d => !domainIds.has(d));
      const addDomains = [...domainIds].filter(d => !oldDomains.has(d));
      if (dropDomains.length) {
        const { error } = await supabase.from('ac_topic_domains').delete().eq('user_id', userId).eq('topic_id', id).in('domain_id', dropDomains);
        if (error) throw error;
      }
      if (addDomains.length) {
        const { error } = await supabase.from('ac_topic_domains').insert(addDomains.map(d => ({ user_id: userId, topic_id: id, domain_id: d })));
        if (error) throw error;
      }

      toast.success(topic ? t('pf.common.updated') : t('pf.common.added'));
      onSaved(id);
    } catch (e) {
      console.error(e);
      toast.error(errorMessage(e, t('pf.common.saveError')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={() => !saving && onClose()} title={topic ? t('ac.topic.edit') : t('ac.topic.create')} className="max-w-3xl">
      <div className="space-y-4">
        <label className="block">
          <span className={label}>{t('pf.common.name')} <span className="text-danger">*</span></span>
          <input value={name} onChange={e => setName(e.target.value)} className={`${pfInputClass} h-10`} autoFocus />
        </label>
        <label className="block">
          <span className={label}>{t('org.common.description')}</span>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className={pfInputClass} />
        </label>
        <div className="grid sm:grid-cols-[10rem_1fr] gap-4">
          <label className="block">
            <span className={label}>{t('ac.topic.points')} <span className="text-danger">*</span></span>
            <input type="number" min={0} step={1} value={points} onChange={e => setPoints(e.target.value)} className={`${pfInputClass} h-10`} />
          </label>
          <label className="block">
            <span className={label}>{t('ac.topic.spMeaning')}</span>
            <input value={spDescription} onChange={e => setSpDescription(e.target.value)} placeholder={t('ac.topic.spMeaningPlaceholder')} className={`${pfInputClass} h-10`} />
          </label>
        </div>
        <p className={hint}>{t('ac.topic.pointsHint')}</p>

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={milestone} onChange={e => setMilestone(e.target.checked)} className="w-4 h-4 text-primary rounded border-gray-300" />
          <Star size={16} className={milestone ? 'fill-warning text-warning' : 'text-gray-400'} />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('ac.topic.milestone')}</span>
        </label>
        {milestone && (
          <AcScheduleEditor
            weekdays={schedWeekdays}
            dates={schedDates}
            onChange={(w, d) => { setSchedWeekdays(w); setSchedDates(d); }}
          />
        )}

        <div>
          <span className={label}>{t('ac.domains')}</span>
          {domains.length === 0 ? (
            <p className={hint}>{t('ac.domain.none')}</p>
          ) : (
            <>
            {domainIds.size > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {domains.filter(d => domainIds.has(d.id)).map(d => (
                  <Chip key={d.id} label={d.name} color={d.color} onRemove={() => setDomainIds(s => toggle(s, d.id))} />
                ))}
              </div>
            )}
            {domains.length > DOMAINS_PER_PAGE && (
              <div className="relative mb-2">
                <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={domainSearch} onChange={e => { setDomainSearch(e.target.value); setDomainPage(0); }} placeholder={t('ac.topic.searchDomains')} className={`${pfInputClass} h-9 pl-8`} />
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {pagedDomains.length === 0 && <p className="text-sm text-gray-500">{t('pf.common.empty')}</p>}
              {pagedDomains.map(d => {
                const on = domainIds.has(d.id);
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDomainIds(s => toggle(s, d.id))}
                    className={`px-3 py-1 rounded-full text-sm border transition-colors ${on ? 'text-white border-transparent' : 'text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600'}`}
                    style={on ? { background: d.color } : undefined}
                  >
                    {d.name}
                  </button>
                );
              })}
            </div>
            <MiniPager page={domainPageSafe} size={DOMAINS_PER_PAGE} total={domainMatches.length} onChange={setDomainPage} />
            </>
          )}
          <p className={hint}>{t('ac.topic.domainsHint')}</p>
        </div>

        <div>
          <span className={label}>{t('ac.topic.parents')}</span>
          {parentIds.size > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {[...parentIds].map(id => graph.byId.get(id) && (
                <Chip key={id} label={graph.byId.get(id)!.name} onRemove={() => setParentIds(s => toggle(s, id))} />
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2 mb-2">
            <div className="relative basis-full">
              <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => { setSearch(e.target.value); setParentPage(0); }} placeholder={t('pf.common.search')} className={`${pfInputClass} h-9 pl-8`} />
            </div>
            <AcTopicFilterSelects filter={filter} domains={domains} className="flex-1 min-w-32" />
          </div>
          <div className="rounded-md border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
            {pagedCandidates.length === 0 && <p className="p-3 text-sm text-gray-500">{t('pf.common.empty')}</p>}
            {pagedCandidates.map(x => (
              <label key={x.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40">
                <input type="checkbox" checked={parentIds.has(x.id)} onChange={() => toggleParent(x.id)} className="w-4 h-4 text-primary rounded border-gray-300" />
                <span className="text-gray-800 dark:text-gray-200">{x.name}</span>
                {graph.isSubject(x.id) && <span className="text-[11px] text-gray-400">{t('ac.level.subject')}</span>}
              </label>
            ))}
          </div>
          <MiniPager page={parentPageSafe} size={PARENTS_PER_PAGE} total={candidates.length} onChange={setParentPage} />
          <p className={hint}>{parentIds.size === 0 ? t('ac.topic.noParentHint') : t('ac.topic.parentsHint')}</p>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
          <Button variant="ghost" onClick={onClose} disabled={saving}>{t('pf.common.cancel')}</Button>
          <Button onClick={save} disabled={saving || !valid}>{saving ? t('pf.common.saving') : t('pf.common.save')}</Button>
        </div>
      </div>
    </Modal>
  );
};
