import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Plus, Pencil, Trash2, Play, Shuffle, ArrowLeft, ArrowUp, ArrowDown, X, Disc3, ListMusic, Search, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { errorMessage } from '../../lib/portfolio';
import {
  COLLECTION_SELECT, MP_COLLECTION_MAX, SONG_SELECT, deleteMusicFile, formatDuration, songArtist, useMpGenres, useMpLookups, useMpRatings, useMpUserId, withCover,
  type MpCollection, type MpSong,
} from '../../lib/music';

const isFullError = (e: { message?: string; hint?: string } | null) => !!e && (e.hint === 'mp_collection_full' || /at most 20 songs/.test(e.message ?? ''));
import { usePlayer } from '../../lib/MusicPlayerContext';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Pagination, usePagination } from '../../components/ui/Pagination';
import { pfInputClass } from '../../components/portfolio/PfFieldInput';
import { MpCover, MpCoverInput, MpPlayButton, MpPlayingBars, MpStars } from '../../components/music/MpUi';
import { MpCombo, MpMultiPick } from '../../components/music/MpCombo';
import { activeItems, MpSingerPicker, MpSourcePicker } from '../../components/music/MpSongForm';
import { EMPTY_FILTERS, fetchSongs, MpSongFilterBar, type SongFilters } from '../../components/music/MpSongFilters';
import { PfPageHeader, PfTabs } from '../Portfolio/PfPageHeader';

const card = 'bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700';
const label = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5';
type Kind = 'all' | 'album' | 'mix';

// ------------------------------------------------------------ form

