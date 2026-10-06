import { useMemo, useState } from 'react';
import { ChevronRight, ChevronDown, Star, ZoomIn, ZoomOut, Network, ListTree, Grid3x3 } from 'lucide-react';
import { useLanguage } from '../../lib/LanguageContext';
import { cycleKey, cycleLabel, percent, useAcData, useSelectedCycle, type CycleRef, type AcGraph, type AcLink, type AcRollup } from '../../lib/achievementCycle';
import { acSelectClass, AcCyclePicker, AcLevelBadge, AcProgress, acCard, AcArchiveToggle } from '../../components/achievementCycle/AcUi';
import { useAcDialogs } from '../../components/achievementCycle/useAcDialogs';
import { LEVELS, type Level } from '../../components/achievementCycle/AcTopicFilters';
import { PfPageHeader } from '../Portfolio/PfPageHeader';

type View = 'tree' | 'graph' | 'heatmap';
type RollupOf = (id: string, c: CycleRef) => AcRollup | null;

/** Top-level topics of a scope: subjects, or (inside a domain) topics whose parents are all outside it. */
const scopeRoots = (graph: AcGraph, scope: Set<string> | null) =>
  scope
    ? [...scope].map(id => graph.byId.get(id)!).filter(x => x && graph.parents(x.id).every(p => !scope.has(p.id))).sort((a, b) => a.name.localeCompare(b.name))
    : graph.roots;

// ---------------------------------------------------------------- tree

