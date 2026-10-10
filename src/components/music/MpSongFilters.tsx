import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { MOODS, SONG_SELECT, SOURCE_KINDS, useMpLookups, type MpGenre, type MpSong } from '../../lib/music';
import { pfInputClass } from '../portfolio/PfFieldInput';

export type SongFilters = {
  search: string; genreId: string; countryId: string; languageId: string; singerId: string; mood: string;
  price: '' | 'free' | 'paid'; collectionId: string;
  sourceKind: string; sourceId: string; info: '' | 'pending' | 'complete';
};
export const EMPTY_FILTERS: SongFilters = {
  search: '', genreId: '', countryId: '', languageId: '', singerId: '', mood: '', price: '', collectionId: '',
  sourceKind: '', sourceId: '', info: '',
};

/** Filter value for "no singer / no source / in no album": the Unknown groups. */
export const UNKNOWN = 'none';

/** Ids of songs that have a singer / are in an album (the complement is the Unknown group). */
async function songIdsWithSinger(): Promise<string[]> {
  const { data, error } = await supabase.from('mp_song_singers').select('song_id');
  if (error) throw error;
  return [...new Set((data ?? []).map(r => r.song_id as string))];
}
async function songIdsInAlbums(): Promise<string[]> {
  const { data, error } = await supabase.from('mp_collection_songs').select('song_id, c:mp_collections!inner(kind)').eq('c.kind', 'album');
  if (error) throw error;
  return [...new Set((data ?? []).map(r => r.song_id as string))];
}

