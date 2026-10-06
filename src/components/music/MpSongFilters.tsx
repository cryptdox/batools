import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { MOODS, SONG_SELECT, type MpGenre, type MpSong } from '../../lib/music';
import { pfInputClass } from '../portfolio/PfFieldInput';

export type SongFilters = {
  search: string; genreId: string; origin: string; language: string; mood: string;
  price: '' | 'free' | 'paid'; collectionId: string;
};
export const EMPTY_FILTERS: SongFilters = { search: '', genreId: '', origin: '', language: '', mood: '', price: '', collectionId: '' };

const sel = `${pfInputClass.replace('w-full ', '')} h-9 max-w-44`;

/**
 * One page of songs matching the filters, newest first (server-side).
 * Returns the rows and the total count.
 */
export async function fetchSongs(f: SongFilters, from: number, size: number): Promise<{ rows: MpSong[]; total: number }> {
  // Filtering by album / mix needs the link table joined in (inner join).
  const select = f.collectionId ? `${SONG_SELECT}, mp_collection_songs!inner(collection_id)` : SONG_SELECT;
  let q = supabase.from('mp_songs').select(select, { count: 'exact' });
  if (f.collectionId) q = q.eq('mp_collection_songs.collection_id', f.collectionId);
  const s = f.search.trim().replace(/[,()]/g, ' ');
  if (s) q = q.or(`title.ilike.%${s}%,artist.ilike.%${s}%`);
  if (f.genreId) q = q.eq('genre_id', f.genreId);
  if (f.origin) q = q.eq('origin', f.origin);
  if (f.language) q = q.eq('language', f.language);
  if (f.mood) q = q.eq('mood', f.mood);
  if (f.price) q = q.eq('is_free', f.price === 'free');
  const { data, count, error } = await q.order('created_at', { ascending: false }).range(from, from + size - 1);
  if (error) throw error;
  return { rows: (data ?? []) as unknown as MpSong[], total: count ?? 0 };
}

/** Search + genre / origin / language / mood / free-paid / album-mix selects. */
export const MpSongFilterBar = ({ value, onChange, genres, showCollection = true }: {
  value: SongFilters;
  onChange: (f: SongFilters) => void;
  genres: MpGenre[];
  showCollection?: boolean;
}) => {
  const { t } = useLanguage();
  const [search, setSearch] = useState(value.search);
  const [origins, setOrigins] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [collections, setCollections] = useState<{ id: string; kind: string; title: string }[]>([]);

  // Options that actually occur in the library.
  useEffect(() => {
    void supabase.from('mp_songs').select('origin, language').then(({ data }) => {
      const uniq = (k: 'origin' | 'language') => [...new Set((data ?? []).map(r => r[k]).filter(Boolean) as string[])].sort();
      setOrigins(uniq('origin'));
      setLanguages(uniq('language'));
    });
    if (showCollection) void supabase.from('mp_collections').select('id, kind, title').order('title').then(({ data }) => setCollections(data ?? []));
  }, [showCollection]);

  // Type, then a short pause, then search.
  useEffect(() => {
    const id = setTimeout(() => { if (search !== value.search) onChange({ ...value, search }); }, 350);
    return () => clearTimeout(id);
  }, [search, value, onChange]);

  const set = (k: keyof SongFilters, v: string) => onChange({ ...value, [k]: v });

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
      <select value={value.origin} onChange={e => set('origin', e.target.value)} className={sel} aria-label={t('mp.origin')}>
        <option value="">{t('mp.allOrigins')}</option>
        {origins.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <select value={value.language} onChange={e => set('language', e.target.value)} className={sel} aria-label={t('mp.language')}>
        <option value="">{t('mp.allLanguages')}</option>
        {languages.map(o => <option key={o} value={o}>{o}</option>)}
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
      {showCollection && (
        <select value={value.collectionId} onChange={e => set('collectionId', e.target.value)} className={sel} aria-label={t('mp.collection')}>
          <option value="">{t('mp.allCollections')}</option>
          {collections.map(c => <option key={c.id} value={c.id}>{c.kind === 'album' ? '💿' : '🎧'} {c.title}</option>)}
        </select>
      )}
    </div>
  );
};
