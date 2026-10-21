import type { CSSProperties, ReactNode } from 'react';
import type { CvData, CvSectionKey, CvTemplate } from '../../lib/cvMaker';

// The CV as one continuous sheet. Always black on white paper (no dark:
// styles), A4 wide (794px at 96dpi). Section titles stay English: they are
// part of the document, not of the app's UI language. CvPages cuts this sheet
// into A4 pages: `data-cv-block` marks what must not be split across pages,
// `data-cv-keep` (headings) stays on the same page as the block after it.

export const CV_PAGE_WIDTH = 794;
export const CV_PAGE_HEIGHT = 1123;

const TITLES: Record<CvSectionKey, string> = {
  summary: 'Profile',
  experience: 'Experience',
  education: 'Education',
  projects: 'Projects',
  skills: 'Skills',
  certifications: 'Certifications',
  languages: 'Languages',
};

/** Sections the modern template puts in its side column. */
const SIDE: CvSectionKey[] = ['skills', 'languages', 'certifications'];

type Props = { data: CvData; template: CvTemplate; accent: string };

const bullets = (text: string) => text.split('\n').map(l => l.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean);
const range = (start: string, end: string, current = false) => [start, current ? 'Present' : end].filter(Boolean).join(' – ');
const stripUrl = (u: string) => u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

const Bullets = ({ text, className = '' }: { text: string; className?: string }) => {
  const items = bullets(text);
  if (!items.length) return null;
  return (
    <ul className={`list-disc pl-4 mt-1 space-y-0.5 ${className}`}>
      {items.map((b, i) => <li key={i}>{b}</li>)}
    </ul>
  );
};

/** Whether a section has anything to print. */
function hasContent(data: CvData, key: CvSectionKey): boolean {
  if (data.hidden.includes(key)) return false;
  if (key === 'summary') return !!data.summary.trim();
  return data[key].length > 0;
}

function contacts(data: CvData): string[] {
  const p = data.personal;
  return [p.email, p.phone, p.location, p.website && stripUrl(p.website), p.linkedin && stripUrl(p.linkedin), p.github && stripUrl(p.github)]
    .filter((x): x is string => !!x && !!x.trim());
}

