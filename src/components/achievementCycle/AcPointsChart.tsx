import { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, LineChart, AreaChart, PieChart, Table2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { getDhakaDateString } from '../../lib/dhakaTime';
import { cycleLabel, shiftDay, weekdayOf, type AcCycle, type AcGraph, type CycleRef } from '../../lib/achievementCycle';
import { acCard, acSelectClass, AcStat } from './AcUi';

// Points gained over time (progress logs), by day / week / month / year over a
// preset or custom range, as bar / line / area, a pie by top-level topic, or a
// table. Plain SVG; colors are the validated reference palette (light / dark).

type Grain = 'day' | 'week' | 'month' | 'year';
type Kind = 'bar' | 'line' | 'area' | 'pie' | 'table';
type Log = { delta: number; created_at: string; cycle_id: string; comment_html: string | null };
type Bucket = { key: string; label: string; value: number };

const PRESETS: { key: string; days: number; grain: Grain }[] = [
  { key: '7d', days: 7, grain: 'day' },
  { key: '30d', days: 30, grain: 'day' },
  { key: '90d', days: 90, grain: 'week' },
  { key: '12w', days: 84, grain: 'week' },
  { key: '12m', days: 365, grain: 'month' },
  { key: '5y', days: 365 * 5, grain: 'year' },
];
const MAX_BUCKETS = 400;
// Categorical slots 1–6 (validated adjacent-pair safe in light + dark); slot 7+ folds into "Other" (gray).
const SLICE_CLASSES = [
  'fill-[#2a78d6] dark:fill-[#3987e5]', 'fill-[#eb6834] dark:fill-[#d95926]', 'fill-[#1baf7a] dark:fill-[#199e70]',
  'fill-[#eda100] dark:fill-[#c98500]', 'fill-[#e87ba4] dark:fill-[#d55181]', 'fill-[#008300] dark:fill-[#008300]',
];
const OTHER_CLASS = 'fill-gray-400 dark:fill-gray-500';
const SERIES_FILL = 'fill-[#2a78d6] dark:fill-[#3987e5]';
const SERIES_STROKE = 'stroke-[#2a78d6] dark:stroke-[#3987e5]';
const SWATCH_BG = ['bg-[#2a78d6] dark:bg-[#3987e5]', 'bg-[#eb6834] dark:bg-[#d95926]', 'bg-[#1baf7a] dark:bg-[#199e70]', 'bg-[#eda100] dark:bg-[#c98500]', 'bg-[#e87ba4] dark:bg-[#d55181]', 'bg-[#008300] dark:bg-[#008300]'];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** Weeks start on Saturday (Bangladesh). */
const weekStart = (day: string) => shiftDay(day, -((weekdayOf(day) + 1) % 7));
const keyOf = (day: string, g: Grain) => (g === 'day' ? day : g === 'week' ? weekStart(day) : g === 'month' ? day.slice(0, 7) : day.slice(0, 4));
const labelOf = (key: string, g: Grain) => {
  if (g === 'year') return key;
  const [y, m, d] = key.split('-');
  if (g === 'month') return `${MONTHS[Number(m) - 1]} ${y.slice(2)}`;
  return `${Number(d)} ${MONTHS[Number(m) - 1]}`;
};
/** Every bucket key from `from` to `to` (inclusive), in order. */
function bucketKeys(from: string, to: string, g: Grain): string[] {
  const keys: string[] = [];
  for (let d = from; d <= to && keys.length <= MAX_BUCKETS; d = shiftDay(d, 1)) {
    const k = keyOf(d, g);
    if (keys[keys.length - 1] !== k) keys.push(k);
    // Jump ahead inside long buckets (months / years) instead of walking every day.
    if (g === 'year') d = `${k}-12-31`;
  }
  return keys;
}
const niceMax = (v: number) => {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map(m => m * p).find(x => x >= v)!;
};
const compact = (n: number) => (Math.abs(n) >= 1000 ? `${Math.round(n / 100) / 10}K` : String(n));

export const AcPointsChart = ({ userId, scope, cycles, graph, cycle }: {
  userId: string; scope: Set<string>; cycles: AcCycle[]; graph: AcGraph; cycle: CycleRef;
}) => {
  const { t } = useLanguage();
  const today = getDhakaDateString();
  const [preset, setPreset] = useState('30d');
  const [grain, setGrain] = useState<Grain>('day');
  const [from, setFrom] = useState(shiftDay(today, -29));
  const [to, setTo] = useState(today);
  const [kind, setKind] = useState<Kind>('bar');
  const [onlyCycle, setOnlyCycle] = useState(false);
  const [logs, setLogs] = useState<Log[] | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const pickPreset = (key: string) => {
    setPreset(key);
    const p = PRESETS.find(x => x.key === key);
    if (!p) return;
    setGrain(p.grain);
    setFrom(shiftDay(today, -(p.days - 1)));
    setTo(today);
  };

  // Logs in the range (Dhaka days), all pages of them.
  useEffect(() => {
    let alive = true;
    setLoadingLogs(true);
    void (async () => {
      const rows: Log[] = [];
      for (let page = 0; page < 20; page++) {
        const { data } = await supabase.from('ac_progress_logs').select('delta, created_at, cycle_id, comment_html')
          .eq('user_id', userId).gte('created_at', `${from}T00:00:00+06:00`).lt('created_at', `${shiftDay(to, 1)}T00:00:00+06:00`)
          .order('created_at').range(page * 1000, page * 1000 + 999);
        rows.push(...((data ?? []) as Log[]));
        if (!data || data.length < 1000) break;
      }
      if (alive) { setLogs(rows); setLoadingLogs(false); }
    })();
    return () => { alive = false; };
  }, [userId, from, to]);

  const cycleById = useMemo(() => new Map(cycles.map(c => [c.id, c])), [cycles]);
  // Logs of topics in the dashboard's scope (and cycle, if asked). "Carried over" logs only
  // move existing points to a new child, they are not new work.
  const inScope = useMemo(() => (logs ?? []).filter(l => {
    const c = cycleById.get(l.cycle_id);
    if (!c || !scope.has(c.topic_id)) return false;
    if (onlyCycle && (c.kind !== cycle.kind || c.round !== cycle.round)) return false;
    return !(l.comment_html ?? '').startsWith('<p>Carried over from parent');
  }), [logs, cycleById, scope, onlyCycle, cycle]);

  const keys = useMemo(() => bucketKeys(from, to, grain), [from, to, grain]);
  const tooMany = keys.length > MAX_BUCKETS;
  const buckets: Bucket[] = useMemo(() => {
    const sums = new Map<string, number>();
    for (const l of inScope) {
      const k = keyOf(getDhakaDateString(new Date(l.created_at)), grain);
      sums.set(k, (sums.get(k) ?? 0) + l.delta);
    }
    return keys.map(k => ({ key: k, label: labelOf(k, grain), value: sums.get(k) ?? 0 }));
  }, [inScope, keys, grain]);

  // Pie: the range's points by top-level topic of the scope (each log goes to its nearest one).
  const slices = useMemo(() => {
    const tops = new Set([...scope].filter(id => graph.parents(id).every(p => !scope.has(p.id))));
    const sums = new Map<string, number>();
    for (const l of inScope) {
      const topic = cycleById.get(l.cycle_id)!.topic_id;
      const top = tops.has(topic) ? topic : [...graph.ancestors(topic)].find(a => tops.has(a));
      if (top) sums.set(top, (sums.get(top) ?? 0) + l.delta);
    }
    const rows = [...sums.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
      .map(([id, v]) => ({ id, name: graph.byId.get(id)?.name ?? '', value: v }));
    const head = rows.slice(0, 6);
    const rest = rows.slice(6).reduce((s, r) => s + r.value, 0);
    return rest > 0 ? [...head, { id: 'other', name: t('ac.points.other'), value: rest }] : head;
  }, [inScope, scope, graph, cycleById, t]);

  const total = buckets.reduce((s, b) => s + b.value, 0);
  const best = buckets.reduce<Bucket | null>((m, b) => (!m || b.value > m.value ? b : m), null);
  const active = buckets.filter(b => b.value !== 0).length;
  const grainName = t(`ac.points.grain.${grain}`);

  const kindBtn = (k: Kind, Icon: typeof BarChart3) => (
    <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k} title={t(`ac.points.kind.${k}`)}
      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${kind === k ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
      <Icon size={14} /><span className="hidden sm:inline">{t(`ac.points.kind.${k}`)}</span>
    </button>
  );

  return (
    <div className={`${acCard} p-5 space-y-4`}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mr-auto">{t('ac.points.title')}</h3>
        {/* One row of filters: range first, then grain, then scope / chart type. */}
        <select value={preset} onChange={e => pickPreset(e.target.value)} className={`${acSelectClass} h-9`} aria-label={t('ac.points.range')}>
          {PRESETS.map(p => <option key={p.key} value={p.key}>{t(`ac.points.preset.${p.key}`)}</option>)}
          <option value="custom">{t('ac.points.preset.custom')}</option>
        </select>
        {preset === 'custom' && (
          <span className="inline-flex items-center gap-1">
            <input type="date" value={from} max={to} onChange={e => e.target.value && setFrom(e.target.value)} className={`${acSelectClass} h-9`} aria-label={t('ac.points.from')} />
            <span className="text-gray-400">–</span>
            <input type="date" value={to} min={from} max={today} onChange={e => e.target.value && setTo(e.target.value)} className={`${acSelectClass} h-9`} aria-label={t('ac.points.to')} />
          </span>
        )}
        <select value={grain} onChange={e => setGrain(e.target.value as Grain)} className={`${acSelectClass} h-9`} aria-label={t('ac.points.by')}>
          {(['day', 'week', 'month', 'year'] as Grain[]).map(g => <option key={g} value={g}>{t(`ac.points.grainBy.${g}`)}</option>)}
        </select>
        <select value={onlyCycle ? 'one' : 'all'} onChange={e => setOnlyCycle(e.target.value === 'one')} className={`${acSelectClass} h-9`} aria-label={t('ac.cycle')}>
          <option value="all">{t('ac.points.allCycles')}</option>
          <option value="one">{cycleLabel(cycle, t)}</option>
        </select>
        <div className="inline-flex rounded-lg bg-gray-100 dark:bg-gray-900/60 p-1">
          {kindBtn('bar', BarChart3)}{kindBtn('line', LineChart)}{kindBtn('area', AreaChart)}{kindBtn('pie', PieChart)}{kindBtn('table', Table2)}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <AcStat label={t('ac.points.total')} value={total} />
        <AcStat label={t('ac.points.average').replace('{grain}', grainName)} value={keys.length ? Math.round((total / keys.length) * 10) / 10 : 0} />
        <AcStat label={t('ac.points.best').replace('{grain}', grainName)} value={best && best.value > 0 ? best.value : 0} hint={best && best.value > 0 ? best.label : undefined} />
        <AcStat label={t('ac.points.active').replace('{grain}', grainName)} value={`${active}/${keys.length}`} />
      </div>

      <div className={`transition-opacity ${loadingLogs && logs ? 'opacity-50' : ''}`}>
        {tooMany ? (
          <p className="p-8 text-center text-sm text-gray-500">{t('ac.points.tooMany').replace('{n}', String(MAX_BUCKETS))}</p>
        ) : logs === null ? (
          <p className="p-8 text-center text-sm text-gray-500">{t('pf.common.loading')}</p>
        ) : kind === 'pie' ? (
          <Pie slices={slices} />
        ) : kind === 'table' ? (
          <PointsTable buckets={buckets} />
        ) : (
          <TimeChart buckets={buckets} kind={kind} />
        )}
      </div>
    </div>
  );
};

const H = 240; // plot height (px)
const PAD = { top: 12, right: 12, bottom: 28, left: 40 };

/** Bars (one per period) or a line / area over the periods; hover shows the period and its points. */
const TimeChart = ({ buckets, kind }: { buckets: Bucket[]; kind: 'bar' | 'line' | 'area' }) => {
  const { t } = useLanguage();
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(600);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = buckets.length;
  const maxV = niceMax(Math.max(0, ...buckets.map(b => b.value)));
  const minV = Math.min(0, ...buckets.map(b => b.value));
  const lo = minV < 0 ? -niceMax(-minV) : 0;
  const plotW = w - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const band = plotW / Math.max(1, n);
  const x = (i: number) => PAD.left + band * i + band / 2;
  const y = (v: number) => PAD.top + plotH * (1 - (v - lo) / (maxV - lo));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => lo + (maxV - lo) * f);
  // Label every k-th period so x labels never collide (~56px each).
  const every = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(plotW / 56))));
  const barW = Math.min(24, band * 0.7);
  const r = Math.min(4, barW / 2);

  const barPath = (i: number, v: number) => {
    const x0 = x(i) - barW / 2, x1 = x0 + barW, base = y(0), top = y(v);
    if (v === 0) return '';
    const rr = Math.min(r, Math.abs(base - top));
    return v > 0
      ? `M${x0},${base} V${top + rr} Q${x0},${top} ${x0 + rr},${top} H${x1 - rr} Q${x1},${top} ${x1},${top + rr} V${base} Z`
      : `M${x0},${base} V${top - rr} Q${x0},${top} ${x0 + rr},${top} H${x1 - rr} Q${x1},${top} ${x1},${top - rr} V${base} Z`;
  };
  const linePath = buckets.map((b, i) => `${i ? 'L' : 'M'}${x(i)},${y(b.value)}`).join(' ');
  const areaPath = `${linePath} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z`;

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const i = Math.floor((e.clientX - rect.left) / band);
    setHover(Math.max(0, Math.min(n - 1, i)));
  };
  const hb = hover !== null ? buckets[hover] : null;

  return (
    <div ref={box} className="relative select-none">
      <svg width={w} height={H} role="img" aria-label={t('ac.points.title')} className="block overflow-visible">
        {ticks.map(v => (
          <g key={v}>
            <line x1={PAD.left} x2={w - PAD.right} y1={y(v)} y2={y(v)} className={v === 0 ? 'stroke-gray-300 dark:stroke-gray-600' : 'stroke-gray-100 dark:stroke-gray-800'} strokeWidth={1} />
            <text x={PAD.left - 6} y={y(v)} dy="0.32em" textAnchor="end" className="fill-gray-500 dark:fill-gray-400 text-[10px] tabular-nums">{compact(Math.round(v))}</text>
          </g>
        ))}
        {buckets.map((b, i) => (i % every === 0 ? (
          <text key={b.key} x={x(i)} y={H - 8} textAnchor="middle" className="fill-gray-500 dark:fill-gray-400 text-[10px]">{b.label}</text>
        ) : null))}

        {kind === 'bar' && buckets.map((b, i) => (
          <path key={b.key} d={barPath(i, b.value)} className={`${SERIES_FILL} transition-opacity ${hover !== null && hover !== i ? 'opacity-60' : ''}`} />
        ))}
        {kind !== 'bar' && n > 0 && (
          <>
            {kind === 'area' && <path d={areaPath} className={SERIES_FILL} fillOpacity={0.1} />}
            <path d={linePath} fill="none" className={SERIES_STROKE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {/* End marker, plus the hovered one: 8px dot with a 2px surface ring. */}
            {[n - 1, ...(hover !== null && hover !== n - 1 ? [hover] : [])].map(i => (
              <circle key={i} cx={x(i)} cy={y(buckets[i].value)} r={4} className={`${SERIES_FILL} stroke-white dark:stroke-gray-800`} strokeWidth={2} />
            ))}
          </>
        )}
        {kind !== 'bar' && hover !== null && (
          <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} className="stroke-gray-300 dark:stroke-gray-600" strokeWidth={1} />
        )}
        {/* Hit layer bigger than the marks: the whole plot finds the nearest period. */}
        <rect x={PAD.left} y={PAD.top} width={plotW} height={plotH} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
      </svg>
      {hb && hover !== null && (
        <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 shadow-md text-xs whitespace-nowrap"
          style={{ left: Math.min(Math.max(x(hover), 60), w - 60), top: Math.max(y(Math.max(hb.value, 0)) - 6, 30) }}>
          <div className="font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{hb.value > 0 ? `+${hb.value}` : hb.value} {t('ac.points.pts')}</div>
          <div className="text-gray-500 dark:text-gray-400">{hb.label}</div>
        </div>
      )}
    </div>
  );
};

