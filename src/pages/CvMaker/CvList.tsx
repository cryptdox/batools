import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { Plus, UserCircle, Copy, Trash2, Pencil, Sparkles } from 'lucide-react';
import { useLanguage } from '../../lib/LanguageContext';
import { errorMessage } from '../../lib/portfolio';
import { CV_ACCENTS, CV_TEMPLATES, createCv, cvFromPortfolio, deleteCv, emptyCv, sampleCv, useCvList, type CvResume, type CvTemplate } from '../../lib/cvMaker';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { CvPreview, CV_PAGE_WIDTH } from '../../components/cvMaker/CvPreview';
import { PfPageHeader } from '../Portfolio/PfPageHeader';

/** Thumbnail width of a CV card; the A4 preview is zoomed down to it. */
const THUMB = 220;

/** Accent each template's sample starts with. */
const SAMPLE_ACCENT: Record<CvTemplate, string> = { classic: CV_ACCENTS[0], modern: CV_ACCENTS[6], minimal: CV_ACCENTS[1] };
const SAMPLE = sampleCv();

/** The signed-in user's CVs: start a new one (blank, from the sample or from the portfolio), open, copy, delete. */
export const CvList = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { userId, resumes, loading, error, reload } = useCvList();
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<CvResume | null>(null);

  const start = async (make: () => Promise<{ title: string; data: CvResume['data']; template?: CvResume['template']; accent?: string }>) => {
    if (!userId || busy) return;
    setBusy(true);
    try {
      const id = await createCv(userId, await make());
      navigate(`/cv/${id}`);
    } catch (e) {
      toast.error(errorMessage(e, t('cv.list.createError')));
    } finally {
      setBusy(false);
    }
  };

  const blank = () => start(async () => ({ title: t('cv.list.untitled'), data: emptyCv() }));
  const fromPortfolio = () => start(async () => ({ title: t('cv.list.portfolioTitle'), data: await cvFromPortfolio(userId!) }));
  const fromSample = (template: CvTemplate = 'classic') =>
    start(async () => ({ title: t('cv.list.sampleTitle'), data: sampleCv(), template, accent: SAMPLE_ACCENT[template] }));
  const duplicate = (cv: CvResume) => start(async () => ({ title: `${cv.title} (${t('cv.list.copy')})`, data: cv.data, template: cv.template, accent: cv.accent }));

  const remove = async () => {
    if (!toDelete || !userId) return;
    try {
      await deleteCv(toDelete.id, userId);
    } catch (e) {
      return toast.error(errorMessage(e, t('pf.common.deleteError')));
    }
    setToDelete(null);
    toast.success(t('pf.common.deleted'));
    await reload();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PfPageHeader title="cv.list.pageTitle" subtitle="cv.list.pageSubtitle"
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => fromSample()} disabled={busy}><Sparkles size={16} className="mr-1" />{t('cv.list.fromSample')}</Button>
            <Button variant="outline" onClick={fromPortfolio} disabled={busy}><UserCircle size={16} className="mr-1" />{t('cv.list.fromPortfolio')}</Button>
            <Button onClick={blank} disabled={busy}><Plus size={16} className="mr-1" />{t('cv.list.create')}</Button>
          </div>
        } />

      {loading ? (
        <p className="text-gray-500">{t('pf.common.loading')}</p>
      ) : error ? (
        <p className="text-danger">{errorMessage(error, t('pf.common.loadError'))}</p>
      ) : resumes.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-8 space-y-6">
          <div className="text-center space-y-2">
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('cv.list.emptyTitle')}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('cv.list.emptyHint')}</p>
          </div>
          {/* The complete sample in every template: pick one to start from. */}
          <div className="flex flex-wrap justify-center gap-6">
            {CV_TEMPLATES.map(tpl => (
              <button key={tpl} onClick={() => fromSample(tpl)} disabled={busy} className="group text-center disabled:opacity-60">
                <div className="overflow-hidden rounded shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 group-hover:ring-2 group-hover:ring-primary transition-shadow"
                  style={{ width: THUMB, height: THUMB * 1.414 }} aria-hidden="true">
                  <div className="pointer-events-none" style={{ zoom: THUMB / CV_PAGE_WIDTH }}>
                    <CvPreview data={SAMPLE} template={tpl} accent={SAMPLE_ACCENT[tpl]} />
                  </div>
                </div>
                <div className="mt-2 text-sm font-medium text-gray-700 dark:text-gray-200 group-hover:text-primary">
                  {t('cv.list.useSample')} · {t(`cv.templates.${tpl}`)}
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid gap-5 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
          {resumes.map(cv => (
            <div key={cv.id} className="group bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col">
              <Link to={`/cv/${cv.id}`} className="block bg-gray-100 dark:bg-gray-900 p-3" title={t('pf.common.edit')}>
                <div className="mx-auto overflow-hidden rounded shadow-sm pointer-events-none" style={{ width: THUMB, height: THUMB * 1.414 }} aria-hidden="true">
                  <div style={{ zoom: THUMB / CV_PAGE_WIDTH }}>
                    <CvPreview data={cv.data} template={cv.template} accent={cv.accent} />
                  </div>
                </div>
              </Link>
              <div className="p-3 flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <Link to={`/cv/${cv.id}`} className="block font-semibold text-gray-900 dark:text-gray-100 truncate hover:text-primary">{cv.title}</Link>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {t(`cv.templates.${cv.template}`)} · {t('cv.list.edited')} {format(new Date(cv.updated_at), 'd MMM yyyy, h:mm a')}
                  </div>
                </div>
                <div className="flex shrink-0">
                  <Link to={`/cv/${cv.id}`} className="p-1.5 rounded-md text-gray-500 hover:text-primary hover:bg-gray-100 dark:hover:bg-gray-700" title={t('pf.common.edit')}><Pencil size={15} /></Link>
                  <button onClick={() => duplicate(cv)} disabled={busy} className="p-1.5 rounded-md text-gray-500 hover:text-primary hover:bg-gray-100 dark:hover:bg-gray-700" title={t('cv.list.duplicate')}><Copy size={15} /></button>
                  <button onClick={() => setToDelete(cv)} className="p-1.5 rounded-md text-gray-500 hover:text-danger hover:bg-gray-100 dark:hover:bg-gray-700" title={t('pf.common.delete')}><Trash2 size={15} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={!!toDelete} onClose={() => setToDelete(null)} title={t('cv.list.deleteTitle')}>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-5">
          <span className="font-semibold">{toDelete?.title}</span> — {t('cv.list.deleteHint')}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setToDelete(null)}>{t('pf.common.cancel')}</Button>
          <Button variant="danger" onClick={remove}>{t('pf.common.delete')}</Button>
        </div>
      </Modal>
    </div>
  );
};
