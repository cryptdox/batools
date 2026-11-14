import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { AlertTriangle, ChevronLeft, ChevronRight, Pencil, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { errorMessage } from '../../lib/portfolio';
import { isText, type IsRow } from '../../lib/islamicStudio';
import { Badge, Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { pfInputClass } from '../portfolio/PfFieldInput';

const arabicStyle = { fontFamily: '"Amiri", "Scheherazade New", "Noto Naskh Arabic", serif' };
const card = 'bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700';

/** Footnote HTML as the translator gave it, reduced to bold / italic and line breaks. */
function safeNoteHtml(note: string): string {
  return note.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/&lt;(\/?)(b|strong|i|em)&gt;/gi, '<$1$2>')
    .replace(/&lt;br\s*\/?&gt;/gi, '<br>')
    .replace(/\n/g, '<br>');
}

type SurahMeta = { number: number; englishName: string; name: string; numberOfAyahs: number };
let surahList: Promise<SurahMeta[]> | null = null;
/** Surah names and lengths (public, from alquran.cloud), loaded once. */
function loadSurahList(): Promise<SurahMeta[]> {
  surahList ??= fetch('https://api.alquran.cloud/v1/surah').then(r => r.json()).then(j => j.data as SurahMeta[])
    .catch(e => { surahList = null; throw e; });
  return surahList;
}

const ReviewBadge = ({ status }: { status: unknown }) => {
  const { t } = useLanguage();
  const s = String(status ?? 'draft');
  return <Badge variant={s === 'approved' ? 'success' : s === 'rejected' ? 'danger' : 'warning'}>{t(`is.review.${s}`)}</Badge>;
};

/**
 * Read a stored translation (is_translation_ayahs) surah by surah, next to the
 * Arabic, with the translator's footnotes; each ayah can be corrected.
 */
export const TranslationText = ({ initialPack }: { initialPack?: string | null }) => {
  const { t, language } = useLanguage();
  const [packs, setPacks] = useState<IsRow[]>([]);
  const [packId, setPackId] = useState<string>(initialPack ?? '');
  const [surahs, setSurahs] = useState<SurahMeta[]>([]);
  const [surah, setSurah] = useState(1);
  const [rows, setRows] = useState<{ ayah: number; text: string; note: string | null }[] | null>(null);
  const [arabic, setArabic] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<{ ayah: number; text: string; note: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void supabase.from('is_content_packs').select('id, name, slug, language, license, review_status')
      .eq('kind', 'quran_translation').eq('is_stored', true).order('sort_order')
      .then(({ data }) => {
        setPacks(data ?? []);
        if (!initialPack && data?.[0]) setPackId(String(data[0].id));
      });
    void loadSurahList().then(setSurahs).catch(() => setSurahs([]));
  }, [initialPack]);

  useEffect(() => {
    if (!packId) return;
    setRows(null);
    void supabase.from('is_translation_ayahs').select('ayah, text, note').eq('pack_id', packId).eq('surah', surah).order('ayah')
      .then(({ data, error }) => {
        if (error) toast.error(errorMessage(error, t('pf.common.loadError')));
        setRows((data ?? []) as { ayah: number; text: string; note: string | null }[]);
      });
    setArabic([]);
    void fetch(`https://api.alquran.cloud/v1/surah/${surah}/quran-uthmani`).then(r => r.json())
      .then(j => setArabic((j.data.ayahs as { text: string }[]).map(a => a.text))).catch(() => setArabic([]));
  }, [packId, surah, t]);

  const pack = packs.find(p => String(p.id) === packId);
  const keepUnchanged = /unchanged|no change|without change/i.test(String(pack?.license ?? ''));
  const meta = surahs.find(s => s.number === surah);
  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (rows ?? []).filter(r => !needle || r.text.toLowerCase().includes(needle) || (r.note ?? '').toLowerCase().includes(needle) || String(r.ayah) === needle);
  }, [rows, search]);

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase.from('is_translation_ayahs')
      .update({ text: editing.text.trim(), note: editing.note.trim() || null })
      .eq('pack_id', packId).eq('surah', surah).eq('ayah', editing.ayah);
    setSaving(false);
    if (error) {
      toast.error(errorMessage(error, t('pf.common.saveError')));
      return;
    }
    setRows(prev => (prev ?? []).map(r => (r.ayah === editing.ayah ? { ...r, text: editing.text.trim(), note: editing.note.trim() || null } : r)));
    setEditing(null);
    toast.success(t('pf.common.updated'));
    toast.info(t('is.text.appNote'));
  };

  return (
    <div className="space-y-4">
      <div className={`${card} p-4 flex flex-wrap items-center gap-3`}>
        <select value={packId} onChange={e => setPackId(e.target.value)} className={`${pfInputClass} h-10 w-auto`}>
          {packs.length === 0 && <option value="">{t('is.text.noStored')}</option>}
          {packs.map(p => <option key={String(p.id)} value={String(p.id)}>{isText(p.name, language)}</option>)}
        </select>
        <div className="flex items-center gap-1">
          <button onClick={() => setSurah(s => Math.max(1, s - 1))} disabled={surah === 1} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30"><ChevronLeft size={16} /></button>
          <select value={surah} onChange={e => setSurah(Number(e.target.value))} className={`${pfInputClass} h-10 w-auto`}>
            {Array.from({ length: 114 }, (_, i) => i + 1).map(n => {
              const s = surahs.find(x => x.number === n);
              return <option key={n} value={n}>{n}. {s ? `${s.englishName} (${s.numberOfAyahs})` : ''}</option>;
            })}
          </select>
          <button onClick={() => setSurah(s => Math.min(114, s + 1))} disabled={surah === 114} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30"><ChevronRight size={16} /></button>
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('pf.common.search')} className={`${pfInputClass} h-10 pl-8 w-48`} />
        </div>
        {pack && <ReviewBadge status={pack.review_status} />}
      </div>

      {pack && (
        <p className="text-xs text-gray-500 dark:text-gray-400 px-1">
          {t('is.quran.license')}: {String(pack.license ?? '—')}
        </p>
      )}

      <div className={`${card} overflow-hidden`}>
        {meta && <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex justify-between"><span className="font-semibold">{meta.number}. {meta.englishName}</span><span dir="rtl" style={arabicStyle} className="text-lg">{meta.name}</span></div>}
        {!rows ? <div className="p-8 text-center text-gray-500">{t('pf.common.loading')}</div> : rows.length === 0 ? (
          <div className="p-8 text-center text-gray-500">{t('is.text.empty')}</div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {shown.map(r => (
              <li key={r.ayah} className="p-4 space-y-2">
                <div className="flex items-start gap-3">
                  <span className="shrink-0 w-10 text-xs font-semibold text-primary">{surah}:{r.ayah}</span>
                  <div className="flex-1 min-w-0 space-y-2">
                    {arabic[r.ayah - 1] && <p dir="rtl" lang="ar" className="text-2xl leading-loose text-gray-900 dark:text-gray-100" style={arabicStyle}>{arabic[r.ayah - 1]}</p>}
                    <p className="text-[15px] leading-relaxed text-gray-800 dark:text-gray-200">{r.text}</p>
                    {r.note && (
                      <details className="text-sm text-gray-600 dark:text-gray-400">
                        <summary className="cursor-pointer text-xs font-semibold text-primary">{t('is.text.notes')}</summary>
                        <div className="mt-2 rounded-lg bg-gray-50 dark:bg-gray-900 p-3 leading-relaxed" dangerouslySetInnerHTML={{ __html: safeNoteHtml(r.note) }} />
                      </details>
                    )}
                  </div>
                  <button onClick={() => setEditing({ ayah: r.ayah, text: r.text, note: r.note ?? '' })} className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700" title={t('pf.common.edit')}>
                    <Pencil size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal isOpen={!!editing} onClose={() => !saving && setEditing(null)} title={`${t('pf.common.edit')} · ${surah}:${editing?.ayah ?? ''}`} className="max-w-3xl">
        {editing && (
          <div className="space-y-4">
            {keepUnchanged && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 text-sm">
                <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" /> {t('is.text.noChangesWarning')}
              </div>
            )}
            {arabic[editing.ayah - 1] && <p dir="rtl" lang="ar" className="text-2xl leading-loose" style={arabicStyle}>{arabic[editing.ayah - 1]}</p>}
            <label className="block">
              <span className="block text-sm font-medium mb-1.5">{t('is.text.translation')}</span>
              <textarea value={editing.text} onChange={e => setEditing({ ...editing, text: e.target.value })} rows={4} className={pfInputClass} />
            </label>
            <label className="block">
              <span className="block text-sm font-medium mb-1.5">{t('is.text.notes')}</span>
              <textarea value={editing.note} onChange={e => setEditing({ ...editing, note: e.target.value })} rows={6} className={`${pfInputClass} text-sm`} />
            </label>
            <div className="flex justify-end gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
              <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>{t('pf.common.cancel')}</Button>
              <Button onClick={() => void save()} disabled={saving || !editing.text.trim()}>{saving ? t('pf.common.saving') : t('pf.common.save')}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

type Hadith = { hadithnumber: number; text: string; grades?: { name: string; grade: string }[] };

/** Read any hadith book chapter by chapter, Arabic with a translation, from its packs. */
export const HadithText = ({ initialBook }: { initialBook?: string | null }) => {
  const { t, language } = useLanguage();
  const [books, setBooks] = useState<IsRow[]>([]);
  const [bookId, setBookId] = useState<string>(initialBook ?? '');
  const [packs, setPacks] = useState<IsRow[]>([]);
  const [langCode, setLangCode] = useState<string>(language === 'bn' ? 'bn' : 'en');
  const [sections, setSections] = useState<{ number: number; name: unknown; hadith_first: number; hadith_last: number }[]>([]);
  const [section, setSection] = useState(1);
  const [items, setItems] = useState<{ n: number; ar?: Hadith; tr?: Hadith }[] | null>(null);

  useEffect(() => {
    void supabase.from('is_hadith_collections').select('id, slug, name').order('sort_order').then(({ data }) => {
      setBooks(data ?? []);
      if (!initialBook && data?.[0]) setBookId(String(data[0].id));
    });
  }, [initialBook]);

  useEffect(() => {
    if (!bookId) return;
    void supabase.from('is_content_packs').select('id, language, name, file_url, api_edition, license, review_status')
      .eq('kind', 'hadith').eq('hadith_collection_id', bookId).then(({ data }) => setPacks(data ?? []));
    void supabase.from('is_hadith_sections').select('number, name, hadith_first, hadith_last').eq('collection_id', bookId).order('number')
      .then(({ data }) => { setSections(data ?? []); setSection(data?.[0]?.number ?? 1); });
  }, [bookId]);

  const arabicPack = packs.find(p => p.language === 'ar');
  const trPack = packs.find(p => p.language === langCode);

  useEffect(() => {
    if (!arabicPack && !trPack) { setItems([]); return; }
    let alive = true;
    setItems(null);
    const get = (p: IsRow | undefined) => (p?.file_url && p.api_edition
      ? fetch(`${String(p.file_url).replace(/\/+$/, '')}/${p.api_edition}/sections/${section}.min.json`).then(r => r.json()).then(j => j.hadiths as Hadith[])
      : Promise.resolve([] as Hadith[]));
    void Promise.allSettled([get(arabicPack), get(trPack)]).then(([ar, tr]) => {
      if (!alive) return;
      const map = new Map<number, { n: number; ar?: Hadith; tr?: Hadith }>();
      for (const h of ar.status === 'fulfilled' ? ar.value : []) if (h.text?.trim()) map.set(h.hadithnumber, { ...map.get(h.hadithnumber), n: h.hadithnumber, ar: h });
      for (const h of tr.status === 'fulfilled' ? tr.value : []) if (h.text?.trim()) map.set(h.hadithnumber, { ...map.get(h.hadithnumber), n: h.hadithnumber, tr: h });
      setItems([...map.values()].sort((a, b) => a.n - b.n));
    });
    return () => { alive = false; };
  }, [arabicPack, trPack, section]);

  return (
    <div className="space-y-4">
      <div className={`${card} p-4 flex flex-wrap items-center gap-3`}>
        <select value={bookId} onChange={e => setBookId(e.target.value)} className={`${pfInputClass} h-10 w-auto`}>
          {books.map(b => <option key={String(b.id)} value={String(b.id)}>{isText(b.name, language)}</option>)}
        </select>
        <select value={section} onChange={e => setSection(Number(e.target.value))} className={`${pfInputClass} h-10 w-auto max-w-xs`}>
          {sections.map(s => <option key={s.number} value={s.number}>{s.number}. {isText(s.name, language)} ({s.hadith_first}–{s.hadith_last})</option>)}
        </select>
        <select value={langCode} onChange={e => setLangCode(e.target.value)} className={`${pfInputClass} h-10 w-auto`}>
          <option value="bn">বাংলা</option>
          <option value="en">English</option>
        </select>
        {trPack && <ReviewBadge status={trPack.review_status} />}
      </div>
      {trPack && <p className="text-xs text-gray-500 dark:text-gray-400 px-1">{isText(trPack.name, language)} · {t('is.quran.license')}: {String(trPack.license ?? '—')}</p>}
      <div className={`${card} overflow-hidden`}>
        {!items ? <div className="p-8 text-center text-gray-500">{t('pf.common.loading')}</div> : items.length === 0 ? (
          <div className="p-8 text-center text-gray-500">{t('is.text.empty')}</div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {items.map(h => (
              <li key={h.n} className="p-4 space-y-2">
                <div className="text-xs font-semibold text-primary">#{h.n}</div>
                {h.ar && <p dir="rtl" lang="ar" className="text-xl leading-loose text-gray-900 dark:text-gray-100" style={arabicStyle}>{h.ar.text}</p>}
                {h.tr && <p className="text-[15px] leading-relaxed whitespace-pre-line text-gray-800 dark:text-gray-200">{h.tr.text}</p>}
                {(h.tr?.grades?.length || h.ar?.grades?.length) ? (
                  <p className="text-xs text-gray-500">{((h.tr?.grades?.length ? h.tr.grades : h.ar?.grades) ?? []).map(g => `${g.grade} (${g.name})`).join(' · ')}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 px-1">{t('is.text.hadithSource')}</p>
    </div>
  );
};
