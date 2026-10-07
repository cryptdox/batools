import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Upload, Play, ListPlus, ListEnd, Pencil, Trash2, AlertTriangle, Music } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { errorMessage } from '../../lib/portfolio';
import { deleteMusicFile, formatDuration, songArtist, useMpGenres, useMpRatings, useMpUserId, type MpSong } from '../../lib/music';
import { usePlayer } from '../../lib/MusicPlayerContext';
import { Badge, Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';
import { MpCover, MpPlayButton, MpPlayingBars, MpStars } from '../../components/music/MpUi';
import { MpSongForm } from '../../components/music/MpSongForm';
import { EMPTY_FILTERS, fetchSongs, MpSongFilterBar, type SongFilters } from '../../components/music/MpSongFilters';
import { PfPageHeader } from '../Portfolio/PfPageHeader';

const card = 'bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700';
const iconBtn = 'p-1.5 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700';

/** Every uploaded song: filter, page, play, and upload / edit your own. */
export const MpLibrary = () => {
  const { t } = useLanguage();
  const userId = useMpUserId();
  const { genres } = useMpGenres();
  const player = usePlayer();
  // /mp?singer=<id> opens the library filtered to that singer (from the Singers page).
  const [params] = useSearchParams();
  const [filters, setFilters] = useState<SongFilters>(() => ({ ...EMPTY_FILTERS, singerId: params.get('singer') ?? '' }));
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(25);
  const [rows, setRows] = useState<MpSong[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<MpSong | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<MpSong | null>(null);
  const [deleting, setDeleting] = useState(false);
  const ratings = useMpRatings('song', rows.map(r => r.id), userId);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchSongs(filters, (page - 1) * size, size);
      setRows(res.rows);
      setTotal(res.total);
    } catch (e) {
      toast.error(errorMessage(e, t('pf.common.loadError')));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, page, size]);

  useEffect(() => { void load(); }, [load]);

  const changeFilters = useCallback((f: SongFilters) => { setFilters(f); setPage(1); }, []);

  const remove = async () => {
    if (!toDelete || !userId) return;
    setDeleting(true);
    const { error } = await supabase.from('mp_songs').delete().eq('id', toDelete.id).eq('uploaded_by', userId);
    if (!error) { await deleteMusicFile(toDelete.audio); await deleteMusicFile(toDelete.cover); }
    setDeleting(false);
    if (error) return toast.error(errorMessage(error, t('pf.common.deleteError')));
    setToDelete(null);
    toast.success(t('pf.common.deleted'));
    await load();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PfPageHeader
        title="mp.library.pageTitle"
        subtitle="mp.library.pageSubtitle"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => player.playList(rows)} disabled={!rows.length}><Play size={16} className="mr-1" />{t('mp.playAll')}</Button>
            <Button onClick={() => setForm('new')}><Upload size={16} className="mr-1" />{t('mp.form.upload')}</Button>
          </div>
        }
      />

      <div className={`${card} p-4`}>
        <MpSongFilterBar value={filters} onChange={changeFilters} genres={genres} />
      </div>

      <div className={`${card} overflow-hidden`}>
        {loading ? (
          <div className="p-12 text-center text-gray-500">{t('pf.common.loading')}</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-gray-500 space-y-3">
            <Music size={32} className="mx-auto text-gray-400" />
            <p>{total === 0 && JSON.stringify(filters) === JSON.stringify(EMPTY_FILTERS) ? t('mp.library.empty') : t('pf.common.empty')}</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {rows.map((s, i) => {
              const isCurrent = player.current?.id === s.id;
              const mine = s.uploaded_by === userId;
              return (
                <li key={s.id} className={`flex items-center gap-3 px-4 py-2.5 ${isCurrent ? 'bg-primary/5' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}>
                  <span className="w-6 text-center text-xs tabular-nums text-gray-400 shrink-0">
                    {isCurrent ? <MpPlayingBars active={player.playing} /> : (page - 1) * size + i + 1}
                  </span>
                  <MpCover url={s.cover?.url} color={s.genre?.color} className="w-11 h-11" rounded="rounded-md" alt={s.title} />
                  <MpPlayButton song={s} list={rows} size={34} />
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-semibold truncate ${isCurrent ? 'text-primary' : 'text-gray-900 dark:text-gray-100'}`}>{s.title}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {[songArtist(s) || t('mp.unknownArtist'), s.country?.name, s.language?.name, s.release_year].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div className="hidden md:flex items-center gap-1.5 shrink-0">
                    {s.genre && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">
                        <span className="w-2 h-2 rounded-full" style={{ background: s.genre.color }} />{s.genre.name}
                      </span>
                    )}
                    {s.mood && <Badge variant="muted">{t(`mp.moods.${s.mood}`)}</Badge>}
                    {s.is_free ? <Badge variant="success">{t('mp.free')}</Badge> : <Badge variant="warning">{t('mp.paid')}</Badge>}
                  </div>
                  <MpStars className="hidden sm:inline-flex shrink-0" stat={ratings.stats[s.id]} mine={ratings.mine[s.id]} onRate={n => void ratings.rate(s.id, n)} size={13} />
                  <span className="hidden sm:block w-12 text-right text-xs tabular-nums text-gray-500 shrink-0">{formatDuration(s.duration_seconds)}</span>
                  <span className="hidden lg:block w-14 text-right text-[11px] tabular-nums text-gray-400 shrink-0" title={t('mp.plays')}>▶ {s.play_count}</span>
                  <div className="flex items-center shrink-0">
                    <button className={iconBtn} onClick={() => player.playNext(s)} title={t('mp.playNext')}><ListPlus size={16} /></button>
                    <button className={iconBtn} onClick={() => player.addToQueue(s)} title={t('mp.addToQueue')}><ListEnd size={16} /></button>
                    {mine && (
                      <>
                        <button className={iconBtn} onClick={() => setForm(s)} title={t('pf.common.edit')}><Pencil size={15} /></button>
                        <button className={iconBtn} onClick={() => setToDelete(s)} title={t('pf.common.delete')}><Trash2 size={15} className="text-danger" /></button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <Pagination
          page={page}
          pageCount={Math.max(1, Math.ceil(total / size))}
          total={total}
          pageSize={size}
          onPageChange={setPage}
          onPageSizeChange={n => { setSize(n); setPage(1); }}
        />
      </div>

      {form && userId && (
        <MpSongForm
          userId={userId}
          song={form === 'new' ? null : form}
          genres={genres}
          onClose={() => setForm(null)}
          onSaved={async () => { setForm(null); await load(); }}
        />
      )}

      <Modal isOpen={!!toDelete} onClose={() => !deleting && setToDelete(null)} title={t('pf.common.deleteTitle')}>
        {toDelete && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-danger/5 border border-danger/20 rounded-lg p-4 text-sm text-gray-700 dark:text-gray-300">
              <AlertTriangle size={20} className="text-danger shrink-0" />
              {t('mp.library.deleteHint').replace('{title}', toDelete.title)}
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setToDelete(null)} disabled={deleting}>{t('pf.common.cancel')}</Button>
              <Button variant="danger" onClick={() => void remove()} disabled={deleting}>{deleting ? t('pf.common.deleting') : t('pf.common.delete')}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
