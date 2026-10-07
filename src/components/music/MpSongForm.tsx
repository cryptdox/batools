import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { FileAudio, ImagePlus, Search, X, Plus, Disc3, ListMusic, Mic2, Pencil, Trash2, Ban } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { errorMessage } from '../../lib/portfolio';
import {
  MP_COLLECTION_MAX, deleteMusicFile, deleteSong, discardUploads, findSimilarSongs, isDuplicate, formatDuration, MOODS, songArtist, readDuration, SINGER_FIELDS, SOURCE_FIELDS, SOURCE_KINDS, titleFromFile, uploadMusicFile, useMpLookups,
  type MpGenre, type MpSimilarSong, type MpSinger, type MpSong, type MpSource, type MpSourceKind,
} from '../../lib/music';

const isFullError = (e: { message?: string; hint?: string } | null) => !!e && (e.hint === 'mp_collection_full' || /at most 20 songs/.test(e.message ?? ''));
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { pfInputClass } from '../portfolio/PfFieldInput';
import { MpCover, MpPlayButton } from './MpUi';
import { MpCombo } from './MpCombo';

type CollectionRef = { id: string; kind: 'album' | 'mix'; title: string; songs?: { count: number }[] };

const label = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5';
const AUDIO_ACCEPT = 'audio/mpeg,audio/mp3,audio/mp4,audio/x-m4a,audio/aac,audio/wav,audio/ogg,audio/webm,audio/flac,.mp3,.m4a,.aac,.wav,.ogg,.flac';
const MAX_BYTES = 50 * 1024 * 1024;

/** Active entries for a picker, plus the current one even if it was made inactive. */
export const activeItems = <T extends { id: string; name: string; is_active: boolean }>(list: T[], current: string, hint?: (x: T) => string | null) =>
  list.filter(x => x.is_active || x.id === current).map(x => ({ id: x.id, label: x.name, hint: hint?.(x) ?? null }));

/** Pick one or more singers (in order), or add a new one by typing its name. */
export const MpSingerPicker = ({ userId, singers, onSingersChange, value, onChange, max }: {
  userId: string;
  singers: MpSinger[];
  onSingersChange: (s: MpSinger[]) => void;
  value: string[];
  onChange: (ids: string[]) => void;
  max?: number;
}) => {
  const { t } = useLanguage();
  const full = max !== undefined && value.length >= max;

  const create = async (name: string) => {
    const { data, error } = await supabase.from('mp_singers').insert([{ name, created_by: userId }]).select(SINGER_FIELDS).single();
    if (error) { toast.error(errorMessage(error, t('pf.common.saveError'))); return null; }
    onSingersChange([...singers, data as MpSinger].sort((a, b) => a.name.localeCompare(b.name)));
    return data.id as string;
  };

  return (
    <div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {value.map(id => {
            const s = singers.find(x => x.id === id);
            return s && (
              <span key={id} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary max-w-full">
                <Mic2 size={12} className="shrink-0" /><span className="truncate">{s.name}</span>
                <button type="button" onClick={() => onChange(value.filter(x => x !== id))} className="p-0.5 rounded-full hover:bg-black/10" aria-label={`Remove ${s.name}`}><X size={12} /></button>
              </span>
            );
          })}
        </div>
      )}
      {!full && (
        <MpCombo
          multi
          items={singers.map(x => ({ id: x.id, label: x.name }))}
          value=""
          exclude={value}
          onChange={id => onChange(max === 1 ? [id] : [...value, id])}
          placeholder={t('mp.form.findSinger')}
          onCreate={create}
          createLabel={name => t('mp.form.newSinger').replace('{name}', name)}
        />
      )}
    </div>
  );
};