/** How many songs have no singer, no source, or are in no album. */
export async function countUnknown(what: 'singer' | 'source' | 'album'): Promise<number> {
  let q = supabase.from('mp_songs').select('id', { count: 'exact', head: true });
  if (what === 'source') q = q.is('source_id', null);
  else {
    const ids = what === 'singer' ? await songIdsWithSinger() : await songIdsInAlbums();
    if (ids.length) q = q.not('id', 'in', `(${ids.join(',')})`);
  }
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

/** Ids of the songs sung by any of these singers. */
async function songIdsBySingers(singerIds: string[]): Promise<string[]> {
  if (!singerIds.length) return [];
  const { data, error } = await supabase.from('mp_song_singers').select('song_id').in('singer_id', singerIds);
  if (error) throw error;
  return [...new Set((data ?? []).map(r => r.song_id as string))];
}

const sel = `${pfInputClass.replace('w-full ', '')} h-9 max-w-44`;

/**
 * One page of songs matching the filters, newest first (server-side).
 * Returns the rows and the total count.
 */
export async function fetchSongs(f: SongFilters, from: number, size: number): Promise<{ rows: MpSong[]; total: number }> {
  // Filtering by album / mix (or by source kind) needs that table joined in (inner join).
  let select = SONG_SELECT;
  if (f.collectionId && f.collectionId !== UNKNOWN) select += ', mp_collection_songs!inner(collection_id)';
  if (f.sourceKind && !f.sourceId) select += ', src:mp_sources!mp_songs_source_fkey!inner(kind)';
  let q = supabase.from('mp_songs').select(select, { count: 'exact' });
  if (f.collectionId === UNKNOWN) {
    const ids = await songIdsInAlbums();
    if (ids.length) q = q.not('id', 'in', `(${ids.join(',')})`);
  } else if (f.collectionId) q = q.eq('mp_collection_songs.collection_id', f.collectionId);
  if (f.sourceId === UNKNOWN) q = q.is('source_id', null);
  else if (f.sourceId) q = q.eq('source_id', f.sourceId);
  else if (f.sourceKind) q = q.eq('src.kind', f.sourceKind);
  if (f.info) q = q.eq('info_pending', f.info === 'pending');
  const s = f.search.trim().replace(/[,()%*]/g, ' ').trim();
  if (s) {
    // Title, or sung by a singer whose name matches.
    const { data: hit } = await supabase.from('mp_singers').select('id').ilike('name', `%${s}%`);
    const ids = await songIdsBySingers((hit ?? []).map(r => r.id as string));
    q = q.or(ids.length ? `title.ilike.%${s}%,id.in.(${ids.join(',')})` : `title.ilike.%${s}%`);
  }
  if (f.singerId === UNKNOWN) {
    const ids = await songIdsWithSinger();
    if (ids.length) q = q.not('id', 'in', `(${ids.join(',')})`);
  } else if (f.singerId) {
    const ids = await songIdsBySingers([f.singerId]);
    if (!ids.length) return { rows: [], total: 0 };
    q = q.in('id', ids);
  }
  if (f.genreId) q = q.eq('genre_id', f.genreId);
  if (f.countryId) q = q.eq('country_id', f.countryId);
  if (f.languageId) q = q.eq('language_id', f.languageId);
  if (f.mood) q = q.eq('mood', f.mood);
  if (f.price) q = q.eq('is_free', f.price === 'free');
  const { data, count, error } = await q.order('created_at', { ascending: false }).range(from, from + size - 1);
  if (error) throw error;
  return { rows: (data ?? []) as unknown as MpSong[], total: count ?? 0 };
}

/** Search + genre / singer / source / country / language / mood / free-paid / info / album-mix selects. */
export const MpSongFilterBar = ({ value, onChange, genres, showCollection = true }: {
  value: SongFilters;
  onChange: (f: SongFilters) => void;
  genres: MpGenre[];
  showCollection?: boolean;
}) => {
  const { t } = useLanguage();
  const [search, setSearch] = useState(value.search);
  const lookups = useMpLookups();
  const [used, setUsed] = useState<{ countries: Set<string>; languages: Set<string> }>({ countries: new Set(), languages: new Set() });
  const [collections, setCollections] = useState<{ id: string; kind: string; title: string }[]>([]);

  // Only offer countries / languages that actually occur in the library.
  useEffect(() => {
    void supabase.from('mp_songs').select('country_id, language_id').then(({ data }) => {
      const uniq = (k: 'country_id' | 'language_id') => new Set((data ?? []).map(r => r[k]).filter(Boolean) as string[]);
      setUsed({ countries: uniq('country_id'), languages: uniq('language_id') });
    });
    if (showCollection) void supabase.from('mp_collections').select('id, kind, title').order('title').then(({ data }) => setCollections(data ?? []));
  }, [showCollection]);

  // Type, then a short pause, then search.
  useEffect(() => {
    const id = setTimeout(() => { if (search !== value.search) onChange({ ...value, search }); }, 350);
    return () => clearTimeout(id);
  }, [search, value, onChange]);

  const set = (k: keyof SongFilters, v: string) => onChange({ ...value, [k]: v });
  const sources = lookups.sources.filter(o => !value.sourceKind || o.kind === value.sourceKind);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-48">
        <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('mp.searchSongs')} className={`${pfInputClass} h-9 pl-8`} />
      </div>
      <select value={value.genreId} onChange={e => set('genreId', e.target.value)} className={sel} aria-label={t('mp.genre')}>
        <option value="">{t('mp.allGenres')}</option>
        {genres.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
      </select>
      <select value={value.singerId} onChange={e => set('singerId', e.target.value)} className={sel} aria-label={t('mp.singer')}>
        <option value="">{t('mp.allSingers')}</option>
        <option value={UNKNOWN}>{t('mp.unknown.singer')}</option>
        {lookups.singers.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
      <select value={value.sourceKind} onChange={e => onChange({ ...value, sourceKind: e.target.value, sourceId: '' })} className={sel} aria-label={t('mp.sources.kind')}>
        <option value="">{t('mp.allSourceKinds')}</option>
        {SOURCE_KINDS.map(k => <option key={k} value={k}>{t(`mp.sourceKinds.${k}`)}</option>)}
      </select>
      <select value={value.sourceId} onChange={e => set('sourceId', e.target.value)} className={sel} aria-label={t('mp.source')}>
        <option value="">{t('mp.allSources')}</option>
        <option value={UNKNOWN}>{t('mp.unknown.source')}</option>
        {sources.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
      <select value={value.countryId} onChange={e => set('countryId', e.target.value)} className={sel} aria-label={t('mp.country')}>
        <option value="">{t('mp.allCountries')}</option>
        {lookups.countries.filter(o => used.countries.has(o.id) || o.id === value.countryId).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
      <select value={value.languageId} onChange={e => set('languageId', e.target.value)} className={sel} aria-label={t('mp.language')}>
        <option value="">{t('mp.allLanguages')}</option>
        {lookups.languages.filter(o => used.languages.has(o.id) || o.id === value.languageId).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
      <select value={value.mood} onChange={e => set('mood', e.target.value)} className={sel} aria-label={t('mp.mood')}>
        <option value="">{t('mp.allMoods')}</option>
        {MOODS.map(m => <option key={m} value={m}>{t(`mp.moods.${m}`)}</option>)}
      </select>
      <select value={value.price} onChange={e => set('price', e.target.value)} className={sel} aria-label={t('mp.price')}>
        <option value="">{t('mp.freeAndPaid')}</option>
        <option value="free">{t('mp.free')}</option>
        <option value="paid">{t('mp.paid')}</option>
      </select>
      <select value={value.info} onChange={e => set('info', e.target.value)} className={sel} aria-label={t('mp.info.label')}>
        <option value="">{t('mp.info.any')}</option>
        <option value="pending">{t('mp.info.pending')}</option>
        <option value="complete">{t('mp.info.complete')}</option>
      </select>
      {showCollection && (
        <select value={value.collectionId} onChange={e => set('collectionId', e.target.value)} className={sel} aria-label={t('mp.collection')}>
          <option value="">{t('mp.allCollections')}</option>
          <option value={UNKNOWN}>{t('mp.unknown.album')}</option>
          {collections.map(c => <option key={c.id} value={c.id}>{c.kind === 'album' ? '💿' : '🎧'} {c.title}</option>)}
        </select>
      )}
    </div>
  );
};
