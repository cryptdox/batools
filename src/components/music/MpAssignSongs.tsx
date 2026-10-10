import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { Search, Lock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { errorMessage } from '../../lib/portfolio';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { pfInputClass } from '../portfolio/PfFieldInput';

type SongRow = {
  id: string; title: string; release_year: number | null; uploaded_by: string;
  singers: { singer_id: string; position: number; singer: { name: string } | null }[];
};

const SHOWN = 50;

/**
 * Assign songs to a singer: tick songs to link them (the singer goes after the
 * song's current singers), untick to unlink. Like the song form, only songs you
 * uploaded can be changed; others already linked are listed, locked.
 */
export const MpAssignSongs = ({ userId, singer, onClose, onDone }: {
  userId: string;
  singer: { id: string; name: string };
  onClose: () => void;
  onDone: () => void;
}) => {
  const { t } = useLanguage();
  const [songs, setSongs] = useState<SongRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [initial, setInitial] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase.from('mp_songs')
        .select('id, title, release_year, uploaded_by, singers:mp_song_singers(singer_id, position, singer:mp_singers(name))')
        .order('title');
      if (error) toast.error(errorMessage(error, t('pf.common.loadError')));
      const rows = (data ?? []) as unknown as SongRow[];
      const linked = new Set(rows.filter(s => s.singers.some(x => x.singer_id === singer.id)).map(s => s.id));
      setSongs(rows);
      setPicked(linked);
      setInitial(linked);
      setLoading(false);
    })();
  }, [singer.id, t]);

  const needle = search.trim().toLowerCase();
  // Linked songs first, then the rest; filtered by title or singer names.
  const list = useMemo(() => songs
    .filter(s => !needle || s.title.toLowerCase().includes(needle) || s.singers.some(x => x.singer?.name.toLowerCase().includes(needle)))
    .sort((a, b) => Number(initial.has(b.id)) - Number(initial.has(a.id))), [songs, needle, initial]);
  const shown = list.slice(0, SHOWN);

  const toggle = (id: string) => setPicked(p => { const n = new Set(p); if (!n.delete(id)) n.add(id); return n; });
  const add = [...picked].filter(id => !initial.has(id));
  const drop = [...initial].filter(id => !picked.has(id));

  const save = async () => {
    setSaving(true);
    try {
      if (add.length) {
        const rows = add.map(id => {
          const s = songs.find(x => x.id === id);
          const last = Math.max(0, ...(s?.singers.map(x => x.position) ?? []));
          return { song_id: id, singer_id: singer.id, position: last + 1 };
        });
        const { error } = await supabase.from('mp_song_singers').insert(rows);
        if (error) throw error;
      }
      if (drop.length) {
        const { error } = await supabase.from('mp_song_singers').delete().eq('singer_id', singer.id).in('song_id', drop);
        if (error) throw error;
      }
      toast.success(t('mp.assign.saved').replace('{added}', String(add.length)).replace('{removed}', String(drop.length)));
      onDone();
    } catch (e) {
      toast.error(errorMessage(e, t('pf.common.saveError')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={() => !saving && onClose()} title={t('mp.assign.title').replace('{name}', singer.name)} className="max-w-2xl">
      <div className="space-y-3">
        <p className="text-sm text-gray-600 dark:text-gray-300">{t('mp.assign.hint')}</p>
        <div className="relative">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder={t('mp.assign.search')} className={`${pfInputClass} h-9 pl-8`} />
        </div>
        {loading ? (
          <p className="p-6 text-center text-sm text-gray-500">{t('pf.common.loading')}</p>
        ) : (
          <ul className="max-h-[55vh] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700 rounded-lg border border-gray-200 dark:border-gray-700">
            {shown.map(s => {
              const mine = s.uploaded_by === userId;
              const others = s.singers.filter(x => x.singer_id !== singer.id).sort((a, b) => a.position - b.position).map(x => x.singer?.name).filter(Boolean);
              return (
                <li key={s.id}>
                  <label className={`flex items-center gap-3 px-3 py-2 ${mine ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40' : 'opacity-60'}`}
                    title={mine ? undefined : t('mp.assign.notYours')}>
                    <input type="checkbox" checked={picked.has(s.id)} disabled={!mine || saving} onChange={() => toggle(s.id)} className="w-4 h-4 text-primary rounded border-gray-300 shrink-0" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-gray-900 dark:text-gray-100 truncate" title={s.title}>{s.title}</span>
                      <span className="block text-[11px] text-gray-500 truncate">
                        {[others.join(', '), s.release_year].filter(Boolean).join(' · ') || '—'}
                      </span>
                    </span>
                    {!mine && <Lock size={13} className="text-gray-400 shrink-0" />}
                  </label>
                </li>
              );
            })}
            {list.length === 0 && <li className="px-3 py-6 text-center text-sm text-gray-500">{t('pf.common.empty')}</li>}
            {list.length > SHOWN && <li className="px-3 py-2 text-xs text-gray-500">{t('mp.assign.more').replace('{n}', String(list.length - SHOWN))}</li>}
          </ul>
        )}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <span className="mr-auto text-sm text-gray-500">
            {t('mp.assign.count').replace('{n}', String(picked.size))}
            {(add.length > 0 || drop.length > 0) && <span className="text-primary"> · +{add.length} / −{drop.length}</span>}
          </span>
          <Button variant="ghost" onClick={onClose} disabled={saving}>{t('pf.common.cancel')}</Button>
          <Button onClick={() => void save()} disabled={saving || (add.length === 0 && drop.length === 0)}>{saving ? t('pf.common.saving') : t('pf.common.save')}</Button>
        </div>
      </div>
    </Modal>
  );
};
