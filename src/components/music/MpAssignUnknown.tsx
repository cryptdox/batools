import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { Search, Lock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { errorMessage } from '../../lib/portfolio';
import { useMpLookups, type MpSong } from '../../lib/music';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { pfInputClass } from '../portfolio/PfFieldInput';
import { addSongToCollections, loadCollections, MpCollectionPicker, MpSingerPicker, MpSourcePicker, type CollectionRef } from './MpSongForm';
import { EMPTY_FILTERS, fetchSongs, UNKNOWN } from './MpSongFilters';

type What = 'singer' | 'source' | 'album';
const label = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5';
const LOAD_MAX = 500;
const SHOWN = 100;

/**
 * Give songs that have no singer / source / album one in bulk: pick the
 * singer(s), source, or album(s) / mix(es), tick the songs, save. Singers and
 * sources change the song itself, so (like the song form) only songs you
 * uploaded can take them; any song can be put in an album or mix.
 */
export const MpAssignUnknown = ({ what, userId, onClose, onDone }: {
  what: What; userId: string; onClose: () => void; onDone: () => void;
}) => {
  const { t } = useLanguage();
  const { singers, setSingers, sources, setSources } = useMpLookups();
  const [songs, setSongs] = useState<MpSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [singerIds, setSingerIds] = useState<string[]>([]);
  const [sourceId, setSourceId] = useState('');
  const [collections, setCollections] = useState<CollectionRef[]>([]);
  const [targets, setTargets] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const filter = what === 'singer' ? { singerId: UNKNOWN } : what === 'source' ? { sourceId: UNKNOWN } : { collectionId: UNKNOWN };
    void fetchSongs({ ...EMPTY_FILTERS, ...filter }, 0, LOAD_MAX)
      .then(r => setSongs(r.rows))
      .catch(e => toast.error(errorMessage(e, t('pf.common.loadError'))))
      .finally(() => setLoading(false));
    if (what === 'album') void loadCollections().then(setCollections);
  }, [what, t]);

  const editable = (s: MpSong) => what === 'album' || s.uploaded_by === userId;
  const needle = search.trim().toLowerCase();
  const list = useMemo(() => songs.filter(s => !needle || s.title.toLowerCase().includes(needle)), [songs, needle]);
  const shown = list.slice(0, SHOWN);
  const selectable = list.filter(editable);
  const allPicked = selectable.length > 0 && selectable.every(s => picked.has(s.id));

  const toggle = (id: string) => setPicked(p => { const n = new Set(p); if (!n.delete(id)) n.add(id); return n; });
  const toggleAll = () => setPicked(p => {
    const n = new Set(p);
    for (const s of selectable) { if (allPicked) n.delete(s.id); else n.add(s.id); }
    return n;
  });

  const target = what === 'singer' ? singerIds.length > 0 : what === 'source' ? !!sourceId : targets.size > 0;

  const save = async () => {
    const ids = [...picked];
    if (!ids.length || !target) return;
    setSaving(true);
    try {
      if (what === 'singer') {
        const { error } = await supabase.from('mp_song_singers')
          .insert(ids.flatMap(song_id => singerIds.map((singer_id, i) => ({ song_id, singer_id, position: i + 1 }))));
        if (error) throw error;
      } else if (what === 'source') {
        const { error } = await supabase.from('mp_songs').update({ source_id: sourceId, updated_at: new Date().toISOString() })
          .in('id', ids).eq('uploaded_by', userId);
        if (error) throw error;
      } else {
        // Albums / mixes hold at most 20 songs: say once per one that ran full.
        const full = new Set<string>();
        for (const id of ids) {
          for (const f of await addSongToCollections(id, [...targets], userId, collections)) {
            if (f.full ? full.has(f.title) : false) continue;
            if (f.full) full.add(f.title);
            toast.warning(`${f.title}: ${f.full ? t('mp.collections.full') : f.message}`);
          }
        }
      }
      toast.success(t('mp.unknown.assigned').replace('{n}', String(ids.length)));
      onDone();
    } catch (e) {
      toast.error(errorMessage(e, t('pf.common.saveError')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={() => !saving && onClose()} title={t(`mp.unknown.assignTitle.${what}`)} className="max-w-2xl">
      <div className="space-y-4">
        <div>
          <span className={label}>{t(`mp.unknown.target.${what}`)}</span>
          {what === 'singer' && <MpSingerPicker userId={userId} singers={singers} onSingersChange={setSingers} value={singerIds} onChange={setSingerIds} />}
          {what === 'source' && <MpSourcePicker userId={userId} sources={sources} onSourcesChange={setSources} value={sourceId} onChange={setSourceId} />}
          {what === 'album' && <MpCollectionPicker userId={userId} collections={collections} onCollectionsChange={setCollections} picked={targets} onPickedChange={setTargets} />}
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('mp.unknown.searchSongs')} className={`${pfInputClass} h-9 pl-8`} />
            </div>
            <Button size="sm" variant="outline" type="button" disabled={!selectable.length} onClick={toggleAll}>
              {allPicked ? t('mp.unknown.selectNone') : t('mp.unknown.selectAll')}
            </Button>
          </div>
          {what !== 'album' && <p className="text-xs text-gray-500">{t('mp.unknown.ownOnly')}</p>}
          {loading ? (
            <p className="p-6 text-center text-sm text-gray-500">{t('pf.common.loading')}</p>
          ) : (
            <ul className="max-h-[45vh] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700 rounded-lg border border-gray-200 dark:border-gray-700">
              {shown.map(s => {
                const ok = editable(s);
                return (
                  <li key={s.id}>
                    <label className={`flex items-center gap-3 px-3 py-2 ${ok ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40' : 'opacity-60'}`} title={ok ? undefined : t('mp.assign.notYours')}>
                      <input type="checkbox" checked={picked.has(s.id)} disabled={!ok || saving} onChange={() => toggle(s.id)} className="w-4 h-4 text-primary rounded border-gray-300 shrink-0" />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-gray-900 dark:text-gray-100 truncate" title={s.title}>{s.title}</span>
                        <span className="block text-[11px] text-gray-500 truncate">{[s.release_year, s.genre?.name].filter(Boolean).join(' · ') || '—'}</span>
                      </span>
                      {!ok && <Lock size={13} className="text-gray-400 shrink-0" />}
                    </label>
                  </li>
                );
              })}
              {list.length === 0 && <li className="px-3 py-6 text-center text-sm text-gray-500">{t('pf.common.empty')}</li>}
              {list.length > SHOWN && <li className="px-3 py-2 text-xs text-gray-500">{t('mp.assign.more').replace('{n}', String(list.length - SHOWN))}</li>}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <span className="mr-auto text-sm text-gray-500">{t('mp.unknown.selected').replace('{n}', String(picked.size))}</span>
          <Button variant="ghost" onClick={onClose} disabled={saving}>{t('pf.common.cancel')}</Button>
          <Button onClick={() => void save()} disabled={saving || !picked.size || !target}>{saving ? t('pf.common.saving') : t('mp.unknown.assign')}</Button>
        </div>
      </div>
    </Modal>
  );
};