/** Donut of the range's points by top-level topic; legend with values and shares (identity never by color alone). */
const Pie = ({ slices }: { slices: { id: string; name: string; value: number }[] }) => {
  const { t } = useLanguage();
  const [hover, setHover] = useState<string | null>(null);
  const sum = slices.reduce((s, x) => s + x.value, 0);
  if (!sum) return <p className="p-8 text-center text-sm text-gray-500">{t('ac.points.noGain')}</p>;
  const R = 100, r0 = 62, C = 110;
  let a0 = -Math.PI / 2;
  const arcs = slices.map((s, i) => {
    const a1 = a0 + (s.value / sum) * Math.PI * 2;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (a: number, rad: number) => `${C + rad * Math.cos(a)},${C + rad * Math.sin(a)}`;
    const d = slices.length === 1
      ? `M${C - R},${C} A${R},${R} 0 1 1 ${C + R},${C} A${R},${R} 0 1 1 ${C - R},${C} M${C - r0},${C} A${r0},${r0} 0 1 0 ${C + r0},${C} A${r0},${r0} 0 1 0 ${C - r0},${C} Z`
      : `M${p(a0, R)} A${R},${R} 0 ${large} 1 ${p(a1, R)} L${p(a1, r0)} A${r0},${r0} 0 ${large} 0 ${p(a0, r0)} Z`;
    a0 = a1;
    return { ...s, d, cls: s.id === 'other' ? OTHER_CLASS : SLICE_CLASSES[i], sw: s.id === 'other' ? 'bg-gray-400 dark:bg-gray-500' : SWATCH_BG[i] };
  });
  const h = arcs.find(a => a.id === hover);
  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <svg width={C * 2} height={C * 2} role="img" aria-label={t('ac.points.byTopic')} className="shrink-0">
        {arcs.map(a => (
          // 2px surface-colored gap between slices.
          <path key={a.id} d={a.d} className={`${a.cls} stroke-white dark:stroke-gray-800 transition-opacity ${hover && hover !== a.id ? 'opacity-50' : ''}`} strokeWidth={2}
            onPointerEnter={() => setHover(a.id)} onPointerLeave={() => setHover(null)} />
        ))}
        <text x={C} y={C - 6} textAnchor="middle" className="fill-gray-900 dark:fill-gray-100 text-xl font-bold tabular-nums">{h ? h.value : sum}</text>
        <text x={C} y={C + 14} textAnchor="middle" className="fill-gray-500 dark:fill-gray-400 text-[11px]">{h ? `${Math.round((h.value / sum) * 100)}%` : t('ac.points.pts')}</text>
      </svg>
      <ul className="flex-1 min-w-0 space-y-1.5 w-full">
        {arcs.map(a => (
          <li key={a.id} className={`flex items-center gap-2 text-sm rounded px-1 ${hover === a.id ? 'bg-gray-50 dark:bg-gray-700/40' : ''}`}
            onPointerEnter={() => setHover(a.id)} onPointerLeave={() => setHover(null)}>
            <span className={`w-3 h-3 rounded-sm shrink-0 ${a.sw}`} aria-hidden="true" />
            <span className="flex-1 min-w-0 truncate text-gray-800 dark:text-gray-200" title={a.name}>{a.name}</span>
            <span className="tabular-nums font-semibold text-gray-900 dark:text-gray-100">{a.value}</span>
            <span className="tabular-nums text-xs text-gray-500 w-10 text-right">{Math.round((a.value / sum) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

/** The same numbers as a table (the accessible view; every chart value is reachable here). */
const PointsTable = ({ buckets }: { buckets: Bucket[] }) => {
  const { t } = useLanguage();
  return (
    <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-100 dark:border-gray-700">
      <table className="min-w-full text-sm">
        <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900 text-left text-xs text-gray-500">
          <tr><th className="px-3 py-2">{t('ac.points.period')}</th><th className="px-3 py-2 text-right">{t('ac.points.pts')}</th></tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {[...buckets].reverse().map(b => (
            <tr key={b.key}>
              <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{b.label}</td>
              <td className={`px-3 py-1.5 text-right tabular-nums ${b.value ? 'font-semibold text-gray-900 dark:text-gray-100' : 'text-gray-400'}`}>{b.value > 0 ? `+${b.value}` : b.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