/** One section's body, shared by every template. `compact` is the narrow side column. */
function SectionBody({ data, k, accent, compact = false }: { data: CvData; k: CvSectionKey; accent: string; compact?: boolean }) {
  switch (k) {
    case 'summary':
      return <p data-cv-block="" className="whitespace-pre-line leading-relaxed">{data.summary}</p>;
    case 'experience':
      return (
        <div className="space-y-3">
          {data.experience.map(e => (
            <div key={e.id} data-cv-block="">
              <div className="flex justify-between gap-3 items-baseline">
                <div className="font-semibold text-[#111827]">{e.role}{e.company && <span className="font-normal" style={{ color: accent }}>{e.role ? ' · ' : ''}{e.company}</span>}</div>
                <div className="text-[11px] text-[#6b7280] whitespace-nowrap">{range(e.start, e.end, e.current)}</div>
              </div>
              {e.location && <div className="text-[11px] text-[#6b7280]">{e.location}</div>}
              <Bullets text={e.details} />
            </div>
          ))}
        </div>
      );
    case 'education':
      return (
        <div className="space-y-2.5">
          {data.education.map(e => (
            <div key={e.id} data-cv-block="">
              <div className="flex justify-between gap-3 items-baseline">
                <div className="font-semibold text-[#111827]">{e.degree}</div>
                <div className="text-[11px] text-[#6b7280] whitespace-nowrap">{range(e.start, e.end)}</div>
              </div>
              <div className="text-[#374151]">{[e.school, e.location].filter(Boolean).join(', ')}</div>
              <Bullets text={e.details} />
            </div>
          ))}
        </div>
      );
    case 'projects':
      return (
        <div className="space-y-2.5">
          {data.projects.map(p => (
            <div key={p.id} data-cv-block="">
              <div className="flex justify-between gap-3 items-baseline">
                <div className="font-semibold text-[#111827]">{p.name}</div>
                {p.link && <div className="text-[11px] whitespace-nowrap" style={{ color: accent }}>{stripUrl(p.link)}</div>}
              </div>
              {p.tech && <div className="text-[11px] text-[#6b7280]">{p.tech}</div>}
              <Bullets text={p.details} />
            </div>
          ))}
        </div>
      );
    case 'skills':
      return (
        <div className={compact ? 'space-y-2' : 'space-y-1'}>
          {data.skills.map(g => {
            const items = g.items.split(',').map(x => x.trim()).filter(Boolean);
            return compact ? (
              <div key={g.id} data-cv-block="">
                {g.name && <div className="font-semibold mb-1">{g.name}</div>}
                <div className="flex flex-wrap gap-1">
                  {items.map(it => <span key={it} className="px-1.5 py-0.5 rounded text-[10.5px] bg-white/15">{it}</span>)}
                </div>
              </div>
            ) : (
              <div key={g.id} data-cv-block="">
                {g.name && <span className="font-semibold text-[#111827]">{g.name}: </span>}
                <span>{items.join(', ')}</span>
              </div>
            );
          })}
        </div>
      );
    case 'certifications':
      return (
        <div className="space-y-1.5">
          {data.certifications.map(c => (
            <div key={c.id} data-cv-block="">
              <div className="font-semibold">{c.name}</div>
              <div className={compact ? 'text-[11px] opacity-80' : 'text-[11px] text-[#6b7280]'}>{[c.issuer, c.date].filter(Boolean).join(' · ')}</div>
            </div>
          ))}
        </div>
      );
    case 'languages':
      return (
        <div className={compact ? 'space-y-1' : 'flex flex-wrap gap-x-5 gap-y-1'}>
          {data.languages.map(l => (
            <div key={l.id} data-cv-block="" className={compact ? 'flex justify-between gap-2' : ''}>
              <span className="font-semibold">{l.name}</span>
              {l.level && <span className={compact ? 'opacity-80' : 'text-[#6b7280]'}>{compact ? l.level : ` — ${l.level}`}</span>}
            </div>
          ))}
        </div>
      );
  }
}

const Photo = ({ url, size, ring }: { url: string; size: number; ring?: string }) =>
  url ? <img src={url} alt="" className="rounded-full object-cover shrink-0" style={{ width: size, height: size, border: ring ? `3px solid ${ring}` : undefined }} /> : null;

const Sheet = ({ children, className = '', style }: { children: ReactNode; className?: string; style?: CSSProperties }) => (
  <div
    className={`cv-sheet bg-white text-[#374151] text-[12.5px] leading-snug ${className}`}
    style={{ width: CV_PAGE_WIDTH, fontFamily: 'Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', ...style }}
  >
    {children}
  </div>
);

function Classic({ data, accent }: Props) {
  const p = data.personal;
  const keys = data.order.filter(k => hasContent(data, k));
  return (
    <Sheet className="px-14">
      <header className="text-center" data-cv-block="">
        {p.photoUrl && <div className="flex justify-center mb-3"><Photo url={p.photoUrl} size={88} ring={accent} /></div>}
        <h1 className="text-[30px] font-bold tracking-tight text-[#111827]">{p.name || 'Your Name'}</h1>
        {p.headline && <div className="text-[14px] mt-0.5" style={{ color: accent }}>{p.headline}</div>}
        <div className="text-[11.5px] text-[#4b5563] mt-2 flex flex-wrap justify-center gap-x-2">
          {contacts(data).map((c, i) => <span key={i}>{i > 0 && <span className="mr-2 text-[#9ca3af]">|</span>}{c}</span>)}
        </div>
      </header>
      <div className="h-[2px] my-5" style={{ background: accent }} />
      <div className="space-y-5">
        {keys.map(k => (
          <section key={k}>
            <h2 data-cv-keep="" className="text-[13px] font-bold uppercase tracking-[0.12em] pb-1 mb-2 border-b" style={{ color: accent, borderColor: `${accent}55` }}>{TITLES[k]}</h2>
            <SectionBody data={data} k={k} accent={accent} />
          </section>
        ))}
      </div>
    </Sheet>
  );
}