/** Pick the song's source: choose a kind, then find or add a band / movie / ... */
export const MpSourcePicker = ({ userId, sources, onSourcesChange, value, onChange }: {
  userId: string;
  sources: MpSource[];
  onSourcesChange: (s: MpSource[]) => void;
  value: string;
  onChange: (id: string) => void;
}) => {
  const { t } = useLanguage();
  const current = sources.find(s => s.id === value);
  const [kind, setKind] = useState<MpSourceKind>(current?.kind ?? 'band');
  useEffect(() => { if (current) setKind(current.kind); }, [current]);

  const create = async (name: string) => {
    const { data, error } = await supabase.from('mp_sources').insert([{ kind, name, created_by: userId }]).select(SOURCE_FIELDS).single();
    if (error) { toast.error(errorMessage(error, t('pf.common.saveError'))); return null; }
    onSourcesChange([...sources, data as MpSource].sort((a, b) => a.name.localeCompare(b.name)));
    return data.id as string;
  };

  return (
    <div className="flex gap-2">
      <select value={kind} onChange={e => { setKind(e.target.value as MpSourceKind); if (current && current.kind !== e.target.value) onChange(''); }}
        className={`${pfInputClass.replace('w-full ', '')} h-10 w-32 shrink-0`} aria-label={t('mp.sources.kind')}>
        {SOURCE_KINDS.map(k => <option key={k} value={k}>{t(`mp.sourceKinds.${k}`)}</option>)}
      </select>
      <MpCombo
        className="flex-1 min-w-0"
        limit={10}
        items={sources.filter(s => s.kind === kind).map(s => ({ id: s.id, label: s.name, hint: s.release_year ? String(s.release_year) : null }))}
        value={value}
        onChange={onChange}
        placeholder={t('mp.form.findSource').replace('{kind}', t(`mp.sourceKinds.${kind}`).toLowerCase())}
        onCreate={create}
        createLabel={name => t('mp.form.newSource').replace('{kind}', t(`mp.sourceKinds.${kind}`)).replace('{name}', name)}
      />
    </div>
  );
};

/**
 * Upload a song (audio + cover + info + albums / mixes), or edit one you
 * uploaded. While uploading, songs with a similar title are listed; picking
 * one of yours switches to editing it (onEditOther).
 */
