import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { FileAudio, X, CheckCircle2, AlertCircle, AlertTriangle, Ban, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { errorMessage } from '../../lib/portfolio';
import { discardUploads, findSimilarSongs, formatDuration, isDuplicate, MOODS, readDuration, titleFromFile, uploadMusicFile, useMpLookups, type MpGenre, type MpSimilarSong } from '../../lib/music';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { pfInputClass } from '../portfolio/PfFieldInput';
import { activeItems, addSongToCollections, loadCollections, MpCollectionPicker, MpSingerPicker, MpSourcePicker, type CollectionRef } from './MpSongForm';
import { MpCombo } from './MpCombo';

const label = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5';

const AUDIO_ACCEPT = 'audio/mpeg,audio/mp3,audio/mp4,audio/x-m4a,audio/aac,audio/wav,audio/ogg,audio/webm,audio/flac,.mp3,.m4a,.aac,.wav,.ogg,.flac';
const MAX_BYTES = 50 * 1024 * 1024;

type Item = {
  key: string; file: File; title: string; duration: number | null;
  status: 'waiting' | 'uploading' | 'done' | 'failed'; error?: string;
  similar?: MpSimilarSong | null;   // closest song already in the library, if any
};

/**
 * Upload many songs at once. Each file becomes a song titled from its file
 * name and marked info_pending: visible and playable now, details later.
 * Optional details for the whole batch (singers, source, genre, country,
 * language, mood, year, description, albums / mixes) are attached to every song.
 */
export const MpBulkUpload = ({ userId, genres, onClose, onDone }: { userId: string; genres: MpGenre[]; onClose: () => void; onDone: () => void }) => {
  const { t } = useLanguage();
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [running, setRunning] = useState(false);
  const [dragging, setDragging] = useState(false);
  // Applied to every song in this batch; editable, empty = unknown.
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const yearNum = year.trim() ? Number(year) : null;
  const yearOk = yearNum === null || (Number.isInteger(yearNum) && yearNum >= 1800 && yearNum <= 2200);
  // The rest of the batch details (all optional).
  const { countries, languages, singers, setSingers, sources, setSources } = useMpLookups();
  const [singerIds, setSingerIds] = useState<string[]>([]);
  const [sourceId, setSourceId] = useState('');
  const [genreId, setGenreId] = useState('');
  const [countryId, setCountryId] = useState('');
  const [languageId, setLanguageId] = useState('');
  const [mood, setMood] = useState('');
  const [description, setDescription] = useState('');
  const [collections, setCollections] = useState<CollectionRef[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  useEffect(() => { void loadCollections().then(setCollections); }, []);

  const add = async (files: FileList | File[]) => {
    const list = [...files];
    const skipped = list.filter(f => f.size > MAX_BYTES || !(f.type.startsWith('audio/') || /\.(mp3|m4a|aac|wav|ogg|flac|webm)$/i.test(f.name)));
    if (skipped.length) toast.warn(t('mp.bulk.skipped').replace('{n}', String(skipped.length)));
    const fresh: Item[] = list.filter(f => !skipped.includes(f)).map(f => ({
      key: `${f.name}-${f.size}-${f.lastModified}-${Math.random().toString(36).slice(2, 6)}`,
      file: f, title: titleFromFile(f.name), duration: null, status: 'waiting',
    }));
    setItems(prev => [...prev, ...fresh]);
    // Lengths and look-alikes are found in the background; the list is usable meanwhile.
    for (const it of fresh) {
      const [d, sim] = await Promise.all([readDuration(it.file), findSimilarSongs(it.title, 1)]);
      setItems(prev => prev.map(x => (x.key === it.key ? { ...x, duration: d, similar: sim[0] ?? null } : x)));
    }
  };

  const recheck = async (key: string, title: string) => {
    const sim = await findSimilarSongs(title, 1);
    setItems(prev => prev.map(x => (x.key === key ? { ...x, similar: sim[0] ?? null } : x)));
  };

  const patch = (key: string, p: Partial<Item>) => setItems(prev => prev.map(x => (x.key === key ? { ...x, ...p } : x)));

  // One at a time, so a slow connection doesn't time out several uploads together.
  const start = async () => {
    setRunning(true);
    let ok = 0;
    // Albums / mixes that ran full (20 songs) during this batch: said once each.
    const fullWarned = new Set<string>();
    for (const it of items) {
      // Duplicates of a song already in the library are never uploaded.
      if (it.status === 'done' || isDuplicate(it.similar)) continue;
      patch(it.key, { status: 'uploading', error: undefined });
      let audioId: string | null = null;
      try {
        const duration = it.duration ?? await readDuration(it.file);
        audioId = await uploadMusicFile(it.file, 'audio', userId, duration);
        const { data: row, error } = await supabase.from('mp_songs').insert([{
          title: it.title.trim() || titleFromFile(it.file.name), audio_file_id: audioId, duration_seconds: duration,
          release_year: yearNum, info_pending: true, uploaded_by: userId,
          genre_id: genreId || null, country_id: countryId || null, language_id: languageId || null,
          source_id: sourceId || null, mood: mood || null, description: description.trim() || null,
        }]).select('id').single();
        if (error) throw error;
        const songId = row.id as string;
        // The song is saved; its singers and albums / mixes follow (a failure there is only a warning).
        if (singerIds.length) {
          const { error: e2 } = await supabase.from('mp_song_singers').insert(singerIds.map((singer_id, i) => ({ song_id: songId, singer_id, position: i + 1 })));
          if (e2) toast.warning(`${it.title}: ${errorMessage(e2, t('pf.common.saveError'))}`);
        }
        for (const f of await addSongToCollections(songId, [...picked], userId, collections)) {
          if (f.full && fullWarned.has(f.title)) continue;
          if (f.full) fullWarned.add(f.title);
          toast.warning(`${f.title}: ${f.full ? t('mp.collections.full') : f.message}`);
        }
        patch(it.key, { status: 'done' });
        ok++;
      } catch (e) {
        await discardUploads([audioId]);
        // 23505: the DB found a near-duplicate (e.g. an earlier file in this batch).
        const dup = (e as { code?: string })?.code === '23505';
        patch(it.key, { status: 'failed', error: dup ? t('mp.form.duplicateBlocked') : errorMessage(e, t('pf.upload.error')) });
        if (dup) void recheck(it.key, it.title);
      }
    }
    setRunning(false);
    if (ok) {
      toast.success(t('mp.bulk.uploaded').replace('{n}', String(ok)));
      onDone();
    }
  };

  const blocked = items.filter(i => i.status !== 'done' && isDuplicate(i.similar));
  const pending = items.filter(i => i.status !== 'done' && !isDuplicate(i.similar));
  const finished = items.length > 0 && pending.length === 0 && blocked.length === 0;
  const valid = yearOk && pending.every(i => i.title.trim());

  return (
    <Modal isOpen onClose={() => !running && onClose()} title={t('mp.bulk.title')} className="max-w-3xl">
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-300">{t('mp.bulk.hint')}</p>
        <button
          type="button"
          disabled={running}
          onClick={() => input.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); if (!running) void add(e.dataTransfer.files); }}
          className={`w-full flex flex-col items-center gap-1 rounded-lg border-2 border-dashed p-6 text-center ${dragging ? 'border-primary bg-primary/5' : 'border-gray-300 dark:border-gray-600 hover:border-primary'}`}
        >
          <FileAudio size={26} className="text-primary" />
          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{t('mp.bulk.choose')}</span>
          <span className="text-xs text-gray-500">{t('mp.form.audioHint')}</span>
        </button>
        <input ref={input} type="file" multiple accept={AUDIO_ACCEPT} className="hidden"
          onChange={e => { if (e.target.files) void add(e.target.files); e.target.value = ''; }} />

        {/* Details attached to every song of this batch; all optional. */}
        <fieldset disabled={running} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-3">
          <legend className="px-1 text-sm font-semibold text-gray-800 dark:text-gray-200">{t('mp.bulk.details')}</legend>
          <p className="text-xs text-gray-500 -mt-1">{t('mp.bulk.detailsHint')}</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <span className={label}>{t('mp.singers')}</span>
              <MpSingerPicker userId={userId} singers={singers} onSingersChange={setSingers} value={singerIds} onChange={setSingerIds} />
            </div>
            <div>
              <span className={label}>{t('mp.source')}</span>
              <MpSourcePicker userId={userId} sources={sources} onSourcesChange={setSources} value={sourceId} onChange={setSourceId} />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <label className="block">
              <span className={label}>{t('mp.genre')}</span>
              <select value={genreId} onChange={e => setGenreId(e.target.value)} className={`${pfInputClass} h-10`}>
                <option value="">—</option>
                {genres.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </label>
            <div>
              <span className={label}>{t('mp.country')}</span>
              <MpCombo items={activeItems(countries, countryId, c => c.code)} value={countryId} onChange={setCountryId} />
            </div>
            <div>
              <span className={label}>{t('mp.language')}</span>
              <MpCombo items={activeItems(languages, languageId, l => (l.native_name !== l.name ? l.native_name : null))} value={languageId} onChange={setLanguageId} />
            </div>
            <label className="block">
              <span className={label}>{t('mp.mood')}</span>
              <select value={mood} onChange={e => setMood(e.target.value)} className={`${pfInputClass} h-10`}>
                <option value="">—</option>
                {MOODS.map(m => <option key={m} value={m}>{t(`mp.moods.${m}`)}</option>)}
              </select>
            </label>
            <label className="block">
              <span className={label}>{t('mp.year')}</span>
              <input type="number" min={1800} max={2200} value={year} onChange={e => setYear(e.target.value)} className={`${pfInputClass} h-10`} title={t('mp.bulk.yearHint')} />
            </label>
          </div>
          <label className="block">
            <span className={label}>{t('org.common.description')}</span>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className={pfInputClass} />
          </label>
          <div>
            <span className={label}>{t('mp.form.collections')}</span>
            <MpCollectionPicker userId={userId} collections={collections} onCollectionsChange={setCollections} picked={picked} onPickedChange={setPicked} />
          </div>
        </fieldset>

        {items.length > 0 && (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700 max-h-[50vh] overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
            {items.map(it => (
              <li key={it.key} className="flex items-center gap-3 px-3 py-2">
                <span className="w-5 shrink-0">
                  {it.status === 'uploading' && <Loader2 size={16} className="animate-spin text-primary" />}
                  {it.status === 'done' && <CheckCircle2 size={16} className="text-success" />}
                  {it.status === 'failed' && <span title={it.error}><AlertCircle size={16} className="text-danger" /></span>}
                  {it.status === 'waiting' && <FileAudio size={16} className="text-gray-400" />}
                </span>
                <div className="flex-1 min-w-0">
                  <input value={it.title} onChange={e => patch(it.key, { title: e.target.value })} onBlur={e => void recheck(it.key, e.target.value)} disabled={running || it.status === 'done'}
                    className={`${pfInputClass} h-8 text-sm`} aria-label={t('mp.form.title')} />
                  <div className="text-[11px] text-gray-500 truncate mt-0.5" title={it.file.name}>
                    {it.file.name} · {(it.file.size / 1024 / 1024).toFixed(1)} MB{it.duration ? ` · ${formatDuration(it.duration)}` : ''}
                    {it.status === 'failed' && it.error && <span className="text-danger"> · {it.error}</span>}
                  </div>
                  {it.similar && it.status !== 'done' && (isDuplicate(it.similar) ? (
                    <div className="flex items-center gap-1 text-[11px] text-danger truncate" title={it.similar.title}>
                      <Ban size={12} className="shrink-0" />
                      <span className="truncate">{t('mp.bulk.duplicate').replace('{title}', it.similar.title)}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-[11px] text-warning truncate" title={it.similar.title}>
                      <AlertTriangle size={12} className="shrink-0" />
                      <span className="truncate">{t('mp.bulk.similar').replace('{title}', it.similar.title)}</span>
                    </div>
                  ))}
                </div>
                {!running && it.status !== 'done' && (
                  <button type="button" className="p-1 rounded text-gray-400 hover:text-danger shrink-0" onClick={() => setItems(prev => prev.filter(x => x.key !== it.key))} aria-label={t('pf.common.delete')}>
                    <X size={15} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
          {items.length > 0 && (
            <span className="mr-auto text-sm text-gray-500">
              {t('mp.bulk.progress').replace('{done}', String(items.filter(i => i.status === 'done').length)).replace('{total}', String(items.length))}
              {blocked.length > 0 && <span className="text-danger"> · {t('mp.bulk.skippedDup').replace('{n}', String(blocked.length))}</span>}
            </span>
          )}
          <Button variant="ghost" onClick={onClose} disabled={running}>{finished ? t('mp.bulk.close') : t('pf.common.cancel')}</Button>
          {!finished && (
            <Button onClick={() => void start()} disabled={running || pending.length === 0 || !valid}>
              {running ? t('mp.bulk.uploading') : t('mp.bulk.start').replace('{n}', String(pending.length))}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};
