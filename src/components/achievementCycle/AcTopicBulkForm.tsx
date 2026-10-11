import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { Plus, Trash2, X, Crown, ListOrdered, Combine } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { errorMessage } from '../../lib/portfolio';
import { rankByName, type AcDomain, type AcGraph, type AcTopic } from '../../lib/achievementCycle';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { pfInputClass } from '../portfolio/PfFieldInput';
import { AcTopicMultiPicker } from './AcTopicMultiPicker';
import { acSelectClass } from './AcUi';
import { ALL, AcTopicFilterSelects, useTopicFilter } from './AcTopicFilters';

type Props = {
  userId: string;
  graph: AcGraph;
  topics: AcTopic[];
  domains: AcDomain[];
  /** Pre-selected parent (e.g. "bulk add children here"). */
  parentId?: string | null;
  /** Pre-selected domain for topics created without a parent. */
  domainId?: string | null;
  onClose: () => void;
  onSaved: () => void;
};

/** One value of a layer: an existing topic, plain text, or text to create as a topic too. */
type LayerItem = { key: string; name: string; topicId: string | null; create: boolean };
type Layer = { id: string; items: LayerItem[] };
/** A topic to create: its name and the parents it goes under (ids, or layer items still to be created). */
type Planned = { name: string; parents: (string | LayerItem)[] };

const MAX_TOPICS = 500;
const PREVIEW = 40;

const label = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5';
const hint = 'mt-1 text-xs text-gray-500 dark:text-gray-400';

