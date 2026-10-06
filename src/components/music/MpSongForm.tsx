import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { FileAudio, ImagePlus, Search, X, Plus, Disc3, ListMusic } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { errorMessage } from '../../lib/portfolio';
import { deleteMusicFile, formatDuration, MOODS, readDuration, uploadMusicFile, type MpGenre, type MpSong } from '../../lib/music';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { pfInputClass } from '../portfolio/PfFieldInput';
import { MpCover } from './MpUi';

type CollectionRef = { id: string; kind: 'album' | 'mix'; title: string };

const label = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5';
const AUDIO_ACCEPT = 'audio/mpeg,audio/mp3,audio/mp4,audio/x-m4a,audio/aac,audio/wav,audio/ogg,audio/webm,audio/flac,.mp3,.m4a,.aac,.wav,.ogg,.flac';
const MAX_BYTES = 50 * 1024 * 1024;

/** Upload a song (audio + cover + info + albums / mixes), or edit one you uploaded. */
export const MpSongForm = ({ userId, song, genres, onClose, onSaved }: {
  userId: string;
  song: MpSong | null;
  genres: MpGenre[];
  onClose: () => void;
  onSaved: () => void;
}) => {
  const { t } = useLanguage();
  const audioInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [duration, setDuration] = useState<number | null>(song?.duration_seconds ?? null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(song?.cover?.url ?? null);
  const [removeCover, setRemoveCover] = useState(false);

  const [title, setTitle] = useState(song?.title ?? '');
  const [artist, setArtist] = useState(song?.artist ?? '');
  const [genreId, setGenreId] = useState(song?.genre_id ?? '');
  const [origin, setOrigin] = useState(song?.origin ?? '');
  const [language, setLanguage] = useState(song?.language ?? '');
  const [mood, setMood] = useState(song?.mood ?? '');
  const [year, setYear] = useState(song?.release_year ? String(song.release_year) : '');
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
      const { data } = await supabase.from('mp_collections').select('id, kind, title').order('title');
      setCollections((data ?? []) as CollectionRef[]);
      if (song) {
        const { data: links } = await supabase.from('mp_collection_songs').select('collection_id').eq('song_id', song.id);
        const ids = new Set((links ?? []).map(l => l.collection_id as string));
        setPicked(ids);
        setInitialPicked(ids);
      }
    })();
  }, [song]);

  useEffect(() => () => { if (coverFile && coverPreview) URL.revokeObjectURL(coverPreview); }, [coverFile, coverPreview]);

  const pickAudio = async (f: File) => {
    if (f.size > MAX_BYTES) return toast.error(t('mp.form.tooBig'));
    setAudioFile(f);
    setDuration(await readDuration(f));
    if (!title.trim()) setTitle(f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim());
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
  const valid = title.trim() !== '' && (song || audioFile) && (yearNum === null || (Number.isInteger(yearNum) && yearNum >= 1800 && yearNum <= 2200));

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      let audioId = song?.audio_file_id ?? null;
      let coverId = removeCover ? null : song?.cover_file_id ?? null;
      if (audioFile) {
        setStep(t('mp.form.uploadingAudio'));
        audioId = await uploadMusicFile(audioFile, 'audio', userId, duration);
      }
      if (coverFile) {
        setStep(t('mp.form.uploadingCover'));
        coverId = await uploadMusicFile(coverFile, 'image', userId);
      }
      setStep(t('pf.common.saving'));
      const row = {
        title: title.trim(), artist: artist.trim() || null, genre_id: genreId || null,
        origin: origin.trim() || null, language: language.trim() || null, mood: mood || null,
        release_year: yearNum, tags: tags.split(',').map(x => x.trim()).filter(Boolean),
        description: description.trim() || null, lyrics: lyrics.trim() || null, is_free: isFree,
        audio_file_id: audioId, cover_file_id: coverId, duration_seconds: duration, updated_at: new Date().toISOString(),
      };
      let songId = song?.id;
      if (song) {
        const { error } = await supabase.from('mp_songs').update(row).eq('id', song.id).eq('uploaded_by', userId);
        if (error) throw error;
        // Replaced files are not referenced any more: remove them.
        if (audioFile && song.audio) await deleteMusicFile(song.audio);
        if ((coverFile || removeCover) && song.cover) await deleteMusicFile(song.cover);
      } else {
        const { data, error } = await supabase.from('mp_songs').insert([{ ...row, uploaded_by: userId }]).select('id').single();
        if (error) throw error;
        songId = data.id as string;
      }

      const add = [...picked].filter(id => !initialPicked.has(id));
      const drop = [...initialPicked].filter(id => !picked.has(id));
      if (drop.length) await supabase.from('mp_collection_songs').delete().eq('song_id', songId).in('collection_id', drop);
      for (const cid of add) {
        const { count } = await supabase.from('mp_collection_songs').select('id', { count: 'exact', head: true }).eq('collection_id', cid);
        await supabase.from('mp_collection_songs').insert([{ collection_id: cid, song_id: songId, position: (count ?? 0) + 1, added_by: userId }]);
      }

      toast.success(song ? t('pf.common.updated') : t('mp.form.uploaded'));
      onSaved();
    } catch (e) {
      console.error(e);
      toast.error(errorMessage(e, t('pf.upload.error')));
    } finally {
      setSaving(false);
      setStep('');
    }
  };

  const needle = collSearch.trim().toLowerCase();
  const matches = collections.filter(c => !picked.has(c.id) && (!needle || c.title.toLowerCase().includes(needle))).slice(0, 8);
  const exact = collections.some(c => c.title.toLowerCase() === needle);

  return (
    <Modal isOpen onClose={() => !saving && onClose()} title={song ? t('mp.form.edit') : t('mp.form.upload')} className="max-w-3xl">
      <div className="space-y-5">
        <div className="grid sm:grid-cols-[10rem_1fr] gap-4">
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
          <div className="space-y-3">
            <div>
              <span className={label}>{t('mp.form.audio')} {!song && <span className="text-danger">*</span>}</span>
              <button type="button" onClick={() => audioInput.current?.click()} className="w-full flex items-center gap-3 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 p-3 hover:border-primary text-left">
                <FileAudio size={22} className="text-primary shrink-0" />
                <span className="text-sm min-w-0">
                  <span className="block font-medium text-gray-800 dark:text-gray-200 truncate">
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
            <label className="block">
              <span className={label}>{t('mp.form.artist')}</span>
              <input value={artist} onChange={e => setArtist(e.target.value)} className={`${pfInputClass} h-10`} />
            </label>
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
          <label className="block">
            <span className={label}>{t('mp.origin')}</span>
            <input value={origin} onChange={e => setOrigin(e.target.value)} placeholder={t('mp.form.originPlaceholder')} className={`${pfInputClass} h-10`} />
          </label>
          <label className="block">
            <span className={label}>{t('mp.language')}</span>
            <input value={language} onChange={e => setLanguage(e.target.value)} placeholder={t('mp.form.languagePlaceholder')} className={`${pfInputClass} h-10`} />
          </label>
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
              {matches.map(c => (
                <button key={c.id} type="button" onClick={() => setPicked(p => new Set([...p, c.id]))} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-700/40">
                  {c.kind === 'album' ? <Disc3 size={14} className="text-gray-400" /> : <ListMusic size={14} className="text-gray-400" />}
                  <span className="text-gray-800 dark:text-gray-200">{c.title}</span>
                  <span className="text-[11px] text-gray-400 ml-auto">{t(`mp.kind.${c.kind}`)}</span>
                </button>
              ))}
              {needle && !exact && (
                <div className="flex gap-2 px-3 py-1.5">
                  <Button size="sm" variant="ghost" type="button" onClick={() => void createCollection('album')}><Plus size={13} className="mr-1" />{t('mp.form.newAlbum').replace('{name}', collSearch.trim())}</Button>
                  <Button size="sm" variant="ghost" type="button" onClick={() => void createCollection('mix')}><Plus size={13} className="mr-1" />{t('mp.form.newMix').replace('{name}', collSearch.trim())}</Button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
          {step && <span className="mr-auto text-sm text-gray-500">{step}</span>}
          <Button variant="ghost" onClick={onClose} disabled={saving}>{t('pf.common.cancel')}</Button>
          <Button onClick={save} disabled={saving || !valid}>{saving ? t('pf.common.saving') : song ? t('pf.common.save') : t('mp.form.uploadBtn')}</Button>
        </div>
      </div>
    </Modal>
  );
};