function Modern({ data, accent }: Props) {
  const p = data.personal;
  const keys = data.order.filter(k => hasContent(data, k));
  const side = keys.filter(k => SIDE.includes(k));
  const main = keys.filter(k => !SIDE.includes(k));
  return (
    <Sheet className="flex">
      <aside className="shrink-0 text-white px-7 space-y-6" style={{ width: CV_SIDE_WIDTH, background: accent }}>
        {p.photoUrl && <div data-cv-block="" className="flex justify-center"><Photo url={p.photoUrl} size={120} ring="rgba(255,255,255,0.6)" /></div>}
        <div data-cv-block="" className="space-y-1.5 text-[11.5px] break-words">
          <h2 className="text-[12px] font-bold uppercase tracking-[0.14em] mb-2 opacity-90">Contact</h2>
          {contacts(data).map((c, i) => <div key={i}>{c}</div>)}
        </div>
        {side.map(k => (
          <section key={k} className="text-[11.5px]">
            <h2 data-cv-keep="" className="text-[12px] font-bold uppercase tracking-[0.14em] mb-2 opacity-90">{TITLES[k]}</h2>
            <SectionBody data={data} k={k} accent="#ffffff" compact />
          </section>
        ))}
      </aside>
      <main className="flex-1 px-9 min-w-0">
        <header className="mb-6" data-cv-block="">
          <h1 className="text-[32px] font-extrabold leading-tight text-[#111827]">{p.name || 'Your Name'}</h1>
          {p.headline && <div className="text-[15px] font-medium mt-1" style={{ color: accent }}>{p.headline}</div>}
        </header>
        <div className="space-y-6">
          {main.map(k => (
            <section key={k}>
              <h2 data-cv-keep="" className="flex items-center gap-2 text-[14px] font-bold uppercase tracking-[0.1em] text-[#111827] mb-2.5">
                <span className="w-5 h-[3px] rounded-full" style={{ background: accent }} />{TITLES[k]}
              </h2>
              <SectionBody data={data} k={k} accent={accent} />
            </section>
          ))}
        </div>
      </main>
    </Sheet>
  );
}

function Minimal({ data, accent }: Props) {
  const p = data.personal;
  const keys = data.order.filter(k => hasContent(data, k));
  return (
    <Sheet className="px-14">
      <header className="flex items-center gap-5 mb-8" data-cv-block="">
        <Photo url={p.photoUrl} size={76} />
        <div className="min-w-0">
          <h1 className="text-[28px] font-light tracking-tight text-[#111827]">{p.name || 'Your Name'}</h1>
          {p.headline && <div className="text-[13px] text-[#6b7280] mt-0.5">{p.headline}</div>}
          <div className="text-[11px] mt-2 flex flex-wrap gap-x-3" style={{ color: accent }}>
            {contacts(data).map((c, i) => <span key={i}>{c}</span>)}
          </div>
        </div>
      </header>
      <div className="space-y-5">
        {keys.map(k => (
          <section key={k} className="grid grid-cols-[130px_1fr] gap-5">
            <h2 data-cv-keep="" className="text-[11px] font-semibold uppercase tracking-[0.14em] pt-0.5" style={{ color: accent }}>{TITLES[k]}</h2>
            <div className="min-w-0"><SectionBody data={data} k={k} accent={accent} /></div>
          </section>
        ))}
      </div>
    </Sheet>
  );
}

/** Width of the modern template's side column (its colour runs down every page). */
export const CV_SIDE_WIDTH = 250;

export const CvPreview = (props: Props) =>
  props.template === 'modern' ? <Modern {...props} /> : props.template === 'minimal' ? <Minimal {...props} /> : <Classic {...props} />;