const CollectionForm = ({ userId, collection, onClose, onSaved }: {
  userId: string; collection: MpCollection | null; onClose: () => void; onSaved: (id: string) => void;
}) => {
  const { t } = useLanguage();
  const { singers, setSingers, sources, setSources, countries, languages } = useMpLookups();
  const [kind, setKind] = useState<'album' | 'mix'>(collection?.kind ?? 'album');
  const [title, setTitle] = useState(collection?.title ?? '');
  const [singerIds, setSingerIds] = useState<string[]>(
    [...(collection?.singers ?? [])].sort((a, b) => a.position - b.position).map(x => x.singer?.id).filter(Boolean) as string[]);
  const [languageIds, setLanguageIds] = useState<string[]>((collection?.languages ?? []).map(x => x.language?.id).filter(Boolean) as string[]);
  const [sourceId, setSourceId] = useState(collection?.source_id ?? '');
  const [countryId, setCountryId] = useState(collection?.country_id ?? '');
  const [year, setYear] = useState(collection ? (collection.release_year ? String(collection.release_year) : '') : String(new Date().getFullYear()));
  const [description, setDescription] = useState(collection?.description ?? '');
  const [cover, setCover] = useState<{ file: File | null; remove: boolean; preview: string | null }>({ file: null, remove: false, preview: collection?.cover?.url ?? null });
  const [saving, setSaving] = useState(false);

  const yearNum = year.trim() ? Number(year) : null;
  const valid = title.trim() !== '' && (yearNum === null || (Number.isInteger(yearNum) && yearNum >= 1800 && yearNum <= 2200));

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      const id = await withCover({ file: cover.file, remove: cover.remove, current: collection?.cover, userId }, async coverId => {
        const row = {
          kind, title: title.trim(), release_year: yearNum, description: description.trim() || null,
          source_id: sourceId || null, country_id: countryId || null, cover_file_id: coverId, updated_at: new Date().toISOString(),
        };
        if (collection) {
          const { error } = await supabase.from('mp_collections').update(row).eq('id', collection.id).eq('created_by', userId);
          if (error) throw error;
          return collection.id;
        }
        const { data, error } = await supabase.from('mp_collections').insert([{ ...row, created_by: userId }]).select('id').single();
        if (error) throw error;
        return data.id as string;
      });
      // Singers (in the picked order) and languages: rewrite the links.
      if (collection) {
        await supabase.from('mp_collection_singers').delete().eq('collection_id', id);
        await supabase.from('mp_collection_languages').delete().eq('collection_id', id);
      }
      if (singerIds.length) {
        const { error } = await supabase.from('mp_collection_singers').insert(singerIds.map((singer_id, i) => ({ collection_id: id, singer_id, position: i + 1 })));
        if (error) throw error;
      }
      if (languageIds.length) {
        const { error } = await supabase.from('mp_collection_languages').insert(languageIds.map(language_id => ({ collection_id: id, language_id })));
        if (error) throw error;
      }
      toast.success(collection ? t('pf.common.updated') : t('pf.common.added'));
      onSaved(id);
    } catch (e) {
      toast.error(errorMessage(e, t('pf.common.saveError')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={() => !saving && onClose()} title={collection ? t('mp.collections.edit') : t('mp.collections.create')} className="max-w-2xl">
      <div className="space-y-4">
        <div className="flex gap-4">
          <MpCoverInput url={cover.preview} onChange={setCover} />
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex gap-2">
              {(['album', 'mix'] as const).map(k => (
                <button key={k} type="button" onClick={() => setKind(k)}
                  className={`flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg text-sm font-medium border ${kind === k ? 'bg-primary text-white border-primary' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'}`}>
                  {k === 'album' ? <Disc3 size={15} /> : <ListMusic size={15} />}{t(`mp.kind.${k}`)}
                </button>
              ))}
            </div>
            <label className="block">
              <span className={label}>{t('mp.form.title')} <span className="text-danger">*</span></span>
              <input value={title} onChange={e => setTitle(e.target.value)} className={`${pfInputClass} h-10`} autoFocus />
            </label>
          </div>
        </div>
        <div>
          <span className={label}>{t('mp.singers')}</span>
          <MpSingerPicker userId={userId} singers={singers} onSingersChange={setSingers} value={singerIds} onChange={setSingerIds} />
        </div>
        <div>
          <span className={label}>{t('mp.source')}</span>
          <MpSourcePicker userId={userId} sources={sources} onSourcesChange={setSources} value={sourceId} onChange={setSourceId} />
        </div>
        <div>
          <span className={label}>{t('mp.languages')}</span>
          <MpMultiPick items={activeItems(languages, '', l => (l.native_name !== l.name ? l.native_name : null)).concat(
            languages.filter(l => !l.is_active && languageIds.includes(l.id)).map(l => ({ id: l.id, label: l.name, hint: null })))}
            value={languageIds} onChange={setLanguageIds} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className={label}>{t('mp.country')}</span>
            <MpCombo items={activeItems(countries, countryId, c => c.code)} value={countryId} onChange={setCountryId} />
          </div>
          <label className="block">
            <span className={label}>{t('mp.year')}</span>
            <input type="number" min={1800} max={2200} value={year} onChange={e => setYear(e.target.value)} className={`${pfInputClass} h-10`} />
          </label>
        </div>
        <label className="block">
          <span className={label}>{t('org.common.description')}</span>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className={pfInputClass} />
        </label>
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
          <Button variant="ghost" onClick={onClose} disabled={saving}>{t('pf.common.cancel')}</Button>
          <Button onClick={save} disabled={saving || !valid}>{saving ? t('pf.common.saving') : t('pf.common.save')}</Button>
        </div>
      </div>
    </Modal>
  );
};

/** "Singer A, Singer B" for an album / mix, in order. */
const collectionArtist = (c: MpCollection) =>
  [...(c.singers ?? [])].sort((a, b) => a.position - b.position).map(x => x.singer?.name).filter(Boolean).join(', ') || null;

// ------------------------------------------------------------ list

export const MpCollections = () => {
  const { t } = useLanguage();
  const userId = useMpUserId();
  const navigate = useNavigate();
  const [kind, setKind] = useState<Kind>('all');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<MpCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<MpCollection | 'new' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('mp_collections').select(COLLECTION_SELECT).order('created_at', { ascending: false });
    if (kind !== 'all') q = q.eq('kind', kind);
    if (search.trim()) q = q.ilike('title', `%${search.trim()}%`);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setItems((data ?? []) as unknown as MpCollection[]);
    setLoading(false);
  }, [kind, search]);

  useEffect(() => { const id = setTimeout(() => void load(), 250); return () => clearTimeout(id); }, [load]);
  const pg = usePagination(items);
  useEffect(() => { pg.setPage(1); }, [kind, search]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PfPageHeader title="mp.collections.pageTitle" subtitle="mp.collections.pageSubtitle"
        action={<Button onClick={() => setForm('new')}><Plus size={16} className="mr-1" />{t('mp.collections.create')}</Button>} />
      <div className={`${card} p-4 flex flex-wrap items-center gap-3`}>
        <PfTabs tabs={[{ key: 'all' as Kind, label: 'mp.collections.all' }, { key: 'album' as Kind, label: 'mp.collections.albums' }, { key: 'mix' as Kind, label: 'mp.collections.mixes' }]} active={kind} onChange={setKind} />
        <div className="relative ml-auto">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('pf.common.search')} className={`${pfInputClass} h-9 pl-8 w-56`} />
        </div>
      </div>
      {loading ? (
        <div className="p-12 text-center text-gray-500">{t('pf.common.loading')}</div>
      ) : items.length === 0 ? (
        <div className={`${card} p-12 text-center text-gray-500`}>{t('mp.collections.empty')}</div>
      ) : (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {pg.pageRows.map(c => (
            <button key={c.id} onClick={() => navigate(`/mp/collections/${c.id}`)} className={`${card} p-3 text-left group hover:shadow-lg transition-shadow`}>
              <div className="relative">
                <MpCover url={c.cover?.url} className="w-full aspect-square" rounded="rounded-lg" alt={c.title} />
                <span className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-primary text-white shadow-lg flex items-center justify-center opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition">
                  <Play size={18} fill="currentColor" className="ml-0.5" />
                </span>
              </div>
              <div className="mt-2 font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">{c.title}</div>
              <div className="text-xs text-gray-500 truncate">
                {t(`mp.kind.${c.kind}`)} · {c.songs?.[0]?.count ?? 0} {t('mp.songs')}{collectionArtist(c) ? ` · ${collectionArtist(c)}` : ''}
              </div>
            </button>
          ))}
        </div>
      )}
      {!loading && pg.total > 0 && (
        <div className={`${card} overflow-hidden`}>
          <Pagination page={pg.page} pageCount={pg.pageCount} total={pg.total} pageSize={pg.pageSize} onPageChange={pg.setPage} onPageSizeChange={pg.setPageSize} />
        </div>
      )}
      {form && userId && (
        <CollectionForm userId={userId} collection={form === 'new' ? null : form} onClose={() => setForm(null)}
          onSaved={id => { setForm(null); navigate(`/mp/collections/${id}`); }} />
      )}
    </div>
  );
};

