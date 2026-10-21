import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CvData, CvTemplate } from '../../lib/cvMaker';
import { CvPreview, CV_PAGE_HEIGHT, CV_PAGE_WIDTH, CV_SIDE_WIDTH } from './CvPreview';

// The CV cut into A4 pages, for the preview and for printing alike, so the PDF
// is exactly what the editor shows. The sheet is rendered once off-screen to
// measure it; each page then shows its own slice of the sheet. Cuts fall
// between `data-cv-block`s, never through one (unless one is taller than a page).

type Props = {
  data: CvData;
  template: CvTemplate;
  accent: string;
  /** Show only the first pages (thumbnails). */
  maxPages?: number;
  /** Space between pages on screen (print puts each on its own sheet). */
  gap?: number;
  className?: string;
};

type Layout = { breaks: number[]; total: number };

/** Top / bottom margin inside every page. */
const padOf = (template: CvTemplate) => (template === 'modern' ? 40 : 48);

/** A page should hold at least this much before a cut is moved up to keep a block whole. */
const MIN_FILL = 0.4;

function computeLayout(sheet: HTMLElement, inner: number): Layout | null {
  const base = sheet.getBoundingClientRect().top;
  const total = sheet.offsetHeight;
  if (!total) return null; // not laid out (hidden): keep the last layout
  const marked = Array.from(sheet.querySelectorAll<HTMLElement>('[data-cv-block],[data-cv-keep]')).map(el => {
    const r = el.getBoundingClientRect();
    return { top: r.top - base, bottom: r.bottom - base, keep: el.hasAttribute('data-cv-keep') };
  });
  // A heading reaches down to the end of the block after it, so it never ends a page alone.
  const blocks = marked.map((b, i) => {
    if (!b.keep) return b;
    const next = marked.slice(i + 1).find(n => !n.keep && n.top >= b.top);
    return { ...b, bottom: next ? Math.max(b.bottom, next.bottom) : b.bottom };
  });
  const cuts = (y: number) => blocks.some(b => b.top < y - 0.5 && b.bottom > y + 0.5);
  const starts = [...new Set(blocks.map(b => b.top))].sort((a, b) => a - b);

  const breaks = [0];
  let start = 0;
  while (total - start > inner + 0.5) {
    const limit = start + inner;
    const fit = starts.filter(y => y > start + inner * MIN_FILL && y <= limit && !cuts(y));
    const y = fit.length ? fit[fit.length - 1] : limit;
    breaks.push(y);
    start = y;
  }
  return { breaks, total };
}

const sameLayout = (a: Layout, b: Layout) => a.total === b.total && a.breaks.join() === b.breaks.join();

export function CvPages({ data, template, accent, maxPages, gap = 24, className = '' }: Props) {
  const pad = padOf(template);
  const inner = CV_PAGE_HEIGHT - 2 * pad;
  const measure = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout>({ breaks: [0], total: inner });

  useLayoutEffect(() => {
    const sheet = measure.current?.firstElementChild as HTMLElement | null;
    if (!sheet) return;
    const run = () => {
      const next = computeLayout(sheet, inner);
      if (next) setLayout(prev => (sameLayout(prev, next) ? prev : next));
    };
    run();
    // Fonts and the photo load later and change heights.
    const ro = new ResizeObserver(run);
    ro.observe(sheet);
    return () => ro.disconnect();
  }, [data, template, accent, inner]);

  const pages = layout.breaks
    .slice(0, maxPages ?? layout.breaks.length)
    .map((start, i) => ({ start, end: layout.breaks[i + 1] ?? layout.total }));
  const background = template === 'modern' ? `linear-gradient(to right, ${accent} ${CV_SIDE_WIDTH}px, #fff ${CV_SIDE_WIDTH}px)` : '#fff';

  return (
    <>
      {createPortal(
        <div ref={measure} className="cv-measure" aria-hidden="true"
          style={{ position: 'fixed', left: -100000, top: 0, visibility: 'hidden', pointerEvents: 'none' }}>
          <CvPreview data={data} template={template} accent={accent} />
        </div>,
        document.body,
      )}
      <div className={`cv-pages flex flex-col ${className}`} style={{ gap }}>
        {pages.map((p, i) => (
          <div key={i} className="cv-page overflow-hidden" style={{ width: CV_PAGE_WIDTH, height: CV_PAGE_HEIGHT, padding: `${pad}px 0`, boxSizing: 'border-box', background }}>
            <div className="overflow-hidden" style={{ height: p.end - p.start }}>
              <div style={{ marginTop: -p.start }}>
                <CvPreview data={data} template={template} accent={accent} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