const TreeNode = ({ graph, id, link, depth, cycle, rollupOf, open, toggle, onOpen, scope }: {
  graph: AcGraph; id: string; link: AcLink | null; depth: number; cycle: CycleRef; rollupOf: RollupOf;
  open: Set<string>; toggle: (key: string) => void; onOpen: (id: string) => void; scope: Set<string> | null;
}) => {
  const topic = graph.byId.get(id)!;
  const kids = (graph.childLinks.get(id) ?? []).filter(l => !scope || scope.has(l.child_id));
  // A shared topic appears under every parent, so expansion is keyed by path.
  const key = `${link?.id ?? 'root'}:${id}`;
  const isOpen = open.has(key);
  const r = rollupOf(id, cycle);
  const otherParents = graph.parents(id).length - 1;
  return (
    <>
      <div className="flex items-center gap-2 py-1.5 pr-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-md" style={{ paddingLeft: depth * 20 + 4 }}>
        <button className="w-5 h-5 flex items-center justify-center text-gray-400 disabled:invisible" disabled={kids.length === 0} onClick={() => toggle(key)} aria-label={isOpen ? 'Collapse' : 'Expand'}>
          {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </button>
        <button className="flex-1 min-w-0 flex items-center gap-2 text-left" onClick={() => onOpen(id)}>
          {topic.is_milestone && <Star size={13} className="fill-warning text-warning shrink-0" />}
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{topic.name}</span>
          <AcLevelBadge level={link ? graph.roleOf(link) : 'subject'} />
          {link && otherParents > 0 && <span className="text-[11px] text-gray-400 shrink-0">+{otherParents}</span>}
        </button>
        <div className="w-56 shrink-0"><AcProgress achieved={r?.achieved ?? 0} total={r?.total ?? 0} size="sm" /></div>
      </div>
      {isOpen && kids.map(l => (
        <TreeNode key={l.id} graph={graph} id={l.child_id} link={l} depth={depth + 1} cycle={cycle} rollupOf={rollupOf} open={open} toggle={toggle} onOpen={onOpen} scope={scope} />
      ))}
    </>
  );
};

// ---------------------------------------------------------------- graph

const NODE_W = 190;
const NODE_H = 58;
const GAP_X = 28;
const GAP_Y = 70;

/** Layered layout: depth = longest path from a root; order by parents' mean x. */
function layout(graph: AcGraph, ids: Set<string>) {
  const depth = new Map<string, number>();
  const visit = (id: string): number => {
    if (depth.has(id)) return depth.get(id)!;
    const ps = graph.parents(id).filter(p => ids.has(p.id));
    const d = ps.length ? Math.max(...ps.map(p => visit(p.id))) + 1 : 0;
    depth.set(id, d);
    return d;
  };
  for (const id of ids) visit(id);
  const layers: string[][] = [];
  for (const [id, d] of depth) (layers[d] ??= []).push(id);
  const x = new Map<string, number>();
  layers.forEach((layer, d) => {
    if (d === 0) layer.sort((a, b) => graph.byId.get(a)!.name.localeCompare(graph.byId.get(b)!.name));
    else {
      const mean = (id: string) => {
        const ps = graph.parents(id).filter(p => x.has(p.id));
        return ps.length ? ps.reduce((s, p) => s + x.get(p.id)!, 0) / ps.length : 0;
      };
      layer.sort((a, b) => mean(a) - mean(b));
    }
    layer.forEach((id, i) => x.set(id, i));
  });
  const width = Math.max(1, ...layers.map(l => l.length)) * (NODE_W + GAP_X) + NODE_W;
  const pos = new Map<string, { x: number; y: number }>();
  layers.forEach((layer, d) => {
    const offset = (width - layer.length * (NODE_W + GAP_X)) / 2;
    layer.forEach((id, i) => pos.set(id, { x: offset + i * (NODE_W + GAP_X) + GAP_X / 2, y: d * (NODE_H + GAP_Y) + 16 }));
  });
  return { pos, width, height: layers.length * (NODE_H + GAP_Y) + 16 };
}

const GraphView = ({ graph, ids, cycle, rollupOf, onOpen }: { graph: AcGraph; ids: Set<string>; cycle: CycleRef; rollupOf: RollupOf; onOpen: (id: string) => void }) => {
  const { t } = useLanguage();
  const [zoom, setZoom] = useState(1);
  const [hover, setHover] = useState<string | null>(null);
  const { pos, width, height } = useMemo(() => layout(graph, ids), [graph, ids]);
  const edges = [...ids].flatMap(id => (graph.childLinks.get(id) ?? []).filter(l => ids.has(l.child_id)));
  const near = hover ? new Set([hover, ...graph.parents(hover).map(p => p.id), ...graph.children(hover).map(c => c.id)]) : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <button className="p-1.5 rounded-md border border-gray-200 dark:border-gray-700" onClick={() => setZoom(z => Math.max(0.4, z - 0.15))} aria-label="Zoom out"><ZoomOut size={14} /></button>
        <span className="tabular-nums w-10 text-center">{Math.round(zoom * 100)}%</span>
        <button className="p-1.5 rounded-md border border-gray-200 dark:border-gray-700" onClick={() => setZoom(z => Math.min(1.6, z + 0.15))} aria-label="Zoom in"><ZoomIn size={14} /></button>
        <span className="ml-2">{t('ac.explore.graphHint')}</span>
      </div>
      <div className="overflow-auto rounded-lg border border-gray-100 dark:border-gray-700 max-h-[70vh]">
        <svg width={width * zoom} height={height * zoom} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={t('ac.explore.graph')}>
          {edges.map(l => {
            const a = pos.get(l.parent_id)!;
            const b = pos.get(l.child_id)!;
            const x1 = a.x + NODE_W / 2, y1 = a.y + NODE_H, x2 = b.x + NODE_W / 2, y2 = b.y;
            // A link that skips a layer would run straight behind the nodes in
            // between; bow it out to the side so it stays visible.
            const skips = b.y - a.y > NODE_H + GAP_Y + 1;
            const bow = skips ? NODE_W * 0.75 : 0;
            const lit = near && near.has(l.parent_id) && near.has(l.child_id) && (l.parent_id === hover || l.child_id === hover);
            return (
              <path
                key={l.id}
                d={`M${x1},${y1} C${x1 + bow},${y1 + GAP_Y} ${x2 + bow},${y2 - GAP_Y} ${x2},${y2}`}
                fill="none"
                stroke={lit ? 'var(--ac-seq)' : 'var(--ac-edge)'}
                strokeWidth={lit ? 2 : 1.5}
                strokeDasharray={graph.roleOf(l) === 'area' ? '4 3' : undefined}
                opacity={near && !lit ? 0.35 : 1}
              />
            );
          })}
          {[...ids].map(id => {
            const p = pos.get(id)!;
            const topic = graph.byId.get(id)!;
            const r = rollupOf(id, cycle);
            const pct = percent(r?.achieved ?? 0, r?.total ?? 0);
            const dim = near && !near.has(id);
            return (
              <g key={id} transform={`translate(${p.x},${p.y})`} className="cursor-pointer" opacity={dim ? 0.4 : 1}
                onMouseEnter={() => setHover(id)} onMouseLeave={() => setHover(null)} onClick={() => onOpen(id)}>
                <title>{`${topic.name} — ${pct}% (${r?.achieved ?? 0}/${r?.total ?? 0})`}</title>
                <rect width={NODE_W} height={NODE_H} rx={10} className="fill-white dark:fill-gray-800 stroke-gray-200 dark:stroke-gray-600" strokeWidth={hover === id ? 2 : 1} />
                <text x={12} y={22} className="fill-gray-900 dark:fill-gray-100" fontSize={13} fontWeight={600}>
                  {(topic.is_milestone ? '★ ' : '') + (topic.name.length > 22 ? `${topic.name.slice(0, 21)}…` : topic.name)}
                </text>
                <rect x={12} y={36} width={NODE_W - 64} height={6} rx={3} fill="var(--ac-seq-track)" />
                <rect x={12} y={36} width={((NODE_W - 64) * pct) / 100} height={6} rx={3} fill="var(--ac-seq)" />
                <text x={NODE_W - 12} y={42} textAnchor="end" fontSize={11} className="fill-gray-600 dark:fill-gray-300">{pct}%</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flex gap-4 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1.5"><svg width="24" height="6"><line x1="0" y1="3" x2="24" y2="3" stroke="var(--ac-edge)" strokeWidth="1.5" /></svg>{t('ac.level.general')}</span>
        <span className="inline-flex items-center gap-1.5"><svg width="24" height="6"><line x1="0" y1="3" x2="24" y2="3" stroke="var(--ac-edge)" strokeWidth="1.5" strokeDasharray="4 3" /></svg>{t('ac.level.area')}</span>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- heatmap

const Heatmap = ({ graph, roots, refs, rollupOf, onOpen, scope }: { graph: AcGraph; roots: { id: string }[]; refs: CycleRef[]; rollupOf: RollupOf; onOpen: (id: string) => void; scope: Set<string> | null }) => {
  const { t } = useLanguage();
  // Depth-first from the roots; a shared topic is listed once, under its first parent.
  const rows: { id: string; depth: number }[] = [];
  const seen = new Set<string>();
  const walk = (id: string, depth: number) => {
    if (seen.has(id)) return;
    seen.add(id);
    rows.push({ id, depth });
    for (const c of graph.children(id)) if (!scope || scope.has(c.id)) walk(c.id, depth + 1);
  };
  roots.forEach(r => walk(r.id, 0));

  return (
    <div className="overflow-auto max-h-[70vh] rounded-lg border border-gray-100 dark:border-gray-700">
      <table className="text-xs border-separate" style={{ borderSpacing: 2 }}>
        <thead className="sticky top-0 bg-white dark:bg-gray-800 z-10">
          <tr>
            <th className="text-left px-2 py-2 font-semibold text-gray-600 dark:text-gray-300 min-w-56">{t('ac.topics.title')}</th>
            {refs.map(r => <th key={cycleKey(r)} className="px-2 py-2 font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">{cycleLabel(r, t)}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ id, depth }) => (
            <tr key={id}>
              <td className="px-2 py-1">
                <button className="text-left text-gray-800 dark:text-gray-200 hover:underline truncate max-w-72 block" style={{ paddingLeft: depth * 14 }} onClick={() => onOpen(id)}>
                  {graph.byId.get(id)!.name}
                </button>
              </td>
              {refs.map(r => {
                const ru = rollupOf(id, r);
                if (!ru || ru.total === 0) {
                  return <td key={cycleKey(r)} className="w-16 h-8 text-center rounded text-gray-400 bg-gray-50 dark:bg-gray-900/40">—</td>;
                }
                const pct = percent(ru.achieved, ru.total);
                return (
                  <td
                    key={cycleKey(r)}
                    className={`w-16 h-8 text-center rounded tabular-nums font-medium ${pct >= 55 ? 'text-white' : 'text-gray-800 dark:text-gray-100'}`}
                    style={{ background: `color-mix(in srgb, var(--ac-seq) ${Math.max(pct, 4)}%, var(--ac-seq-track))` }}
                    title={`${graph.byId.get(id)!.name} · ${cycleLabel(r, t)}: ${pct}% (${ru.achieved}/${ru.total})`}
                  >
                    {pct}%
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ---------------------------------------------------------------- page

const VIEWS: { key: View; label: string; icon: typeof Network }[] = [
  { key: 'tree', label: 'ac.explore.tree', icon: ListTree },
  { key: 'graph', label: 'ac.explore.graph', icon: Network },
  { key: 'heatmap', label: 'ac.explore.heatmap', icon: Grid3x3 },
];

/** The topic network as a tree, a graph and a topic × cycle heatmap. */
export const AcExplore = () => {
  const { t } = useLanguage();
  const data = useAcData();
  const { loading, graph, domains, topics, cycleRefs, rollupOf } = data;
  const { cycle, cycleKey: ck, select } = useSelectedCycle(cycleRefs);
  const { openTopic, dialogs } = useAcDialogs(data, cycle);
  const [view, setView] = useState<View>('tree');
  const [domainId, setDomainId] = useState('');
  // Subject and level filters; '' = all (the default).
  const [subjectId, setSubjectId] = useState('');
  const [level, setLevel] = useState<'' | Level>('');
  const [open, setOpen] = useState<Set<string>>(new Set());

  const domainSet = useMemo(() => (domainId ? graph.domainTopics(domainId) : null), [graph, domainId]);
  const subjects = graph.roots.filter(r => !domainSet || domainSet.has(r.id));
  // A subject from another domain no longer applies once the domain changes.
  const activeSubject = subjects.some(x => x.id === subjectId) ? subjectId : '';
  // Everything the views show: domain ∩ subject's branch ∩ level (each only when chosen).
  const scope = useMemo(() => {
    let set = domainSet;
    if (activeSubject) {
      const sub = graph.subtree(activeSubject);
      set = set ? new Set([...sub].filter(x => set!.has(x))) : sub;
    }
    if (level) set = new Set([...(set ?? topics.map(x => x.id))].filter(x => graph.levelOf(x) === level));
    return set;
  }, [graph, domainSet, activeSubject, level, topics]);
  const roots = scopeRoots(graph, scope);
  const ids = useMemo(() => scope ?? new Set(topics.map(x => x.id)), [scope, topics]);

  const toggle = (key: string) => setOpen(s => {
    const next = new Set(s);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const expandAll = () => {
    const keys = new Set<string>();
    const walk = (id: string, link: AcLink | null) => {
      keys.add(`${link?.id ?? 'root'}:${id}`);
      for (const l of graph.childLinks.get(id) ?? []) if (!scope || scope.has(l.child_id)) walk(l.child_id, l);
    };
    roots.forEach(r => walk(r.id, null));
    setOpen(keys);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PfPageHeader title="ac.explore.pageTitle" subtitle="ac.explore.pageSubtitle" action={<AcArchiveToggle value={data.showArchived} onChange={data.setShowArchived} />} />
      <div className={`${acCard} p-4 flex flex-wrap items-center gap-3`}>
        <div className="flex gap-1">
          {VIEWS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setView(key)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium ${view === key ? 'bg-primary text-white' : 'text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
              <Icon size={15} />{t(label)}
            </button>
          ))}
        </div>
        {view !== 'heatmap' && <AcCyclePicker refs={cycleRefs} value={ck} onChange={select} />}
        <select value={domainId} onChange={e => setDomainId(e.target.value)} className={`${acSelectClass} h-9`}>
          <option value="">{t('ac.allDomains')}</option>
          {domains.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={activeSubject} onChange={e => setSubjectId(e.target.value)} className={`${acSelectClass} h-9`} aria-label={t('ac.level.subject')}>
          <option value="">{t('ac.allSubjects')}</option>
          {subjects.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        <select value={level} onChange={e => setLevel(e.target.value as '' | Level)} className={`${acSelectClass} h-9`} aria-label={t('ac.topics.level')}>
          <option value="">{t('ac.allLevels')}</option>
          {LEVELS.map(l => <option key={l} value={l}>{t(`ac.level.${l}`)}</option>)}
        </select>
        {view === 'tree' && (
          <div className="ml-auto flex gap-2 text-sm">
            <button className="text-primary hover:underline" onClick={expandAll}>{t('ac.explore.expandAll')}</button>
            <button className="text-primary hover:underline" onClick={() => setOpen(new Set())}>{t('ac.explore.collapseAll')}</button>
          </div>
        )}
      </div>

      <div className={`${acCard} p-4`}>
        {loading ? (
          <div className="p-12 text-center text-gray-500">{t('pf.common.loading')}</div>
        ) : topics.length === 0 ? (
          <div className="p-12 text-center text-gray-500">{t('ac.topics.empty')}</div>
        ) : view === 'tree' ? (
          <div>
            {roots.map(r => (
              <TreeNode key={r.id} graph={graph} id={r.id} link={null} depth={0} cycle={cycle} rollupOf={rollupOf} open={open} toggle={toggle} onOpen={openTopic} scope={scope} />
            ))}
          </div>
        ) : view === 'graph' ? (
          <GraphView graph={graph} ids={ids} cycle={cycle} rollupOf={rollupOf} onOpen={openTopic} />
        ) : (
          <Heatmap graph={graph} roots={roots} refs={cycleRefs} rollupOf={rollupOf} onOpen={openTopic} scope={scope} />
        )}
      </div>

      {dialogs}
    </div>
  );
};
