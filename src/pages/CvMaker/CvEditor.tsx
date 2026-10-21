import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Download, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { useLanguage } from '../../lib/LanguageContext';
import { errorMessage } from '../../lib/portfolio';
import { CV_ACCENTS, CV_TEMPLATES, loadCv, saveCv, type CvData, type CvListKey, type CvPersonal, type CvResume, type CvSectionKey } from '../../lib/cvMaker';
import { Button } from '../../components/ui/Button';
import { pfInputClass } from '../../components/portfolio/PfFieldInput';
import { CV_PAGE_WIDTH } from '../../components/cvMaker/CvPreview';
import { CvPages } from '../../components/cvMaker/CvPages';
import { CvFieldInput, CvListEditor, CvSectionCard, type CvField } from '../../components/cvMaker/CvForm';

const PERSONAL_FIELDS: (CvField & { key: keyof CvPersonal })[] = [
  { key: 'name', label: 'fields.name' },
  { key: 'headline', label: 'fields.headline', placeholder: 'Senior Software Engineer' },
  { key: 'email', label: 'fields.email' },
  { key: 'phone', label: 'fields.phone' },
  { key: 'location', label: 'fields.location', placeholder: 'Dhaka, Bangladesh' },
  { key: 'website', label: 'fields.website', placeholder: 'https://' },
  { key: 'linkedin', label: 'fields.linkedin', placeholder: 'linkedin.com/in/…' },
  { key: 'github', label: 'fields.github', placeholder: 'github.com/…' },
  { key: 'photoUrl', label: 'fields.photoUrl', placeholder: 'https://…/photo.jpg', hint: 'hints.photo', wide: true },
];

/** Wait this long after the last keystroke before saving. */
const AUTOSAVE_MS = 900;

type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