export const MpSongForm = ({ userId, song, genres, onClose, onSaved, onEditOther }: {
  userId: string;
  song: MpSong | null;
  genres: MpGenre[];
  onClose: () => void;
  onSaved: () => void;
  onEditOther?: (song: MpSong) => void;
}) => {
  const { t } = useLanguage();
  const audioInput = useRef<HTMLInputElement>(null);
  const { countries, languages, singers, setSingers, sources, setSources } = useMpLookups();
  const coverInput = useRef<HTMLInputElement>(null);

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [duration, setDuration] = useState<number | null>(song?.duration_seconds ?? null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(song?.cover?.url ?? null);
  const [removeCover, setRemoveCover] = useState(false);

  const [title, setTitle] = useState(song?.title ?? '');
  const initialSingers = [...(song?.singers ?? [])].sort((a, b) => a.position - b.position).map(x => x.singer?.id).filter(Boolean) as string[];
  const [singerIds, setSingerIds] = useState<string[]>(initialSingers);
  const [genreId, setGenreId] = useState(song?.genre_id ?? '');
  const [countryId, setCountryId] = useState(song?.country_id ?? '');
  const [languageId, setLanguageId] = useState(song?.language_id ?? '');
  const [sourceId, setSourceId] = useState(song?.source_id ?? '');
  // Saving the form marks the info as filled in, unless this is ticked.
  const [keepPending, setKeepPending] = useState(false);
  const [mood, setMood] = useState(song?.mood ?? '');
  // A new upload starts at this year; editable (clear it for "unknown").
  const [year, setYear] = useState(song ? (song.release_year ? String(song.release_year) : '') : String(new Date().getFullYear()));
  const [similar, setSimilar] = useState<MpSimilarSong[]>([]);
  const [similarDismissed, setSimilarDismissed] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deletedAny, setDeletedAny] = useState(false);
  // A new song this close to an existing one is a duplicate: no upload.
  const duplicate = !song ? similar.find(isDuplicate) ?? null : null;
  const [tags, setTags] = useState((song?.tags ?? []).join(', '));
  const [description, setDescription] = useState(song?.description ?? '');
  const [lyrics, setLyrics] = useState(song?.lyrics ?? '');
  const [isFree, setIsFree] = useState(song?.is_free ?? true);

  const [collections, setCollections] = useState<CollectionRef[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [initialPicked, setInitialPicked] = useState<Set<string>>(new Set());
  const [collSearch, setCollSearch] = useState('');

  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState('');

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from('mp_collections').select('id, kind, title, songs:mp_collection_songs(count)').order('title');
      setCollections((data ?? []) as CollectionRef[]);
      if (song) {
        const { data: links } = await supabase.from('mp_collection_songs').select('collection_id').eq('song_id', song.id);
        const ids = new Set((links ?? []).map(l => l.collection_id as string));
        setPicked(ids);
        setInitialPicked(ids);
      }
    })();
  }, [song]);

  // New uploads: look for songs already in the library with a similar title.
  const checkSimilar = useCallback(() => { if (!song) void findSimilarSongs(title).then(setSimilar); }, [song, title]);
  useEffect(() => {
    const id = setTimeout(checkSimilar, 350);
    return () => clearTimeout(id);
  }, [checkSimilar]);

  // Deleted an existing song from the list: the library must reload on close.
  const close = () => (deletedAny ? onSaved() : onClose());

  const removeExisting = async (s: MpSong) => {
    try {
      await deleteSong(s, userId);
      toast.success(t('pf.common.deleted'));
      setConfirmDelete(null);
      checkSimilar();
      setDeletedAny(true);
    } catch (e) {
      toast.error(errorMessage(e, t('pf.common.deleteError')));
    }
  };

  useEffect(() => () => { if (coverFile && coverPreview) URL.revokeObjectURL(coverPreview); }, [coverFile, coverPreview]);

  const pickAudio = async (f: File) => {
    if (f.size > MAX_BYTES) return toast.error(t('mp.form.tooBig'));
    setAudioFile(f);
    setDuration(await readDuration(f));
    if (!title.trim()) setTitle(titleFromFile(f.name));
  };

  const pickCover = (f: File) => {
    if (!f.type.startsWith('image/')) return toast.error(t('mp.form.notImage'));
    setCoverFile(f);
    setCoverPreview(URL.createObjectURL(f));
    setRemoveCover(false);
  };

  // New album / mix straight from the search box.
  const createCollection = async (kind: 'album' | 'mix') => {
    const name = collSearch.trim();
    if (!name) return;
    const { data, error } = await supabase.from('mp_collections').insert([{ kind, title: name, created_by: userId }]).select('id, kind, title').single();
    if (error) return toast.error(errorMessage(error, t('pf.common.saveError')));
    setCollections(c => [...c, data as CollectionRef].sort((a, b) => a.title.localeCompare(b.title)));
    setPicked(p => new Set([...p, data.id as string]));
    setCollSearch('');
  };

  const yearNum = year.trim() ? Number(year) : null;
  const valid = title.trim() !== '' && (song || audioFile) && !duplicate && (yearNum === null || (Number.isInteger(yearNum) && yearNum >= 1800 && yearNum <= 2200));

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    const uploaded: string[] = [];
    let songSaved = false;
    try {
      let audioId = song?.audio_file_id ?? null;
      let coverId = removeCover ? null : song?.cover_file_id ?? null;
      if (audioFile) {
        setStep(t('mp.form.uploadingAudio'));
        audioId = await uploadMusicFile(audioFile, 'audio', userId, duration);
        uploaded.push(audioId);
      }
      if (coverFile) {
        setStep(t('mp.form.uploadingCover'));
        coverId = await uploadMusicFile(coverFile, 'image', userId);
        uploaded.push(coverId);
      }
      setStep(t('pf.common.saving'));
      const row = {
        title: title.trim(), genre_id: genreId || null,
        country_id: countryId || null, language_id: languageId || null, source_id: sourceId || null,
        info_pending: keepPending, mood: mood || null,
        release_year: yearNum, tags: tags.split(',').map(x => x.trim()).filter(Boolean),
        description: description.trim() || null, lyrics: lyrics.trim() || null, is_free: isFree,
        audio_file_id: audioId, cover_file_id: coverId, duration_seconds: duration, updated_at: new Date().toISOString(),
      };
      let songId = song?.id;
      if (song) {
        const { error } = await supabase.from('mp_songs').update(row).eq('id', song.id).eq('uploaded_by', userId);
        if (error) throw error;
        songSaved = true;
        // Replaced files are not referenced any more: remove them.
        if (audioFile && song.audio) await deleteMusicFile(song.audio);
        if ((coverFile || removeCover) && song.cover) await deleteMusicFile(song.cover);
      } else {
        const { data, error } = await supabase.from('mp_songs').insert([{ ...row, uploaded_by: userId }]).select('id').single();
        if (error) throw error;
        songId = data.id as string;
        songSaved = true;
      }

      // Singers: rewrite the links in the picked order.
      if (song) await supabase.from('mp_song_singers').delete().eq('song_id', songId);
      if (singerIds.length) {
        const { error } = await supabase.from('mp_song_singers').insert(singerIds.map((singer_id, i) => ({ song_id: songId, singer_id, position: i + 1 })));
        if (error) throw error;
      }

      const add = [...picked].filter(id => !initialPicked.has(id));
      const drop = [...initialPicked].filter(id => !picked.has(id));
      if (drop.length) await supabase.from('mp_collection_songs').delete().eq('song_id', songId).in('collection_id', drop);
      for (const cid of add) {
        const { count } = await supabase.from('mp_collection_songs').select('id', { count: 'exact', head: true }).eq('collection_id', cid);
        const { error } = await supabase.from('mp_collection_songs').insert([{ collection_id: cid, song_id: songId, position: (count ?? 0) + 1, added_by: userId }]);
        // The song itself is saved; just say which album / mix refused it (full, at 20).
        if (error) toast.warning(`${collections.find(c => c.id === cid)?.title ?? ''}: ${isFullError(error) ? t('mp.collections.full') : error.message}`);
      }

      toast.success(song ? t('pf.common.updated') : t('mp.form.uploaded'));
      onSaved();
    } catch (e) {
      console.error(e);
      // The song row never took the new files: don't leave them in storage.
      if (!songSaved) await discardUploads(uploaded);
      // The DB refuses near-duplicate titles too (mp_songs_block_duplicate).
      const code = (e as { code?: string })?.code;
      toast.error(code === '23505' ? t('mp.form.duplicateBlocked') : errorMessage(e, t('pf.upload.error')));
      if (code === '23505') checkSimilar();
    } finally {
      setSaving(false);
      setStep('');
    }
  };

  const needle = collSearch.trim().toLowerCase();
  const matches = collections.filter(c => !picked.has(c.id) && (!needle || c.title.toLowerCase().includes(needle))).slice(0, 5);
  const exact = collections.some(c => c.title.toLowerCase() === needle);

  return (
    <Modal isOpen onClose={() => !saving && close()} title={song ? t('mp.form.edit') : t('mp.form.upload')} className="max-w-3xl">
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-[10rem_minmax(0,1fr)] gap-4">
          <div className="space-y-2">
            <button type="button" onClick={() => coverInput.current?.click()} className="block w-40 h-40 group relative" title={t('mp.form.cover')}>
              <MpCover url={coverPreview} color={genres.find(g => g.id === genreId)?.color} className="w-40 h-40" rounded="rounded-xl" />
              <span className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/40 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition">
                <ImagePlus size={22} />
              </span>
            </button>
            <input ref={coverInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) pickCover(f); e.target.value = ''; }} />
            {coverPreview && (
              <button type="button" className="text-xs text-danger hover:underline" onClick={() => { setCoverFile(null); setCoverPreview(null); setRemoveCover(true); }}>{t('mp.form.removeCover')}</button>
            )}
          </div>
          <div className="space-y-3 min-w-0">
            <div>
              <span className={label}>{t('mp.form.audio')} {!song && <span className="text-danger">*</span>}</span>
              <button type="button" onClick={() => audioInput.current?.click()} className="w-full flex items-center gap-3 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 p-3 hover:border-primary text-left">
                <FileAudio size={22} className="text-primary shrink-0" />
                <span className="text-sm min-w-0 flex-1">
                  <span title={audioFile?.name} className="block font-medium text-gray-800 dark:text-gray-200 truncate">
                    {audioFile ? audioFile.name : song ? t('mp.form.replaceAudio') : t('mp.form.chooseAudio')}
                  </span>
                  <span className="text-xs text-gray-500">{duration ? formatDuration(duration) : t('mp.form.audioHint')}</span>
                </span>
              </button>
              <input ref={audioInput} type="file" accept={AUDIO_ACCEPT} className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) void pickAudio(f); e.target.value = ''; }} />
            </div>
            <label className="block">
              <span className={label}>{t('mp.form.title')} <span className="text-danger">*</span></span>
              <input value={title} onChange={e => setTitle(e.target.value)} className={`${pfInputClass} h-10`} />
            </label>
            {!song && similar.length > 0 && (duplicate || similarDismissed !== title) && (
              <div className={`-mt-1 rounded-lg border overflow-hidden ${duplicate ? 'border-danger/40 bg-danger/5' : 'border-warning/40 bg-warning/5'}`}>
                <div className="flex items-start gap-2 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                  {duplicate && <Ban size={14} className="text-danger shrink-0 mt-px" />}
                  <span className="flex-1">
                    {duplicate
                      ? duplicate.uploaded_by === userId ? t('mp.form.duplicateMine') : t('mp.form.duplicateOther')
                      : t('mp.form.similarFound')}
                  </span>
                  {!duplicate && <button type="button" className="text-gray-500 hover:underline shrink-0" onClick={() => setSimilarDismissed(title)}>{t('mp.form.notDuplicate')}</button>}
                </div>
                <ul className="divide-y divide-gray-200/60 dark:divide-gray-700 max-h-56 overflow-y-auto">
                  {similar.map(s => {
                    const mine = s.uploaded_by === userId;
                    const dup = isDuplicate(s);
                    return (
                      <li key={s.id} className="flex items-center gap-2 px-3 py-1.5">
                        <MpCover url={s.cover?.url} color={s.genre?.color} className="w-8 h-8" rounded="rounded" />
                        <MpPlayButton song={s} size={26} />
                        <div className="flex-1 min-w-0">
                          <span className="block text-sm font-medium truncate text-gray-900 dark:text-gray-100" title={s.title}>{s.title}</span>
                          <span className="block text-[11px] text-gray-500 truncate">
                            {[songArtist(s), s.release_year, `${Math.round(s.score * 100)}% ${t('mp.form.match')}`, !mine && t('mp.form.notYours')].filter(Boolean).join(' · ')}
                          </span>
                        </div>
                        {dup && <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-danger/15 text-danger shrink-0">{t('mp.form.duplicate')}</span>}
                        {mine && (confirmDelete === s.id ? (
                          <span className="flex items-center gap-1 shrink-0">
                            <Button size="sm" variant="danger" type="button" onClick={() => void removeExisting(s)}>{t('pf.common.delete')}</Button>
                            <Button size="sm" variant="ghost" type="button" onClick={() => setConfirmDelete(null)}>{t('pf.common.cancel')}</Button>
                          </span>
                        ) : (
                          <span className="flex shrink-0">
                            <button type="button" disabled={saving} onClick={() => onEditOther?.(s)} title={t('mp.form.editThis')}
                              className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"><Pencil size={14} /></button>
                            <button type="button" disabled={saving} onClick={() => setConfirmDelete(s.id)} title={t('pf.common.delete')}
                              className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"><Trash2 size={14} className="text-danger" /></button>
                          </span>
                        ))}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            <div>
              <span className={label}>{t('mp.singers')}</span>
              <MpSingerPicker userId={userId} singers={singers} onSingersChange={setSingers} value={singerIds} onChange={setSingerIds} />
            </div>
            <div>
              <span className={label}>{t('mp.source')}</span>
              <MpSourcePicker userId={userId} sources={sources} onSourcesChange={setSources} value={sourceId} onChange={setSourceId} />
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
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
            <input type="number" min={1800} max={2200} value={year} onChange={e => setYear(e.target.value)} className={`${pfInputClass} h-10`} />
          </label>
          <label className="flex items-center gap-2 mt-7 cursor-pointer">
            <input type="checkbox" checked={isFree} onChange={e => setIsFree(e.target.checked)} className="w-4 h-4 text-primary rounded border-gray-300" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('mp.free')}</span>
          </label>
        </div>
        {!isFree && <p className="-mt-2 text-xs text-warning">{t('mp.form.paidHint')}</p>}

        <label className="block">
          <span className={label}>{t('mp.tags')}</span>
          <input value={tags} onChange={e => setTags(e.target.value)} placeholder={t('mp.form.tagsPlaceholder')} className={`${pfInputClass} h-10`} />
        </label>
        <label className="block">
          <span className={label}>{t('org.common.description')}</span>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className={pfInputClass} />
        </label>
        <label className="block">
          <span className={label}>{t('mp.lyrics')}</span>
          <textarea value={lyrics} onChange={e => setLyrics(e.target.value)} rows={4} className={pfInputClass} />
        </label>

        <div>
          <span className={label}>{t('mp.form.collections')}</span>
          {picked.size > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {[...picked].map(id => {
                const c = collections.find(x => x.id === id);
                return c && (
                  <span key={id} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                    {c.kind === 'album' ? <Disc3 size={12} /> : <ListMusic size={12} />}{c.title}
                    <button type="button" onClick={() => setPicked(p => { const n = new Set(p); n.delete(id); return n; })} className="p-0.5 rounded-full hover:bg-black/10" aria-label={`Remove ${c.title}`}><X size={12} /></button>
                  </span>
                );
              })}
            </div>
          )}
          <div className="relative">
            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={collSearch} onChange={e => setCollSearch(e.target.value)} placeholder={t('mp.form.findCollection')} className={`${pfInputClass} h-9 pl-8`} />
          </div>
          {(matches.length > 0 || (needle && !exact)) && (
            <div className="mt-1 rounded-md border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
              {matches.map(c => {
                const isFull = (c.songs?.[0]?.count ?? 0) >= MP_COLLECTION_MAX;
                return (
                  <button key={c.id} type="button" disabled={isFull} title={isFull ? t('mp.collections.full') : undefined}
                    onClick={() => setPicked(p => new Set([...p, c.id]))}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-700/40 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent">
                    {c.kind === 'album' ? <Disc3 size={14} className="text-gray-400" /> : <ListMusic size={14} className="text-gray-400" />}
                    <span className="text-gray-800 dark:text-gray-200">{c.title}</span>
                    <span className="text-[11px] text-gray-400 ml-auto">{isFull ? `${t('mp.collections.fullBadge')} · ${MP_COLLECTION_MAX}` : t(`mp.kind.${c.kind}`)}</span>
                  </button>
                );
              })}
              {needle && !exact && (
                <div className="flex gap-2 px-3 py-1.5">
                  <Button size="sm" variant="ghost" type="button" onClick={() => void createCollection('album')}><Plus size={13} className="mr-1" />{t('mp.form.newAlbum').replace('{name}', collSearch.trim())}</Button>
                  <Button size="sm" variant="ghost" type="button" onClick={() => void createCollection('mix')}><Plus size={13} className="mr-1" />{t('mp.form.newMix').replace('{name}', collSearch.trim())}</Button>
                </div>
              )}
            </div>
          )}
        </div>

        {song?.info_pending && (
          <label className="flex items-start gap-2 rounded-lg bg-warning/10 border border-warning/30 p-3 cursor-pointer">
            <input type="checkbox" checked={keepPending} onChange={e => setKeepPending(e.target.checked)} className="mt-0.5 w-4 h-4 text-primary rounded border-gray-300" />
            <span className="text-sm text-gray-700 dark:text-gray-300">{t('mp.form.keepPending')}</span>
          </label>
        )}

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
          {step && <span className="mr-auto text-sm text-gray-500">{step}</span>}
          <Button variant="ghost" onClick={close} disabled={saving}>{t('pf.common.cancel')}</Button>
          <Button onClick={save} disabled={saving || !valid}>{saving ? t('pf.common.saving') : song ? t('pf.common.save') : t('mp.form.uploadBtn')}</Button>
        </div>
      </div>
    </Modal>
  );
};