let seq = 0;
const newKey = () => `k${++seq}`;
const splitValues = (s: string) => [...new Set(s.split(',').map(x => x.trim()).filter(Boolean))];
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Values of one layer: tick existing topics, or add typed text (as text or as a new topic). */
const LayerPicker = ({ graph, domains, domainId, topics, items, forceCreate, onChange }: {
  graph: AcGraph; domains: AcDomain[]; domainId: string;
  topics: AcTopic[]; items: LayerItem[]; forceCreate: boolean; onChange: (items: LayerItem[]) => void;
}) => {
  const { t } = useLanguage();
  // This layer's own domain → subject → level filter, inside what the form already allows.
  const filter = useTopicFilter(graph, domains, { domainId: domainId || ALL, allowAllDomains: true });
  // The form's domain changing resets this layer's domain to match.
  const { setDomain } = filter;
  useEffect(() => { setDomain(domainId || ALL); }, [domainId, setDomain]);
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const needle = text.trim().toLowerCase();
  const picked = new Set(items.map(i => i.topicId).filter(Boolean));
  const ranked = rankByName(topics.filter(x => filter.matches(x.id)), needle);
  const matches = ranked.slice(0, 50);
  const values = splitValues(text);
  const has = (name: string) => items.some(i => i.name.toLowerCase() === name.toLowerCase());

  const toggleTopic = (x: AcTopic) => onChange(picked.has(x.id)
    ? items.filter(i => i.topicId !== x.id)
    : [...items, { key: newKey(), name: x.name, topicId: x.id, create: false }]);
  // Every topic the filter and search currently match (not only the first 50 shown).
  const allPicked = ranked.length > 0 && ranked.every(x => picked.has(x.id));
  const selectAll = () => onChange([...items, ...ranked.filter(x => !picked.has(x.id))
    .map(x => ({ key: newKey(), name: x.name, topicId: x.id, create: false }))]);
  const unselectAll = () => {
    const ids = new Set(ranked.map(x => x.id));
    onChange(items.filter(i => !i.topicId || !ids.has(i.topicId)));
  };
  const addText = (create: boolean) => {
    const add = values.filter(v => !has(v)).map(v => ({ key: newKey(), name: v, topicId: null, create }));
    if (add.length) onChange([...items, ...add]);
    setText('');
  };

  return (
    <div ref={box} className="relative space-y-2">
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {items.map(i => {
            const asTopic = !!i.topicId || i.create || forceCreate;
            return (
              <span
                key={i.key}
                className={`inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full text-xs font-medium ${asTopic ? 'bg-primary/10 text-primary' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}
                title={i.topicId ? t('ac.bulk.existing') : asTopic ? t('ac.bulk.willCreate') : t('ac.bulk.textOnly')}
              >
                {i.name}
                {!i.topicId && !forceCreate && (
                  <button
                    type="button"
                    className="px-1 rounded text-[10px] uppercase tracking-wide hover:bg-black/10"
                    onClick={() => onChange(items.map(x => x.key === i.key ? { ...x, create: !x.create } : x))}
                  >
                    {i.create ? t('ac.bulk.topic') : t('ac.bulk.text')}
                  </button>
                )}
                <button type="button" onClick={() => onChange(items.filter(x => x.key !== i.key))} className="p-0.5 rounded-full hover:bg-black/10" aria-label={`Remove ${i.name}`}><X size={12} /></button>
              </span>
            );
          })}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <AcTopicFilterSelects filter={filter} domains={domains} className="flex-1 min-w-28 text-xs" />
      </div>
      <input
        value={text}
        onChange={e => { setText(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (values.length) addText(false); } }}
        placeholder={t('ac.bulk.layerPlaceholder')}
        className={`${pfInputClass} h-9`}
      />
      {open && (matches.length > 0 || values.length > 0) && (
        <div className="absolute z-30 left-0 right-0 mt-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
          {values.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-700 text-xs">
              <span className="text-gray-500 truncate max-w-full">“{values.join(', ')}”</span>
              {!forceCreate && <Button size="sm" variant="outline" onClick={() => addText(false)}>{t('ac.bulk.useText')}</Button>}
              <Button size="sm" onClick={() => addText(true)}>{t('ac.bulk.createTopic')}</Button>
            </div>
          )}
          {ranked.length > 0 && (
            <div className="flex items-center justify-between px-3 pt-1.5 text-xs">
              {!allPicked
                ? <button type="button" className="text-primary hover:underline" onClick={selectAll}>{t('ac.topics.selectAllShown').replace('{n}', String(ranked.length))}</button>
                : <span />}
              {ranked.some(x => picked.has(x.id)) && (
                <button type="button" className="text-gray-500 hover:underline" onClick={unselectAll}>{t('ac.detail.clearSelection')}</button>
              )}
            </div>
          )}
          <ul className="max-h-56 overflow-y-auto py-1 text-sm">
            {matches.map(x => (
              <li key={x.id}>
                <label className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200">
                  <input type="checkbox" checked={picked.has(x.id)} onChange={() => toggleTopic(x)} className="w-4 h-4 text-primary rounded border-gray-300 shrink-0" />
                  <span className="truncate">{x.name}</span>
                </label>
              </li>
            ))}
            {matches.length === 0 && <li className="px-3 py-2 text-gray-500">{t('pf.common.empty')}</li>}
            {ranked.length > matches.length && (
              <li className="px-3 py-1.5 text-xs text-gray-500">{t('ac.board.moreMilestones').replace('{n}', String(ranked.length - matches.length))}</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

/**
 * Create many topics at once: a numbered / listed sequence ("Chapter 1, 2, 3…",
 * continuing after the last one), or every combination of several layers of values,
 * optionally placed under the values of one layer.
 */
export const AcTopicBulkForm = ({ userId, graph, topics, domains, parentId, domainId, onClose, onSaved }: Props) => {
  const { t } = useLanguage();
  const [mode, setMode] = useState<'sequence' | 'layers'>('sequence');
  const [points, setPoints] = useState('1');
  const [parentIds, setParentIds] = useState<Set<string>>(() => new Set(parentId ? [parentId] : []));
  const [domain, setDomain] = useState(domainId ?? '');
  const [saving, setSaving] = useState(false);

  // Sequence
  const [base, setBase] = useState('');
  const [seqKind, setSeqKind] = useState<'range' | 'values'>('range');
  const [count, setCount] = useState('3');
  const [start, setStart] = useState<string | null>(null);
  const [valuesText, setValuesText] = useState('');

  // Layers
  const [layers, setLayers] = useState<Layer[]>(() => [{ id: newKey(), items: [] }, { id: newKey(), items: [] }]);
  // Layers whose values the generated topics go under (any number: one parent per layer).
  const [parentLayers, setParentLayers] = useState<Set<string>>(new Set());
  const [separator, setSeparator] = useState(' ');

  // "Base 1…n" already there: a range continues after the highest number.
  const nextNumber = useMemo(() => {
    const name = base.trim();
    if (!name) return 1;
    const re = new RegExp(`^${escapeRe(name)}\\s+(\\d+)$`, 'i');
    return topics.reduce((max, x) => {
      const m = re.exec(x.name.trim());
      return m ? Math.max(max, Number(m[1])) : max;
    }, 0) + 1;
  }, [base, topics]);

  const shared = [...parentIds];

  // Pickers only offer topics in the chosen domain; layers only those under the chosen parents.
  const inDomain = useMemo(() => {
    if (!domain) return topics;
    const ids = graph.domainTopics(domain);
    return topics.filter(x => ids.has(x.id));
  }, [domain, graph, topics]);
  const layerTopicsPool = useMemo(() => {
    if (parentIds.size === 0) return inDomain;
    const below = new Set<string>();
    for (const p of parentIds) for (const id of graph.subtree(p)) if (!parentIds.has(id)) below.add(id);
    return inDomain.filter(x => below.has(x.id));
  }, [inDomain, parentIds, graph]);
  // A new domain drops picked parents that are outside it.
  const changeDomain = (id: string) => {
    setDomain(id);
    if (!id) return;
    const ids = graph.domainTopics(id);
    setParentIds(s => new Set([...s].filter(p => ids.has(p))));
  };

  const planned: Planned[] = useMemo(() => {
    if (mode === 'sequence') {
      const name = base.trim();
      if (!name) return [];
      if (seqKind === 'values') return splitValues(valuesText).map(v => ({ name: `${name} ${v}`, parents: shared }));
      const n = Number(count);
      const from = Number(start ?? nextNumber);
      if (!Number.isInteger(n) || n < 1 || !Number.isInteger(from) || from < 0) return [];
      return Array.from({ length: Math.min(n, MAX_TOPICS + 1) }, (_, i) => ({ name: `${name} ${from + i}`, parents: shared }));
    }
    const used = layers.filter(l => l.items.length > 0);
    if (used.length === 0) return [];
    let combos: LayerItem[][] = [[]];
    for (const l of used) {
      combos = combos.flatMap(c => l.items.map(i => [...c, i]));
      if (combos.length > MAX_TOPICS) break;
    }
    const pIdx = used.map((l, k) => (parentLayers.has(l.id) ? k : -1)).filter(k => k >= 0);
    return combos.map(c => {
      // Its value in every parent layer (the same topic picked in two layers counts once).
      const ps = pIdx.map(k => c[k].topicId ?? c[k]);
      const unique = ps.filter((x, k) => ps.findIndex(y => (typeof y === 'string' ? y : y.name.trim().toLowerCase()) === (typeof x === 'string' ? x : x.name.trim().toLowerCase())) === k);
      return { name: c.map(i => i.name).join(separator || ' '), parents: pIdx.length ? unique : shared };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, base, seqKind, valuesText, count, start, nextNumber, layers, parentLayers, separator, parentIds]);

  // Skip names already under the same parent (or already a subject, without a parent).
  const existsUnder = (p: string | LayerItem | undefined, name: string) => {
    const lower = name.toLowerCase();
    if (p === undefined) return graph.roots.some(r => r.name.toLowerCase() === lower);
    if (typeof p !== 'string') return false;
    return graph.children(p).some(c => c.name.toLowerCase() === lower);
  };
  // Combinations never repeat a name: one that is already a topic anywhere is skipped.
  const existingByName = useMemo(() => new Map(topics.map(x => [x.name.trim().toLowerCase(), x.id])), [topics]);
  const seen = new Set<string>();
  const toCreate = planned.filter(p => {
    const lower = p.name.trim().toLowerCase();
    if (mode === 'layers') {
      if (seen.has(lower) || existingByName.has(lower)) return false;
      seen.add(lower);
      return true;
    }
    const key = `${p.parents.map(x => (typeof x === 'string' ? x : x.key)).join('|')}::${lower}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return !(p.parents.length ? p.parents.every(x => existsUnder(x, p.name)) : existsUnder(undefined, p.name));
  });
  const skipped = planned.length - toCreate.length;
  // Layer values to create as topics: ticked "topic", and every text value of the parent layer.
  // A name that is already a topic reuses it; the same name in two layers is created once.
  const layerValues = mode === 'layers'
    ? layers.flatMap(l => l.items.filter(i => !i.topicId && (i.create || parentLayers.has(l.id))))
    : [];
  const layerTopics = layerValues.filter((i, k) => {
    const lower = i.name.trim().toLowerCase();
    return !existingByName.has(lower) && layerValues.findIndex(o => o.name.trim().toLowerCase() === lower) === k;
  });

  const pointsNum = Number(points);
  const tooMany = toCreate.length > MAX_TOPICS;
  const valid = toCreate.length > 0 && !tooMany && Number.isInteger(pointsNum) && pointsNum >= 0;

  const updateLayer = (id: string, items: LayerItem[]) => setLayers(ls => ls.map(l => (l.id === id ? { ...l, items } : l)));
  const removeLayer = (id: string) => {
    setLayers(ls => ls.filter(l => l.id !== id));
    setParentLayers(s => { const n = new Set(s); n.delete(id); return n; });
  };

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      const hibernated = new Map(topics.map(x => [x.id, x.is_hibernated]));
      // A new topic is awake if any parent is awake; without a parent it starts hibernated (the default).
      const inherit = (ids: string[]) => (ids.length ? ids.every(id => hibernated.get(id)) : true);
      const insert = async (rows: { name: string; parents: string[] }[]) => {
        const { data, error } = await supabase.from('ac_topics').insert(rows.map(r => ({
          user_id: userId, name: r.name, default_points: pointsNum, is_hibernated: inherit(r.parents),
        }))).select('id');
        if (error) throw error;
        const ids = (data ?? []).map(d => d.id as string);
        ids.forEach((id, i) => hibernated.set(id, inherit(rows[i].parents)));

        const counts = new Map<string, number>();
        const links = rows.flatMap((r, i) => r.parents.map(p => {
          const n = (counts.get(p) ?? graph.childLinks.get(p)?.length ?? 0) + 1;
          counts.set(p, n);
          return { user_id: userId, parent_id: p, child_id: ids[i], sort_order: n };
        }));
        if (links.length) {
          const { error: linkError } = await supabase.from('ac_topic_links').insert(links);
          if (linkError) throw linkError;
        }
        const tagged = rows.flatMap((r, i) => (domain && r.parents.length === 0 ? [{ user_id: userId, topic_id: ids[i], domain_id: domain }] : []));
        if (tagged.length) {
          const { error: domainError } = await supabase.from('ac_topic_domains').insert(tagged);
          if (domainError) throw domainError;
        }
        return ids;
      };

      // Layer values first, so the generated topics can go under them.
      const created = new Map<string, string>();
      if (layerTopics.length) {
        const ids = await insert(layerTopics.map(i => ({ name: i.name, parents: shared })));
        layerTopics.forEach((i, k) => created.set(i.name.trim().toLowerCase(), ids[k]));
      }
      const layerTopicId = (i: LayerItem) => {
        const lower = i.name.trim().toLowerCase();
        return created.get(lower) ?? existingByName.get(lower)!;
      };
      await insert(toCreate.map(p => ({
        name: p.name,
        parents: p.parents.map(x => (typeof x === 'string' ? x : layerTopicId(x))),
      })));

      toast.success(t('ac.bulk.created').replace('{n}', String(toCreate.length + layerTopics.length)));
      onSaved();
    } catch (e) {
      console.error(e);
      toast.error(errorMessage(e, t('pf.common.saveError')));
    } finally {
      setSaving(false);
    }
  };

  const tab = (on: boolean) => `flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${on
    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`;
  const pill = (on: boolean) => `px-3 py-1 rounded-full text-sm border ${on ? 'bg-primary text-white border-primary' : 'text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600'}`;

  return (
    <Modal isOpen onClose={() => !saving && onClose()} title={t('ac.bulk.title')} className="max-w-3xl">
      <div className="space-y-5">
        <div className="flex gap-1 p-1 rounded-lg bg-gray-100 dark:bg-gray-900/40">
          <button type="button" className={tab(mode === 'sequence')} onClick={() => setMode('sequence')}><ListOrdered size={15} />{t('ac.bulk.sequence')}</button>
          <button type="button" className={tab(mode === 'layers')} onClick={() => setMode('layers')}><Combine size={15} />{t('ac.bulk.layers')}</button>
        </div>

        <div className="grid sm:grid-cols-[1fr_1fr_8rem] gap-4">
          <label className="block">
            <span className={label}>{t('ac.bulk.domain')}</span>
            <select value={domain} onChange={e => changeDomain(e.target.value)} className={`${acSelectClass} h-10 w-full`}>
              <option value="">{t('ac.allDomains')}</option>
              {domains.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <span className={hint}>{t('ac.bulk.domainHint')}</span>
          </label>
          <div>
            <span className={label}>{t('ac.topic.parents')}</span>
            <AcTopicMultiPicker topics={inDomain} value={parentIds} onChange={setParentIds} placeholder={t('ac.bulk.noParent')} />
            <p className={hint}>{mode === 'layers' && parentLayers.size > 0 ? t('ac.bulk.sharedParentsHint') : t('ac.bulk.parentsHint')}</p>
          </div>
          <label className="block">
            <span className={label}>{t('ac.topic.points')}</span>
            <input type="number" min={0} step={1} value={points} onChange={e => setPoints(e.target.value)} className={`${pfInputClass} h-10`} />
          </label>
        </div>

        {mode === 'sequence' ? (
          <div className="space-y-4">
            <label className="block">
              <span className={label}>{t('ac.bulk.baseName')} <span className="text-danger">*</span></span>
              <input value={base} onChange={e => setBase(e.target.value)} placeholder={t('ac.bulk.baseNamePlaceholder')} className={`${pfInputClass} h-10`} autoFocus />
            </label>
            <div className="flex gap-2">
              <button type="button" className={pill(seqKind === 'range')} onClick={() => setSeqKind('range')}>{t('ac.bulk.range')}</button>
              <button type="button" className={pill(seqKind === 'values')} onClick={() => setSeqKind('values')}>{t('ac.bulk.values')}</button>
            </div>
            {seqKind === 'range' ? (
              <div className="grid grid-cols-2 gap-4 max-w-sm">
                <label className="block">
                  <span className={label}>{t('ac.bulk.count')}</span>
                  <input type="number" min={1} step={1} value={count} onChange={e => setCount(e.target.value)} className={`${pfInputClass} h-10`} />
                </label>
                <label className="block">
                  <span className={label}>{t('ac.bulk.startAt')}</span>
                  <input type="number" min={0} step={1} value={start ?? String(nextNumber)} onChange={e => setStart(e.target.value)} className={`${pfInputClass} h-10`} />
                </label>
              </div>
            ) : (
              <label className="block">
                <span className={label}>{t('ac.bulk.valuesLabel')}</span>
                <input value={valuesText} onChange={e => setValuesText(e.target.value)} placeholder="a, b, c, d" className={`${pfInputClass} h-10`} />
              </label>
            )}
            {seqKind === 'range' && <p className={hint}>{t('ac.bulk.rangeHint')}</p>}
          </div>
        ) : (
          <div className="space-y-3">
            {layers.map((l, i) => (
              <div key={l.id} className={`rounded-lg border p-3 space-y-2 ${parentLayers.has(l.id) ? 'border-warning bg-warning/5' : 'border-gray-200 dark:border-gray-700'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{t('ac.bulk.layer').replace('{n}', String(i + 1))}</span>
                  <span className="flex items-center gap-1">
                    <label className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer" title={t('ac.bulk.parentLayerHint')}>
                      <input type="checkbox" checked={parentLayers.has(l.id)} onChange={e => setParentLayers(s => { const n = new Set(s); if (e.target.checked) n.add(l.id); else n.delete(l.id); return n; })} className="w-3.5 h-3.5 text-primary rounded border-gray-300" />
                      <Crown size={13} className={parentLayers.has(l.id) ? 'text-warning' : 'text-gray-400'} />{t('ac.bulk.parentLayer')}
                    </label>
                    {layers.length > 1 && (
                      <button type="button" className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700" onClick={() => removeLayer(l.id)} title={t('pf.common.delete')}>
                        <Trash2 size={14} className="text-danger" />
                      </button>
                    )}
                  </span>
                </div>
                <LayerPicker graph={graph} domains={domains} domainId={domain} topics={layerTopicsPool} items={l.items} forceCreate={parentLayers.has(l.id)} onChange={items => updateLayer(l.id, items)} />
              </div>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button size="sm" variant="outline" onClick={() => setLayers(ls => [...ls, { id: newKey(), items: [] }])}><Plus size={14} className="mr-1" />{t('ac.bulk.addLayer')}</Button>
              <label className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                {t('ac.bulk.separator')}
                <input value={separator} onChange={e => setSeparator(e.target.value)} className={`${pfInputClass} h-8 w-16 text-center`} />
              </label>
            </div>
            <p className={hint}>{t('ac.bulk.layersHint')}</p>
          </div>
        )}


        <div>
          <div className="flex flex-wrap items-baseline gap-x-3 mb-1.5">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('ac.bulk.preview').replace('{n}', String(toCreate.length))}
            </span>
            {layerTopics.length > 0 && <span className="text-xs text-gray-500">{t('ac.bulk.plusLayerTopics').replace('{n}', String(layerTopics.length))}</span>}
            {skipped > 0 && <span className="text-xs text-gray-500">{t('ac.bulk.skipped').replace('{n}', String(skipped))}</span>}
          </div>
          {tooMany && <p className="text-sm text-danger mb-1.5">{t('ac.bulk.tooMany').replace('{n}', String(MAX_TOPICS))}</p>}
          {toCreate.length > 0 && (
            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto rounded-md border border-gray-100 dark:border-gray-700 p-2">
              {toCreate.slice(0, PREVIEW).map((p, i) => {
                const parent = p.parents.map(x => (typeof x === 'string' ? graph.byId.get(x)?.name : x.name)).filter(Boolean).join(' + ');
                return (
                  <span key={i} className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-xs text-gray-700 dark:text-gray-200">
                    {parentLayers.size > 0 && parent && <span className="text-gray-400">{parent} › </span>}{p.name}
                  </span>
                );
              })}
              {toCreate.length > PREVIEW && <span className="px-2 py-0.5 text-xs text-gray-500">+{toCreate.length - PREVIEW}</span>}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
          <Button variant="ghost" onClick={onClose} disabled={saving}>{t('pf.common.cancel')}</Button>
          <Button onClick={save} disabled={saving || !valid}>
            {saving ? t('pf.common.saving') : t('ac.bulk.submit').replace('{n}', String(toCreate.length + layerTopics.length))}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