/** One CV: form on the left, live A4 preview on the right, autosaved, printable to PDF. */
export const CvEditor = () => {
  const { id = '' } = useParams();
  const { t } = useLanguage();
  const userId = useAuth().user?.userId ?? null;
  const [cv, setCv] = useState<CvResume | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'missing' | { error: string }>('loading');
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const latest = useRef<CvResume | null>(null);
  const dirty = useRef(false);

  useEffect(() => {
    if (!userId) return;
    let live = true;
    setLoadState('loading');
    loadCv(id, userId)
      .then(row => { if (!live) return; setCv(row); latest.current = row; setLoadState(row ? 'ready' : 'missing'); })
      .catch(e => { if (live) setLoadState({ error: errorMessage(e, t('pf.common.loadError')) }); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, userId]);

  const persist = async () => {
    const row = latest.current;
    if (!row || !dirty.current) return;
    dirty.current = false;
    setSaveState('saving');
    try {
      await saveCv(row);
      // Edits made while saving leave it dirty for the next round.
      setSaveState(dirty.current ? 'dirty' : 'saved');
    } catch {
      dirty.current = true;
      setSaveState('error');
    }
  };

  // Autosave after a pause in typing.
  useEffect(() => {
    if (saveState !== 'dirty') return;
    const timer = setTimeout(persist, AUTOSAVE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cv, saveState]);

  // Leaving the page: save what is pending, and warn if the tab is closing first.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty.current) e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => { window.removeEventListener('beforeunload', warn); void persist(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (patch: Partial<CvResume>) => {
    setCv(prev => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      latest.current = next;
      return next;
    });
    dirty.current = true;
    setSaveState('dirty');
  };
  const updateData = (patch: Partial<CvData>) => cv && update({ data: { ...cv.data, ...patch } });

  const print = async () => {
    await persist();
    // The browser names the PDF after the document title.
    const before = document.title;
    document.title = cv?.title || 'CV';
    window.print();
    document.title = before;
  };

  if (loadState === 'loading') return <p className="text-gray-500">{t('pf.common.loading')}</p>;
  if (loadState === 'missing' || typeof loadState === 'object' || !cv) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center space-y-3">
        <p className="font-semibold text-gray-900 dark:text-gray-100">{typeof loadState === 'object' ? loadState.error : t('cv.editor.notFound')}</p>
        <Link to="/cv" className="text-primary text-sm hover:underline">{t('cv.editor.back')}</Link>
      </div>
    );
  }

  const { data } = cv;
  const moveSection = (k: CvSectionKey, by: number) => {
    const order = [...data.order];
    const i = order.indexOf(k);
    const j = i + by;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    updateData({ order });
  };
  const toggleHidden = (k: CvSectionKey) =>
    updateData({ hidden: data.hidden.includes(k) ? data.hidden.filter(x => x !== k) : [...data.hidden, k] });

  return (
    // On wide screens the editor fills the window and the form and the preview
    // scroll on their own (64px top bar + 2×25px page padding); narrower, it stacks.
    <div className="max-w-[1600px] mx-auto flex flex-col gap-4 xl:h-[calc(100vh-114px)]">
      {/* Toolbar */}
      <div className="shrink-0 flex flex-wrap items-center gap-3 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <Link to="/cv" className="p-2 rounded-lg text-gray-500 hover:text-primary hover:bg-gray-100 dark:hover:bg-gray-700" title={t('cv.editor.back')}><ArrowLeft size={18} /></Link>
        <input
          value={cv.title}
          onChange={e => update({ title: e.target.value })}
          aria-label={t('cv.editor.cvTitle')}
          className={`${pfInputClass} h-10 font-semibold max-w-xs`}
        />
        <SaveBadge state={saveState} onRetry={persist} />
        <div className="flex-1" />
        <div className="flex flex-wrap items-center gap-1" role="radiogroup" aria-label={t('cv.editor.template')}>
          {CV_TEMPLATES.map(tpl => (
            <button
              key={tpl}
              role="radio"
              aria-checked={cv.template === tpl}
              onClick={() => update({ template: tpl })}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                cv.template === tpl ? 'bg-primary text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {t(`cv.templates.${tpl}`)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5" role="radiogroup" aria-label={t('cv.editor.accent')}>
          {CV_ACCENTS.map(c => (
            <button
              key={c}
              role="radio"
              aria-checked={cv.accent === c}
              aria-label={c}
              onClick={() => update({ accent: c })}
              className={`w-6 h-6 rounded-full transition-transform ${cv.accent === c ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-offset-gray-800 scale-110' : 'hover:scale-110'}`}
              style={{ background: c }}
            />
          ))}
          <input type="color" value={cv.accent} onChange={e => update({ accent: e.target.value })} title={t('cv.editor.customColor')}
            className="w-7 h-7 rounded cursor-pointer bg-transparent border-0 p-0" />
        </div>
        <Button onClick={print}><Download size={16} className="mr-1.5" />{t('cv.editor.download')}</Button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:flex-1 xl:min-h-0">
        {/* Form */}
        <div className="space-y-4 min-w-0 xl:overflow-y-auto xl:pr-2 overscroll-contain">
          <CvSectionCard title={t('cv.sections.personal')}>
            <div className="grid gap-3 sm:grid-cols-2">
              {PERSONAL_FIELDS.map(f => (
                <CvFieldInput key={f.key} field={f} value={data.personal[f.key]}
                  onChange={v => updateData({ personal: { ...data.personal, [f.key]: String(v) } })} />
              ))}
            </div>
          </CvSectionCard>

          {data.order.map((k, i) => (
            <CvSectionCard
              key={k}
              title={t(`cv.sections.${k}`)}
              hidden={data.hidden.includes(k)}
              onToggleHidden={() => toggleHidden(k)}
              onUp={i > 0 ? () => moveSection(k, -1) : undefined}
              onDown={i < data.order.length - 1 ? () => moveSection(k, 1) : undefined}
            >
              {k === 'summary' ? (
                <textarea rows={5} value={data.summary} onChange={e => updateData({ summary: e.target.value })}
                  placeholder={t('cv.hints.summary')} className={pfInputClass} />
              ) : (
                <CvListEditor section={k as CvListKey} items={data[k as CvListKey]} onChange={items => updateData({ [k]: items })} />
              )}
            </CvSectionCard>
          ))}
        </div>

        {/* Live preview */}
        <div className="min-w-0 rounded-xl bg-gray-200/70 dark:bg-gray-900 p-4 sm:p-6 xl:overflow-y-auto overscroll-contain">
          <ScaledPreview>
            <CvPages data={data} template={cv.template} accent={cv.accent} className="[&>.cv-page]:shadow-xl" />
          </ScaledPreview>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">{t('cv.editor.printHint')}</p>
        </div>
      </div>

      {/* What window.print() puts on paper: everything else on the page is hidden by the print CSS. */}
      {createPortal(
        <div className="cv-print-root">
          {/* No page margin: the pages carry their own, and browsers have nowhere to print their URL / date header and footer. */}
          <style>{'@page { size: A4; margin: 0; }'}</style>
          <CvPages data={data} template={cv.template} accent={cv.accent} gap={0} />
        </div>,
        document.body,
      )}
    </div>
  );
};

/** Fits the A4 pages to the column width. */
function ScaledPreview({ children }: { children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, el.clientWidth / CV_PAGE_WIDTH));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={box} className="w-full">
      <div className="mx-auto" style={{ width: CV_PAGE_WIDTH * scale }}>
        <div style={{ zoom: scale }}>{children}</div>
      </div>
    </div>
  );
}

function SaveBadge({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  const { t } = useLanguage();
  if (state === 'error') {
    return (
      <button onClick={onRetry} className="flex items-center gap-1 text-xs text-danger hover:underline">
        <AlertCircle size={14} />{t('cv.editor.saveError')}
      </button>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400" aria-live="polite">
      {state === 'saved' ? <Check size={14} className="text-success" /> : <Loader2 size={14} className="animate-spin" />}
      {state === 'saved' ? t('cv.editor.saved') : t('cv.editor.saving')}
    </span>
  );
}