// ------------------------------------------------------------ detail

type Linked = { id: string; position: number; song: MpSong };

export const MpCollectionDetail = () => {
  const { t } = useLanguage();
  const { id } = useParams();
  const navigate = useNavigate();
  const userId = useMpUserId();
  const player = usePlayer();
  const { genres } = useMpGenres();
  const [collection, setCollection] = useState<MpCollection | null>(null);
  const [links, setLinks] = useState<Linked[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [adding, setAdding] = useState(false);
  const [filters, setFilters] = useState<SongFilters>(EMPTY_FILTERS);
  const [found, setFound] = useState<MpSong[]>([]);
  const [busy, setBusy] = useState(false);
  const albumRating = useMpRatings('album', collection?.kind === 'album' ? [collection.id] : [], userId);

  const load = useCallback(async () => {
    if (!id) return;
    const [c, l] = await Promise.all([
      supabase.from('mp_collections').select(COLLECTION_SELECT).eq('id', id).maybeSingle(),
      supabase.from('mp_collection_songs').select(`id, position, song:mp_songs!mp_collection_songs_song_fkey(${SONG_SELECT})`).eq('collection_id', id).order('position'),
    ]);
    if (c.error || l.error) toast.error((c.error ?? l.error)!.message);
    setCollection((c.data ?? null) as unknown as MpCollection | null);
    setLinks(((l.data ?? []) as unknown as Linked[]).filter(x => x.song));
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!adding) return;
    void fetchSongs(filters, 0, 20).then(r => setFound(r.rows)).catch(() => setFound([]));
  }, [adding, filters]);

  const mine = collection?.created_by === userId;
  const songs = links.map(l => l.song);
  const total = songs.reduce((s, x) => s + (x.duration_seconds ?? 0), 0);

  const full = links.length >= MP_COLLECTION_MAX;
  const addSong = async (s: MpSong) => {
    if (!id || !userId) return;
    if (full) return toast.error(t('mp.collections.full'));
    const { error } = await supabase.from('mp_collection_songs').insert([{ collection_id: id, song_id: s.id, position: (links.at(-1)?.position ?? 0) + 1, added_by: userId }]);
    if (error) return toast.error(isFullError(error) ? t('mp.collections.full') : errorMessage(error, t('pf.common.saveError')));
    await load();
  };
  const removeLink = async (l: Linked) => {
    const { error } = await supabase.from('mp_collection_songs').delete().eq('id', l.id);
    if (error) return toast.error(error.message);
    await load();
  };
  // Rewrites positions 1..n so moves are exact even after gaps.
  const move = async (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= links.length) return;
    setBusy(true);
    const next = [...links];
    [next[i], next[j]] = [next[j], next[i]];
    for (let k = 0; k < next.length; k++) if (next[k].position !== k + 1) await supabase.from('mp_collection_songs').update({ position: k + 1 }).eq('id', next[k].id);
    setBusy(false);
    await load();
  };
  const removeCollection = async () => {
    if (!collection || !userId) return;
    const { error } = await supabase.from('mp_collections').delete().eq('id', collection.id).eq('created_by', userId);
    if (error) return toast.error(errorMessage(error, t('pf.common.deleteError')));
    await deleteMusicFile(collection.cover);
    toast.success(t('pf.common.deleted'));
    navigate('/mp/collections');
  };

  if (loading) return <div className="p-12 text-center text-gray-500">{t('pf.common.loading')}</div>;
  if (!collection) return <div className="p-12 text-center text-gray-500">{t('mp.collections.notFound')}</div>;

  const inIt = new Set(songs.map(s => s.id));

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Link to="/mp/collections" className="inline-flex items-center gap-1 text-sm text-primary hover:underline"><ArrowLeft size={15} />{t('mp.collections.pageTitle')}</Link>

      <div className={`${card} p-5 flex flex-col sm:flex-row gap-5 overflow-hidden relative`}>
        <MpCover url={collection.cover?.url} className="w-44 h-44 shadow-xl" rounded="rounded-xl" alt={collection.title} />
        <div className="flex-1 min-w-0 flex flex-col justify-end gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t(`mp.kind.${collection.kind}`)}</span>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 truncate">{collection.title}</h2>
          {collection.description && <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">{collection.description}</p>}
          <div className="text-sm text-gray-500">
            {[collectionArtist(collection), collection.release_year, t('mp.collections.songCount').replace('{n}', String(songs.length)), formatDuration(total)].filter(Boolean).join(' · ')}
          </div>
          <div className="text-xs text-gray-500">
            {[
              collection.source && `${t(`mp.sourceKinds.${collection.source.kind}`)}: ${collection.source.name}`,
              collection.country?.name,
              collection.languages.map(l => l.language?.name).filter(Boolean).join(', '),
            ].filter(Boolean).join(' · ')}
          </div>
          {collection.kind === 'album' && (
            <MpStars stat={albumRating.stats[collection.id]} mine={albumRating.mine[collection.id]} onRate={n => void albumRating.rate(collection.id, n)} size={18} />
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={() => player.playList(songs)} disabled={!songs.length}><Play size={16} className="mr-1" fill="currentColor" />{t('mp.playAll')}</Button>
            <Button variant="outline" disabled={!songs.length} onClick={() => { player.setShuffle(true); player.playList(songs, Math.floor(Math.random() * songs.length)); }}>
              <Shuffle size={16} className="mr-1" />{t('mp.shufflePlay')}
            </Button>
            {mine && (
              <>
                <Button variant="outline" onClick={() => setAdding(a => !a)} disabled={full && !adding} title={full ? t('mp.collections.full') : undefined}><Plus size={16} className="mr-1" />{t('mp.collections.addSongs')}</Button>
                <Button variant="ghost" onClick={() => setEditing(true)}><Pencil size={15} /></Button>
                <Button variant="ghost" onClick={() => setConfirmDelete(true)}><Trash2 size={15} className="text-danger" /></Button>
              </>
            )}
          </div>
        </div>
      </div>

      {adding && mine && (
        <div className={`${card} p-4 space-y-3`}>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('mp.collections.findSongs')}</h3>
            <button className="p-1 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700" onClick={() => setAdding(false)}><X size={16} /></button>
          </div>
          {full && <p className="text-sm rounded-md bg-warning/10 border border-warning/30 text-warning px-3 py-2">{t('mp.collections.full')}</p>}
          <MpSongFilterBar value={filters} onChange={setFilters} genres={genres} showCollection={false} />
          <ul className="divide-y divide-gray-100 dark:divide-gray-700 max-h-80 overflow-y-auto">
            {found.length === 0 && <li className="p-3 text-sm text-gray-500">{t('pf.common.empty')}</li>}
            {found.map(s => (
              <li key={s.id} className="flex items-center gap-3 py-2">
                <MpCover url={s.cover?.url} color={s.genre?.color} className="w-9 h-9" rounded="rounded" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate text-gray-900 dark:text-gray-100">{s.title}</div>
                  <div className="text-xs text-gray-500 truncate">{songArtist(s) || t('mp.unknownArtist')}{s.genre ? ` · ${s.genre.name}` : ''}</div>
                </div>
                {inIt.has(s.id)
                  ? <span className="text-xs text-gray-400">{t('mp.collections.added')}</span>
                  : <Button size="sm" variant="outline" onClick={() => void addSong(s)} disabled={full}><Plus size={13} className="mr-1" />{t('pf.common.add')}</Button>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={`${card} overflow-hidden`}>
        {links.length === 0 ? (
          <div className="p-12 text-center text-gray-500">{t('mp.collections.noSongs')}</div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {links.map((l, i) => {
              const s = l.song;
              const isCurrent = player.current?.id === s.id;
              return (
                <li key={l.id} className={`flex items-center gap-3 px-4 py-2.5 ${isCurrent ? 'bg-primary/5' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}>
                  <span className="w-6 text-center text-xs tabular-nums text-gray-400">{isCurrent ? <MpPlayingBars active={player.playing} /> : i + 1}</span>
                  <MpCover url={s.cover?.url} color={s.genre?.color} className="w-10 h-10" rounded="rounded-md" />
                  <MpPlayButton song={s} list={songs} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-semibold truncate ${isCurrent ? 'text-primary' : 'text-gray-900 dark:text-gray-100'}`}>{s.title}</div>
                    <div className="text-xs text-gray-500 truncate">{songArtist(s) || t('mp.unknownArtist')}</div>
                  </div>
                  <span className="text-xs tabular-nums text-gray-500">{formatDuration(s.duration_seconds)}</span>
                  {mine && (
                    <div className="flex">
                      <button className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30" disabled={busy || i === 0} onClick={() => void move(i, -1)}><ArrowUp size={15} /></button>
                      <button className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30" disabled={busy || i === links.length - 1} onClick={() => void move(i, 1)}><ArrowDown size={15} /></button>
                      <button className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700" onClick={() => void removeLink(l)} title={t('mp.collections.removeSong')}><X size={15} className="text-danger" /></button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {editing && userId && <CollectionForm userId={userId} collection={collection} onClose={() => setEditing(false)} onSaved={async () => { setEditing(false); await load(); }} />}
      <Modal isOpen={confirmDelete} onClose={() => setConfirmDelete(false)} title={t('pf.common.deleteTitle')}>
        <div className="space-y-4">
          <div className="flex items-start gap-3 bg-danger/5 border border-danger/20 rounded-lg p-4 text-sm text-gray-700 dark:text-gray-300">
            <AlertTriangle size={20} className="text-danger shrink-0" />{t('mp.collections.deleteHint').replace('{title}', collection.title)}
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>{t('pf.common.cancel')}</Button>
            <Button variant="danger" onClick={() => void removeCollection()}>{t('pf.common.delete')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
